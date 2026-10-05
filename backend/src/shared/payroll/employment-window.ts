/**
 * The slice of a payroll period an employee was actually employed for.
 *
 * This logic already existed, correctly, in exactly one place: the arrears
 * path, which pays for a period that closed without the employee in it. The
 * main payroll run had none of it — it paid a full month to someone who joined
 * on the 20th, and skipped a leaver's final partial month altogether because
 * their status was no longer ACTIVE by the time the run happened. Two
 * implementations of the same window would eventually disagree about someone's
 * last month, so there is one.
 *
 * Basis is calendar days, inclusive of both ends, which is what the arrears
 * path established and therefore what the two must share.
 *
 * ponytail: calendar days only. Some Indonesian employers prorate on working
 * days instead; if a customer needs that, it becomes a company setting here
 * rather than a second window somewhere else.
 */

/** Whole days from `from` to `to`, counting both ends. Date-only, UTC. */
export function inclusiveDays(from: Date, to: Date): number {
  const ms = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate())
    - Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  return Math.floor(ms / 86_400_000) + 1;
}

export interface EmploymentWindow {
  /** Days in the period the employee was employed for. 0 when not at all. */
  payableDays: number;
  /** Days in the whole period. */
  periodDays: number;
  /** payableDays / periodDays, clamped to [0, 1]. */
  fraction: number;
  /** False when the employee was not employed during any part of the period. */
  employedAtAll: boolean;
  /** True when the window is shorter than the period. */
  prorated: boolean;
}

export function employmentWindow(params: {
  periodStart: Date;
  periodEnd: Date;
  joinDate?: Date | null;
  /** From the employee's approved resignation, when there is one. */
  lastWorkingDate?: Date | null;
}): EmploymentWindow {
  const { periodStart, periodEnd } = params;
  const periodDays = inclusiveDays(periodStart, periodEnd);

  const joined = params.joinDate ? new Date(params.joinDate) : null;
  const from = joined && joined > periodStart ? joined : periodStart;
  const last = params.lastWorkingDate ? new Date(params.lastWorkingDate) : null;
  const to = last && last < periodEnd ? last : periodEnd;

  if (to < from || periodDays <= 0) {
    return { payableDays: 0, periodDays, fraction: 0, employedAtAll: false, prorated: true };
  }

  const payableDays = Math.min(inclusiveDays(from, to), periodDays);
  return {
    payableDays,
    periodDays,
    fraction: payableDays / periodDays,
    employedAtAll: payableDays > 0,
    prorated: payableDays < periodDays,
  };
}
