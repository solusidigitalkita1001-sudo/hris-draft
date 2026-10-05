import { leaveService } from './leave.service';
import { leaveRepository } from './leave.repository';

jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));
jest.mock('./leave.repository', () => ({
  leaveRepository: { findAccrualInputs: jest.fn(), upsertAccruedBalance: jest.fn(async (data) => data) },
}));

const inputs = leaveRepository.findAccrualInputs as jest.Mock;
const upsert = leaveRepository.upsertAccruedBalance as jest.Mock;

const employee = { id: 'employee-1', companyId: 'company-a', joinDate: new Date('2020-01-15') };
const leaveType = { id: 'annual', companyId: 'company-a', isAnnual: true, maxDays: 12 };

const accrue = (overrides: Record<string, unknown>) => {
  inputs.mockResolvedValueOnce({ employee, leaveType, ...overrides });
  return leaveService.accrueAnnualBalance({ employeeId: employee.id, leaveTypeId: leaveType.id, year: 2027, maxCarryOver: 3 });
};

describe('yearly accrual is safe to run twice', () => {
  beforeEach(() => jest.clearAllMocks());

  it('carries from last year on the first run', async () => {
    const result = await accrue({ previousBalance: { remainingDays: 5 }, currentBalance: null });

    // 5 remaining, capped at 3, on top of the full 12-day quota.
    expect(result.breakdown).toEqual({ entitlement: 12, carryOver: 3, totalDays: 15 });
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 15, carryOverDays: 3 }));
  });

  it('reuses the recorded carry-over on a second run, after expiry zeroed last year', async () => {
    // This is the real second-run state: expiry has already set last year's
    // remainingDays to 0, so re-deriving would yield a carry-over of nothing.
    const result = await accrue({ previousBalance: { remainingDays: 0 }, currentBalance: { carryOverDays: 3 } });

    expect(result.breakdown).toEqual({ entitlement: 12, carryOver: 3, totalDays: 15 });
    // The assertion that fails on the previous behaviour: totalDays stayed 15
    // instead of being written back down to the bare 12-day entitlement.
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 15, carryOverDays: 3 }));
  });

  it('records a zero carry-over rather than leaving it unset', async () => {
    await accrue({ previousBalance: null, currentBalance: null });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ totalDays: 12, carryOverDays: 0 }));
  });

  it('honours the cap the caller passes instead of a figure fixed in code', async () => {
    inputs.mockResolvedValueOnce({ employee, leaveType, previousBalance: { remainingDays: 9 }, currentBalance: null });
    const result = await leaveService.accrueAnnualBalance({
      employeeId: employee.id, leaveTypeId: leaveType.id, year: 2027, maxCarryOver: 7,
    });

    expect(result.breakdown.carryOver).toBe(7);
  });

  it('still pro-rates someone who joined mid-year', async () => {
    inputs.mockResolvedValueOnce({
      employee: { ...employee, joinDate: new Date('2027-07-01') },
      leaveType, previousBalance: null, currentBalance: null,
    });
    const result = await leaveService.accrueAnnualBalance({ employeeId: employee.id, leaveTypeId: leaveType.id, year: 2027 });

    expect(result.breakdown.entitlement).toBeLessThan(12);
    expect(result.breakdown.entitlement).toBeGreaterThan(0);
  });
});
