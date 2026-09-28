import prisma from '@/shared/database/prisma';
import config from '@/config';
import { AppError, BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { buildPayslipBreakdown } from '@/shared/payroll/payslip-breakdown';
import {
  createSelfPayslipUnlockToken,
  isValidPayslipPin,
  pinLockRemainingSeconds,
  registerFailedPinAttempt,
  resetPinLockState,
  verifySelfPayslipUnlockToken,
} from '@/shared/payroll/payslip-pin';

/**
 * PIN slip gaji self-service.
 *
 * Terpisah dari PayrollUnlockService (jalur admin): sesi payroll-unlock adalah
 * bukti reauthentikasi password(+TOTP). Unlock PIN memakai token HMAC pendek
 * (header X-Payslip-Unlock) yang hanya membuka slip milik sendiri, sehingga
 * PIN 6 digit tidak pernah diterima di jalur X-Payroll-Unlock-Token dan
 * sebaliknya. PIN mentah tidak pernah di-log ataupun disimpan — hanya hash
 * argon2id di kolom users.payslip_pin_hash.
 */

type SelfPayslipActor = {
  id: string;
  employeeId?: string;
  companyId?: string;
};

function pinLockedError(lockedUntil: Date, now: Date): AppError {
  const remainingMinutes = Math.max(1, Math.ceil(pinLockRemainingSeconds(lockedUntil, now) / 60));
  return new AppError(
    `Terlalu banyak percobaan PIN salah. Coba lagi dalam ${remainingMinutes} menit.`,
    429,
    'PAYSLIP_PIN_LOCKED',
    true,
  );
}

export class PayslipPinService {
  private requireActor(actor: SelfPayslipActor): { userId: string; employeeId: string; companyId: string } {
    if (!actor.companyId || !actor.employeeId) {
      throw new BadRequestError('Akun ini tidak tertaut ke data karyawan dan company aktif');
    }
    return { userId: actor.id, employeeId: actor.employeeId, companyId: actor.companyId };
  }

  private async findActiveUser(actor: SelfPayslipActor) {
    const { userId, employeeId, companyId } = this.requireActor(actor);
    const user = await prisma.user.findFirst({
      where: { id: userId, employeeId, status: 'ACTIVE', deletedAt: null },
      select: {
        id: true,
        passwordHash: true,
        payslipPinHash: true,
        payslipPinFailedAttempts: true,
        payslipPinLockedUntil: true,
        employee: { select: { companyId: true } },
      },
    });
    if (!user || user.employee?.companyId !== companyId) {
      throw new BadRequestError('Akun ini tidak tertaut ke data karyawan pada company aktif');
    }
    return { user, userId, employeeId, companyId };
  }

  /** Set/ubah PIN setelah verifikasi password akun. Tidak mengembalikan data sensitif. */
  async setPin(actor: SelfPayslipActor, input: { currentPassword: string; pin: string }): Promise<void> {
    const { user } = await this.findActiveUser(actor);
    if (!isValidPayslipPin(input.pin)) {
      throw new BadRequestError('PIN harus terdiri dari 6 digit angka');
    }
    const passwordValid = await passwordHandler.compare(input.currentPassword, user.passwordHash);
    if (!passwordValid) {
      throw new AppError('Kata sandi salah', 403, 'PAYSLIP_PIN_REAUTH_FAILED', true);
    }
    const pinHash = await passwordHandler.hash(input.pin);
    const reset = resetPinLockState();
    await prisma.user.update({
      where: { id: user.id },
      data: {
        payslipPinHash: pinHash,
        payslipPinFailedAttempts: reset.failedAttempts,
        payslipPinLockedUntil: reset.lockedUntil,
      },
    });
  }

  async getStatus(actor: SelfPayslipActor): Promise<{ pinSet: boolean; lockedUntil?: string }> {
    const { user } = await this.findActiveUser(actor);
    const now = new Date();
    const lockedRemaining = pinLockRemainingSeconds(user.payslipPinLockedUntil, now);
    return {
      pinSet: Boolean(user.payslipPinHash),
      ...(lockedRemaining > 0 && user.payslipPinLockedUntil
        ? { lockedUntil: user.payslipPinLockedUntil.toISOString() }
        : {}),
    };
  }

  /** Verifikasi PIN → token unlock HMAC 15 menit khusus slip milik sendiri. */
  async unlock(actor: SelfPayslipActor, pin: string): Promise<{ unlockToken: string; expiresAt: string }> {
    const { user, userId, employeeId, companyId } = await this.findActiveUser(actor);
    const now = new Date();

    if (user.payslipPinLockedUntil && pinLockRemainingSeconds(user.payslipPinLockedUntil, now) > 0) {
      throw pinLockedError(user.payslipPinLockedUntil, now);
    }
    if (!user.payslipPinHash) {
      throw new AppError('PIN slip gaji belum diatur. Atur PIN terlebih dahulu.', 409, 'PAYSLIP_PIN_NOT_SET', true);
    }

    const pinValid = isValidPayslipPin(pin) && (await passwordHandler.compare(pin, user.payslipPinHash));
    if (!pinValid) {
      const next = registerFailedPinAttempt(
        { failedAttempts: user.payslipPinFailedAttempts, lockedUntil: user.payslipPinLockedUntil },
        now,
      );
      await prisma.user.update({
        where: { id: user.id },
        data: { payslipPinFailedAttempts: next.failedAttempts, payslipPinLockedUntil: next.lockedUntil },
      });
      if (next.lockedUntil && pinLockRemainingSeconds(next.lockedUntil, now) > 0) {
        throw pinLockedError(next.lockedUntil, now);
      }
      throw new AppError('PIN salah', 403, 'PAYSLIP_PIN_INVALID', true);
    }

    const reset = resetPinLockState();
    await prisma.user.update({
      where: { id: user.id },
      data: { payslipPinFailedAttempts: reset.failedAttempts, payslipPinLockedUntil: reset.lockedUntil },
    });

    const { token, expiresAt } = createSelfPayslipUnlockToken(
      config.jwt.accessSecret,
      { userId, employeeId, companyId },
      now,
    );
    return { unlockToken: token, expiresAt: expiresAt.toISOString() };
  }

  /** Token dari header X-Payslip-Unlock harus valid untuk user+employee+company saat ini. */
  assertUnlockToken(actor: SelfPayslipActor, rawToken: string | undefined): void {
    const identity = this.requireActor(actor);
    const claims = verifySelfPayslipUnlockToken(config.jwt.accessSecret, rawToken, identity, new Date());
    if (!claims) {
      throw new AppError(
        'Sesi buka slip gaji tidak valid atau sudah kedaluwarsa. Masukkan PIN kembali.',
        403,
        'PAYSLIP_UNLOCK_INVALID',
        true,
      );
    }
  }

  /**
   * Detail payslip LENGKAP milik karyawan yang login sendiri.
   * Scope keras: employeeId dan companyId dari sesi, hanya run final
   * (APPROVED/DISBURSED) — sama dengan daftar self-service.
   */
  async getMyPayslipDetail(actor: SelfPayslipActor, payslipId: string) {
    const { employeeId, companyId } = this.requireActor(actor);
    const payslip = await prisma.payslip.findFirst({
      where: {
        id: payslipId,
        companyId,
        employeeId,
        employee: { companyId, deletedAt: null },
        payrollRun: {
          companyId,
          deletedAt: null,
          status: { in: ['APPROVED', 'DISBURSED'] },
          period: { companyId, deletedAt: null },
        },
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        payrollRun: {
          select: {
            id: true, name: true, runNumber: true, status: true,
            period: { select: { id: true, name: true, code: true, frequency: true, startDate: true, endDate: true, payDate: true } },
          },
        },
        components: { where: { salaryComponent: { companyId } }, include: { salaryComponent: { select: { id: true, code: true, name: true, type: true } } } },
      },
    });
    if (!payslip) throw new NotFoundError('Slip gaji tidak ditemukan');

    const breakdown = buildPayslipBreakdown({
      baseSalary: Number(payslip.baseSalary) || 0,
      totalEarnings: Number(payslip.totalEarnings) || 0,
      totalDeductions: Number(payslip.totalDeductions) || 0,
      netPay: Number(payslip.netPay) || 0,
      components: (payslip.components ?? []).map((component) => ({
        id: component.id,
        name: component.name,
        type: component.type,
        amount: Number(component.amount) || 0,
        isTaxable: component.isTaxable,
        salaryComponent: component.salaryComponent ? { code: component.salaryComponent.code } : null,
      })),
    });
    return { ...payslip, breakdown };
  }
}

export const payslipPinService = new PayslipPinService();
