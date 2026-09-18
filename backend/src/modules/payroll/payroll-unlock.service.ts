import crypto from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { AppError, BadRequestError } from '@/shared/exceptions/AppError';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { decryptSecret } from '@/shared/security/secret-crypto';

export const PAYROLL_UNLOCK_TTL_SECONDS = 5 * 60;
export const PAYROLL_UNLOCK_MAX_ATTEMPTS = 5;
export const PAYROLL_UNLOCK_LOCK_MINUTES = 15;

type PayrollActor = {
  id: string;
  employeeId?: string;
  companyId?: string;
};

type UnlockInput = { password: string; totp?: string };

function digest(token: string): string {
  return crypto.createHash('sha256').update(token, 'utf8').digest('hex');
}

function unlockRequired(message = 'Payroll reauthentication is required') {
  return new AppError(message, 401, 'PAYROLL_UNLOCK_REQUIRED', true);
}

export class PayrollUnlockService {
  private requireActor(actor: PayrollActor) {
    if (!actor.companyId || !actor.employeeId) {
      throw new BadRequestError('Akun ini tidak tertaut ke employee dan company aktif');
    }
    return { companyId: actor.companyId, employeeId: actor.employeeId };
  }

  private async registerFailure(companyId: string, userId: string): Promise<never> {
    const current = await prisma.payrollUnlockGuard.findUnique({
      where: { companyId_userId: { companyId, userId } },
    });
    const stillInWindow = Boolean(
      current && current.updatedAt.getTime() > Date.now() - PAYROLL_UNLOCK_LOCK_MINUTES * 60_000,
    );
    const guard = await prisma.payrollUnlockGuard.upsert({
      where: { companyId_userId: { companyId, userId } },
      create: { companyId, userId, failedAttempts: 1, lockedUntil: null },
      update: stillInWindow
        ? { failedAttempts: { increment: 1 } }
        : { failedAttempts: 1, lockedUntil: null },
    });

    if (guard.failedAttempts >= PAYROLL_UNLOCK_MAX_ATTEMPTS) {
      const lockedUntil = new Date(Date.now() + PAYROLL_UNLOCK_LOCK_MINUTES * 60_000);
      await prisma.payrollUnlockGuard.update({ where: { id: guard.id }, data: { lockedUntil } });
      throw new AppError(
        `Payroll unlock locked for ${PAYROLL_UNLOCK_LOCK_MINUTES} minutes`,
        429,
        'PAYROLL_UNLOCK_LOCKED',
        true,
      );
    }
    throw new AppError('Payroll reauthentication failed', 401, 'PAYROLL_REAUTH_FAILED', true);
  }

  async unlock(actor: PayrollActor, input: UnlockInput) {
    const { companyId, employeeId } = this.requireActor(actor);
    const guard = await prisma.payrollUnlockGuard.findUnique({
      where: { companyId_userId: { companyId, userId: actor.id } },
    });
    if (guard?.lockedUntil && guard.lockedUntil.getTime() > Date.now()) {
      throw new AppError(
        'Payroll unlock is temporarily locked',
        429,
        'PAYROLL_UNLOCK_LOCKED',
        true,
      );
    }

    const user = await prisma.user.findFirst({
      where: { id: actor.id, employeeId, status: 'ACTIVE', deletedAt: null },
      select: {
        passwordHash: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        lockedUntil: true,
        employee: { select: { companyId: true } },
      },
    });
    if (!user || user.employee?.companyId !== companyId) {
      throw unlockRequired();
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      throw new AppError('Account is locked', 429, 'ACCOUNT_LOCKED', true);
    }

    const passwordValid = await passwordHandler.compare(input.password, user.passwordHash);
    let mfaValid = !user.twoFactorEnabled;
    if (user.twoFactorEnabled && input.totp && user.twoFactorSecret) {
      // Keep the ESM-only OTP provider off the common payroll route import path.
      // This also avoids loading QR/setup dependencies for requests that do not
      // perform an MFA verification.
      const { verifyTotp } = await import('@/shared/security/mfa');
      mfaValid = verifyTotp(decryptSecret(user.twoFactorSecret), input.totp);
    }
    if (!passwordValid || !mfaValid) {
      return this.registerFailure(companyId, actor.id);
    }

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + PAYROLL_UNLOCK_TTL_SECONDS * 1000);
    await prisma.$transaction(async (tx) => {
      await tx.payrollUnlockGuard.upsert({
        where: { companyId_userId: { companyId, userId: actor.id } },
        create: { companyId, userId: actor.id, failedAttempts: 0, lockedUntil: null },
        update: { failedAttempts: 0, lockedUntil: null },
      });
      await tx.payrollUnlockSession.updateMany({
        where: { companyId, userId: actor.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await tx.payrollUnlockSession.create({
        data: {
          companyId,
          userId: actor.id,
          employeeId,
          tokenHash: digest(rawToken),
          expiresAt,
        },
      });
    });

    return {
      unlockToken: rawToken,
      tokenType: 'PayrollUnlock',
      expiresAt: expiresAt.toISOString(),
      expiresIn: PAYROLL_UNLOCK_TTL_SECONDS,
    };
  }

  async assertGrant(actor: PayrollActor, rawToken: string | undefined): Promise<void> {
    const { companyId, employeeId } = this.requireActor(actor);
    if (!rawToken || rawToken.length > 256) throw unlockRequired();

    const session = await prisma.payrollUnlockSession.findFirst({
      where: {
        companyId,
        userId: actor.id,
        employeeId,
        tokenHash: digest(rawToken),
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });
    if (!session) throw unlockRequired('Payroll unlock is invalid, expired, or revoked');

    await prisma.payrollUnlockSession.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date() },
    });
  }

  async lock(actor: PayrollActor): Promise<void> {
    const { companyId } = this.requireActor(actor);
    await prisma.payrollUnlockSession.updateMany({
      where: { companyId, userId: actor.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

export const payrollUnlockService = new PayrollUnlockService();
