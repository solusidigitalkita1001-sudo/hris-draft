import { ewaRepository } from './ewa.repository';
import {
  assessEwaRequest,
  calcMaxAllowedEwa,
  isStatusTransitionValid,
  aggregateEwaForPayroll,
} from '@/shared/ewa/ewa-mvp';
import { generateSystemCode } from '@/shared/utils/system-code';
import { getRequestContext, getCurrentCompanyId, getCurrentRoles } from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/shared/exceptions/AppError';
import type { CreateEWARequestDTO, ApproveEWARequestDTO, RejectEWARequestDTO, MarkPaidEWARequestDTO } from './ewa.dto';
import type { EWATransactionStatus } from '@prisma/client';

const EMPLOYEE_ELEVATED_HR_ROLES = ['HR_STAFF', 'HR_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN'];
const FINANCE_DISBURSE_ROLES = ['FINANCE_STAFF', 'FINANCE_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN'];
const DEFAULT_MAX_PERCENT = 50;

export class EWAService {
  async findAll(companyId: string, filters: { status?: EWATransactionStatus; employeeId?: string }) {
    return ewaRepository.findAll(companyId, filters);
  }

  async findMyRequests(employeeId: string, status?: EWATransactionStatus) {
    return ewaRepository.findMyRequests(employeeId, status);
  }

