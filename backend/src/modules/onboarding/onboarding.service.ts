import { onboardingRepository } from './onboarding.repository';
import { CreateChecklistDTO, UpdateChecklistDTO, CreateResignationDTO } from './onboarding.dto';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { calculateSeverance, EmploymentEndReason } from '@/shared/payroll/severance';

export class OnboardingService {
  async getChecklists(employeeId: string) {
    return onboardingRepository.findChecklistsByEmployee(employeeId);
  }

  async createChecklist(data: CreateChecklistDTO) {
    return onboardingRepository.createChecklist(data);
  }

  async updateChecklist(id: string, data: UpdateChecklistDTO) {
    return onboardingRepository.updateChecklist(id, data);
  }

  async findAllResignations(companyId: string, status?: string) {
    return onboardingRepository.findAllResignations(companyId, status);
  }

  async findResignationById(id: string) {
    const resignation = await onboardingRepository.findResignationById(id);
    if (!resignation) throw new NotFoundError('Resignation not found');
    return resignation;
  }

  async createResignation(data: CreateResignationDTO) {
    // Validations (checklist §30): active employee, ordered dates, one open
    // resignation at a time.
    if (new Date(data.lastWorkingDate).getTime() < new Date(data.resignDate).getTime()) {
      throw new BadRequestError('Tanggal terakhir bekerja harus setelah atau sama dengan tanggal pengajuan resign');
    }
    const employee = await prisma.employee.findFirst({
      where: { id: data.employeeId, companyId: data.companyId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!employee) throw new NotFoundError('Karyawan tidak ditemukan atau sudah tidak aktif');
    const open = await prisma.resignation.findFirst({
      where: { employeeId: data.employeeId, status: { in: ['SUBMITTED', 'APPROVED'] } },
      select: { id: true },
    });
    if (open) throw new ConflictError('Masih ada pengajuan resign yang belum selesai untuk karyawan ini');

    const resignation = await onboardingRepository.createResignation(data);
    try {
      await onboardingRepository.generateClearances(resignation.id, data.employeeId);
    } catch (err) {
      // Compensation: a resignation without clearances has no checklist to gate on.
      await prisma.resignation.delete({ where: { id: resignation.id } }).catch(() => undefined);
      throw err;
    }
    logger.info('Resignation created with clearances', { employeeId: data.employeeId });
    return this.findResignationById(resignation.id);
  }

  async approveResignation(id: string, userId: string, approverEmployeeId?: string | null) {
    const resignation = await this.findResignationById(id);
    if (approverEmployeeId && resignation.employeeId === approverEmployeeId) {
      throw new ForbiddenError('Tidak dapat menyetujui pengajuan resign milik sendiri');
    }
    // Guarded transition: only SUBMITTED approves; re-approve/flip is rejected.
    const approved = await prisma.resignation.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });
    if (approved.count !== 1) throw new ConflictError('Pengajuan resign sudah diproses');

    // Surface outstanding loans to the approver — settlement leverage is lost
    // at exit (checklist §30: loan settlement). Non-blocking by design: no
    // early-settlement flow exists yet, so blocking would deadlock.
    const outstandingLoans = await prisma.loan.findMany({
      where: { employeeId: resignation.employeeId, status: 'ACTIVE', remainingBalance: { gt: 0 } },
      select: { id: true, remainingBalance: true },
    });
    if (outstandingLoans.length) {
      logger.warn('Resignation approved with outstanding loans', {
        resignationId: id,
        employeeId: resignation.employeeId,
        loans: outstandingLoans.map((loan) => ({ id: loan.id, remaining: Number(loan.remainingBalance) })),
      });
    }

    // Apply offboarding effects now when the last working day has passed;
    // otherwise the hourly sweep applies them at the right date.
    const result = await this.findResignationById(id);
    if (new Date(resignation.lastWorkingDate).getTime() <= Date.now()) {
      await this.applyResignationEffects(id);
    }
    return { ...result, outstandingLoans };
  }

