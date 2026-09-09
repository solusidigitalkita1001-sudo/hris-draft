import { ewaRepository } from './ewa.repository';
import {
  assessEwaRequest,
  calcMaxAllowedEwa,
  isStatusTransitionValid,
  aggregateEwaForPayroll,
} from '@/shared/ewa/ewa-mvp';
import { generateSystemCode } from '@/shared/utils/system-code';
import { getCurrentUser, getCurrentRoles } from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ForbiddenError, BadRequestError, ConflictError, ValidationError } from '@/shared/exceptions/AppError';
import type { CreateEWARequestDTO, ApproveEWARequestDTO, RejectEWARequestDTO, MarkPaidEWARequestDTO } from './ewa.dto';
import type { EWATransactionStatus } from '@prisma/client';
import { z } from 'zod';
import { createEWARequestSchema, approveEWARequestSchema, rejectEWARequestSchema, markPaidEWARequestSchema, ewaLimitQuerySchema } from './ewa.dto';
import { ewaAccess, EWA_HR_ROLES, EWA_FINANCE_ROLES } from './ewa-access';
import { prisma } from '@/shared/database/prisma';
import { payrollRepository } from '@/modules/payroll/payroll.repository';
import { workCalendarRepository } from '@/modules/work-calendar/work-calendar.repository';
import { calculateOvertimePay } from '@/shared/attendance/overtime';
import { withDatabaseAdvisoryLock } from '@/shared/database/advisory-lock';

function parse<T extends z.ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError('Invalid EWA input', result.error.issues.map(issue => ({ field: issue.path.join('.'), message: issue.message })));
  return result.data;
}
const DEFAULT_MAX_PERCENT = 50;
const DEFAULT_WORKDAYS_FALLBACK = 22;

