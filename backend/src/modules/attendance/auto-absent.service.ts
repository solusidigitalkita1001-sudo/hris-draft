import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { loadPayrollAttendance } from '@/modules/payroll/payroll-attendance';
import { payrollDate } from '@/shared/payroll/attendance-calendar';
import { assertPayrollDateOpen } from '@/shared/payroll/payroll-period-guard';

/**
 * `autoAbsentEnabled` was dead configuration: plumbed through the schema, the
 * DTO and the resolved policy, offered to HR as a switch — and read by nothing.
 * There was no attendance queue at all, so turning it on did precisely nothing.
 *
 * What this does NOT do is change anybody's pay, and that is a verified fact
 * rather than an intention. Payroll counts a day present only when a row says
 * PRESENT or LATE (`attendance-calendar.ts:113`) and derives absence as
 * `workDays - present - leave` (`:137`), so an ABSENT row neither inflates
 * presence nor alters the absent count. The late-deduction path reads
 * `lateMinutes > 0`, which these rows do not have. The value here is
 * visibility: a missing day becomes a record HR can see, question, and that an
 * employee can file a correction against.
 *
 * The predicate is borrowed rather than rebuilt. Asked for a single-day range,
 * `loadPayrollAttendance` already answers exactly the right question: `absent
 * === 1` means the day is a working day on that employee's resolved calendar,
 * they are not present, and no approved leave, business trip or WFH covers it.
 * A second definition of "working day" is how two parts of a payroll system
 * start disagreeing about someone's month.
 */

export interface AutoAbsentResult {
  date: string;
  /** Companies with the switch on. */
  companies: number;
  candidates: number;
  created: number;
  /** Days skipped because the payroll period is already closed. */
  closedPeriods: number;
}

export async function sweepAutoAbsent(target: Date): Promise<AutoAbsentResult> {
  return runInSystemContext('auto-absent-sweep', async () => {
    const date = payrollDate(target);
    const result: AutoAbsentResult = {
      date: date.toISOString().slice(0, 10),
      companies: 0, candidates: 0, created: 0, closedPeriods: 0,
    };

    // Resolution mirrors attendance-context: the employee's branch policy
    // first, else the company-wide row (branchId null).
    const policies = await prisma.branchAttendancePolicy.findMany({
      where: { deletedAt: null },
      select: { companyId: true, branchId: true, autoAbsentEnabled: true },
    });
    const byCompany = new Map<string, { branch: Map<string, boolean>; fallback: boolean }>();
    for (const policy of policies) {
      const entry = byCompany.get(policy.companyId) ?? { branch: new Map<string, boolean>(), fallback: false };
      if (policy.branchId) entry.branch.set(policy.branchId, policy.autoAbsentEnabled);
      else entry.fallback = policy.autoAbsentEnabled;
      byCompany.set(policy.companyId, entry);
    }

    for (const [companyId, entry] of byCompany) {
      const anyEnabled = entry.fallback || [...entry.branch.values()].some(Boolean);
      if (!anyEnabled) continue;
      result.companies += 1;

      // Never write attendance into a period payroll has already closed —
      // the same rule every other attendance mutation obeys.
      try {
        await assertPayrollDateOpen(companyId, date);
      } catch {
        result.closedPeriods += 1;
        continue;
      }

      const employees = await prisma.employee.findMany({
        where: { companyId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, branchId: true },
      });
      const covered = employees.filter((employee) => {
        const perBranch = employee.branchId ? entry.branch.get(employee.branchId) : undefined;
        return perBranch ?? entry.fallback;
      });
      if (!covered.length) continue;

      const inputs = await loadPayrollAttendance(prisma, companyId, covered.map((row) => row.id), date, date);
      const absentees = covered.filter((employee) => inputs.get(employee.id)?.absent === 1);
      result.candidates += absentees.length;
      if (!absentees.length) continue;

      // skipDuplicates leans on @@unique([employeeId, date]): re-running the
      // sweep for the same day adds nothing, and a day the employee later
      // corrects already has a row to correct.
      const written = await prisma.attendance.createMany({
        data: absentees.map((employee) => ({
          companyId,
          employeeId: employee.id,
          branchId: employee.branchId,
          date,
          status: 'ABSENT' as const,
          method: 'MANUAL' as const,
          source: 'auto-absent',
          workDuration: 0,
          lateMinutes: 0,
        })),
        skipDuplicates: true,
      });
      result.created += written.count;
    }

    logger.info('Auto-absent sweep finished', { ...result });
    return result;
  });
}
