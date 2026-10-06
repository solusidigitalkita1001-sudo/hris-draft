import { payrollRepository } from './payroll.repository';
import {
  CreateSalaryComponentDTO,
  UpdateSalaryComponentDTO,
  CreateEmployeeSalaryDTO,
  UpdateEmployeeSalaryDTO,
  CreatePayrollPeriodDTO,
  UpdatePayrollPeriodDTO,
  CreatePayrollRunDTO,
  CalculatePph21DTO,
  CalculateThrStandaloneDTO,
  CalculateBpjsDTO,
  CalculateJknDTO,
} from './payroll.dto';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ConflictError, BadRequestError, ValidationError, ForbiddenError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId } from '@/shared/context/RequestContext';
import { isConcurrencyFailure } from '@/shared/database/concurrency';
import { payrollArrearsService } from './payroll-arrears.service';
import { leaveEncashmentService } from '@/modules/leave/leave-encashment.service';
import { calculatePph21Correction, shouldReconcileAnnualTax } from '@/shared/payroll/pph21-annual';
import { mailService } from '@/shared/mail/MailService';
import { randomUUID as uuidv4 } from 'node:crypto';
import { employeeLoanRepository } from '@/modules/employee-loan/employee-loan.repository';
import { generateSystemCode } from '@/shared/utils/system-code';
import { calculateBpjs } from '@/shared/payroll/bpjs';
import { calculatePph21 } from '@/shared/payroll/pph21';
import { buildPayrollJournal } from '@/shared/payroll/journal';
import { employmentWindow } from '@/shared/payroll/employment-window';
import { loadPayrollPolicyConfig } from '@/shared/payroll/payroll-policy';
import { calculateThr } from '@/shared/payroll/thr';
import { calculateThrTax } from '@/shared/payroll/thr-tax';
import { AmbiguousSalaryError, selectAsOfSalaries } from '@/shared/payroll/as-of-salary';
import { monthlyStatutoryWage } from '@/shared/payroll/statutory-wage';
import { buildPayslipBreakdown } from '@/shared/payroll/payslip-breakdown';
import { prisma } from '@/shared/database/prisma';
import { calculateOvertimePay } from '@/shared/attendance/overtime';
import { loadPayrollAttendance, PayrollAttendanceSummary } from './payroll-attendance';
import { payrollDate, payrollDateKey } from '@/shared/payroll/attendance-calendar';
import { companySettingsService } from '@/modules/company-settings/company-settings.service';
import { JKKRiskClass, Prisma } from '@prisma/client';
import { selectFormulaVersions } from '@/shared/payroll/formula';
import { calculateEmployeePay, PayComponent } from '@/shared/payroll/employee-pay';
import { ewaRepository, PayrollEWADeduction } from '@/modules/ewa/ewa.repository';
import { employeeSalaryService } from './employee-salary.service';
import { companyPayrollAccess, payrollAccess } from './payroll-access';

const JKK_RISK_TO_RATE: Record<JKKRiskClass, number> = {
  [JKKRiskClass.I]: 0.24,
  [JKKRiskClass.II]: 0.54,
  [JKKRiskClass.III]: 0.89,
  [JKKRiskClass.IV]: 1.27,
  [JKKRiskClass.V]: 1.74,
};

/**
 * Deductible employee pension for the tax base: BPJS JHT + JP, the same two the
 * monthly engine subtracts. Read from the company's own policy so the annual
 * reconciliation uses the same numbers the monthly withholding did.
 */
function bpjsPensionFor(policy: { bpjs?: Parameters<typeof calculateBpjs>[1] }, monthlyWage: number): number {
  const breakdown = calculateBpjs(monthlyWage, policy.bpjs ?? {});
  return breakdown.employee.jht + breakdown.employee.jp;
}

export class PayrollService {
  // ==================== Salary Components ====================

  async findAllSalaryComponents(companyId: string) {
    return payrollRepository.findAllSalaryComponents(companyId);
  }

  async findSalaryComponentById(id: string) {
    const component = await payrollRepository.findSalaryComponentById(id);
    if (!component) throw new NotFoundError('Salary component not found');
    return component;
  }

  async createSalaryComponent(data: CreateSalaryComponentDTO) {
    if (data.calculationMethod === 'FORMULA') {
      throw new BadRequestError(
        'Buat komponen FIXED atau PERCENTAGE terlebih dahulu, lalu simulasikan dan publikasikan versi formula melalui menu Formula. Metode dasar tetap berlaku sebelum tanggal efektif formula.',
      );
    }
    const code = await generateSystemCode({
      prefix: 'PAY-CMP',
      label: data.name,
      exists: async (candidate) => Boolean(await payrollRepository.findSalaryComponentByCode(data.companyId, candidate)),
    });
    const existing = await payrollRepository.findSalaryComponentByCode(data.companyId, code);
    if (existing) throw new ConflictError('Salary component code already exists');

    const component = await payrollRepository.createSalaryComponent({ ...data, code });

    logger.info('Salary component created', { componentId: component.id, code: component.code });
    return component;
  }

  async updateSalaryComponent(id: string, data: UpdateSalaryComponentDTO) {
    const currentComponent = await this.findSalaryComponentById(id);
    if (data.calculationMethod === 'FORMULA') {
      throw new BadRequestError(
        'Buat komponen FIXED atau PERCENTAGE terlebih dahulu, lalu simulasikan dan publikasikan versi formula melalui menu Formula. Metode dasar tetap berlaku sebelum tanggal efektif formula.',
      );
    }
    const requestedCode = (data as Record<string, unknown>).code;
    if (typeof requestedCode === 'string' && requestedCode !== currentComponent.code) {
      throw new ValidationError('Salary component code is generated by system and cannot be changed');
    }
    const component = await payrollRepository.updateSalaryComponent(id, data);

    logger.info('Salary component updated', { componentId: id });
    return component;
  }

  async deleteSalaryComponent(id: string) {
    await this.findSalaryComponentById(id);
    await payrollRepository.softDeleteSalaryComponent(id);

    logger.info('Salary component deleted', { componentId: id });
  }

  // ==================== Employee Salaries ====================

  async findAllEmployeeSalaries(companyId: string, employeeId?: string) {
    return employeeSalaryService.list(companyId, employeeId);
  }

  async findEmployeeSalaryById(id: string) {
    return employeeSalaryService.findById(id);
  }

  async createEmployeeSalary(data: CreateEmployeeSalaryDTO) {
    const salary = await employeeSalaryService.create(data);

    logger.info('Employee salary created', {
      employeeId: data.employeeId,
      salaryId: salary.id,
    });

    return salary;
  }

  async updateEmployeeSalary(id: string, data: UpdateEmployeeSalaryDTO) {
    return employeeSalaryService.update(id, data);
  }

  /**
   * Hitung THR seorang karyawan (Business Rule Gap: Permenaker 6/2016).
   * ≥12 bulan = 1× upah; 1–<12 bulan = prorata (masa kerja/12 × upah); <1 bulan = tidak berhak.
   */
  async calculateEmployeeThr(employeeId: string, referenceDate?: Date) {
    if (referenceDate && !Number.isFinite(referenceDate.getTime())) throw new ValidationError('Invalid THR reference date');
    const { salary, employee } = await employeeSalaryService.thrInputs(employeeId);
    if (!employee) throw new NotFoundError('Employee not found');
    if (!employee.joinDate) {
      throw new BadRequestError('Tanggal masuk (joinDate) karyawan belum diisi');
    }
    if (!salary) {
      throw new BadRequestError('Data gaji aktif karyawan tidak ditemukan');
    }

    // "Upah sebulan" under Permenaker 6/2016 is gaji pokok PLUS tunjangan
    // tetap. This passed base salary alone, which paid less THR than the law
    // requires for anybody whose package includes a fixed allowance — and
    // `thr.ts` has stated the right rule in its own header all along, with no
    // data to express it until `isFixedAllowance` existed.
    const { wage: statutoryWage, fixedAllowances } = monthlyStatutoryWage(
      salary.baseSalary, salary.components);
    const result = calculateThr({
      monthlyWage: statutoryWage.toNumber(),
      joinDate: employee.joinDate,
      referenceDate: referenceDate ?? new Date(),
    });

    // PPh 21 on the THR. `calculateThrTax` existed with no caller at all, so
    // this endpoint returned a gross figure and the comment in
    // `calculateThrStandalone` said as much: "return amount THR saja". THR is
    // irregular income, so its tax depends on the rest of the year (annualized
    // method) or on the month it lands in (TER) — never on the THR alone.
    const reference = referenceDate ?? new Date();
    const companyId = getCurrentCompanyId();
    if (!companyId) throw new ForbiddenError('THR calculation requires an active company context');
    const [policy, methodSetting] = await Promise.all([
      loadPayrollPolicyConfig(prisma, companyId, reference.getUTCFullYear()),
      prisma.companySetting.findUnique({
        where: { companyId_key: { companyId, key: 'pph21_method' } },
        select: { value: true },
      }),
    ]);
    // The tax base stays base salary, deliberately, and it is NOT the same
    // question as the THR base above.
    //
    // The regular monthly taxable gross ought to be base pay plus taxable
    // allowances. But in this codebase base pay lives only in
    // `EmployeeSalary.baseSalary`: the seeded `Gaji Pokok` component carries no
    // amount and is therefore never allocated, so `employee-pay.ts` — which
    // derives its taxable gross from the allocation alone — leaves base pay out
    // of the monthly tax base entirely. That is a systemic defect the audit has
    // already named, and it is not this change's to fix. Summing the allocation
    // here would inherit it and tax a THR against allowances only; adding base
    // pay to it would create a second, different base from the monthly run.
    // Base salary alone is the closest of the three and changes nothing.
    const thrTax = calculateThrTax({
      monthlyGross: Number(salary.baseSalary),
      thrAmount: result.amount,
      married: employee.maritalStatus === 'MARRIED',
      dependents: employee._count?.families ?? 0,
      hasNpwp: Boolean(employee.taxId),
      monthlyPensionContribution: bpjsPensionFor(policy, Number(salary.baseSalary)),
      method: methodSetting?.value === 'TER' ? 'TER' : 'ANNUALIZED',
      terTables: policy.ter,
    }, policy.pph21);

    // Deliberately logs the employee only. `employee-salary-read.mysql.test.ts`
    // asserts this exact call to keep financial values out of application
    // logs, and the tax is one — my first version logged it and that guard
    // caught it. The method is omitted too rather than weaken an exact match.
    logger.info('THR calculated', { employeeId });

    return {
      employee: { id: employee.id, fullName: employee.fullName, employeeNumber: employee.employeeNumber },
      /** gaji pokok + tunjangan tetap — the base the THR is a month of. */
      monthlyWage: statutoryWage.toNumber(),
      /** Which components counted toward it, so the figure can be checked. */
      fixedAllowances,
      ...result,
      /** PPh 21 withheld from the THR. */
      tax: thrTax.tax,
      /** What the employee actually receives. */
      netAmount: Math.max(0, Math.round(result.amount - thrTax.tax)),
      taxMethod: thrTax.method,
    };
  }

