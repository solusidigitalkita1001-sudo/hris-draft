let balanceUpdateMany: jest.Mock;
let employeeFindMany: jest.Mock;
let leaveTypeFindMany: jest.Mock;
let accrue: jest.Mock;
let settingFindUnique: jest.Mock;
const order: string[] = [];

jest.mock('@/shared/database/prisma', () => {
  balanceUpdateMany = jest.fn(async () => { order.push('expire'); return { count: 3 }; });
  employeeFindMany = jest.fn(async () => [{ id: 'employee-1', companyId: 'company-a' }]);
  leaveTypeFindMany = jest.fn(async () => [{ id: 'annual', companyId: 'company-a' }]);
  settingFindUnique = jest.fn(async () => null);
  const client = {
    leaveBalance: { updateMany: balanceUpdateMany },
    employee: { findMany: employeeFindMany },
    leaveType: { findMany: leaveTypeFindMany },
    companySetting: { findUnique: settingFindUnique },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('./leave.service', () => ({
  leaveService: { accrueAnnualBalance: (accrue = jest.fn(async () => { order.push('accrue'); })) },
}));
jest.mock('@/infrastructure/queue/QueueManager', () => ({
  queueManager: { isEnabled: () => false, enqueue: jest.fn() },
  QueueNames: { LEAVE_AUTOMATION: 'leave-automation' },
}));

import { runYearlyLeaveAccrual } from './leave.scheduler';

/**
 * Carry-over reads last year's `remainingDays`. Expiring that row first — which
 * is what this job used to do — zeroed the very field the accrual was about to
 * read, so carry-over silently carried nothing every single year.
 */
describe('yearly leave accrual', () => {
  beforeEach(() => { order.length = 0; jest.clearAllMocks(); });

  it('accrues before expiring, so the previous balance is still readable', async () => {
    await runYearlyLeaveAccrual(2027);

    expect(order).toEqual(['accrue', 'expire']);
  });

  it('accrues each annual leave type of the employee company for the target year', async () => {
    await runYearlyLeaveAccrual(2027);

    expect(accrue).toHaveBeenCalledWith({ employeeId: 'employee-1', leaveTypeId: 'annual', year: 2027, maxCarryOver: 1 });
  });

  it('expires only unexpired balances of the previous year and reports the count', async () => {
    await expect(runYearlyLeaveAccrual(2027)).resolves.toEqual({ processed: 1, failed: 0, expired: 3, skippedExpiry: 0 });

    expect(balanceUpdateMany).toHaveBeenCalledWith({
      where: { year: 2026, remainingDays: { gt: 0 }, expiredAt: null },
      data: { expiredAt: expect.any(Date), remainingDays: 0 },
    });
  });

  /**
   * This case used to assert `{processed: 0, failed: 1, expired: 3}` — that is,
   * it required the job to expire last year's balance for an employee whose
   * accrual had just thrown. The days owed were destroyed and nothing was left
   * to reconstruct them from, and the test held the behaviour in place. It now
   * asserts the opposite.
   */
  it('keeps going when one employee fails, but refuses to expire that employee', async () => {
    accrue.mockRejectedValueOnce(new Error('joinDate missing'));

    await expect(runYearlyLeaveAccrual(2027)).resolves.toMatchObject({ processed: 0, failed: 1, skippedExpiry: 1 });

    expect(balanceUpdateMany).toHaveBeenCalledTimes(1);
    expect(balanceUpdateMany).toHaveBeenCalledWith({
      where: {
        year: 2026, remainingDays: { gt: 0 }, expiredAt: null,
        employeeId: { notIn: ['employee-1'] },
      },
      data: { expiredAt: expect.any(Date), remainingDays: 0 },
    });
  });

  it('takes the carry-over cap from the company setting, not from the code', async () => {
    settingFindUnique.mockResolvedValueOnce({ value: '6' });

    await runYearlyLeaveAccrual(2027);

    expect(accrue).toHaveBeenCalledWith(expect.objectContaining({ maxCarryOver: 6 }));
  });

  it('falls back to the documented default when the setting is nonsense', async () => {
    settingFindUnique.mockResolvedValueOnce({ value: 'dua hari' });

    await runYearlyLeaveAccrual(2027);

    expect(accrue).toHaveBeenCalledWith(expect.objectContaining({ maxCarryOver: 1 }));
  });
});
