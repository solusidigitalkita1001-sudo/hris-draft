let policyFindMany: jest.Mock;
let attendanceFindMany: jest.Mock;
let attendanceUpdate: jest.Mock;
let assertOpen: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  policyFindMany = jest.fn();
  attendanceFindMany = jest.fn(async () => []);
  attendanceUpdate = jest.fn(async () => ({}));
  const client = {
    branchAttendancePolicy: { findMany: policyFindMany },
    attendance: { findMany: attendanceFindMany, update: attendanceUpdate },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('@/shared/payroll/payroll-period-guard', () => ({
  assertPayrollDateOpen: (assertOpen = jest.fn(async () => undefined)),
}));

import { sweepAutoCheckout } from './auto-checkout.service';

const DAY = new Date('2026-10-04T00:00:00Z');
const at = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date(DAY); d.setHours(h, m, 0, 0); return d;
};
const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1', branchId: 'b1', checkIn: at('08:05'),
  scheduledWorkStart: '08:00', scheduledWorkEnd: '17:00', ...over,
});

describe('auto-checkout sweep', () => {
  beforeEach(() => { jest.clearAllMocks(); assertOpen.mockResolvedValue(undefined); });

  it('does nothing when the switch is off', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: false }]);

    expect(await sweepAutoCheckout(DAY)).toMatchObject({ companies: 0, closed: 0 });
    expect(attendanceFindMany).not.toHaveBeenCalled();
  });

  it('writes the scheduled shift end, not the time it ran', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    attendanceFindMany.mockResolvedValueOnce([row()]);

    const result = await sweepAutoCheckout(DAY);

    expect(result).toMatchObject({ companies: 1, candidates: 1, closed: 1 });
    const [[call]] = attendanceUpdate.mock.calls;
    expect(call.data.checkOut).toEqual(at('17:00'));
    // 08:05 to 17:00 is 535 minutes. Someone who merely forgot to tap out is
    // credited with their shift and no overtime.
    expect(call.data.workDuration).toBe(535);
    expect(call.data.source).toBe('auto-checkout');
  });

  it('rolls an overnight shift into the next morning instead of computing backwards', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    attendanceFindMany.mockResolvedValueOnce([
      row({ checkIn: at('22:00'), scheduledWorkStart: '22:00', scheduledWorkEnd: '06:00' }),
    ]);

    await sweepAutoCheckout(DAY);

    const [[call]] = attendanceUpdate.mock.calls;
    expect(call.data.workDuration).toBe(8 * 60);
    expect(call.data.checkOut.getTime()).toBeGreaterThan(at('22:00').getTime());
  });

  it('leaves a row with no scheduled end for a human to correct', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    attendanceFindMany.mockResolvedValueOnce([row({ scheduledWorkEnd: null })]);

    const result = await sweepAutoCheckout(DAY);

    // Guessing a time would invent a work duration out of nothing.
    expect(result).toMatchObject({ candidates: 1, closed: 0, skippedNoSchedule: 1 });
    expect(attendanceUpdate).not.toHaveBeenCalled();
  });

  it('skips a row whose schedule would end before the check-in', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    attendanceFindMany.mockResolvedValueOnce([
      row({ checkIn: at('18:00'), scheduledWorkStart: null, scheduledWorkEnd: '17:00' }),
    ]);

    expect(await sweepAutoCheckout(DAY)).toMatchObject({ closed: 0, skippedNoSchedule: 1 });
  });

  it('honours a branch that overrides the company default', async () => {
    policyFindMany.mockResolvedValueOnce([
      { companyId: 'c1', branchId: null, autoCheckoutEnabled: true },
      { companyId: 'c1', branchId: 'b-off', autoCheckoutEnabled: false },
    ]);
    attendanceFindMany.mockResolvedValueOnce([row({ id: 'off', branchId: 'b-off' }), row({ id: 'on', branchId: 'b-on' })]);

    await sweepAutoCheckout(DAY);

    expect(attendanceUpdate).toHaveBeenCalledTimes(1);
    expect(attendanceUpdate.mock.calls[0][0].where.id).toBe('on');
  });

  it('refuses to touch a closed payroll period', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    assertOpen.mockRejectedValueOnce(new Error('closed'));

    expect(await sweepAutoCheckout(DAY)).toMatchObject({ closedPeriods: 1, closed: 0 });
    expect(attendanceFindMany).not.toHaveBeenCalled();
  });

  it('only looks at rows that have a check-in and no check-out', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);

    await sweepAutoCheckout(DAY);

    const [[query]] = attendanceFindMany.mock.calls;
    expect(query.where).toMatchObject({ checkIn: { not: null }, checkOut: null, deletedAt: null });
  });
});
