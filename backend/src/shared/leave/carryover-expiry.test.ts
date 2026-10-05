import { carryOverDeadlinePassed, computeCarryOverForfeit } from './carryover-expiry';

describe('forfeiting unused carried leave', () => {
  it('forfeits nothing when nothing was carried', () => {
    expect(computeCarryOverForfeit({ totalDays: 12, usedDays: 4, carryOverDays: 0 }))
      .toEqual({ forfeited: 0, totalDays: 12, remainingDays: 8 });
  });

  it('treats carried days as spent first, so leave already taken protects them', () => {
    // 3 carried, 2 days taken: those 2 came out of the carried pile, 1 is lost.
    // Spending entitlement first would have forfeited all 3 while the employee
    // still had balance — the same silent loss #47 was about.
    expect(computeCarryOverForfeit({ totalDays: 15, usedDays: 2, carryOverDays: 3 }))
      .toEqual({ forfeited: 1, totalDays: 14, remainingDays: 12 });
  });

  it('forfeits nothing once the carried pile is fully used', () => {
    expect(computeCarryOverForfeit({ totalDays: 15, usedDays: 3, carryOverDays: 3 }))
      .toEqual({ forfeited: 0, totalDays: 15, remainingDays: 12 });
    expect(computeCarryOverForfeit({ totalDays: 15, usedDays: 9, carryOverDays: 3 }).forfeited).toBe(0);
  });

  it('forfeits the whole pile when no leave was taken at all', () => {
    expect(computeCarryOverForfeit({ totalDays: 15, usedDays: 0, carryOverDays: 3 }))
      .toEqual({ forfeited: 3, totalDays: 12, remainingDays: 12 });
  });

  it('never produces a negative remainder', () => {
    // Defensive: a balance already overdrawn must not go further negative.
    expect(computeCarryOverForfeit({ totalDays: 2, usedDays: 5, carryOverDays: 3 }).remainingDays).toBe(0);
  });
});

describe('the carry-over deadline', () => {
  const march31 = new Date('2026-03-31T23:00:00Z');
  const april1 = new Date('2026-04-01T00:00:00Z');

  it('treats month 3 as the END of March, not its start', () => {
    // "pakai sebelum akhir Maret" must not forfeit on 1 March.
    expect(carryOverDeadlinePassed(3, 2026, new Date('2026-03-01T00:00:00Z'))).toBe(false);
    expect(carryOverDeadlinePassed(3, 2026, march31)).toBe(false);
    expect(carryOverDeadlinePassed(3, 2026, april1)).toBe(true);
  });

  it('never passes when the company set no deadline', () => {
    // 0 is the default, and the behaviour that existed before this feature —
    // so no tenant loses days because this shipped.
    for (const now of [march31, april1, new Date('2026-12-31T23:59:59Z')]) {
      expect(carryOverDeadlinePassed(0, 2026, now)).toBe(false);
    }
  });

  it('ignores a nonsense month rather than forfeiting on it', () => {
    for (const month of [-1, 13, 1.5, Number.NaN]) {
      expect(carryOverDeadlinePassed(month, 2026, april1)).toBe(false);
    }
  });

  it('handles December as the last month of the year', () => {
    expect(carryOverDeadlinePassed(12, 2026, new Date('2026-12-31T23:00:00Z'))).toBe(false);
    expect(carryOverDeadlinePassed(12, 2026, new Date('2027-01-01T00:00:00Z'))).toBe(true);
  });
});
