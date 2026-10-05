/**
 * Forfeiting unused carried-over leave (the remainder of GAP-06).
 *
 * PR #47 recorded how many days an employee carried from last year and said
 * plainly that the column was the prerequisite, not the feature. This is the
 * feature: many Indonesian employers require carried days to be taken before
 * a cut-off, usually the end of March. Without one, carried days accumulate
 * with no bound other than the annual cap, and the policy cannot be expressed
 * at all.
 *
 * The one decision that actually moves days, made in the employee's favour:
 * **carried days are treated as spent first.** If someone with 3 carried days
 * has taken 2 days of leave, those 2 came out of the carried pile and only 1
 * forfeits. The alternative — spending entitlement first — would quietly
 * expire carried days while the employee still had plenty of balance, which is
 * the same class of silent loss the accrual fixes in #47 were about.
 */

export interface CarryOverForfeit {
  /** Days lost. 0 when the carried pile was fully used, or nothing was carried. */
  forfeited: number;
  /** totalDays after the forfeit. */
  totalDays: number;
  /** remainingDays after the forfeit, never negative. */
  remainingDays: number;
}

export function computeCarryOverForfeit(balance: {
  totalDays: number;
  usedDays: number;
  carryOverDays: number;
}): CarryOverForfeit {
  const carried = Math.max(0, balance.carryOverDays);
  const used = Math.max(0, balance.usedDays);
  // Carried days are spent first, so only the part the employee never reached
  // is lost.
  const forfeited = Math.max(0, carried - used);
  const totalDays = Math.max(0, balance.totalDays - forfeited);
  return { forfeited, totalDays, remainingDays: Math.max(0, totalDays - used) };
}

/**
 * True once the cut-off has passed for the given year. Month 0 means the
 * company set no deadline, which is the default and the behaviour that existed
 * before this feature.
 *
 * The cut-off is the END of the configured month: "pakai sebelum akhir Maret"
 * with month = 3 forfeits on 1 April, not on 1 March.
 */
export function carryOverDeadlinePassed(expiryMonth: number, year: number, now: Date): boolean {
  if (!Number.isInteger(expiryMonth) || expiryMonth < 1 || expiryMonth > 12) return false;
  // First instant after the configured month ends.
  const cutoff = Date.UTC(year, expiryMonth, 1);
  return now.getTime() >= cutoff;
}
