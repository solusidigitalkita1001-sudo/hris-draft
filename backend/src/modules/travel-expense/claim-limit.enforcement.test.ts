let limitFindMany: jest.Mock;
let claimFindMany: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  limitFindMany = jest.fn();
  claimFindMany = jest.fn(async () => []);
  const client = {
    claimCategoryLimit: { findMany: limitFindMany, upsert: jest.fn() },
    expenseClaim: { findMany: claimFindMany },
  };
  return { __esModule: true, default: client, prisma: client };
});

import { assertWithinCategoryLimits } from './claim-limit.service';

const WHEN = '2026-10-05T00:00:00Z';
const call = (amount: number) => assertWithinCategoryLimits({
  companyId: 'c1', employeeId: 'e1', category: 'MEAL', amount, expenseDate: WHEN,
});
const limit = (over: Record<string, unknown> = {}) => ({
  companyId: 'c1', category: 'MEAL', periodType: 'MONTHLY', limitAmount: 1_000_000,
  violationAction: 'WARN', isActive: true, validFrom: null, validUntil: null, ...over,
});

describe('claim category plafond enforcement', () => {
  beforeEach(() => { jest.clearAllMocks(); claimFindMany.mockResolvedValue([]); });

  it('is a no-op when no limit has been configured', async () => {
    limitFindMany.mockResolvedValueOnce([]);

    await expect(call(9_999_999)).resolves.toEqual({ warnings: [], results: [] });
    // Nothing existing breaks because this shipped: no row means unlimited,
    // and the history query is not even run.
    expect(claimFindMany).not.toHaveBeenCalled();
  });

  it('allows a claim inside the plafond', async () => {
    limitFindMany.mockResolvedValueOnce([limit()]);
    claimFindMany.mockResolvedValueOnce([{ amount: 200_000, expenseDate: new Date(WHEN) }]);

    const verdict = await call(300_000);

    expect(verdict.warnings).toEqual([]);
    expect(verdict.results[0]).toMatchObject({ exceeded: false, projectedTotal: 500_000 });
  });

  it('warns but still allows when the action is WARN', async () => {
    limitFindMany.mockResolvedValueOnce([limit()]);
    claimFindMany.mockResolvedValueOnce([{ amount: 900_000, expenseDate: new Date(WHEN) }]);

    const verdict = await call(300_000);

    expect(verdict.warnings.length).toBe(1);
    expect(verdict.results[0]).toMatchObject({ exceeded: true, isBlock: false });
  });

  it('refuses the claim when the action is BLOCK', async () => {
    limitFindMany.mockResolvedValueOnce([limit({ violationAction: 'BLOCK' })]);
    claimFindMany.mockResolvedValueOnce([{ amount: 900_000, expenseDate: new Date(WHEN) }]);

    await expect(call(300_000)).rejects.toThrow();
  });

  it('enforces every period a category carries, not just the loosest', async () => {
    // Two million a month and twenty million a year is an ordinary policy; the
    // monthly one is within budget here and the yearly one is not.
    limitFindMany.mockResolvedValueOnce([
      limit({ periodType: 'MONTHLY', limitAmount: 2_000_000 }),
      limit({ periodType: 'YEARLY', limitAmount: 3_000_000, violationAction: 'BLOCK' }),
    ]);
    claimFindMany.mockResolvedValueOnce([
      { amount: 500_000, expenseDate: new Date(WHEN) },
      { amount: 2_400_000, expenseDate: new Date('2026-03-01T00:00:00Z') },
    ]);

    await expect(call(500_000)).rejects.toThrow();
  });

  it('does not count rejected or cancelled claims against the plafond', async () => {
    limitFindMany.mockResolvedValueOnce([limit()]);
    await call(100_000);

    const [[query]] = claimFindMany.mock.calls;
    expect(query.where.status).toEqual({ notIn: ['REJECTED', 'CANCELLED'] });
  });
});
