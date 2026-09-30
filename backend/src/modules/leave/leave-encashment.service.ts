import { LeaveEncashmentStatus, Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { withConcurrencyRetry } from '@/shared/database/concurrency';

export interface RequestEncashmentInput {
  employeeId: string;
  leaveTypeId: string;
  days: number;
  year?: number;
  notes?: string;
}

interface EncashmentPolicy {
  enabled: boolean;
  maxDaysPerYear: number;
  divisor: number;
  includeAllowances: boolean;
}

/**
 * Leave encashment — exchanging unused leave for money (GAP-09).
 *
 * The policy is **per company and changeable**, not chosen once and compiled
 * in: whether it is allowed at all, the yearly ceiling, the daily divisor (21
 * working days or 30 calendar days — both are in use in Indonesia), and whether
 * fixed allowances join the daily rate. A single hardcoded answer would become
 * a code change for every new company using the product.
 *
 * Off by default, like every setting that moves money.
 *
 * The money flows through payroll rather than a separate payment: an approved
 * row is picked up by the next run as its own component, which is the same
 * shape as arrears and reuses its discipline — the amount is derived, never
 * typed, and the run claims each row conditionally so nothing is paid twice.
 */
export class LeaveEncashmentService {
  private async policy(companyId: string): Promise<EncashmentPolicy> {
    const rows = await prisma.companySetting.findMany({
      where: {
        companyId,
        key: {
          in: [
            'leave_encashment_enabled',
            'leave_encashment_max_days_per_year',
            'leave_encashment_daily_divisor',
            'leave_encashment_include_allowances',
          ],
        },
      },
      select: { key: true, value: true },
    });
    const setting = new Map(rows.map((row) => [row.key, row.value]));

    const divisor = Number(setting.get('leave_encashment_daily_divisor') ?? 21);
    return {
      enabled: setting.get('leave_encashment_enabled') === 'true',
      maxDaysPerYear: Math.max(0, Number(setting.get('leave_encashment_max_days_per_year') ?? 0) || 0),
      // A zero or negative divisor would divide by zero into someone's pay, so
      // an invalid setting falls back rather than producing Infinity.
      divisor: Number.isFinite(divisor) && divisor > 0 ? divisor : 21,
      includeAllowances: setting.get('leave_encashment_include_allowances') === 'true',
    };
  }

  /** What the policy currently says — so the UI can explain itself before anyone asks. */
  async describePolicy(companyId: string) {
    const policy = await this.policy(companyId);
    return {
      ...policy,
      dailyRateFormula: `(gaji pokok${policy.includeAllowances ? ' + tunjangan tetap' : ''}) / ${policy.divisor}`,
    };
  }

  private async computeAmount(companyId: string, employeeId: string, days: number, policy: EncashmentPolicy) {
    const salary = await prisma.employeeSalary.findFirst({
      where: { employeeId, companyId, deletedAt: null, isActive: true },
      orderBy: { effectiveDate: 'desc' },
      include: { components: { where: { isActive: true }, include: { salaryComponent: true } } },
    });
    if (!salary) throw new BadRequestError('Employee has no active salary; set the salary before encashing leave');
    if (salary.currency !== 'IDR') throw new BadRequestError('Leave encashment currently supports IDR salary allocations');

    const allowances = policy.includeAllowances
      ? salary.components.filter((row) => row.salaryComponent.type === 'ALLOWANCE')
      : [];
    const monthlyWage = allowances.reduce((sum, row) => sum.plus(row.amount), new Prisma.Decimal(salary.baseSalary));
    const dailyRate = monthlyWage.dividedBy(policy.divisor).toDecimalPlaces(2);
    const gross = dailyRate.times(days).toDecimalPlaces(2);

    if (!gross.isFinite() || gross.lessThanOrEqualTo(0)) {
      throw new BadRequestError('Computed encashment amount is not payable; review the salary allocation');
    }

    return {
      gross,
      basis: {
        salaryId: salary.id,
        baseSalary: salary.baseSalary.toString(),
        includeAllowances: policy.includeAllowances,
        allowances: allowances.map((row) => ({ name: row.salaryComponent.name, amount: row.amount.toString() })),
        monthlyWage: monthlyWage.toString(),
        divisor: policy.divisor,
        dailyRate: dailyRate.toString(),
        days,
        computedAt: new Date().toISOString(),
      },
    };
  }

  async request(companyId: string, input: RequestEncashmentInput) {
    await assertEmployeeInScope(input.employeeId, 'leave');

    const policy = await this.policy(companyId);
    if (!policy.enabled) {
      throw new BadRequestError('Pencairan cuti belum diaktifkan untuk perusahaan ini (leave_encashment_enabled)');
    }
    if (!Number.isInteger(input.days) || input.days < 1) throw new BadRequestError('Days must be a positive whole number');

    const year = input.year ?? new Date().getUTCFullYear();

    const leaveType = await prisma.leaveType.findFirst({
      where: { id: input.leaveTypeId, companyId, deletedAt: null },
      select: { id: true, isPaid: true, isActive: true, name: true },
    });
    if (!leaveType) throw new BadRequestError('Leave type does not belong to the active company');
    if (!leaveType.isActive) throw new BadRequestError('Leave type is inactive');
    // Encashing an unpaid type would pay for days that were never earned as pay.
    if (!leaveType.isPaid) throw new BadRequestError('Only a paid leave type can be encashed');

    const balance = await prisma.leaveBalance.findFirst({
      where: { employeeId: input.employeeId, companyId, leaveTypeId: leaveType.id, year },
      select: { remainingDays: true },
    });
    if (!balance || balance.remainingDays < input.days) {
      throw new BadRequestError(`Saldo cuti tidak cukup: tersisa ${balance?.remainingDays ?? 0} hari`);
    }

    // The ceiling counts days already committed this year, whether they have
    // been paid yet or not — otherwise two pending requests could together
    // exceed a limit each of them respects alone.
    if (policy.maxDaysPerYear > 0) {
      const committed = await prisma.leaveEncashment.aggregate({
        where: {
          employeeId: input.employeeId,
          companyId,
          year,
          status: { in: [LeaveEncashmentStatus.PENDING, LeaveEncashmentStatus.APPROVED, LeaveEncashmentStatus.PAID] },
        },
        _sum: { days: true },
      });
      const alreadyCommitted = committed._sum.days ?? 0;
      if (alreadyCommitted + input.days > policy.maxDaysPerYear) {
        throw new BadRequestError(
          `Batas pencairan ${policy.maxDaysPerYear} hari per tahun terlampaui: ${alreadyCommitted} hari sudah diajukan atau dibayar`,
        );
      }
    }

    const { gross, basis } = await this.computeAmount(companyId, input.employeeId, input.days, policy);

    const row = await prisma.leaveEncashment.create({
      data: {
        companyId,
        employeeId: input.employeeId,
        leaveTypeId: leaveType.id,
        year,
        days: input.days,
        grossAmount: gross,
        basis: basis as Prisma.InputJsonValue,
        notes: input.notes,
        requestedBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('Leave encashment requested', { id: row.id, companyId, employeeId: input.employeeId, days: input.days });
    return row;
  }

  async list(companyId: string, filters: { status?: LeaveEncashmentStatus; employeeId?: string } = {}) {
    return prisma.leaveEncashment.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.employeeId ? { employeeId: filters.employeeId } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { employeeNumber: true, fullName: true } },
        leaveType: { select: { name: true } },
      },
    });
  }

  /**
   * Approve, and deduct the balance in the same transaction.
   *
   * The balance is locked and re-read here rather than trusted from the
   * request: an ordinary leave approval may have spent those days in between,
   * and paying for leave the employee no longer has would be paying twice for
   * the same entitlement.
   */
  async approve(companyId: string, id: string) {
    const actorId = getCurrentUser()?.id ?? null;

    return withConcurrencyRetry(
      () => prisma.$transaction(async (tx) => {
        const row = await tx.leaveEncashment.findFirst({ where: { id, companyId } });
        if (!row) throw new NotFoundError('Leave encashment request not found');
        if (row.status !== LeaveEncashmentStatus.PENDING) {
          throw new BadRequestError(`Only a pending request can be approved; this one is ${row.status}`);
        }
        if (row.requestedBy && row.requestedBy === actorId) {
          // Maker-checker: the same person must not request and approve their
          // own payout.
          throw new BadRequestError('The requester cannot approve their own encashment');
        }

        const [balance] = await tx.$queryRaw<Array<{ id: string; used_days: number; remaining_days: number }>>`
          SELECT id, used_days, remaining_days FROM leave_balances
          WHERE employee_id = ${row.employeeId} AND leave_type_id = ${row.leaveTypeId}
            AND year = ${row.year} AND company_id = ${companyId}
          FOR UPDATE`;

        if (!balance || balance.remaining_days < row.days) {
          throw new BadRequestError(`Saldo cuti sudah tidak cukup: tersisa ${balance?.remaining_days ?? 0} hari`);
        }

        await tx.leaveBalance.update({
          where: { id: balance.id },
          data: {
            usedDays: balance.used_days + row.days,
            remainingDays: balance.remaining_days - row.days,
          },
        });

        const claimed = await tx.leaveEncashment.updateMany({
          where: { id: row.id, companyId, status: LeaveEncashmentStatus.PENDING },
          data: { status: LeaveEncashmentStatus.APPROVED, approvedBy: actorId, approvedAt: new Date() },
        });
        if (claimed.count !== 1) throw new BadRequestError('This request was decided by someone else while you were approving it');

        logger.info('Leave encashment approved', { id: row.id, companyId, days: row.days });
        return { id: row.id, status: LeaveEncashmentStatus.APPROVED, days: row.days, grossAmount: row.grossAmount };
      }),
      'Leave encashment is being decided concurrently; retry the request',
    );
  }

  async reject(companyId: string, id: string, reason: string) {
    const row = await prisma.leaveEncashment.findFirst({ where: { id, companyId }, select: { id: true, status: true } });
    if (!row) throw new NotFoundError('Leave encashment request not found');
    if (row.status !== LeaveEncashmentStatus.PENDING) {
      throw new BadRequestError(`Only a pending request can be rejected; this one is ${row.status}`);
    }

    const result = await prisma.leaveEncashment.updateMany({
      where: { id, companyId, status: LeaveEncashmentStatus.PENDING },
      data: {
        status: LeaveEncashmentStatus.REJECTED,
        rejectedReason: reason.slice(0, 255),
        approvedBy: getCurrentUser()?.id ?? null,
        approvedAt: new Date(),
      },
    });
    if (result.count === 0) throw new BadRequestError('This request was decided by someone else while you were rejecting it');
    return { id, status: LeaveEncashmentStatus.REJECTED };
  }

  /** Approved rows waiting for a payroll run, keyed by employee. */
  async approvedByEmployee(companyId: string, database: Prisma.TransactionClient = prisma) {
    const rows = await database.leaveEncashment.findMany({
      where: { companyId, status: LeaveEncashmentStatus.APPROVED },
      include: { leaveType: { select: { name: true } } },
    });

    const byEmployee = new Map<string, typeof rows>();
    for (const row of rows) {
      const list = byEmployee.get(row.employeeId) ?? [];
      list.push(row);
      byEmployee.set(row.employeeId, list);
    }
    return byEmployee;
  }

  /** Claim the rows a run actually paid — conditional, so nothing is paid twice. */
  async markPaid(
    companyId: string,
    runId: string,
    claims: Array<{ encashmentId: string; payslipId: string }>,
    database: Prisma.TransactionClient = prisma,
  ) {
    for (const claim of claims) {
      const result = await database.leaveEncashment.updateMany({
        where: { id: claim.encashmentId, companyId, status: LeaveEncashmentStatus.APPROVED },
        data: {
          status: LeaveEncashmentStatus.PAID,
          payslipId: claim.payslipId,
          appliedRunId: runId,
          paidAt: new Date(),
        },
      });
      if (result.count !== 1) {
        throw new BadRequestError('A leave encashment changed while this payroll run was calculating; re-run the calculation');
      }
    }
  }
}

export const leaveEncashmentService = new LeaveEncashmentService();
