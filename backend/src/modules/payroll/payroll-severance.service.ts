import { Prisma, SeverancePaymentStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, ConflictError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { onboardingService } from '@/modules/onboarding/onboarding.service';
import type { RegisterSeveranceDTO } from './payroll-severance.dto';

/**
 * Severance payments (GAP-42). `calculateFinalPayroll` QUOTES the figure
 * (UU 13/2003 + PP 68/2009) and persisted nothing: the number an employee was
 * shown had no payment trail, no maker-checker, no payslip. Registering a
 * payment freezes that same calculation — HR's choice of reason and factors
 * included — and a SEVERANCE run pays it. The tax is final (PP 68/2009), so it
 * is computed exactly once, here; the run never taxes anything.
 */
export class PayrollSeveranceService {
  async register(companyId: string, input: RegisterSeveranceDTO) {
    const { resignationId, ...opts } = input;
    const resignation = await prisma.resignation.findFirst({
      where: { id: resignationId, companyId },
      select: { id: true, status: true, employeeId: true },
    });
    if (!resignation) throw new NotFoundError('Resignation not found in the active company');
    if (resignation.status !== 'APPROVED' && resignation.status !== 'COMPLETED') {
      throw new ConflictError(`Severance is paid for an approved exit; this resignation is ${resignation.status}`);
    }

    await assertEmployeeInScope(resignation.employeeId, 'payroll');

    const existing = await prisma.severancePayment.findFirst({
      where: { resignationId },
      select: { id: true, status: true },
    });
    if (existing && existing.status !== SeverancePaymentStatus.CANCELLED) {
      throw new BadRequestError(`A severance payment for this resignation already exists (${existing.status})`);
    }

    const figures = await onboardingService.calculateFinalPayroll(resignationId, opts);
    if (figures.total <= 0) {
      throw new BadRequestError('The calculation produced nothing to pay (a plain RESIGN earns no UP/UPMK and this employee has no UPH); review the reason and factors');
    }

    const data = {
      companyId,
      employeeId: resignation.employeeId,
      resignationId,
      grossAmount: new Prisma.Decimal(figures.total),
      taxAmount: new Prisma.Decimal(figures.tax),
      netAmount: new Prisma.Decimal(figures.netTotal),
      // The working, frozen with the registration: the figure must be
      // traceable years later without re-running a calculation whose inputs
      // (salary rows, leave balances) will have moved on.
      basis: {
        reason: opts.reason ?? 'RESIGN',
        opts,
        tenureYears: figures.tenureYears,
        severanceMonths: figures.severanceMonths,
        longServiceMonths: figures.longServiceMonths,
        severancePay: figures.severancePay,
        longServicePay: figures.longServicePay,
        leaveCompensation: figures.leaveCompensation,
        compensationOfRights: figures.compensationOfRights,
        monthlyWage: figures.monthlyWage,
        unusedLeaveDays: figures.unusedLeaveDays,
        cumulativeGross: figures.cumulativeGross,
        taxIsFinal: figures.taxIsFinal,
        computedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue,
      status: SeverancePaymentStatus.PENDING,
      registeredBy: getCurrentUser()?.id ?? null,
      appliedRunId: null,
      payslipId: null,
      appliedAt: null,
    };

    // One severance payment per resignation for life: a CANCELLED row is
    // revived with fresh figures instead of duplicated (same reasoning as
    // D-007 for system components — the unique index keeps holding the slot).
    const row = existing
      ? await prisma.severancePayment.update({ where: { id: existing.id }, data })
      : await prisma.severancePayment.create({ data });

    logger.info('Severance payment registered', {
      severancePaymentId: row.id, resignationId, employeeId: resignation.employeeId,
      gross: String(figures.total), tax: String(figures.tax),
    });
    return row;
  }

  async list(companyId: string, filters: { status?: SeverancePaymentStatus; employeeId?: string } = {}) {
    return prisma.severancePayment.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { employeeNumber: true, fullName: true } },
        resignation: { select: { id: true, lastWorkingDate: true, status: true } },
      },
    });
  }

  async cancel(companyId: string, id: string) {
    const row = await prisma.severancePayment.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
    if (!row) throw new NotFoundError('Severance payment not found');
    if (row.status !== SeverancePaymentStatus.PENDING) {
      throw new BadRequestError(`Only pending severance payments can be cancelled; this entry is ${row.status}`);
    }

    // Conditional update: a run that claimed this row a moment ago moved it out
    // of PENDING, and cancelling it afterwards would hide money already paid.
    const result = await prisma.severancePayment.updateMany({
      where: { id, companyId, status: SeverancePaymentStatus.PENDING },
      data: { status: SeverancePaymentStatus.CANCELLED },
    });
    if (result.count === 0) {
      throw new BadRequestError('This severance payment was claimed by a payroll run while you were cancelling it');
    }
    return { id, status: SeverancePaymentStatus.CANCELLED };
  }

  /** Pending severance payments keyed by employee. Read inside the run's transaction. */
  async pendingByEmployee(companyId: string, database: Prisma.TransactionClient = prisma) {
    const rows = await database.severancePayment.findMany({
      where: { companyId, status: SeverancePaymentStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });

    const byEmployee = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byEmployee.get(row.employeeId) ?? [];
      list.push(row);
      byEmployee.set(row.employeeId, list);
    }
    return byEmployee;
  }

  /**
   * Claim the rows a run paid. Conditional on PENDING and counted — if another
   * run claimed a row first, the whole calculation fails rather than paying
   * the same severance twice.
   */
  async markApplied(
    companyId: string,
    runId: string,
    claims: Array<{ severancePaymentId: string; payslipId: string }>,
    database: Prisma.TransactionClient = prisma,
  ) {
    for (const claim of claims) {
      const result = await database.severancePayment.updateMany({
        where: { id: claim.severancePaymentId, companyId, status: SeverancePaymentStatus.PENDING },
        data: {
          status: SeverancePaymentStatus.APPLIED,
          payslipId: claim.payslipId,
          appliedRunId: runId,
          appliedAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new BadRequestError('Severance payment changed while this payroll run was calculating; re-run the calculation');
      }
    }
  }
}

export const payrollSeveranceService = new PayrollSeveranceService();
