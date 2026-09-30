import { Prisma, PayrollArrearsStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';

export interface RegisterArrearsInput {
  employeeId: string;
  sourcePeriodId: string;
  notes?: string;
}

/** Whole days between two dates, inclusive of both ends. */
function inclusiveDays(from: Date, to: Date): number {
  const ms = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
    - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Arrears — paying for a closed period in the next one.
 *
 * The organisation decided (GAP-14) that a closed period is never reopened: the
 * reports and the bank reconciliation for it have already gone out. An employee
 * missed by that run is paid in the next run instead, as a component that names
 * the period it belongs to.
 *
 * Tax is deliberately not computed here. Arrears are taxed in the period they
 * are paid — the ordinary PPh21 treatment — so what this stores is the **gross**
 * the employee should have received, and the paying run's own tax and
 * contribution logic takes it from there.
 */
export class PayrollArrearsService {
  /**
   * Work out what the employee should have been paid for that period.
   *
   * Uses the same as-of rule the payroll run uses — the latest salary effective
   * on or before the period end — and prorates when the employee joined partway
   * through, which is the usual reason someone is missed in the first place.
   */
  private async computeGross(companyId: string, employeeId: string, period: { startDate: Date; endDate: Date }) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        joinDate: true,
        // An approved resignation caps the payable window. Without it, someone
        // who left on the 10th and was missed by that period's run would be
        // handed a full month — real money, paid once and hard to claw back.
        resignations: {
          where: { status: 'APPROVED' },
          orderBy: { lastWorkingDate: 'desc' },
          take: 1,
          select: { lastWorkingDate: true },
        },
      },
    });
    if (!employee) throw new NotFoundError('Employee not found in the active company');

    const salary = await prisma.employeeSalary.findFirst({
      where: {
        employeeId,
        companyId,
        deletedAt: null,
        effectiveDate: { lte: period.endDate },
      },
      orderBy: { effectiveDate: 'desc' },
      include: { components: { where: { isActive: true }, include: { salaryComponent: true } } },
    });
    if (!salary) {
      throw new BadRequestError('No salary was effective for this employee during that period; set the salary first');
    }
    if (salary.currency !== 'IDR') {
      throw new BadRequestError('Arrears currently support IDR salary allocations');
    }

    const allowances = salary.components.filter((row) => row.salaryComponent.type === 'ALLOWANCE');
    const monthlyGross = allowances.reduce(
      (sum, row) => sum.plus(row.amount),
      new Prisma.Decimal(salary.baseSalary),
    );

    // Proration window: the part of the period the employee was actually
    // employed for. Joining on the 20th earns eleven days, not a month.
    const periodDays = inclusiveDays(period.startDate, period.endDate);
    const joined = employee.joinDate ? new Date(employee.joinDate) : null;
    const from = joined && joined > period.startDate ? joined : period.startDate;
    const lastWorkingDate = employee.resignations[0]?.lastWorkingDate ?? null;
    const to = lastWorkingDate && new Date(lastWorkingDate) < period.endDate
      ? new Date(lastWorkingDate)
      : period.endDate;
    if (to < from) {
      throw new BadRequestError('The employee was not employed during any part of that period');
    }
    const payableDays = inclusiveDays(from, to);

    const gross = payableDays >= periodDays
      ? monthlyGross
      : monthlyGross.times(payableDays).dividedBy(periodDays).toDecimalPlaces(2);

    if (!gross.isFinite() || gross.lessThanOrEqualTo(0)) {
      throw new BadRequestError('Computed arrears amount is not a payable figure; review the salary allocation');
    }

    return {
      gross,
      basis: {
        employeeNumber: employee.employeeNumber,
        salaryId: salary.id,
        effectiveDate: salary.effectiveDate.toISOString(),
        baseSalary: salary.baseSalary.toString(),
        allowances: allowances.map((row) => ({ name: row.salaryComponent.name, amount: row.amount.toString() })),
        monthlyGross: monthlyGross.toString(),
        periodDays,
        payableDays,
        joinDate: joined?.toISOString() ?? null,
        lastWorkingDate: lastWorkingDate ? new Date(lastWorkingDate).toISOString() : null,
        prorated: payableDays < periodDays,
        computedAt: new Date().toISOString(),
      },
    };
  }

  async register(companyId: string, input: RegisterArrearsInput) {
    await assertEmployeeInScope(input.employeeId, 'payroll');

    const period = await prisma.payrollPeriod.findFirst({
      where: { id: input.sourcePeriodId, companyId, deletedAt: null },
      select: { id: true, name: true, code: true, status: true, startDate: true, endDate: true },
    });
    if (!period) throw new NotFoundError('Payroll period not found in the active company');

    // Arrears exist for periods that can no longer be re-run. An open period
    // should simply include the employee, so allowing arrears there would
    // create a second payment for work the next run is about to pay anyway.
    if (period.status !== 'CLOSED') {
      throw new BadRequestError('Arrears apply to a closed period only; an open period should include the employee in its own run');
    }

    const alreadyPaid = await prisma.payslip.findFirst({
      where: { employeeId: input.employeeId, companyId, payrollRun: { periodId: period.id } },
      select: { id: true },
    });
    if (alreadyPaid) {
      throw new BadRequestError('This employee already has a payslip for that period; a wrong amount is a correction, not arrears');
    }

    const existing = await prisma.payrollArrears.findFirst({
      where: { employeeId: input.employeeId, sourcePeriodId: period.id },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new BadRequestError(`Arrears for this employee and period already exist (${existing.status})`);
    }

    const { gross, basis } = await this.computeGross(companyId, input.employeeId, period);

    const row = await prisma.payrollArrears.create({
      data: {
        companyId,
        employeeId: input.employeeId,
        sourcePeriodId: period.id,
        grossAmount: gross,
        basis: basis as Prisma.InputJsonValue,
        notes: input.notes,
        registeredBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Payroll arrears registered', {
      arrearsId: row.id, employeeId: input.employeeId, periodCode: period.code, gross: gross.toString(),
    });
    return row;
  }

  async list(companyId: string, filters: { status?: PayrollArrearsStatus; employeeId?: string } = {}) {
    return prisma.payrollArrears.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        sourcePeriod: { select: { code: true, name: true } },
        employee: { select: { employeeNumber: true, fullName: true } },
      },
    });
  }

  async cancel(companyId: string, id: string) {
    const row = await prisma.payrollArrears.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
    if (!row) throw new NotFoundError('Arrears entry not found');
    if (row.status !== PayrollArrearsStatus.PENDING) {
      throw new BadRequestError(`Only pending arrears can be cancelled; this entry is ${row.status}`);
    }

    // Conditional update: a run that claimed this row a moment ago moved it out
    // of PENDING, and cancelling it afterwards would hide money already paid.
    const result = await prisma.payrollArrears.updateMany({
      where: { id, companyId, status: PayrollArrearsStatus.PENDING },
      data: { status: PayrollArrearsStatus.CANCELLED },
    });
    if (result.count === 0) {
      throw new BadRequestError('This arrears entry was claimed by a payroll run while you were cancelling it');
    }
    return { id, status: PayrollArrearsStatus.CANCELLED };
  }

  /** Pending arrears for a run, keyed by employee. Read inside the run's transaction. */
  async pendingByEmployee(companyId: string, database: Prisma.TransactionClient = prisma) {
    const rows = await database.payrollArrears.findMany({
      where: { companyId, status: PayrollArrearsStatus.PENDING },
      include: { sourcePeriod: { select: { code: true, name: true } } },
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
   * Claim the rows a run actually put on a payslip.
   *
   * Conditional on PENDING and counted: if another run claimed a row first, the
   * count comes back short and the caller fails the whole run rather than
   * paying the same arrears twice.
   */
  async markApplied(
    companyId: string,
    runId: string,
    claims: Array<{ arrearsId: string; payslipId: string }>,
    database: Prisma.TransactionClient = prisma,
  ) {
    for (const claim of claims) {
      const result = await database.payrollArrears.updateMany({
        where: { id: claim.arrearsId, companyId, status: PayrollArrearsStatus.PENDING },
        data: {
          status: PayrollArrearsStatus.APPLIED,
          payslipId: claim.payslipId,
          appliedRunId: runId,
          appliedAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new BadRequestError('Arrears entry changed while this payroll run was calculating; re-run the calculation');
      }
    }
  }
}

export const payrollArrearsService = new PayrollArrearsService();