  /**
   * Offboarding effects (checklist §30): the resigned person must stop being
   * an active employee AND stop being able to log in. Exactly-once via the
   * effectsAppliedAt claim.
   */
  async applyResignationEffects(id: string) {
    const resignation = await prisma.resignation.findFirst({
      where: { id, status: 'APPROVED', effectsAppliedAt: null },
      select: { id: true, employeeId: true, resignDate: true },
    });
    if (!resignation) return false;
    const claimed = await prisma.resignation.updateMany({
      where: { id, status: 'APPROVED', effectsAppliedAt: null },
      data: { effectsAppliedAt: new Date() },
    });
    if (claimed.count !== 1) return false;

    await prisma.employee.update({
      where: { id: resignation.employeeId },
      data: { status: 'INACTIVE', employmentStatus: 'RESIGNED' },
    });
    const user = await prisma.user.findFirst({
      where: { employeeId: resignation.employeeId, deletedAt: null },
      select: { id: true },
    });
    if (user) {
      await prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
      await prisma.refreshToken.updateMany({ where: { userId: user.id, isRevoked: false }, data: { isRevoked: true } });
    }
    logger.info('Resignation effects applied: employee inactive, user access revoked', {
      resignationId: id,
      employeeId: resignation.employeeId,
    });
    return true;
  }

  async rejectResignation(id: string) {
    await this.findResignationById(id);
    const rejected = await prisma.resignation.updateMany({
      where: { id, status: 'SUBMITTED' },
      data: { status: 'REJECTED' },
    });
    if (rejected.count !== 1) throw new ConflictError('Pengajuan resign sudah diproses');
    return this.findResignationById(id);
  }

  async updateClearance(id: string, status: string, notes?: string) {
    const allowed = ['PENDING', 'IN_PROGRESS', 'CLEARED', 'REJECTED', 'OVERDUE'];
    if (!allowed.includes(status)) {
      throw new BadRequestError(`Status clearance tidak dikenal: ${status}`);
    }
    return onboardingRepository.updateClearance(id, status, notes);
  }

  /**
   * Hitung final payroll / pesangon karyawan yang resign (Business Rule Gap: UU 13/2003 Pasal 156).
   *
   * Mengambil upah aktif + tanggal masuk + sisa cuti tahunan, lalu menghitung
   * Uang Pesangon (UP), Uang Penghargaan Masa Kerja (UPMK), uang sisa cuti, dan
   * Uang Penggantian Hak (UPH). Default alasan = RESIGN (tanpa UP/UPMK); dapat
   * dioverride untuk PHK/pensiun/PKWT beserta faktor pengalinya.
   */
  async calculateFinalPayroll(
    resignationId: string,
    opts?: {
      reason?: EmploymentEndReason;
      severanceFactor?: number;
      upmkFactor?: number;
      compensationOfRights?: number;
      monthlyWorkingDays?: number;
    }
  ) {
    const inputs = await onboardingRepository.findFinalPayrollInputs(resignationId);
    if (!inputs) throw new NotFoundError('Resignation not found');

    const { resignation, activeSalary, unusedLeaveDays } = inputs;
    if (!resignation.employee.joinDate) {
      throw new BadRequestError('Tanggal masuk (joinDate) karyawan belum diisi');
    }
    if (!activeSalary) {
      throw new BadRequestError('Data gaji aktif karyawan tidak ditemukan');
    }

    const result = calculateSeverance({
      monthlyWage: Number(activeSalary.baseSalary),
      joinDate: resignation.employee.joinDate,
      endDate: resignation.lastWorkingDate,
      reason: opts?.reason ?? 'RESIGN',
      severanceFactor: opts?.severanceFactor,
      upmkFactor: opts?.upmkFactor,
      compensationOfRights: opts?.compensationOfRights,
      unusedLeaveDays,
      monthlyWorkingDays: opts?.monthlyWorkingDays,
    });

    logger.info('Final payroll calculated', {
      resignationId,
      employeeId: resignation.employeeId,
      reason: opts?.reason ?? 'RESIGN',
      total: result.total,
    });

    return {
      employee: {
        id: resignation.employee.id,
        fullName: resignation.employee.fullName,
        employeeNumber: resignation.employee.employeeNumber,
      },
      lastWorkingDate: resignation.lastWorkingDate,
      monthlyWage: Number(activeSalary.baseSalary),
      unusedLeaveDays,
      ...result,
    };
  }
}

export const onboardingService = new OnboardingService();
