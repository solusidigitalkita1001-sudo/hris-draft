import { CollectiveLeaveStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser } from '@/shared/context/RequestContext';
import { assertPayrollDateOpen } from '@/shared/payroll/payroll-period-guard';
import { withConcurrencyRetry } from '@/shared/database/concurrency';

export interface DeclareCollectiveLeaveInput {
  date: string;
  name: string;
  leaveTypeId: string;
  unpaidLeaveTypeId: string;
  excludedBranchIds?: string[];
  notes?: string;
}

export type CollectiveLeaveOutcome = 'DEDUCTED' | 'UNPAID' | 'SKIPPED_EXISTING_LEAVE' | 'SKIPPED_ATTENDANCE';

export interface EmployeePlan {
  employeeId: string;
  employeeNumber: string;
  fullName: string;
  branchId: string | null;
  outcome: CollectiveLeaveOutcome;
  remainingBefore: number | null;
}

/**
 * Cuti bersama — a company-wide collective leave day.
 *
 * The organisation decided (GAP-08) that it **deducts annual leave balance**,
 * is declared per company with per-branch exceptions, and that an employee
 * without enough balance falls to **unpaid** rather than a negative balance. A
 * negative balance leaks into payroll and severance arithmetic, so it is
 * refused here rather than corrected later.
 *
 * The effect is materialised as one APPROVED LeaveRequest per employee instead
 * of a calendar marker. Payroll, reports and the employee's own leave history
 * then read it through paths that already exist and are already tested — the
 * attendance calendar in particular already resolves paid over unpaid coverage.
 */
export class CollectiveLeaveService {
  private async loadTypes(companyId: string, leaveTypeId: string, unpaidLeaveTypeId: string) {
    const types = await prisma.leaveType.findMany({
      where: { id: { in: [leaveTypeId, unpaidLeaveTypeId] }, companyId, deletedAt: null },
      select: { id: true, name: true, isPaid: true, isActive: true },
    });

    const paid = types.find((type) => type.id === leaveTypeId);
    const unpaid = types.find((type) => type.id === unpaidLeaveTypeId);
    if (!paid || !unpaid) throw new BadRequestError('Leave type does not belong to the active company');
    if (leaveTypeId === unpaidLeaveTypeId) throw new BadRequestError('The deducting and unpaid leave types must differ');
    if (!paid.isActive || !unpaid.isActive) throw new BadRequestError('Both leave types must be active');
    if (!paid.isPaid) throw new BadRequestError('The deducting leave type must be a paid type');
    if (unpaid.isPaid) throw new BadRequestError('The fallback leave type must be an unpaid type');
    return { paid, unpaid };
  }

  /**
   * Who the day would affect, and how — without writing anything.
   *
   * HR needs this before committing: the decision sends employees with an empty
   * balance to unpaid, which reduces their pay, and that should never be a
   * surprise discovered on a payslip.
   */
  async plan(companyId: string, collectiveLeaveId: string): Promise<EmployeePlan[]> {
    const declaration = await prisma.collectiveLeave.findFirst({
      where: { id: collectiveLeaveId, companyId },
      include: { exclusions: { select: { branchId: true } } },
    });
    if (!declaration) throw new NotFoundError('Collective leave declaration not found');
    return this.buildPlan(companyId, declaration);
  }