  // ==================== Payroll Periods ====================

  async findAllPayrollPeriods(companyId: string) {
    const access = await companyPayrollAccess(companyId);
    return payrollRepository.findAllPayrollPeriods(access.companyId);
  }

  async findPayrollPeriodById(id: string) {
    const { companyId } = await companyPayrollAccess();
    const period = await payrollRepository.findPayrollPeriodById(id, prisma, companyId);
    if (!period) throw new NotFoundError('Payroll period not found');
    return period;
  }

  async createPayrollPeriod(data: CreatePayrollPeriodDTO) {
    const { companyId } = await companyPayrollAccess(data.companyId);
    data = { ...data, companyId };
    const code = await generateSystemCode({
      prefix: 'PAY-PRD',
      label: data.name,
      exists: async (candidate) => {
        const periods = await payrollRepository.findAllPayrollPeriods(data.companyId);
        return periods.some((period) => period.code === candidate);
      },
    });
    // Date-order + overlap validation: two overlapping periods each admit a
    // run of their own, paying the same calendar days twice.
    const startDate = new Date(data.startDate);
    const endDate = new Date(data.endDate);
    if (endDate.getTime() < startDate.getTime()) {
      throw new BadRequestError('Tanggal akhir periode harus setelah tanggal mulai');
    }
    const overlapping = await prisma.payrollPeriod.findFirst({
      where: { companyId: data.companyId, deletedAt: null, startDate: { lte: endDate }, endDate: { gte: startDate } },
      select: { name: true },
    });
    if (overlapping) {
      throw new ConflictError(`Rentang tanggal tumpang tindih dengan periode "${overlapping.name}"`);
    }

    const period = await payrollRepository.createPayrollPeriod({ ...data, code });

    logger.info('Payroll period created', { periodId: period.id, code: period.code });
    return period;
  }

  async closePayrollPeriod(id: string) {
    const existing = await this.findPayrollPeriodById(id);
    // A period may only close when its run (if any) has finished the money
    // path — closing over an unapproved run permanently locks it in limbo.
    const run = await prisma.payrollRun.findFirst({
      where: { periodId: id, companyId: existing.companyId, status: { notIn: ['VOIDED'] as never[] } },
      select: { id: true, status: true },
    });
    if (run && !['APPROVED', 'DISBURSED'].includes(run.status)) {
      throw new ConflictError(`Run payroll periode ini masih berstatus ${run.status}; approve/disburse atau void dulu sebelum menutup periode`);
    }
    const period = await payrollRepository.closePayrollPeriod(id, existing.companyId);

    logger.info('Payroll period closed', { periodId: id });
    return period;
  }

  async updatePayrollPeriod(id: string, data: UpdatePayrollPeriodDTO) {
    const period = await this.findPayrollPeriodById(id);
    const requestedCode = (data as Record<string, unknown>).code;
    if (typeof requestedCode === 'string' && requestedCode !== period.code) {
      throw new ValidationError('Payroll period code is generated by system and cannot be changed');
    }
    if (period.status === 'CLOSED') {
      throw new BadRequestError('Cannot update a closed payroll period');
    }
    return payrollRepository.updatePayrollPeriod(id, data, period.companyId);
  }

  // ==================== Payroll Runs ====================

  async findAllPayrollRuns(companyId: string) {
    const access = await companyPayrollAccess(companyId);
    return payrollRepository.findAllPayrollRuns(access.companyId);
  }

  async findPayrollRunById(id: string) {
    const { companyId } = await companyPayrollAccess();
    const run = await payrollRepository.findPayrollRunForAccess(id, companyId);
    if (!run) throw new NotFoundError('Payroll run not found');
    return run;
  }

  async getAttendanceSummaryForPeriod(periodId: string) {
    const { companyId } = await companyPayrollAccess();
    return prisma.$transaction(async database => {
      const period = await payrollRepository.findPayrollPeriodById(periodId, database, companyId);
      if (!period) throw new NotFoundError('Payroll period not found');
      const salaries = await payrollRepository.findAllEmployeeSalaries(period.companyId, undefined, database);
      const inputs = await loadPayrollAttendance(database, period.companyId,
        salaries.filter(salary => salary.isActive).map(salary => salary.employeeId), period.startDate, period.endDate);
      const summary: Record<string, PayrollAttendanceSummary> = {};
      for (const [employeeId, row] of inputs) {
        summary[employeeId] = {
          workDays: row.workDays, present: row.present, absent: row.absent, leave: row.leave,
          unpaidLeave: row.unpaidLeave,
          overtime: row.overtime, overtimeWorkday: row.overtimeWorkday, overtimeHoliday: row.overtimeHoliday,
        };
      }
      return { period, attendanceReviewedAt: period.attendanceReviewedAt, summary };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, maxWait: 10000, timeout: 60000 });
  }

  async confirmAttendanceReview(periodId: string, userId: string) {
    const { companyId, actor } = await companyPayrollAccess(undefined, userId);
    const period = await this.findPayrollPeriodById(periodId);
    if (period.status === 'CLOSED') throw new BadRequestError('Period sudah ditutup');
    return payrollRepository.confirmAttendanceReview(periodId, actor.id, companyId);
  }

  async createPayrollRun(data: CreatePayrollRunDTO, userId?: string) {
    if (!userId) throw new BadRequestError('Authenticated payroll creator is required');
    const { companyId, actor } = await companyPayrollAccess(data.companyId, userId);
    data = { ...data, companyId };
    const run = await this.createPayrollRunTransaction(data, actor.id);
    // No external side effects run until the payroll transaction has committed.
    try {
      await eventBus.publish({
        name: DomainEvents.PAYROLL_RUN_CREATED,
        aggregateId: run.id,
        aggregateType: 'PayrollRun',
        data: { runNumber: run.runNumber, companyId: data.companyId, periodId: data.periodId },
        metadata: { eventId: uuidv4(), occurredAt: new Date() },
      });
    } catch {
      logger.warn('Payroll event publication failed after commit', { runId: run.id });
    }
    logger.info('Payroll run created', { runId: run.id, runNumber: run.runNumber });
    return this.findPayrollRunById(run.id);
  }

