import { checkCategoryLimit, periodIsActive, samePeriodBucket, sumSubmittedInPeriod, type ClaimSubmittedAmount } from './claim-limit';

describe('C.1 claim limit per category per period pure functions', () => {
  it('C.1 CASE1: MONTHLY cap 1.5M, existing claim 1M + baru 450rb = 1.45M TEPAT DI BAWAH cap => NOT EXCEEDED', () => {
    const history: ClaimSubmittedAmount[] = [{ category: 'TRANSPORTATION', amount: 1_000_000, expenseDate: '2026-08-01' }];
    const res = checkCategoryLimit(
      history,
      { category: 'TRANSPORTATION', amount: 450_000, expenseDate: '2026-08-15' },
      {
        category: 'TRANSPORTATION',
        periodType: 'MONTHLY',
        limitAmount: 1_500_000,
        violationAction: 'WARN',
      },
      new Date('2026-08-15'),
    );
    expect(res.exceeded).toBe(false);
    expect(res.projectedTotal).toBe(1_450_000);
    expect(res.isBlock).toBe(false);
    expect(res.isWarn).toBe(false);
  });

  it('C.1 CASE2: TRANSPORTATION MONTHLY cap 1.5M, existing 1M + baru 800k = 1.8M EXCEEDED -> action WARN (not block, masih disimpan)', () => {
    const history: ClaimSubmittedAmount[] = [{ category: 'TRANSPORTATION', amount: 1_000_000, expenseDate: new Date(2026, 7, 1) }];
    const res = checkCategoryLimit(
      history,
      { category: 'TRANSPORTATION', amount: 800_000, expenseDate: new Date(2026, 7, 15) },
      {
        category: 'TRANSPORTATION',
        periodType: 'MONTHLY',
        limitAmount: 1_500_000,
        violationAction: 'WARN',
      },
      new Date(2026, 7, 15),
    );
    expect(res.exceeded).toBe(true);
    expect(res.isWarn).toBe(true);
    expect(res.isBlock).toBe(false);
    expect(res.delta).toBe(300_000);
    expect(res.warningMessage).toBeTruthy();
  });

  it('C.1 CASE3: Action BLOCK exceeded MEAL 500rb (submit 700rb) => isBlock true + blockMessage set', () => {
    const history: ClaimSubmittedAmount[] = [{ category: 'MEAL', amount: 200_000, expenseDate: '2026-08-02' }];
    const res = checkCategoryLimit(
      history,
      { category: 'MEAL', amount: 400_000, expenseDate: '2026-08-10' },
      { category: 'MEAL', periodType: 'MONTHLY', limitAmount: 500_000, violationAction: 'BLOCK' },
      new Date('2026-08-10'),
    );
    expect(res.exceeded).toBe(true);
    expect(res.isBlock).toBe(true);
    expect(res.blockMessage).toContain('MEAL');
  });

  it('C.1 CASE4: different categories = category TRANSPORTATION claim does NOT affect HOTEL limit (independent buckets)', () => {
    const history: ClaimSubmittedAmount[] = [
      { category: 'TRANSPORTATION', amount: 2_000_000, expenseDate: new Date(2026, 7, 2) },
      { category: 'HOTEL', amount: 600_000, expenseDate: new Date(2026, 7, 3) },
    ];
    const resHotel = checkCategoryLimit(
      history,
      { category: 'HOTEL', amount: 200_000, expenseDate: new Date(2026, 7, 4) },
      { category: 'HOTEL', periodType: 'MONTHLY', limitAmount: 1_000_000, violationAction: 'BLOCK' },
      new Date(2026, 7, 10),
    );
    expect(resHotel.submittedTotalBeforeNew).toBe(600_000);
    expect(resHotel.projectedTotal).toBe(800_000);
    expect(resHotel.exceeded).toBe(false);
  });

  it('C.1 CASE5: QUARTERLY period. Claim Aug (Q3) & Claim Oct (Q4) => dihitung beda bucket', () => {
    const historyQuarterly: ClaimSubmittedAmount[] = [
      { category: 'ENTERTAINMENT', amount: 3_000_000, expenseDate: '2026-08-01' },
    ];
    const oct = checkCategoryLimit(
      historyQuarterly,
      { category: 'ENTERTAINMENT', amount: 2_000_000, expenseDate: '2026-10-05' },
      { category: 'ENTERTAINMENT', periodType: 'QUARTERLY', limitAmount: 5_000_000, violationAction: 'BLOCK' },
      new Date('2026-10-05'),
    );
    expect(oct.submittedTotalBeforeNew).toBe(0); // beda quarter (Q4 vs Q3 history 3M not counted)
    expect(oct.projectedTotal).toBe(2_000_000);
    expect(oct.exceeded).toBe(false);

    const sameQ3 = checkCategoryLimit(
      historyQuarterly,
      { category: 'ENTERTAINMENT', amount: 2_500_000, expenseDate: '2026-09-30' },
      { category: 'ENTERTAINMENT', periodType: 'QUARTERLY', limitAmount: 5_000_000, violationAction: 'BLOCK' },
      new Date('2026-09-30'),
    );
    expect(sameQ3.submittedTotalBeforeNew).toBe(3_000_000);
    expect(sameQ3.projectedTotal).toBe(5_500_000);
    expect(sameQ3.isBlock).toBe(true);
  });

  it('C.1 CASE6: limitAmount <= 0 / isActive false = unlimited mode (false exceeded, no crash, empty history safe)', () => {
    const zero = checkCategoryLimit([], { category: 'OPERATIONAL', amount: 1e9 }, {
      category: 'OPERATIONAL', periodType: 'YEARLY', limitAmount: 0, violationAction: 'BLOCK'
    });
    expect(zero.exceeded).toBe(false);
    expect(zero.unlimited).toBe(true);
    expect(periodIsActive({ category: 'OPERATIONAL', periodType: 'ONCE', limitAmount: 1e9, violationAction: 'WARN', isActive: false })).toBe(false);
    expect(samePeriodBucket(new Date('2026-01-01'), new Date('2026-01-01'), 'ONCE')).toBe(true);
    expect(sumSubmittedInPeriod([], 'MEAL', 'MONTHLY')).toBe(0);
  });
});