function startOfMonth(d: Date): Date {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfMonth(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export class EWAService {
  /**
   * Resolve periode EWA:
   * 1. Jika payrollPeriodId dikirim → lookup start/end dari DB (source of truth, client tidak bisa custom)
   * 2. Jika tidak dikirim → auto-detect periode saat ini (awal-akhir bulan ini)
   */
  private async resolvePeriod(data: CreateEWARequestDTO, companyId: string): Promise<{ payrollPeriodId: string | null; periodStart: Date; periodEnd: Date }> {
    if (data.payrollPeriodId) {
      const period = await payrollRepository.findPayrollPeriodById(data.payrollPeriodId, prisma, companyId);
      if (!period) throw new NotFoundError('Payroll period yang dipilih tidak ditemukan');
      if (period.companyId !== companyId) throw new ForbiddenError('Payroll period tidak sesuai company Anda');
      return {
        payrollPeriodId: period.id,
        periodStart: new Date(period.startDate),
        periodEnd: new Date(period.endDate),
      };
    }
    const today = new Date();
    return { payrollPeriodId: null, periodStart: startOfMonth(today), periodEnd: endOfMonth(today) };
  }

  /**
   * Server-side hitung earned gross to date (sampai sekarang) — TIDAK PERCAYA input client.
   * Formula (mirip payroll calculatePayroll):
   *   dailyRate = baseSalary / max(workDaysInPeriod, 1)
   *   baseEarned  = dailyRate * presentDaysCount (PRESENT + LATE status)
   *   overtimeBonus = approved overtime pay (calculateOvertimePay standard formula)
   *   returned = baseEarned + overtimeBonus
   *
   * Fallback: jika salary tidak ditemukan → 0 (EWA tidak bisa diajukan sblm ada salary aktif).
   */
  async calculateEarnedGrossToDate(
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{ earnedGrossToDate: number; baseSalary: number; presentDays: number; workDaysInPeriod: number; overtimePay: number; dailyRate: number }> {
    const access = await ewaAccess({ companyId });
    if (!Number.isFinite(periodStart.getTime()) || !Number.isFinite(periodEnd.getTime()) || periodEnd < periodStart) throw new ValidationError('Invalid EWA period');
    const employee = await ewaRepository.findEmployeeForAccess(employeeId, access.employeeWhere);
    if (!employee) throw new NotFoundError('Employee not found in the permitted EWA scope');
    const todayCutoff = new Date();
    const effectiveEnd = periodEnd < todayCutoff ? periodEnd : todayCutoff;

    const activeSalaries = await prisma.employeeSalary.findMany({
      where: { companyId, employeeId, isActive: true, deletedAt: null }, select: { baseSalary: true, currency: true }, take: 2,
    });
    if (activeSalaries.length > 1) throw new ConflictError('Multiple active salaries found; review the existing allocations');
    const activeSalary = activeSalaries[0];
    if (!activeSalary) {
      logger.warn('EWA earnedGross calc: active salary tidak ditemukan employeeId=' + employeeId);
      return { earnedGrossToDate: 0, baseSalary: 0, presentDays: 0, workDaysInPeriod: DEFAULT_WORKDAYS_FALLBACK, overtimePay: 0, dailyRate: 0 };
    }
    if (activeSalary.currency !== 'IDR' || !activeSalary.baseSalary.isFinite() || activeSalary.baseSalary.lessThanOrEqualTo(0)) throw new ValidationError('EWA requires a valid IDR salary allocation');
    const baseSalary = Number(activeSalary.baseSalary);

    const companyCalendar = await workCalendarRepository.findCalendarByContext({ companyId });
    const workDaysInPeriodRaw = companyCalendar
      ? await workCalendarRepository.countWorkingDays(companyCalendar.id, periodStart, periodEnd)
      : DEFAULT_WORKDAYS_FALLBACK;
    const workDaysInPeriod = Math.max(1, workDaysInPeriodRaw || DEFAULT_WORKDAYS_FALLBACK);

    const attdRows = await prisma.attendance.groupBy({
      by: ['status'],
      where: { companyId, employeeId, date: { gte: periodStart, lte: effectiveEnd }, deletedAt: null },
      _count: { id: true },
    });
    let presentDays = 0;
    for (const r of attdRows) {
      if (r.status === 'PRESENT' || r.status === 'LATE') presentDays += r._count.id;
    }

    const approvedOt = await prisma.overtimeRequest.findMany({
      where: { companyId, employeeId, status: 'APPROVED', date: { gte: periodStart, lte: effectiveEnd }, deletedAt: null },
      select: { durationHours: true, date: true },
    });
    let overtimePay = 0;
    for (const ot of approvedOt) {
      const h = Number(ot.durationHours) || 0;
      if (h <= 0) continue;
      const dow = new Date(ot.date).getDay();
      const dayType: 'WORKDAY' | 'HOLIDAY' = dow === 0 || dow === 6 ? 'HOLIDAY' : 'WORKDAY';
      overtimePay += calculateOvertimePay({ monthlyWage: baseSalary, hours: h, dayType }).amount;
    }

    const dailyRate = baseSalary / workDaysInPeriod;
    const earnedGrossToDate = Math.max(0, dailyRate * presentDays + overtimePay);
    return { earnedGrossToDate, baseSalary, presentDays, workDaysInPeriod, overtimePay, dailyRate };
  }

  async findAll(companyId: string, filters: { status?: EWATransactionStatus; employeeId?: string }) {
    const access = await ewaAccess({ companyId });
    return ewaRepository.findAll(access.companyId, filters, access.employeeWhere);
  }

  async findMyRequests(employeeId: string, status?: EWATransactionStatus) {
    const access = await ewaAccess({ self: true });
    if (employeeId !== access.actor.employeeId) throw new ForbiddenError('EWA self-service requires the authenticated employee');
    return ewaRepository.findMyRequests(employeeId, access.companyId, access.employeeWhere, status);
  }

  async findById(id: string) {
    const access = await ewaAccess();
    const ewa = await ewaRepository.findById(id, access.companyId, access.employeeWhere);
    if (!ewa) throw new NotFoundError('EWA request tidak ditemukan');
    return ewa;
  }

  async createRequest(input: CreateEWARequestDTO) {
    const data = parse(createEWARequestSchema, input);
    const onBehalf = getCurrentUser()?.roles?.some(role => EWA_HR_ROLES.includes(role));
    const access = await ewaAccess({ self: !onBehalf });
    const employeeId = data.employeeId ?? access.actor.employeeId;
    if (!employeeId) throw new BadRequestError('employeeId wajib diisi');
    if (!onBehalf && employeeId !== access.actor.employeeId) throw new ForbiddenError('EWA can only be requested for the authenticated employee');
    const employee = await ewaRepository.findEmployeeForAccess(employeeId, access.employeeWhere);
    if (!employee) throw new NotFoundError('Employee not found in the permitted EWA scope');
    const finalCompanyId = access.companyId;

    const { payrollPeriodId, periodStart, periodEnd } = await this.resolvePeriod(data, finalCompanyId);

    const grossCalc = await this.calculateEarnedGrossToDate(finalCompanyId, employeeId, periodStart, periodEnd);
    if (grossCalc.baseSalary <= 0) {
      throw new BadRequestError('Karyawan belum memiliki data gaji aktif, silakan hubungi HR untuk mengatur Employee Salary sebelum mengajukan EWA');
    }
    const earnedGross = grossCalc.earnedGrossToDate;

    const created = await withDatabaseAdvisoryLock(
      'ewa-limit',
      // Lock per employee, not per exact date pair: overlapping payroll
      // periods with different boundaries must still serialize.
      `${finalCompanyId}:${employeeId}`,
      async (tx) => {
        // Keep serialization through COMMIT, including the interval between
        // releasing the connection advisory lock and committing its transaction.
        // Acquire this before any consistent read can establish a stale snapshot.
        await tx.$queryRaw`SELECT id FROM employees WHERE id = ${employeeId} AND company_id = ${finalCompanyId} AND deleted_at IS NULL FOR UPDATE`;
        if (!await ewaRepository.findEmployeeForAccess(employeeId, access.employeeWhere, tx)) throw new NotFoundError('Employee not found in the permitted EWA scope');
        // PENDING ikut dihitung sebagai reservasi. Tanpa ini, request paralel
        // dapat sama-sama lolos sebelum salah satunya di-approve.
        const existingReserved = await ewaRepository.findByEmployeePeriodStatus(
          finalCompanyId,
          employeeId,
          periodStart,
          periodEnd,
          ['PENDING', 'APPROVED', 'PAID'],
          tx,
        );
        const totalExistingReserved = existingReserved.reduce((acc, r) => acc + Number(r.amountRequested), 0);

        const assessment = assessEwaRequest(earnedGross, data.amountRequested, totalExistingReserved, DEFAULT_MAX_PERCENT);
        if (!assessment.isAllowed) {
          throw new BadRequestError(
            `EWA request tidak diizinkan: ${assessment.reason ?? `Maksimal ${assessment.maxAllowedPercent}% dari pendapatan periode ini (Rp ${assessment.maxAllowedAmount.toLocaleString('id-ID')}). Data aktual: ${grossCalc.presentDays}/${grossCalc.workDaysInPeriod} hari kerja, base salary Rp ${grossCalc.baseSalary.toLocaleString('id-ID')}`}`,
          );
        }

        const requestCode = await generateSystemCode({
          prefix: 'EWA',
          label: `${employeeId}-${periodStart.toISOString().slice(0, 10)}`,
          exists: async (candidate) => Boolean(await ewaRepository.findByRequestCode(candidate, tx)),
        });

        return ewaRepository.create({
          ...data,
          payrollPeriodId,
          companyId: finalCompanyId,
          employeeId,
          requestCode,
          periodStart,
          periodEnd,
          earnedGrossReference: earnedGross,
          earnedGrossAtRequest: earnedGross,
          maxAllowedPercent: DEFAULT_MAX_PERCENT,
          maxAllowedAtRequest: assessment.maxAllowedAmount,
          totalApprovedSamePeriod: totalExistingReserved,
        }, tx);
      },
    );

    logger.info('EWA request created (server-side earnedGross enforced)', {
      ewaId: created.id,
      requestCode: created.requestCode,
      employeeId,
    });
    return created;
  }

  async approveRequest(id: string, approverId: string, dto: ApproveEWARequestDTO) {
    const access = await ewaAccess({ actorId: approverId });
    dto = parse(approveEWARequestSchema, dto);
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'APPROVED', actor: approverId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-approve: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => EWA_HR_ROLES.includes(r))) throw new ForbiddenError('Hanya HR / Admin yang bisa approve EWA');

    const ctxUser = getCurrentUser();
    if (approverId && ctxUser?.employeeId && ctxUser.employeeId === ewa.employeeId) {
      throw new ForbiddenError('Tidak bisa approve EWA sendiri (self approval)');
    }

    const updated = await ewaRepository.updateStatus(id, access.companyId, access.employeeWhere, ewa.status, {
      status: 'APPROVED',
      approverId,
      approvedAt: new Date(),
      approverNotes: dto.approverNotes,
    });
    logger.info('EWA request approved', { ewaId: id, approverId });
    return updated;
  }

  async rejectRequest(id: string, approverId: string, dto: RejectEWARequestDTO) {
    const access = await ewaAccess({ actorId: approverId });
    dto = parse(rejectEWARequestSchema, dto);
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'REJECTED', actor: approverId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-reject: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => EWA_HR_ROLES.includes(r))) throw new ForbiddenError('Hanya HR / Admin yang bisa reject EWA');
    const ctxUserReject = getCurrentUser();
    if (approverId && ctxUserReject?.employeeId && ctxUserReject.employeeId === ewa.employeeId) {
      throw new ForbiddenError('Tidak bisa reject EWA sendiri (self reject)');
    }
    const updated = await ewaRepository.updateStatus(id, access.companyId, access.employeeWhere, ewa.status, {
      status: 'REJECTED',
      approverId,
      rejectReason: dto.rejectReason,
    });
    logger.info('EWA request rejected', { ewaId: id, approverId });
    return updated;
  }

  async cancelRequest(id: string, cancellerId: string) {
    const access = await ewaAccess({ actorId: cancellerId });
    const ewa = await this.findById(id);
    const mine = access.actor.employeeId === ewa.employeeId;
    const roles = access.actor.roles ?? [];
    if (!mine && !roles.some((r) => EWA_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Hanya pembuat request atau HR / Admin yang bisa cancel');
    }
    if (ewa.status !== 'PENDING') throw new BadRequestError('Hanya EWA status PENDING yang bisa dicancel');
    const updated = await ewaRepository.updateStatus(id, access.companyId, access.employeeWhere, ewa.status, {
      status: 'CANCELLED',
      cancelledBy: cancellerId,
      cancelledAt: new Date(),
    });
    logger.info('EWA request cancelled', { ewaId: id, cancellerId });
    return updated;
  }

  async markPaid(id: string, disburserId: string, dto: MarkPaidEWARequestDTO) {
    const access = await ewaAccess({ actorId: disburserId });
    dto = parse(markPaidEWARequestSchema, dto);
    const ewa = await this.findById(id);
    const transition = isStatusTransitionValid({ fromStatus: ewa.status, toStatus: 'PAID', actor: disburserId });
    if (!transition.allowed) throw new BadRequestError(`Status EWA tidak bisa di-mark PAID: ${transition.reason}`);
    const roles = getCurrentRoles();
    if (!roles.some((r) => EWA_FINANCE_ROLES.includes(r))) throw new ForbiddenError('Hanya Finance / Admin yang bisa mark PAID EWA');
    const updated = await ewaRepository.updateStatus(id, access.companyId, access.employeeWhere, ewa.status, {
      status: 'PAID',
      financeDisburserId: disburserId,
      paidOutAt: new Date(),
      amountPaidOut: dto.amountPaidOut,
      disbursementReference: dto.disbursementReference,
    });
    logger.info('EWA request marked PAID', { ewaId: id, disburserId });
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

  /**
   * getMyLimit: Juga server-side — JANGAN accept query string earnedGross dari client (celah lama).
   * Auto detect periode bulan ini, hitung dari attendance + salary + approved overtime aktual.
   */
  async getMyLimitServer(
    companyId: string,
    employeeId: string,
    overridePercent?: number,
  ): Promise<{ max: number; remaining: number; totalApproved: number; totalReserved: number; earnedGrossToDate: number; breakdown: any }> {
    const access = await ewaAccess({ companyId, self: true });
    if (employeeId !== access.actor.employeeId) throw new ForbiddenError('EWA self-service requires the authenticated employee');
    parse(ewaLimitQuerySchema, { percent: overridePercent });
    const today = new Date();
    const periodStart = startOfMonth(today);
    const periodEnd = endOfMonth(today);
    const gross = await this.calculateEarnedGrossToDate(companyId, employeeId, periodStart, periodEnd);
    const existingReserved = await ewaRepository.findByEmployeePeriodStatus(companyId, employeeId, periodStart, periodEnd, ['PENDING', 'APPROVED', 'PAID']);
    const totalReserved = existingReserved.reduce((acc, r) => acc + Number(r.amountRequested), 0);
    const result = calcMaxAllowedEwa(gross.earnedGrossToDate, overridePercent ?? DEFAULT_MAX_PERCENT, totalReserved);
    return {
      ...result,
      // totalApproved is retained for API compatibility; totalReserved is the
      // accurate name because PENDING requests now reserve available balance.
      totalReserved,
      earnedGrossToDate: gross.earnedGrossToDate,
      breakdown: {
        baseSalary: gross.baseSalary,
        presentDays: gross.presentDays,
        workDaysInPeriod: gross.workDaysInPeriod,
        dailyRate: gross.dailyRate,
        overtimePay: gross.overtimePay,
      },
    };
  }

  calcMaxAllowed(earnedGross: number, percentOverride?: number) {
    return calcMaxAllowedEwa(earnedGross, percentOverride);
  }
}

export const ewaService = new EWAService();
