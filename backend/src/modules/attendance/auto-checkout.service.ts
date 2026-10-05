import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { payrollDate } from '@/shared/payroll/attendance-calendar';
import { assertPayrollDateOpen } from '@/shared/payroll/payroll-period-guard';
import { buildScheduledEndTime, minutesBetween } from '@/shared/attendance/scheduled-time';

/**
 * `autoCheckoutEnabled` was the last of the dead attendance switches: plumbed
 * through the schema, the DTO and the resolved policy, offered to HR, and read
 * by nothing.
 *
 * It stayed dead longer than `autoAbsentEnabled` for a reason — filling in a
 * missing check-out changes `workDuration`, and `workDuration` feeds overtime.
 * *What time to write* was therefore an HR policy question, not a technical
 * one, and the owner answered it: **the employee's scheduled shift end.**
 *
 * That choice has a consequence worth naming: someone who simply forgot to
 * check out is credited with their shift and no more. Writing "check-in plus
 * standard hours" instead would have paid overtime to whoever arrived late,
 * which is the opposite of what forgetting to tap out should earn.
 *
 * The instant is composed with `buildScheduledEndTime`, the same helper the
 * late-minutes calculation uses — including its overnight roll-forward, so a
 * 22:00-06:00 shift ends the next morning rather than computing backwards.
 */

export interface AutoCheckoutResult {
  date: string;
  companies: number;
  candidates: number;
  closed: number;
  /** Rows left alone because the row carries no scheduled end to write. */
  skippedNoSchedule: number;
  closedPeriods: number;
}

export async function sweepAutoCheckout(target: Date): Promise<AutoCheckoutResult> {
  return runInSystemContext('auto-checkout-sweep', async () => {
    const date = payrollDate(target);
    const result: AutoCheckoutResult = {
      date: date.toISOString().slice(0, 10),
      companies: 0, candidates: 0, closed: 0, skippedNoSchedule: 0, closedPeriods: 0,
    };

    // Policy resolution mirrors attendance-context: branch row first, else the
    // company-wide row (branchId null).
    const policies = await prisma.branchAttendancePolicy.findMany({
      where: { deletedAt: null },
      select: { companyId: true, branchId: true, autoCheckoutEnabled: true },
    });
    const byCompany = new Map<string, { branch: Map<string, boolean>; fallback: boolean }>();
    for (const policy of policies) {
      const entry = byCompany.get(policy.companyId) ?? { branch: new Map<string, boolean>(), fallback: false };
      if (policy.branchId) entry.branch.set(policy.branchId, policy.autoCheckoutEnabled);
      else entry.fallback = policy.autoCheckoutEnabled;
      byCompany.set(policy.companyId, entry);
    }

    for (const [companyId, entry] of byCompany) {
      if (!entry.fallback && ![...entry.branch.values()].some(Boolean)) continue;
      result.companies += 1;

      // Never rewrite attendance inside a period payroll has closed — the
      // same rule every other attendance mutation obeys.
      try {
        await assertPayrollDateOpen(companyId, date);
      } catch {
        result.closedPeriods += 1;
        continue;
      }

      const open = await prisma.attendance.findMany({
        where: {
          companyId, date, deletedAt: null,
          checkIn: { not: null },
          checkOut: null,
        },
        select: {
          id: true, branchId: true, checkIn: true,
          scheduledWorkStart: true, scheduledWorkEnd: true,
        },
      });

      for (const row of open) {
        const perBranch = row.branchId ? entry.branch.get(row.branchId) : undefined;
        if (!(perBranch ?? entry.fallback)) continue;
        result.candidates += 1;

        const scheduledEnd = buildScheduledEndTime(date, row.scheduledWorkStart, row.scheduledWorkEnd);
        if (!scheduledEnd || !row.checkIn) {
          // No schedule on the row means no defensible time to write. Guessing
          // one would invent a work duration, so the row is left for a human
          // to correct — which PR #63 gave the employee a way to do.
          result.skippedNoSchedule += 1;
          continue;
        }
        if (scheduledEnd <= row.checkIn) {
          result.skippedNoSchedule += 1;
          continue;
        }

        await prisma.attendance.update({
          where: { id: row.id },
          data: {
            checkOut: scheduledEnd,
            workDuration: minutesBetween(scheduledEnd, row.checkIn),
            source: 'auto-checkout',
          },
        });
        result.closed += 1;
      }
    }

    logger.info('Auto-checkout sweep finished', { ...result });
    return result;
  });
}