  private async buildPlan(
    companyId: string,
    declaration: {
      id: string;
      date: Date;
      leaveTypeId: string;
      exclusions: Array<{ branchId: string }>;
    },
  ): Promise<EmployeePlan[]> {
    const date = declaration.date;
    const excluded = declaration.exclusions.map((row) => row.branchId);

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        deletedAt: null,
        AND: [
          // Nobody is put on leave for a day they were not employed for.
          { OR: [{ joinDate: null }, { joinDate: { lte: date } }] },
          // An employee with no branch is not in an excluded branch — but SQL
          // says otherwise: `branchId NOT IN (...)` is UNKNOWN when branchId is
          // NULL, which quietly drops every unassigned employee from the day.
          // Spell out the null case instead of relying on NOT.
          ...(excluded.length ? [{ OR: [{ branchId: null }, { branchId: { notIn: excluded } }] }] : []),
        ],
      },
      select: { id: true, employeeNumber: true, fullName: true, branchId: true },
      orderBy: { employeeNumber: 'asc' },
    });

    const employeeIds = employees.map((employee) => employee.id);
    if (employeeIds.length === 0) return [];

    const [balances, existingLeave, attendance] = await Promise.all([
      prisma.leaveBalance.findMany({
        where: { employeeId: { in: employeeIds }, companyId, leaveTypeId: declaration.leaveTypeId, year: date.getUTCFullYear() },
        select: { employeeId: true, remainingDays: true },
      }),
      // An employee who already has leave that day keeps it. Overwriting it
      // would silently move someone's annual leave onto the collective day.
      prisma.leaveRequest.findMany({
        where: {
          employeeId: { in: employeeIds },
          companyId,
          deletedAt: null,
          status: { in: ['PENDING', 'APPROVED'] },
          startDate: { lte: date },
          endDate: { gte: date },
        },
        select: { employeeId: true },
      }),
      // Someone who actually clocked in was working, whatever the announcement
      // said. Their day is not converted into leave behind their back.
      prisma.attendance.findMany({
        where: { employeeId: { in: employeeIds }, companyId, date, deletedAt: null },
        select: { employeeId: true },
      }),
    ]);

    const remainingByEmployee = new Map(balances.map((row) => [row.employeeId, row.remainingDays]));
    const hasLeave = new Set(existingLeave.map((row) => row.employeeId));
    const hasAttendance = new Set(attendance.map((row) => row.employeeId));

    return employees.map((employee) => {
      const remainingBefore = remainingByEmployee.get(employee.id) ?? null;
      const outcome: CollectiveLeaveOutcome = hasLeave.has(employee.id)
        ? 'SKIPPED_EXISTING_LEAVE'
        : hasAttendance.has(employee.id)
          ? 'SKIPPED_ATTENDANCE'
          : (remainingBefore ?? 0) >= 1
            ? 'DEDUCTED'
            : 'UNPAID';
      return {
        employeeId: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        branchId: employee.branchId,
        outcome,
        remainingBefore,
      };
    });
  }

  async declare(companyId: string, input: DeclareCollectiveLeaveInput) {
    const date = new Date(input.date);
    if (Number.isNaN(date.getTime())) throw new BadRequestError('Invalid collective leave date');
    const dateOnly = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

    // A closed payroll period has already been paid and reconciled; turning one
    // of its days into leave would change figures that have left the building.
    await assertPayrollDateOpen(companyId, dateOnly);
    await this.loadTypes(companyId, input.leaveTypeId, input.unpaidLeaveTypeId);

    if (input.excludedBranchIds?.length) {
      const branches = await prisma.branch.findMany({
        where: { id: { in: input.excludedBranchIds }, companyId },
        select: { id: true },
      });
      if (branches.length !== new Set(input.excludedBranchIds).size) {
        throw new BadRequestError('One or more excluded branches do not belong to the active company');
      }
    }

    const existing = await prisma.collectiveLeave.findFirst({
      where: { companyId, date: dateOnly },
      select: { id: true, status: true },
    });
    if (existing) {
      throw new BadRequestError(`A collective leave is already declared for that date (${existing.status})`);
    }

    const declaration = await prisma.collectiveLeave.create({
      data: {
        companyId,
        date: dateOnly,
        name: input.name,
        leaveTypeId: input.leaveTypeId,
        unpaidLeaveTypeId: input.unpaidLeaveTypeId,
        notes: input.notes,
        declaredBy: getCurrentUser()?.id ?? null,
        ...(input.excludedBranchIds?.length
          ? { exclusions: { create: [...new Set(input.excludedBranchIds)].map((branchId) => ({ branchId })) } }
          : {}),
      },
      include: { exclusions: { select: { branchId: true } } },
    });

    logger.info('Collective leave declared', { id: declaration.id, companyId, date: dateOnly.toISOString() });
    return declaration;
  }

  async list(companyId: string, filters: { status?: CollectiveLeaveStatus; year?: number } = {}) {
    return prisma.collectiveLeave.findMany({
      where: {
        companyId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.year
          ? {
              date: {
                gte: new Date(Date.UTC(filters.year, 0, 1)),
                lte: new Date(Date.UTC(filters.year, 11, 31)),
              },
            }
          : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        exclusions: { select: { branchId: true } },
        leaveType: { select: { name: true } },
        unpaidLeaveType: { select: { name: true } },
        _count: { select: { requests: true } },
      },
    });
  }

  /**
   * Materialise the day: one APPROVED leave request per employee, balance
   * deducted where there is balance to deduct.
   *
   * Runs in one transaction. Half a company on leave is worse than none: the
   * payroll for that month would be computed from a partially applied day, and
   * nobody could tell which half.
   */
  async apply(companyId: string, collectiveLeaveId: string) {
    const actorId = getCurrentUser()?.id ?? null;

    return withConcurrencyRetry(
      () => prisma.$transaction(async (tx) => {
        const declaration = await tx.collectiveLeave.findFirst({
          where: { id: collectiveLeaveId, companyId },
          include: { exclusions: { select: { branchId: true } } },
        });
        if (!declaration) throw new NotFoundError('Collective leave declaration not found');
        if (declaration.status !== CollectiveLeaveStatus.DECLARED) {
          throw new BadRequestError(`Only a declared collective leave can be applied; this one is ${declaration.status}`);
        }
        await assertPayrollDateOpen(companyId, declaration.date);

        const plan = await this.buildPlan(companyId, declaration);
        const year = declaration.date.getUTCFullYear();
        const tally = { deducted: 0, unpaid: 0, skipped: 0 };

        for (const entry of plan) {
          if (entry.outcome === 'SKIPPED_EXISTING_LEAVE' || entry.outcome === 'SKIPPED_ATTENDANCE') {
            tally.skipped++;
            continue;
          }

          let leaveTypeId = declaration.unpaidLeaveTypeId;

          if (entry.outcome === 'DEDUCTED') {
            // Lock the balance row before reading the figure we are about to
            // spend: the plan was built outside this lock, and an ordinary leave
            // approval may have consumed the last day since.
            const [balance] = await tx.$queryRaw<Array<{ id: string; used_days: number; remaining_days: number }>>`
              SELECT id, used_days, remaining_days FROM leave_balances
              WHERE employee_id = ${entry.employeeId} AND leave_type_id = ${declaration.leaveTypeId}
                AND year = ${year} AND company_id = ${companyId}
              FOR UPDATE`;

            if (balance && balance.remaining_days >= 1) {
              await tx.leaveBalance.update({
                where: { id: balance.id },
                data: { usedDays: balance.used_days + 1, remainingDays: balance.remaining_days - 1 },
              });
              leaveTypeId = declaration.leaveTypeId;
              tally.deducted++;
            } else {
              // The balance went while we were not looking: unpaid, exactly as
              // the policy says. Never a negative balance.
              tally.unpaid++;
            }
          } else {
            tally.unpaid++;
          }

          await tx.leaveRequest.create({
            data: {
              companyId,
              employeeId: entry.employeeId,
              leaveTypeId,
              startDate: declaration.date,
              endDate: declaration.date,
              totalDays: 1,
              reason: `Cuti bersama: ${declaration.name}`,
              status: 'APPROVED',
              approvedBy: actorId,
              approvedAt: new Date(),
              collectiveLeaveId: declaration.id,
            },
          });
        }

        // Conditional on DECLARED: two HR users pressing apply at once must not
        // both deduct a day from everybody.
        const claimed = await tx.collectiveLeave.updateMany({
          where: { id: declaration.id, companyId, status: CollectiveLeaveStatus.DECLARED },
          data: { status: CollectiveLeaveStatus.APPLIED, appliedAt: new Date(), appliedBy: actorId },
        });
        if (claimed.count !== 1) {
          throw new BadRequestError('This collective leave was applied by someone else while you were applying it');
        }

        logger.info('Collective leave applied', { id: declaration.id, companyId, ...tally });
        return { id: declaration.id, status: CollectiveLeaveStatus.APPLIED, ...tally, total: plan.length };
      }),
      'Collective leave is being applied concurrently; retry the request',
    );
  }

  /** Cancel a declaration that has not touched anyone's balance yet. */
  async cancel(companyId: string, collectiveLeaveId: string) {
    const declaration = await prisma.collectiveLeave.findFirst({
      where: { id: collectiveLeaveId, companyId },
      select: { id: true, status: true },
    });
    if (!declaration) throw new NotFoundError('Collective leave declaration not found');
    if (declaration.status !== CollectiveLeaveStatus.DECLARED) {
      throw new BadRequestError(
        `Only a declared collective leave can be cancelled; this one is ${declaration.status}. Reversing an applied day means restoring balances and removing leave, which is a separate decision.`,
      );
    }

    const result = await prisma.collectiveLeave.updateMany({
      where: { id: collectiveLeaveId, companyId, status: CollectiveLeaveStatus.DECLARED },
      data: { status: CollectiveLeaveStatus.CANCELLED },
    });
    if (result.count === 0) throw new BadRequestError('This collective leave was applied while you were cancelling it');
    return { id: collectiveLeaveId, status: CollectiveLeaveStatus.CANCELLED };
  }
}

export const collectiveLeaveService = new CollectiveLeaveService();