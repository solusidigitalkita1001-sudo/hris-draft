let balanceUpdateMany: jest.Mock;
let employeeFindMany: jest.Mock;
let leaveTypeFindMany: jest.Mock;
let accrue: jest.Mock;
const order: string[] = [];

jest.mock('@/shared/database/prisma', () => {
  balanceUpdateMany = jest.fn(async () => { order.push('expire'); return { count: 3 }; });
  employeeFindMany = jest.fn(async () => [{ id: 'employee-1', companyId: 'company-a' }]);
  leaveTypeFindMany = jest.fn(async () => [{ id: 'annual', companyId: 'company-a' }]);
  const client = {
    leaveBalance: { updateMany: balanceUpdateMany },
    employee: { findMany: employeeFindMany },
    leaveType: { findMany: leaveTypeFindMany },
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

    expect(accrue).toHaveBeenCalledWith({ employeeId: 'employee-1', leaveTypeId: 'annual', year: 2027 });
  });

  it('expires only unexpired balances of the previous year and reports the count', async () => {
    await expect(runYearlyLeaveAccrual(2027)).resolves.toEqual({ processed: 1, failed: 0, expired: 3 });

    expect(balanceUpdateMany).toHaveBeenCalledWith({
      where: { year: 2026, remainingDays: { gt: 0 }, expiredAt: null },
      data: { expiredAt: expect.any(Date), remainingDays: 0 },
    });
  });

  it('keeps going when one employee fails and still expires afterwards', async () => {
    accrue.mockRejectedValueOnce(new Error('joinDate missing'));

    await expect(runYearlyLeaveAccrual(2027)).resolves.toMatchObject({ processed: 0, failed: 1, expired: 3 });
    expect(balanceUpdateMany).toHaveBeenCalledTimes(1);
  });
});
