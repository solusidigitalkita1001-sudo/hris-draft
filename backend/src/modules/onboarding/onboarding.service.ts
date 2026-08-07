import { onboardingRepository } from './onboarding.repository';
import { CreateChecklistDTO, UpdateChecklistDTO, CreateResignationDTO } from './onboarding.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
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
    const resignation = await onboardingRepository.createResignation(data);
    // Auto-generate exit clearances
    await onboardingRepository.generateClearances(resignation.id, data.employeeId);
    logger.info('Resignation created with clearances', { employeeId: data.employeeId });
    return this.findResignationById(resignation.id);
  }

  async approveResignation(id: string, userId: string) {
    await this.findResignationById(id);
    return onboardingRepository.updateResignationStatus(id, 'APPROVED', userId);
  }

  async rejectResignation(id: string) {
    await this.findResignationById(id);
    return onboardingRepository.updateResignationStatus(id, 'REJECTED');
  }

  async updateClearance(id: string, status: string, notes?: string) {
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