  private async createPayrollRunTransaction(data: CreatePayrollRunDTO, userId: string) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await prisma.$transaction(async tx => {
          // Same lock as formula publication: revisions cannot change midway
          // through a run, and requests for this company receive distinct numbers.
          const company = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM companies WHERE id = ${data.companyId} AND deleted_at IS NULL FOR UPDATE`;
          if (!company.length) throw new NotFoundError('Company not found');
          const period = await payrollRepository.findPayrollPeriodById(data.periodId, tx, data.companyId);
          if (!period || period.companyId !== data.companyId) throw new NotFoundError('Payroll period not found in this company');
          if (period.status === 'CLOSED') throw new BadRequestError('Cannot create payroll run for a closed period');
          const runType = data.runType ?? 'REGULAR';
          // Only the monthly run is computed from attendance. THR, severance
          // and corrections are not, so gating them on a confirmed attendance
          // recap would block payments that have nothing to do with it.
          if (runType === 'REGULAR' && !period.attendanceReviewedAt) {
            throw new BadRequestError('Attendance harus dikonfirmasi sebelum payroll dihitung.');
          }
          // One run per period PER TYPE. The old rule knew nothing of types, so
          // paying THR meant voiding the month's salary run. VOIDED runs still
          // free their slot for a fresh, corrected run of the same type.
          const existing = await tx.payrollRun.findFirst({
            where: { companyId: data.companyId, periodId: period.id, runType, deletedAt: null, status: { not: 'VOIDED' } },
            select: { id: true },
          });
          if (existing) {
            throw new ConflictError(
              `A ${runType} payroll already exists for this period (${existing.id}); void it first if it needs correction`,
            );
          }
          const runNumber = await payrollRepository.findLatestRunNumber(data.companyId, tx) + 1;
          const run = await payrollRepository.createPayrollRun(data, runNumber, userId, tx);
          await this.calculatePayroll(run.id, tx);
          return run;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10000, timeout: 60000 });
      } catch (error) {
        // Shared predicate: a lost race also arrives as P2010 carrying MySQL
        // 1213/1205, which this site used to leak as a 500.
        if (isConcurrencyFailure(error) && attempt < 2) continue;
        if (isConcurrencyFailure(error)) throw new ConflictError('Payroll run is being created concurrently; retry the request');
        throw error;
      }
    }
  }

  /**
   * Void a wrong, not-yet-approved run (checklist §16 remedy): the run and
   * its payslips stay as historical evidence with status VOIDED, and the
   * period is freed for a corrected run. Approved/disbursed money can never
   * be voided here — that requires a real adjustment flow.
   */
  async voidPayrollRun(id: string, userId: string, reason?: string) {
    const { companyId, actor } = await companyPayrollAccess(undefined, userId);
    const run = await this.findPayrollRunById(id);
    if (run.companyId !== companyId) throw new NotFoundError('Payroll run not found');

    const voided = await prisma.payrollRun.updateMany({
      where: { id, companyId, status: 'COMPLETED' },
      data: {
        status: 'VOIDED',
        notes: `[VOID oleh ${actor.id}${reason ? `: ${reason}` : ''}] ${run.notes ?? ''}`.trim(),
      },
    });
    if (voided.count !== 1) {
      throw new ConflictError('Hanya run berstatus COMPLETED (belum di-approve) yang dapat di-void');
    }
    logger.info('Payroll run voided', { runId: id, voidedBy: actor.id, reason });
    return this.findPayrollRunById(id);
  }

  /**
   * One notification per employee whose payslip the run just published. The
   * notification carries no figures: the amounts stay behind the self-service
   * PIN/reauth gate, so this only says the slip is ready.
   */
  private async notifyPayslipsAvailable(runId: string, companyId: string, periodName: string | null) {
    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: runId, companyId },
      select: { id: true, employeeId: true },
    });
    if (!payslips.length) return;

    const users = await prisma.user.findMany({
      where: { employeeId: { in: payslips.map((payslip) => payslip.employeeId) }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true, employeeId: true },
    });
    const userByEmployee = new Map(users.map((user) => [user.employeeId, user.id]));

    const rows = payslips.flatMap((payslip) => {
      const userId = userByEmployee.get(payslip.employeeId);
      // An employee without an active account has nowhere to be notified.
      if (!userId) return [];
      return [{
        companyId,
        userId,
        title: 'Slip gaji tersedia',
        message: periodName
          ? `Slip gaji periode ${periodName} sudah dapat dibuka di Self Service.`
          : 'Slip gaji terbaru sudah dapat dibuka di Self Service.',
        type: 'INFO' as const,
        resource: 'payslip',
        action: 'PAYSLIP_PUBLISHED',
        referenceId: payslip.id,
      }];
    });
    if (rows.length) await prisma.notification.createMany({ data: rows });

    await this.emailPayslipsAvailable(companyId, periodName, users);
  }

  /**
   * Email the same "it is ready" nudge, when the company has asked for it.
   *
   * Opt-in per company (`payslip_email_notification_enabled`), like every other
   * setting that changes what leaves the system: sending payslip mail to an
   * entire workforce is a tenant decision, not a deploy.
   *
   * Nothing here may break approval. The run is already approved and the
   * payslips are already visible; a mail server being slow or down must not undo
   * that, so every failure is logged and swallowed per recipient.
   */
  private async emailPayslipsAvailable(
    companyId: string,
    periodName: string | null,
    users: Array<{ id: string; employeeId: string | null }>,
  ) {
    if (!users.length) return;

    const setting = await prisma.companySetting.findUnique({
      where: { companyId_key: { companyId, key: 'payslip_email_notification_enabled' } },
      select: { value: true },
    });
    if (setting?.value !== 'true') return;

    const recipients = await prisma.user.findMany({
      where: { id: { in: users.map((user) => user.id) }, email: { not: '' } },
      select: { id: true, email: true },
    });

    const results = await Promise.allSettled(
      recipients.map((recipient) => mailService.sendPayslipAvailable(recipient.email, periodName)),
    );

    const failed = results.filter((result) => result.status === 'rejected').length;
    const sent = results.filter((result) => result.status === 'fulfilled' && result.value).length;
    logger.info('Payslip availability emails dispatched', { companyId, sent, failed, total: recipients.length });
    if (failed) {
      logger.warn('Some payslip availability emails could not be delivered', { companyId, failed });
    }
  }

  async approvePayrollRun(id: string, userId: string) {
    const { companyId, actor } = await companyPayrollAccess(undefined, userId);
    const run = await this.findPayrollRunById(id);
    if (run.status !== 'COMPLETED') {
      throw new BadRequestError('Only completed payroll runs can be approved');
    }

    if (!run.createdBy) throw new ConflictError('Payroll creator is unknown; legacy payroll requires review before approval');
    if (run.createdBy === actor.id) throw new ConflictError('Payroll creator cannot approve their own run');
    const approved = await payrollRepository.approvePayrollRun(id, actor.id, companyId);

    // Approval is what makes a payslip visible in self-service, and until now
    // nobody was told. Employees had to keep checking the app to find out that
    // they had been paid.
    await this.notifyPayslipsAvailable(id, companyId, run.period?.name ?? null);

    await eventBus.publish({
      name: DomainEvents.PAYROLL_RUN_APPROVED,
      aggregateId: id,
      aggregateType: 'PayrollRun',
      data: { approvedBy: userId },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });

    return approved;
  }

  async disbursePayrollRun(id: string, _userId: string): Promise<never> {
    await this.findPayrollRunById(id);
    throw new ConflictError('Direct disbursement is disabled. Create a payment batch, record payment results, then reconcile it.');
  }

  // ==================== B.6 Multibank Disbursement (CSV Export ====================

  /**
   * Group payslips per bank + generate CSV bulk transfer untuk BCA/Mandiri/BNI.
   * Prioritas bank: EmployeeBankAccount primary → first active → legacy bank fields.
   */
  async getPayrollRunDisbursements(runId: string, _bankCodeFilter?: string): Promise<never> {
    await this.findPayrollRunById(runId);
    throw new ConflictError('Create a payment batch and export its immutable bank file from /payroll/payment-batches/:id/export.');
  }

  // ==================== Payslips ====================

  async findPayslipById(id: string) {
    const { companyId, employeeWhere } = await payrollAccess();
    const payslip = await payrollRepository.findPayslipById(id, companyId, employeeWhere);
    if (!payslip) throw new NotFoundError('Payslip not found');
    // B.5 Enrich: inject grouped breakdown (earnings/deductions + statutory summary)
    const breakdown = buildPayslipBreakdown({
      baseSalary: Number(payslip.baseSalary) || 0,
      totalEarnings: Number(payslip.totalEarnings) || 0,
      totalDeductions: Number(payslip.totalDeductions) || 0,
      netPay: Number(payslip.netPay) || 0,
      components: (payslip.components ?? []).map(c => ({
        id: c.id,
        name: c.name,
        type: c.type,
        amount: Number(c.amount) || 0,
        isTaxable: c.isTaxable,
        salaryComponent: c.salaryComponent
          ? { code: c.salaryComponent.code }
          : null,
      })),
    });
    return { ...payslip, breakdown };
  }

  async findPayslipsByEmployee(employeeId: string) {
    const { companyId, actor, employeeWhere } = await payrollAccess();
    if (!actor.employeeId || actor.employeeId !== employeeId) throw new ForbiddenError('Self-service payslips require the authenticated employee');
    // The period list intentionally contains no salary figures or components.
    // Financial fields are only fetched by the detail endpoint after a short-
    // lived payroll unlock grant has been verified.
    return payrollRepository.findPayslipSummariesByEmployee(employeeId, companyId, employeeWhere);
  }

  // ==================== Payroll Calculation ====================

  /**
   * A THR run (Permenaker 6/2016): one month of upah, prorated by months of
   * service, with its PPh 21 withheld — and nothing else.
   *
   * Deliberately NOT a variant of the monthly loop. A THR payslip has no
   * attendance, no overtime, no loan instalment, no BPJS and no arrears: it
   * pays one entitlement and withholds one tax. Threading a runType flag
   * through the monthly path would have put a branch beside every one of those
   * and left the reader to work out which apply.
   *
   * It picks the salary through the same as-of selection the monthly run uses,
   * so the two cannot disagree about what somebody earns.
   */
  private async calculateThrPayroll(runId: string, database: Prisma.TransactionClient) {
    const run = await payrollRepository.findPayrollRunById(runId, database);
    if (!run) throw new NotFoundError('Payroll run not found');

    const allSalaryRows = await payrollRepository.findAllEmployeeSalaries(run.companyId, undefined, database);
    const employeeSalaries = this.asOfSalariesOrConflict(allSalaryRows, run.period.endDate);

    const thrComponent = await this.ensureThrEarningComponent(run.companyId, database);
    // Without somewhere to record the withholding the run would pay THR gross
    // and the company would owe tax it never deducted. Refuse instead.
    const taxComponent = await payrollRepository.findSalaryComponentByCode(run.companyId, 'PPH21', database);
    if (!taxComponent) {
      throw new BadRequestError(
        'No PPH21 salary component exists for this company, so the PPh 21 on the THR cannot be '
        + 'recorded; create it before running THR',
      );
    }

    const referenceDate = new Date(run.period.endDate);
    const [policy, methodSetting] = await Promise.all([
      loadPayrollPolicyConfig(database, run.companyId, referenceDate.getUTCFullYear()),
      database.companySetting.findUnique({
        where: { companyId_key: { companyId: run.companyId, key: 'pph21_method' } },
        select: { value: true },
      }),
    ]);
    const method = methodSetting?.value === 'TER' ? 'TER' as const : 'ANNUALIZED' as const;

    let totalEarnings = new Prisma.Decimal(0);
    let totalDeductions = new Prisma.Decimal(0);
    let employeeCount = 0;

    for (const salary of employeeSalaries) {
      const employee = salary.employee;
      // Tenure decides both eligibility and the prorated fraction, so a
      // missing join date cannot be guessed. Named, so it is fixable.
      if (!employee?.joinDate) {
        throw new BadRequestError(
          `Employee ${employee?.employeeNumber ?? salary.employeeId} has no join date, `
          + 'so THR tenure cannot be computed; fill it in before running THR',
        );
      }

      const { wage } = monthlyStatutoryWage(salary.baseSalary, salary.components);
      const thr = calculateThr({
        monthlyWage: wage.toNumber(),
        joinDate: employee.joinDate,
        referenceDate,
      });
      // Under one month of service earns no THR, and a payslip for nothing
      // would show up in every report as if it had been paid.
      if (!thr.eligible || thr.amount <= 0) continue;

      const tax = calculateThrTax({
        // Base salary, for the same reason `calculateEmployeeThr` uses it: the
        // monthly engine leaves base pay out of its taxable gross because the
        // seeded base-pay component is never allocated, and inventing a second
        // different base here would make the THR tax disagree with the run.
        monthlyGross: Number(salary.baseSalary),
        thrAmount: thr.amount,
        married: employee.maritalStatus === 'MARRIED',
        dependents: employee._count?.families ?? 0,
        hasNpwp: Boolean(employee.taxId),
        monthlyPensionContribution: bpjsPensionFor(policy, Number(salary.baseSalary)),
        method,
        terTables: policy.ter,
      }, policy.pph21);

      const netPay = new Prisma.Decimal(thr.amount).minus(tax.tax).toDecimalPlaces(2).toNumber();
      if (netPay < 0) {
        throw new BadRequestError('THR withholding exceeds the THR itself; review the tax configuration');
      }

      const payslip = await payrollRepository.createPayslip({
        payrollRun: { connect: { id: runId } },
        employee: { connect: { id: salary.employeeId } },
        company: { connect: { id: run.companyId } },
        employeeSalary: { connect: { id: salary.id } },
        baseSalary: salary.baseSalary,
        totalEarnings: thr.amount,
        totalDeductions: tax.tax,
        netPay,
        // A THR run is not a month of work. Leaving these at zero says so,
        // rather than copying a month's attendance onto a payment that has
        // nothing to do with days worked.
        workDays: 0, presentDays: 0, leaveDays: 0, absentDays: 0,
        overtimeHours: 0, overtimeWorkdayHours: 0, overtimeHolidayHours: 0,
        employeeSnapshot: {
          fullName: employee.fullName,
          employeeNumber: employee.employeeNumber,
          employmentType: employee.employmentType,
          departmentId: employee.department?.id ?? null,
          departmentName: employee.department?.name ?? null,
          positionId: employee.position?.id ?? null,
          positionName: employee.position?.name ?? null,
          // The working, frozen with the payment: a THR figure nobody can
          // re-derive a year later is a figure nobody can defend.
          thr: {
            tenureMonths: thr.tenureMonths,
            isProrated: thr.isProrated,
            monthlyWage: wage.toString(),
            taxMethod: tax.method,
          },
        },
        status: 'DRAFT',
      }, database);

      await payrollRepository.createPayslipComponents([
        {
          payslipId: payslip.id,
          salaryComponentId: thrComponent.id,
          name: thrComponent.name,
          type: 'ALLOWANCE',
          amount: thr.amount,
          // Taxable income, which is why there is a withholding at all.
          isTaxable: true,
        },
        {
          payslipId: payslip.id,
          salaryComponentId: taxComponent.id,
          name: taxComponent.name,
          type: 'DEDUCTION',
          amount: tax.tax,
          isTaxable: false,
        },
      ], database);

      totalEarnings = totalEarnings.plus(thr.amount);
      totalDeductions = totalDeductions.plus(tax.tax);
      employeeCount += 1;
    }

    await payrollRepository.updatePayrollRunTotals(runId, {
      totalEmployees: employeeCount,
      totalEarnings,
      totalDeductions,
      totalNetPay: totalEarnings.minus(totalDeductions),
    }, database);
    await payrollRepository.updatePayrollRunStatus(runId, 'COMPLETED', undefined, database);
  }

  /** As-of selection, with its data error surfaced as the HTTP conflict. */
  private asOfSalariesOrConflict<T extends { employeeId: string; effectiveDate: Date | string; isActive: boolean }>(
    rows: readonly T[], periodEnd: Date | string,
  ): T[] {
    try {
      return selectAsOfSalaries(rows, periodEnd);
    } catch (error) {
      if (error instanceof AmbiguousSalaryError) throw new ConflictError(error.message);
      throw error;
    }
  }

  private async calculatePayroll(runId: string, database: Prisma.TransactionClient) {
    const run = await payrollRepository.findPayrollRunById(runId, database);
    if (!run) throw new NotFoundError('Payroll run not found');

    // runType reached the create DTO before this calculation learned what the
    // types mean, and nothing below reads it: a THR run recalculated a full
    // month of salary, so a period already paid gained a second complete set
    // of payslips that could be approved and disbursed on its own. THR is one
    // month of upah under Permenaker 6/2016, not a second salary, and
    // severance has its own tax treatment. Refuse the types this engine cannot
    // compute instead of paying a regular salary under their name.
    // THR has its own calculation: one month of upah with its PPh 21, and none
    // of the attendance, overtime, loan or BPJS machinery below.
    if (run.runType === 'THR') {
      return this.calculateThrPayroll(runId, database);
    }
    // SEVERANCE and CORRECTION are still refused. Severance is computed and
    // taxed on the exit path (`onboarding.calculateFinalPayroll`, PP 68/2009),
    // not as a payroll run; and a correction run would need to know which
    // period it corrects and what was already paid. Answering with a regular
    // month's salary under either name is the failure this guard exists for.
    if (run.runType !== 'REGULAR') {
      throw new ConflictError(
        `A ${run.runType} payroll run cannot be calculated: this engine computes regular monthly payroll `
        + 'and THR. Void the run, or record the amounts as arrears on a regular run.',
      );
    }

    // As-of salary selection (checklist §18): the run pays the LATEST salary
    // row effective on or before the period end. Future-dated raises no
    // longer leak into the current run. A row deactivated only because a
    // future-dated row superseded it still pays; a deliberately paused
    // employee (latest row inactive, nothing newer) is skipped.
    const allSalaryRows = await payrollRepository.findAllEmployeeSalaries(run.companyId, undefined, database);
    // Moved to `shared/payroll/as-of-salary.ts` when the THR run became a
    // second caller: two copies would be two answers to "what is this person's
    // salary right now".
    const employeeSalaries = this.asOfSalariesOrConflict(allSalaryRows, run.period.endDate);
    // Read the published revision set once for the whole run. Later publications
    // never change the version used midway through employee calculations.
    const formulaVersions = selectFormulaVersions(await database.payrollFormulaVersion.findMany({
      where: { companyId: run.companyId, status: 'PUBLISHED' },
    }), new Date(run.period.startDate));
    const loanDeductionComponent = await this.ensureLoanDeductionComponent(run.companyId, database);
    const overtimeEarningComponent = await this.ensureOvertimeEarningComponent(run.companyId, database);
    const lateDeductionComponent = await this.ensureLateDeductionComponent(run.companyId, database);
    const absenceDeductionComponent = await this.ensureAbsenceDeductionComponent(run.companyId, database);
    const ewaDeductionComponent = await this.ensureEWADeductionComponent(run.companyId, database);
    const arrearsEarningComponent = await this.ensureArrearsEarningComponent(run.companyId, database);
    // Arrears carried over from closed periods (GAP-14). Read once for the run
    // so a row registered midway cannot land on two payslips.
    const arrearsByEmployee = await payrollArrearsService.pendingByEmployee(run.companyId, database);
    const arrearsClaims: Array<{ arrearsId: string; payslipId: string }> = [];
    // Approved leave encashments (GAP-09). The balance was already deducted at
    // approval; this run only pays for it.
    const encashmentComponent = await this.ensureLeaveEncashmentComponent(run.companyId, database);
    const encashmentsByEmployee = await leaveEncashmentService.approvedByEmployee(run.companyId, database);
    const encashmentClaims: Array<{ encashmentId: string; payslipId: string }> = [];

    // December PPh21 reconciliation (GAP-16). Opt-in per company, because it
    // changes take-home pay in the last month of the year; and only in the
    // period that actually ends the fiscal year, so a mid-year run cannot
    // accidentally settle a year that is not over.
    // PPh 21 withholding method (GAP-40). TER (PP 58/2023) has been the
    // mandatory monthly method since January 2024, but switching it on changes
    // every employee's take-home pay in both directions, so it stays a
    // deliberate tenant decision rather than a consequence of deploying.
    const methodSetting = await database.companySetting.findUnique({
      where: { companyId_key: { companyId: run.companyId, key: 'pph21_method' } },
      select: { value: true },
    });
    const useTer = methodSetting?.value === 'TER';

    const reconciliationSetting = await database.companySetting.findUnique({
      where: { companyId_key: { companyId: run.companyId, key: 'pph21_december_reconciliation_enabled' } },
      select: { value: true },
    });
    const fiscalPeriodEnd = new Date(run.period.endDate);
    const isFinalPeriodOfYear = fiscalPeriodEnd.getUTCMonth() === 11;
    // TER forces the year-end settlement on. Under TER the monthly figure is a
    // withholding rate, not a twelfth of the year's tax, so without the
    // December true-up the year's withholding would simply never equal the
    // year's liability — and the employee would carry the difference with
    // nothing in the system saying so. Under the annualized method it stays
    // opt-in, because there the twelve months already add up.
    const reconcileAnnualTax = shouldReconcileAnnualTax({
      isFinalPeriodOfYear,
      useTer,
      optedIn: reconciliationSetting?.value === 'true',
    });
    const taxComponent = reconcileAnnualTax
      ? await payrollRepository.findSalaryComponentByCode(run.companyId, 'PPH21', database)
      : null;
    const taxCorrectionComponent = reconcileAnnualTax
      ? await this.ensureTaxCorrectionComponent(run.companyId, database)
      : null;
    const priorPayslips = reconcileAnnualTax
      ? await database.payslip.findMany({
          where: {
            companyId: run.companyId,
            payrollRun: {
              // A paid run is DISBURSED, not APPROVED: settlement moves it
              // (payroll-payment-settlement.ts:34), the only supported payment
              // path. Reading APPROVED alone finds nothing by December, when
              // every earlier run has been paid — so the year-end true-up ran
              // against an empty history and refunded December instead.
              status: { in: ['APPROVED', 'DISBURSED'] },
              period: {
                startDate: { gte: new Date(Date.UTC(fiscalPeriodEnd.getUTCFullYear(), 0, 1)) },
                endDate: { lte: fiscalPeriodEnd },
              },
            },
          },
          select: {
            employeeId: true,
            components: { select: { salaryComponentId: true, amount: true, type: true, isTaxable: true } },
          },
        })
      : [];
    const priorByEmployee = new Map<string, typeof priorPayslips>();
    for (const slip of priorPayslips) {
      const list = priorByEmployee.get(slip.employeeId) ?? [];
      list.push(slip);
      priorByEmployee.set(slip.employeeId, list);
    }
    // Benefit contributions (checklist §19). Opt-in per company via the
    // benefit_payroll_deduction_enabled setting: enabling it changes
    // take-home pay, so it must be a deliberate tenant decision, not a deploy.
    const benefitSetting = await database.companySetting.findUnique({
      where: { companyId_key: { companyId: run.companyId, key: 'benefit_payroll_deduction_enabled' } },
      select: { value: true },
    });
    const benefitDeductionEnabled = benefitSetting?.value === 'true';
    // Unpaid-leave deduction (org decision, dynamic per company): approved
    // leave on an unpaid leave type deducts a daily wage when enabled.
    // Gross-up (GAP-17): the company pays its employees' PPh21 as a taxable
    // tax allowance, so take-home pay no longer moves with the tax. Opt-in per
    // company — it raises employer cost and rewrites every payslip.
    const grossUpSetting = await database.companySetting.findUnique({
      where: { companyId_key: { companyId: run.companyId, key: 'pph21_gross_up_enabled' } },
      select: { value: true },
    });
    const taxAllowanceComponent = grossUpSetting?.value === 'true'
      ? await this.ensureTaxAllowanceComponent(run.companyId, database)
      : null;
    // Gross-up solves `allowance = tax(gross + allowance)` against the annual
    // method; against TER that is a different equation. Running both would
    // produce a number neither policy means, so the run stops before writing
    // anything rather than paying it.
    if (useTer && taxAllowanceComponent) {
      throw new ConflictError(
        'PPh 21 gross-up (pph21_gross_up_enabled) and the TER method (pph21_method=TER) '
        + 'cannot both be enabled; turn one off before running payroll',
      );
    }
    const unpaidLeaveSetting = await database.companySetting.findUnique({
      where: { companyId_key: { companyId: run.companyId, key: 'unpaid_leave_deduction_enabled' } },
      select: { value: true },
    });
    const unpaidLeaveDeductionEnabled = unpaidLeaveSetting?.value === 'true';
    const unpaidLeaveDeductionComponent = unpaidLeaveDeductionEnabled
      ? await this.ensureUnpaidLeaveDeductionComponent(run.companyId, database)
      : null;
    const benefitDeductionComponent = benefitDeductionEnabled
      ? await this.ensureBenefitDeductionComponent(run.companyId, database)
      : null;
    const benefitEnrollmentsByEmployee = new Map<string, Array<{ id: string; employeePercent: number; employerPercent: number }>>();
    if (benefitDeductionEnabled) {
      const enrollments = await database.benefitEnrollment.findMany({
        where: {
          companyId: run.companyId,
          deletedAt: null,
          status: 'ACTIVE',
          effectiveDate: { lte: new Date(run.period.endDate) },
          OR: [{ expiryDate: null }, { expiryDate: { gte: new Date(run.period.startDate) } }],
        },
        select: {
          id: true,
          employeeId: true,
          benefitPlan: { select: { employeeContribution: true, employerContribution: true } },
        },
      });
      for (const enrollment of enrollments) {
        const rows = benefitEnrollmentsByEmployee.get(enrollment.employeeId) ?? [];
        rows.push({
          id: enrollment.id,
          employeePercent: Number(enrollment.benefitPlan.employeeContribution),
          employerPercent: Number(enrollment.benefitPlan.employerContribution),
        });
        benefitEnrollmentsByEmployee.set(enrollment.employeeId, rows);
      }
    }
    const lateCfg = await companySettingsService.getLateDeductionConfig(run.companyId, database);
    const workweekDays = await companySettingsService.getWorkweekDays(run.companyId, database);
    // Tax/BPJS reference tables (per company, per year); statutory code
    // defaults apply when no rows exist for the period's year.
    const payrollPolicy = await loadPayrollPolicyConfig(database, run.companyId, new Date(run.period.startDate).getUTCFullYear());
    // Freeze the configuration this run used (checklist §15): tax brackets,
    // PTKP, BPJS rates and late/absence settings are mutable reference data.
    await database.payrollRun.update({
      where: { id: runId },
      data: {
        policySnapshot: JSON.parse(JSON.stringify({
          pph21: {
            ...payrollPolicy.pph21,
            brackets: payrollPolicy.pph21.brackets?.map(([upper, rate]) => [Number.isFinite(upper) ? upper : 'INF', rate]),
            ptkpAmounts: payrollPolicy.pph21.ptkpAmounts ? Object.fromEntries(payrollPolicy.pph21.ptkpAmounts) : undefined,
          },
          bpjs: payrollPolicy.bpjs,
          lateConfig: lateCfg,
          workweekDays,
          grossUp: taxAllowanceComponent !== null,
        })),
      },
    });
    const dueLoanInstallments = await employeeLoanRepository.findDueInstallmentsForPayroll(
      run.companyId,
      new Date(run.period.endDate), database
    );
    const loanDeductionByEmployee = dueLoanInstallments.reduce<Record<string, Prisma.Decimal>>((acc, installment) => {
      const employeeId = installment.loan.employeeId;
      acc[employeeId] = (acc[employeeId] ?? new Prisma.Decimal(0)).plus(installment.amount);
      return acc;
    }, {});

    const periodStart = payrollDate(run.period.startDate);
    const periodEnd = payrollDate(run.period.endDate);
    const attendanceInputs = await loadPayrollAttendance(database, run.companyId,
      employeeSalaries.filter(salary => salary.isActive).map(salary => salary.employeeId), periodStart, periodEnd);

    const paidEWAsForPeriod = await ewaRepository.findPAIDByEmployeeAndPeriod(
      run.companyId, 'all', periodStart, periodEnd, database,
    );
    const ewaDeductionByEmployee = new Map<string, { total: Prisma.Decimal; deductions: PayrollEWADeduction[] }>();
    for (const row of paidEWAsForPeriod) {
      const amount = new Prisma.Decimal(row.amountPaidOut ?? row.amountRequested);
      if (!amount.isFinite() || amount.isNegative() || amount.greaterThan('9999999999999.99')) {
        throw new BadRequestError('EWA contains an invalid payroll deduction amount');
      }
      if (amount.isZero()) continue;
      const employee = ewaDeductionByEmployee.get(row.employeeId) ?? { total: new Prisma.Decimal(0), deductions: [] };
      employee.total = employee.total.plus(amount);
      employee.deductions.push({ id: row.id, employeeId: row.employeeId, amount,
        amountRequested: row.amountRequested, amountPaidOut: row.amountPaidOut });
      ewaDeductionByEmployee.set(row.employeeId, employee);
    }

    // Task 4.2 — Aggregate net LATE MINUTES per employee + per day key for daily cap deduction
    // Late minutes reduced by BranchAttendancePolicy.lateToleranceMinutes per attendance row
    const perDayLateMinutesByEmployee: Record<string, Record<string, number>> = {};
    if (lateCfg.enabled) {
      const lateAttendanceRows = await database.attendance.findMany({
        where: {
          companyId: run.companyId,
          date: { gte: periodStart, lte: periodEnd },
          deletedAt: null,
          lateMinutes: { gt: 0 },
          OR: [{ status: 'LATE' }, { status: 'PRESENT' }],
        },
        select: {
          employeeId: true,
          date: true,
          lateMinutes: true,
          attendancePolicy: { select: { lateToleranceMinutes: true } },
        },
      });
      for (const row of lateAttendanceRows) {
        const dayKey = payrollDateKey(row.date);
        if (!attendanceInputs.get(row.employeeId)?.workingDates.has(dayKey)) continue;
        const tolerance = Number(row.attendancePolicy?.lateToleranceMinutes ?? 0);
        const netMinutes = Math.max(0, Number(row.lateMinutes ?? 0) - tolerance);
        if (netMinutes <= 0) continue;
        if (!perDayLateMinutesByEmployee[row.employeeId]) perDayLateMinutesByEmployee[row.employeeId] = {};
        perDayLateMinutesByEmployee[row.employeeId][dayKey] = (perDayLateMinutesByEmployee[row.employeeId][dayKey] || 0) + netMinutes;
      }
    }

    let totalEarnings = new Prisma.Decimal(0);
    let totalDeductions = new Prisma.Decimal(0);
    const processedEmployees = new Set<string>();
    const appliedEwaDeductions: PayrollEWADeduction[] = [];
    let employeeCount = 0;

    for (const salary of employeeSalaries) {
      if (!salary.isActive) continue;
      // The employed slice of this period decides both whether to pay and how
      // much. Skipping on status alone dropped a leaver's final partial month
      // entirely: they resign on the 10th, their status is RESIGNED by the
      // time the run happens, and the days they actually worked were never
      // paid. Status still ends payment — but from the period after the one
      // their last working day falls in, not from this one.
      const slice = employmentWindow({
        periodStart,
        periodEnd,
        joinDate: salary.employee.joinDate,
        lastWorkingDate: salary.employee.resignations?.[0]?.lastWorkingDate ?? null,
      });
      if (!slice.employedAtAll) continue;
      // A non-ACTIVE employee is only paid for a period their window reaches
      // into; once it does not, the status check does the rest as before.
      if (salary.employee.status !== 'ACTIVE' && !slice.prorated) continue;
      if (salary.companyId !== run.companyId || salary.employee.companyId !== run.companyId || salary.components.some(allocation => allocation.salaryComponent.companyId !== run.companyId)) {
        throw new ConflictError('Salary allocation references a component outside the payroll company');
      }

      if (processedEmployees.has(salary.employeeId)) throw new ConflictError('Multiple active salaries found for one employee; review salary allocations');
      if (salary.currency !== 'IDR') throw new BadRequestError('Payroll calculation currently supports IDR salary allocations');
      processedEmployees.add(salary.employeeId);

      const loanDeductionAmount = loanDeductionByEmployee[salary.employeeId]?.toNumber() ?? 0;
      const attd = attendanceInputs.get(salary.employeeId);
      if (!attd) throw new BadRequestError('Payroll attendance inputs are unavailable for this employee');
      const workDaysInPeriod = attd.workDays;
      const overtimeHoursForEmployee = attd.overtime;
      const leaveDaysForEmployee = attd.leave;
      const absentDays = attd.absent;
      // Overtime on non-working days (per the employee's resolved calendar)
      // is paid at the statutory holiday bands (2x/3x/4x), not workday bands.
      const overtimePayAmount =
        (attd.overtimeWorkday > 0
          ? calculateOvertimePay({ monthlyWage: Number(salary.baseSalary), hours: attd.overtimeWorkday, dayType: 'WORKDAY', workweekDays }).amount
          : 0) +
        (attd.overtimeHoliday > 0
          ? calculateOvertimePay({ monthlyWage: Number(salary.baseSalary), hours: attd.overtimeHoliday, dayType: 'HOLIDAY', workweekDays }).amount
          : 0);

      // Task 4.2 — Hitung nominal potongan keterlambatan (dengan daily cap persentase gaji pokok)
      const baseMonthlyWage = Number(salary.baseSalary);
      let lateDeductionAmount = 0;
      if (lateCfg.enabled && perDayLateMinutesByEmployee[salary.employeeId]) {
        const dailyCapIdr = baseMonthlyWage * (lateCfg.dailyCapPercentOfBasic / 100);
        const dayMap = perDayLateMinutesByEmployee[salary.employeeId];
        for (const dayKey in dayMap) {
          const dayRawAmount = dayMap[dayKey] * lateCfg.ratePerMinuteIdr;
          lateDeductionAmount += Math.min(dayRawAmount, dailyCapIdr);
        }
        lateDeductionAmount = Math.round(lateDeductionAmount);
      }
      // Task 4.2 — Hitung nominal potongan alpha tidak hadir (persen × gaji / hari kerja default)
      let absenceDeductionAmount = 0;
      if (absentDays > 0 && lateCfg.absenceDailyPercentOfBasic > 0 && lateCfg.defaultWorkingDaysPerMonth > 0) {
        const perDayWageRate = baseMonthlyWage / lateCfg.defaultWorkingDaysPerMonth;
        const perDayDeduction = perDayWageRate * (lateCfg.absenceDailyPercentOfBasic / 100);
        absenceDeductionAmount = Math.round(perDayDeduction * absentDays);
      }

      const benefitRows = benefitEnrollmentsByEmployee.get(salary.employeeId) ?? [];
      const benefitDeductions = benefitRows.map((row) => {
        const employeeAmount = Math.round((baseMonthlyWage * row.employeePercent) / 100);
        const employerAmount = Math.round((baseMonthlyWage * row.employerPercent) / 100);
        return { benefitEnrollmentId: row.id, employeeAmount, employerAmount, totalAmount: employeeAmount + employerAmount };
      });
      const benefitEmployeeTotal = benefitDeductions.reduce((sum, row) => sum + row.employeeAmount, 0);

      const extraComponents: PayComponent[] = [];
      if (unpaidLeaveDeductionComponent && attd.unpaidLeave > 0 && lateCfg.defaultWorkingDaysPerMonth > 0) {
        extraComponents.push({
          salaryComponentId: unpaidLeaveDeductionComponent.id,
          name: 'Potongan Cuti Tidak Dibayar',
          type: 'DEDUCTION',
          amount: Math.round((baseMonthlyWage / lateCfg.defaultWorkingDaysPerMonth) * attd.unpaidLeave),
          isTaxable: false,
        });
      }
      if (benefitDeductionComponent && benefitEmployeeTotal > 0) {
        extraComponents.push({
          salaryComponentId: benefitDeductionComponent.id,
          name: 'Potongan Iuran Benefit',
          type: 'DEDUCTION',
          amount: benefitEmployeeTotal,
          isTaxable: false,
        });
      }
      if (loanDeductionAmount > 0) {
        extraComponents.push({
          salaryComponentId: loanDeductionComponent.id,
          name: 'Potongan Pinjaman Karyawan',
          type: 'DEDUCTION',
          amount: loanDeductionAmount,
          isTaxable: false,
        });
      }
      if (overtimePayAmount > 0) {
        extraComponents.push({
          salaryComponentId: overtimeEarningComponent.id,
          name: 'Tunjangan Lembur',
          type: 'ALLOWANCE',
          amount: overtimePayAmount,
          isTaxable: true,
        });
      }
      if (lateDeductionAmount > 0) {
        extraComponents.push({
          salaryComponentId: lateDeductionComponent.id,
          name: 'Potongan Keterlambatan',
          type: 'DEDUCTION',
          amount: lateDeductionAmount,
          isTaxable: false,
        });
      }
      if (absenceDeductionAmount > 0) {
        extraComponents.push({
          salaryComponentId: absenceDeductionComponent.id,
          name: 'Potongan Tidak Hadir (Alpha)',
          type: 'DEDUCTION',
          amount: absenceDeductionAmount,
          isTaxable: false,
        });
      }
      const ewaDeductInfo = ewaDeductionByEmployee.get(salary.employeeId);
      const ewaDeductionAmount = ewaDeductInfo?.total.toNumber() ?? 0;
      if (ewaDeductionAmount > 0) {
        appliedEwaDeductions.push(...(ewaDeductInfo?.deductions ?? []));
        extraComponents.push({
          salaryComponentId: ewaDeductionComponent.id,
          name: 'Potongan EWA (Tarik Gaji Awal)',
          type: 'DEDUCTION',
          amount: ewaDeductionAmount,
          isTaxable: false,
        });
      }

      // Rapel: paid as its own earning, named after the period it came from, so
      // the payslip says why the month is bigger than usual. Taxable, because
      // arrears are taxed in the period they are paid.
      const employeeArrears = arrearsByEmployee.get(salary.employeeId) ?? [];
      for (const arrears of employeeArrears) {
        const amount = new Prisma.Decimal(arrears.grossAmount);
        if (amount.lessThanOrEqualTo(0)) continue;
        extraComponents.push({
          salaryComponentId: arrearsEarningComponent.id,
          name: `Rapel ${arrears.sourcePeriod.code}`,
          type: 'ALLOWANCE',
          amount: amount.toNumber(),
          isTaxable: true,
        });
      }

      const employeeEncashments = encashmentsByEmployee.get(salary.employeeId) ?? [];
      for (const encashment of employeeEncashments) {
        const amount = new Prisma.Decimal(encashment.grossAmount);
        if (amount.lessThanOrEqualTo(0)) continue;
        extraComponents.push({
          salaryComponentId: encashmentComponent.id,
          name: `Pencairan ${encashment.leaveType.name} (${encashment.days} hari)`,
          type: 'ALLOWANCE',
          amount: amount.toNumber(),
          // Encashed leave is ordinary income in the month it is paid.
          isTaxable: true,
        });
      }

      const emp = salary.employee;
      const taxContext = {
        married: emp?.maritalStatus === 'MARRIED',
        dependents: emp?._count?.families ?? 0,
        hasNpwp: Boolean(emp?.taxId),
      };

      const pay = calculateEmployeePay(salary, extraComponents, taxContext, {
        BASE_SALARY: salary.baseSalary.toString(), WORK_DAYS: String(workDaysInPeriod),
        PRESENT_DAYS: String(attd.present), LEAVE_DAYS: String(leaveDaysForEmployee),
        ABSENT_DAYS: String(absentDays), OVERTIME_HOURS: String(overtimeHoursForEmployee),
      }, formulaVersions, {
        ...payrollPolicy,
        // Only components the tenant flagged isProrated are scaled; see
        // employee-pay.ts. A full window leaves every amount untouched.
        prorationFactor: slice.fraction,
        useTer,
        taxAllowance: taxAllowanceComponent
          ? { salaryComponentId: taxAllowanceComponent.id, name: taxAllowanceComponent.name }
          : null,
      });

      let earningsTotal = pay.earningsTotal;
      let deductionsTotal = pay.deductionsTotal;
      const components = [...pay.components];
      const formulaCalculations = pay.formulaCalculations;

      if (reconcileAnnualTax && taxComponent && taxCorrectionComponent) {
        const correction = this.annualTaxCorrection({
          taxComponentId: taxComponent.id,
          thisPeriod: components,
          priorSlips: priorByEmployee.get(salary.employeeId) ?? [],
          taxContext,
          pension: bpjsPensionFor(payrollPolicy, Number(salary.baseSalary)),
          policy: payrollPolicy,
        });

        if (correction && correction.delta !== 0) {
          const isShortfall = correction.delta > 0;
          const amount = Math.abs(correction.delta);
          components.push({
            salaryComponentId: taxCorrectionComponent.id,
            name: isShortfall ? 'Koreksi PPh21 Tahunan' : 'Pengembalian PPh21 Tahunan',
            type: isShortfall ? 'DEDUCTION' : 'ALLOWANCE',
            amount,
            // The correction settles tax; it is not itself taxable income.
            isTaxable: false,
          });
          if (isShortfall) deductionsTotal = new Prisma.Decimal(deductionsTotal).plus(amount).toDecimalPlaces(2).toNumber();
          else earningsTotal = new Prisma.Decimal(earningsTotal).plus(amount).toDecimalPlaces(2).toNumber();
        }
      }

      const netPay = new Prisma.Decimal(earningsTotal).minus(deductionsTotal).toDecimalPlaces(2).toNumber();
      if (netPay < 0) throw new BadRequestError('Payroll deductions exceed earnings; review the calculation before approval');

      // Create payslip
      const payslip = await payrollRepository.createPayslip({
        payrollRun: { connect: { id: runId } },
        employee: { connect: { id: salary.employeeId } },
        company: { connect: { id: run.companyId } },
        employeeSalary: { connect: { id: salary.id } },
        baseSalary: salary.baseSalary,
        totalEarnings: earningsTotal,
        totalDeductions: deductionsTotal,
        netPay,
        workDays: workDaysInPeriod,
        presentDays: attd.present,
        leaveDays: leaveDaysForEmployee,
        absentDays,
        overtimeHours: overtimeHoursForEmployee,
        overtimeWorkdayHours: attd.overtimeWorkday,
        overtimeHolidayHours: attd.overtimeHoliday,
        // Frozen org context (checklist §15): historical payslips must not
        // re-render against the live employee row after a transfer.
        employeeSnapshot: {
          fullName: salary.employee.fullName,
          employeeNumber: salary.employee.employeeNumber,
          employmentType: salary.employee.employmentType,
          departmentId: salary.employee.department?.id ?? null,
          departmentName: salary.employee.department?.name ?? null,
          positionId: salary.employee.position?.id ?? null,
          positionName: salary.employee.position?.name ?? null,
        },
        status: 'DRAFT',
        ...(benefitDeductions.length
          ? { benefitDeductions: { create: benefitDeductions } }
          : {}),
        formulaCalculations: { create: formulaCalculations.map(calculation => ({
          companyId: run.companyId, runId, componentId: calculation.componentId,
          versionId: calculation.versionId, expression: calculation.expression, amount: calculation.amount,
          inputs: calculation.inputs, dependencies: calculation.dependencies, engineVersion: calculation.engineVersion,
        })) },
        loanDeductionSnapshots: {
          create: dueLoanInstallments
            .filter(installment => installment.loan.employeeId === salary.employeeId)
            .map(installment => ({ companyId: run.companyId, runId,
              loanId: installment.loanId, installmentId: installment.id, amount: installment.amount })),
        },
      }, database);

      for (const arrears of employeeArrears) {
        arrearsClaims.push({ arrearsId: arrears.id, payslipId: payslip.id });
      }
      for (const encashment of employeeEncashments) {
        encashmentClaims.push({ encashmentId: encashment.id, payslipId: payslip.id });
      }

      // Create payslip components
      if (components.length > 0) {
        await payrollRepository.createPayslipComponents(
          components.map((c) => ({
            payslipId: payslip.id,
            salaryComponentId: c.salaryComponentId,
            name: c.name,
            type: c.type,
            amount: c.amount,
            isTaxable: c.isTaxable,
          })), database
        );
      }

      totalEarnings = totalEarnings.plus(earningsTotal);
      totalDeductions = totalDeductions.plus(deductionsTotal);
      employeeCount++;
    }

    // Claim only EWA rows actually represented on a generated slip. Conditional
    // updates detect stale amounts/statuses; any failure rolls the entire run back.
    if (employeeCount === 0) throw new BadRequestError('No active employee salaries are available for this payroll');
    await ewaRepository.markPayrollDeductions(run.companyId, runId, appliedEwaDeductions, database);
    // Same discipline as EWA: claim conditionally on PENDING so a row another
    // run already took fails this one instead of being paid twice.
    await payrollArrearsService.markApplied(run.companyId, runId, arrearsClaims, database);
    await leaveEncashmentService.markPaid(run.companyId, runId, encashmentClaims, database);
    const totalNetPay = totalEarnings.minus(totalDeductions);
    for (const amount of [totalEarnings, totalDeductions, totalNetPay]) {
      if (!amount.isFinite() || amount.isNegative() || amount.greaterThan('9999999999999.99')) {
        throw new BadRequestError('Payroll totals exceed the supported monetary range');
      }
    }

    // Update run totals
    await payrollRepository.updatePayrollRunTotals(runId, {
      totalEmployees: employeeCount,
      totalEarnings,
      totalDeductions,
      totalNetPay,
    }, database);

    // Mark run as completed
    await payrollRepository.updatePayrollRunStatus(runId, 'COMPLETED', undefined, database);

  }

  /**
   * Work out what December owes or must refund.
   *
   * Returns null when the year cannot be settled honestly — no taxable months,
   * or no tax component to read withholding from — because a confident zero
   * would be worse than doing nothing.
   */
  private annualTaxCorrection(input: {
    taxComponentId: string;
    thisPeriod: PayComponent[];
    priorSlips: Array<{ components: Array<{ salaryComponentId: string; amount: Prisma.Decimal; type: string; isTaxable: boolean }> }>;
    taxContext: { married: boolean; dependents: number; hasNpwp: boolean };
    pension: number;
    policy: { pph21?: Record<string, unknown> };
  }) {
    const taxableOf = (rows: Array<{ type: string; isTaxable: boolean; amount: number | Prisma.Decimal }>) =>
      rows
        .filter((row) => row.type === 'ALLOWANCE' && row.isTaxable)
        .reduce((sum, row) => sum + Number(row.amount), 0);
    const withheldOf = (rows: Array<{ salaryComponentId: string; amount: number | Prisma.Decimal }>) =>
      rows
        .filter((row) => row.salaryComponentId === input.taxComponentId)
        .reduce((sum, row) => sum + Number(row.amount), 0);

    const monthlyGrosses: number[] = [];
    let withheldToDate = 0;
    for (const slip of input.priorSlips) {
      monthlyGrosses.push(taxableOf(slip.components));
      withheldToDate += withheldOf(slip.components);
    }
    // The month being paid is part of the year too.
    monthlyGrosses.push(taxableOf(input.thisPeriod));
    withheldToDate += withheldOf(input.thisPeriod);

    if (monthlyGrosses.every((gross) => gross <= 0)) return null;

    return calculatePph21Correction(
      {
        monthlyGrosses,
        monthlyPensions: monthlyGrosses.map(() => input.pension),
        married: input.taxContext.married,
        dependents: input.taxContext.dependents,
        hasNpwp: input.taxContext.hasNpwp,
        withheldToDate,
      },
      input.policy.pph21 ?? {},
    );
  }

  private async ensureTaxCorrectionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'PPH21_ANNUAL_CORRECTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Koreksi PPh21 Tahunan',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: December reconciliation of annual PPh21',
      sortOrder: 994,
    }, database);
  }

  private async ensureLeaveEncashmentComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'LEAVE_ENCASHMENT_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Pencairan Sisa Cuti',
      code,
      type: 'ALLOWANCE',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: true,
      // The amount was computed from a daily rate at approval; prorating it
      // against this period would shrink what was already agreed.
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: unused leave exchanged for money',
      sortOrder: 995,
    }, database);
  }

  private async ensureThrEarningComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'THR_EARNING_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Tunjangan Hari Raya',
      code,
      type: 'ALLOWANCE',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: true,
      // Already prorated by months of service under Permenaker 6/2016, so the
      // period proration must not shrink it a second time. And it is not a
      // tunjangan tetap: it is the THR itself, not part of the wage THR is a
      // month of — counting it would make next year's THR pay for this one.
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: THR keagamaan (Permenaker 6/2016), 1x upah sebulan prorata masa kerja',
      sortOrder: 994,
    }, database);
  }

  private async ensureArrearsEarningComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'ARREARS_EARNING_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Rapel Periode Sebelumnya',
      code,
      type: 'ALLOWANCE',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: true,
      // Never prorated: the amount was already prorated for the period it came
      // from, and prorating it again against this period would shrink it twice.
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: pay for a closed period the employee was missed in',
      sortOrder: 996,
    }, database);
  }

  private async ensureOvertimeEarningComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'OVERTIME_EARNING_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Tunjangan Lembur',
      code,
      type: 'ALLOWANCE',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: true,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: overtime pay per PP 35/2021',
      sortOrder: 998,
    }, database);
  }

  private async ensureLoanDeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'LOAN_DEDUCTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);

    if (existing) {
      return existing;
    }

    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan Pinjaman Karyawan',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated deduction for employee loan installments',
      sortOrder: 999,
    }, database);
  }

  private async ensureLateDeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'LATE_DEDUCTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan Keterlambatan',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: automatic late attendance deduction per minutes after branch tolerance',
      sortOrder: 997,
    }, database);
  }

  private async ensureAbsenceDeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'ABSENCE_DEDUCTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan Tidak Hadir (Alpha)',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: automatic absence per day deduction based on basic salary / working days',
      sortOrder: 996,
    }, database);
  }

  private async ensureUnpaidLeaveDeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'UNPAID_LEAVE_DEDUCTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan Cuti Tidak Dibayar',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: daily-wage deduction for approved leave whose leave type is unpaid (enabled per company via unpaid_leave_deduction_enabled).',
      sortOrder: 993,
    }, database);
  }

  private async ensureTaxAllowanceComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'TAX_ALLOWANCE_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Tunjangan Pajak (Gross-Up)',
      code,
      type: 'ALLOWANCE',
      calculationMethod: 'FIXED',
      amount: 0,
      // Taxable on purpose: the allowance is ordinary income, which is why its
      // own amount has to be solved for rather than copied from the tax.
      isTaxable: true,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: taxable tax allowance equal to the PPh21 it causes, so the employer bears the tax (enabled per company via pph21_gross_up_enabled).',
      sortOrder: 992,
    }, database);
  }

  private async ensureBenefitDeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'BENEFIT_DEDUCTION_AUTO';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan Iuran Benefit',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: employee contribution for active benefit enrollments (percent of base salary per plan).',
      sortOrder: 994,
    }, database);
  }

  private async ensureEWADeductionComponent(companyId: string, database: Prisma.TransactionClient) {
    const code = 'EWA-DEDUCT';
    const existing = await payrollRepository.findSalaryComponentByCode(companyId, code, database);
    if (existing) return existing;
    return payrollRepository.createSalaryComponent({
      companyId,
      name: 'Potongan EWA (Tarik Gaji Awal)',
      code,
      type: 'DEDUCTION',
      calculationMethod: 'FIXED',
      amount: 0,
      isTaxable: false,
      isProrated: false, isFixedAllowance: false,
      description: 'System generated: automatic deduction for approved Earned Wage Access paid requests (employer-funded float model). Deducted bulan berjalan di payslip.',
      sortOrder: 995,
    }, database);
  }

  // ==================== Standalone Calculation Endpoints (B.1, B.2, B.3) ====================

  /**
   * Accounting journal for a run, grouped by cost centre (GAP-47).
   *
   * `Department.costCenter` has been stored since the department module was
   * written and read by nothing, so the one question accounting asks of a
   * payroll run — which cost centre carries this — had to be answered by
   * re-keying the payslip list.
   *
   * The cost centre is resolved from the department id frozen on the payslip,
   * not from the employee's current department, so a transfer does not move
   * last month's cost. ponytail: the centre *code* is read live, because no
   * snapshot of it exists — renaming a cost centre therefore relabels historic
   * journals. Snapshotting it would need a column and a backfill.
   */
  async runJournal(runId: string) {
    const run = await payrollRepository.findPayrollRunById(runId);
    if (!run) throw new NotFoundError('Payroll run not found');

    const payslips = await prisma.payslip.findMany({
      where: { payrollRunId: runId, companyId: run.companyId },
      select: {
        netPay: true, employeeSnapshot: true,
        components: { select: { name: true, type: true, amount: true } },
      },
    });

    const departmentIds = [...new Set(payslips
      .map((slip) => (slip.employeeSnapshot as { departmentId?: string | null } | null)?.departmentId)
      .filter((id): id is string => Boolean(id)))];
    const departments = departmentIds.length
      ? await prisma.department.findMany({
          where: { id: { in: departmentIds }, companyId: run.companyId },
          select: { id: true, costCenter: true },
        })
      : [];

    const lines = buildPayrollJournal(
      payslips.map((slip) => ({ netPay: slip.netPay, employeeSnapshot: slip.employeeSnapshot, components: slip.components })),
      new Map(departments.map((row) => [row.id, row.costCenter])),
    );

    return {
      runId,
      runName: run.name,
      status: run.status,
      lines,
      totals: {
        earnings: lines.reduce((sum, line) => sum + line.earnings, 0),
        deductions: lines.reduce((sum, line) => sum + line.deductionsTotal, 0),
        netPay: lines.reduce((sum, line) => sum + line.netPay, 0),
        /// Non-zero means the journal does not balance and must not be posted.
        imbalance: lines.reduce((sum, line) => sum + line.imbalance, 0),
      },
    };
  }

  calculatePph21Standalone(data: CalculatePph21DTO) {
    return calculatePph21({
      monthlyGross: data.monthlyGross,
      married: data.married,
      dependents: data.dependents,
      monthlyPensionContribution: data.monthlyPensionContribution,
      hasNpwp: data.hasNpwp,
    });
  }

  calculateThrStandalone(data: CalculateThrStandaloneDTO) {
    const result = calculateThr({
      monthlyWage: data.monthlyWage,
      joinDate: new Date(data.joinDate),
      referenceDate: data.referenceDate ? new Date(data.referenceDate) : new Date(),
    });
    // The comment that used to sit here said "return amount THR saja", and
    // that is what it did: `calculateThrTax` existed with no caller anywhere.
    // The tax is reported now, but only when the caller supplies the PTKP
    // status — this endpoint has no employee to read it from, and defaulting
    // to TK/0 would understate the withholding for everybody else.
    const hasTaxContext = data.married !== undefined || data.dependents !== undefined;
    const thrTax = hasTaxContext
      ? calculateThrTax({
          monthlyGross: data.monthlyWage,
          thrAmount: result.amount,
          married: data.married ?? false,
          dependents: data.dependents ?? 0,
          hasNpwp: data.hasNpwp,
          monthlyPensionContribution: data.monthlyPensionContribution,
          method: data.method ?? 'ANNUALIZED',
        })
      : null;

    return {
      ...result,
      monthlyWage: data.monthlyWage,
      joinDate: data.joinDate,
      /** Null when no PTKP status was supplied; the response says which. */
      tax: thrTax?.tax ?? null,
      netAmount: thrTax ? Math.max(0, Math.round(result.amount - thrTax.tax)) : null,
      taxMethod: thrTax?.method ?? null,
      /** Reading `tax: null` as "no tax due" would be wrong; this says why. */
      taxContextProvided: hasTaxContext,
    };
  }

  calculateBpjsStandalone(data: CalculateBpjsDTO) {
    const baseRiskRate = JKK_RISK_TO_RATE[data.jkkRiskClass as JKKRiskClass];
    const mergedConfig = {
      jkkRatePercent: baseRiskRate,
      ...(data.customRates ?? {}),
    };
    const breakdown = calculateBpjs(data.monthlyWage, mergedConfig);
    return {
      jkkRiskClass: data.jkkRiskClass,
      configApplied: mergedConfig,
      ...breakdown,
    };
  }

  calculateJknStandalone(data: CalculateJknDTO) {
    const breakdown = calculateBpjs(data.monthlyWage, data.customRates ?? {});
    const base = Math.min(Math.max(0, data.monthlyWage), data.customRates?.jknWageCap ?? 12_000_000);
    return {
      monthlyWage: data.monthlyWage,
      jknBaseWage: base,
      configApplied: {
        jknEmployerPercent: data.customRates?.jknEmployerPercent ?? 4,
        jknEmployeePercent: data.customRates?.jknEmployeePercent ?? 1,
        jknWageCap: data.customRates?.jknWageCap ?? 12_000_000,
      },
      employee: { jkn: breakdown.employee.jkn },
      employer: { jkn: breakdown.employer.jkn },
      totalPerPerson: breakdown.employee.jkn + breakdown.employer.jkn,
    };
  }
}

export const payrollService = new PayrollService();
