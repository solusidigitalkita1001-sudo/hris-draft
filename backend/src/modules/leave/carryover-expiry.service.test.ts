let settingFindMany: jest.Mock;
let balanceFindMany: jest.Mock;
let balanceUpdate: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  settingFindMany = jest.fn(async () => []);
  balanceFindMany = jest.fn(async () => []);
  balanceUpdate = jest.fn(async () => ({}));
  const client = {
    companySetting: { findMany: settingFindMany },
    leaveBalance: { findMany: balanceFindMany, update: balanceUpdate },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: (_label: string, fn: () => unknown) => fn(),
}));

import { sweepCarryOverExpiry } from './carryover-expiry.service';

const APRIL = new Date('2026-04-02T00:00:00Z');
const MARCH = new Date('2026-03-15T00:00:00Z');

describe('carry-over expiry sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    settingFindMany.mockResolvedValue([]);
    balanceFindMany.mockResolvedValue([]);
  });

  it('does nothing for a company that set no deadline', async () => {
    settingFindMany.mockResolvedValueOnce([{ companyId: 'c1', value: '0' }]);

    const result = await sweepCarryOverExpiry(APRIL);

    // 0 is the default and the pre-feature behaviour: no tenant loses days
    // because this shipped.
    expect(result).toMatchObject({ companies: 0, expired: 0, daysForfeited: 0 });
    expect(balanceFindMany).not.toHaveBeenCalled();
  });

  it('does nothing before the deadline has passed', async () => {
    settingFindMany.mockResolvedValueOnce([{ companyId: 'c1', value: '3' }]);

    const result = await sweepCarryOverExpiry(MARCH);

    expect(result.companies).toBe(0);
    expect(balanceUpdate).not.toHaveBeenCalled();
  });

  it('forfeits only the carried days the employee never reached', async () => {
    settingFindMany.mockResolvedValueOnce([{ companyId: 'c1', value: '3' }]);
    balanceFindMany.mockResolvedValueOnce([
      { id: 'b1', totalDays: 15, usedDays: 2, carryOverDays: 3 },
    ]);

    const result = await sweepCarryOverExpiry(APRIL);

    expect(result).toMatchObject({ companies: 1, checked: 1, expired: 1, daysForfeited: 1 });
    expect(balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'b1' },
      data: { carryOverExpiredAt: APRIL, totalDays: 14, remainingDays: 12 },
    });
  });

  it('stamps a balance whose carried days were all used, without touching the figures', async () => {
    settingFindMany.mockResolvedValueOnce([{ companyId: 'c1', value: '3' }]);
    balanceFindMany.mockResolvedValueOnce([{ id: 'b2', totalDays: 15, usedDays: 5, carryOverDays: 3 }]);

    const result = await sweepCarryOverExpiry(APRIL);

    expect(result).toMatchObject({ expired: 0, daysForfeited: 0 });
    // Stamped anyway: the deadline has passed for this row either way, and
    // leaving it unstamped means re-reading it every morning until December.
    expect(balanceUpdate).toHaveBeenCalledWith({
      where: { id: 'b2' }, data: { carryOverExpiredAt: APRIL },
    });
  });

  it('only looks at rows not already stamped, so running twice forfeits once', async () => {
    settingFindMany.mockResolvedValueOnce([{ companyId: 'c1', value: '3' }]);

    await sweepCarryOverExpiry(APRIL);

    const [[query]] = balanceFindMany.mock.calls;
    expect(query.where).toMatchObject({
      year: 2026, carryOverDays: { gt: 0 }, carryOverExpiredAt: null, expiredAt: null,
    });
  });

  it('sweeps each company against its own deadline', async () => {
    settingFindMany.mockResolvedValueOnce([
      { companyId: 'past', value: '3' },
      { companyId: 'future', value: '12' },
    ]);
    balanceFindMany.mockResolvedValue([]);

    const result = await sweepCarryOverExpiry(APRIL);

    expect(result.companies).toBe(1);
    expect(balanceFindMany).toHaveBeenCalledTimes(1);
    expect(balanceFindMany.mock.calls[0][0].where.companyId).toBe('past');
  });
});