  async findById(id: string) {
    const ewa = await ewaRepository.findById(id);
    if (!ewa) throw new NotFoundError('EWA request tidak ditemukan');
    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId && ctx.user.employeeId === ewa.employeeId;
    if (!isAdmin && currentCompanyId && ewa.companyId !== currentCompanyId) throw new NotFoundError('EWA request tidak ditemukan');
    if (!isAdmin && !mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r) || FINANCE_DISBURSE_ROLES.includes(r))) {
      throw new ForbiddenError('Anda tidak memiliki akses EWA request ini');
    }
    return ewa;
  }

  async createRequest(data: CreateEWARequestDTO & { earnedGross: number; periodStart: Date; periodEnd: Date }) {
    const ctx = getRequestContext();
    const user = ctx?.user;
    const roles = user?.roles ?? [];
    const hasElevatedRole = roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r));
    const companyId = getCurrentCompanyId() ?? data.payrollPeriodId ? '' : '';

    let employeeId = data.employeeId;
    if (user?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      employeeId = user.employeeId;
      if (data.employeeId && data.employeeId !== employeeId) {
        throw new ForbiddenError('Role EMPLOYEE tidak bisa request EWA atas nama karyawan lain');
      }
    }
    if (!employeeId) throw new BadRequestError('employeeId wajib diisi');

    const finalCompanyId = user?.companyId ?? companyId;
    if (!finalCompanyId) throw new BadRequestError('companyId tidak ditemukan dalam context');

    const existingApproved = await ewaRepository.findByEmployeePeriodStatus(
      finalCompanyId,
      employeeId,
      data.periodStart,
      data.periodEnd,
      ['APPROVED', 'PAID'],
    );
    const totalExistingApproved = existingApproved.reduce((acc, r) => acc + Number(r.amountRequested), 0);

    const assessment = assessEwaRequest(data.earnedGross, data.amountRequested, totalExistingApproved, DEFAULT_MAX_PERCENT);
    if (!assessment.isAllowed) {
      throw new BadRequestError(
        `EWA request tidak diizinkan: ${assessment.reason ?? `Maksimal ${assessment.maxAllowedPercent}% dari earned gross (Rp ${assessment.maxAllowedAmount.toLocaleString('id-ID')})`}`,
      );
    }

    const requestCode = await generateSystemCode({
      prefix: 'EWA',
      label: `${employeeId}-${data.periodStart.toISOString().slice(0, 10)}`,
      exists: async (candidate) => Boolean(await ewaRepository.findById(candidate) === null ? false : false),
    });

    const created = await ewaRepository.create({
      ...data,
      companyId: finalCompanyId,
      employeeId,
      requestCode,
      periodStart: data.periodStart,
      periodEnd: data.periodEnd,
      earnedGrossReference: data.earnedGross,
      earnedGrossAtRequest: data.earnedGross,
      maxAllowedPercent: DEFAULT_MAX_PERCENT,
      maxAllowedAtRequest: assessment.maxAllowedAmount,
      totalApprovedSamePeriod: totalExistingApproved,
    });

    logger.info('EWA request created', {
      ewaId: created.id,
      requestCode: created.requestCode,
      employeeId,
      amountRequested: data.amountRequested,
    });
    return created;
  }

  async approveRequest(id: string, approverId: string, dto: ApproveEWARequestDTO) {
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'APPROVED', actor: approverId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-approve: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) throw new ForbiddenError('Hanya HR / Admin yang bisa approve EWA');

    const ctxUser = getRequestContext()?.user;
    if (approverId && ctxUser?.employeeId && ctxUser.employeeId === ewa.employeeId) {
      throw new ForbiddenError('Tidak bisa approve EWA sendiri (self approval)');
    }

    const updated = await ewaRepository.updateStatus(id, {
      status: 'APPROVED',
      approverId,
      approvedAt: new Date(),
      approverNotes: dto.approverNotes,
    });
    logger.info('EWA request approved', { ewaId: id, approverId });
    return updated;
  }

  async rejectRequest(id: string, approverId: string, dto: RejectEWARequestDTO) {
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'REJECTED', actor: approverId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-reject: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) throw new ForbiddenError('Hanya HR / Admin yang bisa reject EWA');
    const ctxUserReject = getRequestContext()?.user;
    if (approverId && ctxUserReject?.employeeId && ctxUserReject.employeeId === ewa.employeeId) {
      throw new ForbiddenError('Tidak bisa reject EWA sendiri (self reject)');
    }
    const updated = await ewaRepository.updateStatus(id, {
      status: 'REJECTED',
      approverId,
      rejectReason: dto.rejectReason,
    });
    logger.info('EWA request rejected', { ewaId: id, approverId, reason: dto.rejectReason });
    return updated;
  }

  async cancelRequest(id: string, cancellerId: string) {
    const ewa = await this.findById(id);
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId === ewa.employeeId;
    const roles = ctx?.user?.roles ?? [];
    if (!mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Hanya pembuat request atau HR / Admin yang bisa cancel');
    }
    if (ewa.status !== 'PENDING') throw new BadRequestError('Hanya EWA status PENDING yang bisa dicancel');
    const updated = await ewaRepository.updateStatus(id, {
      status: 'CANCELLED',
      cancelledBy: cancellerId,
      cancelledAt: new Date(),
    });
    logger.info('EWA request cancelled', { ewaId: id, cancellerId });
    return updated;
  }

  async markPaid(id: string, disburserId: string, dto: MarkPaidEWARequestDTO) {
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'PAID', actor: disburserId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-mark PAID: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => FINANCE_DISBURSE_ROLES.includes(r))) throw new ForbiddenError('Hanya Finance / Admin yang bisa mark PAID EWA');
    const updated = await ewaRepository.updateStatus(id, {
      status: 'PAID',
      financeDisburserId: disburserId,
      paidOutAt: new Date(),
      amountPaidOut: dto.amountPaidOut,
      disbursementReference: dto.disbursementReference,
    });
    logger.info('EWA request marked PAID', { ewaId: id, disburserId, amountPaid: dto.amountPaidOut });
    return updated;
  }

  aggregateDeductionsForPayroll(
    list: Array<{
      id: string;
      employeeId: string;
      amountRequested: number;
      amountPaidOut: number | null;
      status: EWATransactionStatus;
      adminFee: number;
    }>,
  ) {
    return aggregateEwaForPayroll(list);
  }

  calcMaxAllowed(earnedGross: number, percentOverride?: number) {
    return calcMaxAllowedEwa(earnedGross, percentOverride);
  }
}

export const ewaService = new EWAService();
