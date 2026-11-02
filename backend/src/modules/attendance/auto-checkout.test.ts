let policyFindMany: jest.Mock;
let companyFindMany: jest.Mock;
let branchFindMany: jest.Mock;
let attendanceFindMany: jest.Mock;
let attendanceUpdate: jest.Mock;
let assertOpen: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  policyFindMany = jest.fn();
  companyFindMany = jest.fn(async () => [{ id: 'c1', timezone: 'Asia/Jakarta' }]);
  branchFindMany = jest.fn(async () => []);
  attendanceFindMany = jest.fn(async () => []);
  attendanceUpdate = jest.fn(async () => ({}));
  const client = {
    branchAttendancePolicy: { findMany: policyFindMany },
    company: { findMany: companyFindMany },
    branch: { findMany: branchFindMany },
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

/**
 * `at()` used to be `setHours`, i.e. the timezone of whatever machine ran the
 * suite — so it agreed with the service by sharing its bug, and the suite
 * passed while production wrote midnight check-outs. These helpers name the
 * timezone instead, and the suite is meant to run under `TZ=UTC` because that
 * is what the production container runs.
 */
const inZone = (offsetHours: number) => (hhmm: string, dayOffset = 0) => {
  const [h, m] = hhmm.split(':').map(Number);
  return new Date(Date.UTC(2026, 9, 4 + dayOffset, h - offsetHours, m, 0, 0));
};
/** WIB (UTC+7), the schema default `Asia/Jakarta`. */
const wib = inZone(7);
/** WITA (UTC+8), `Asia/Makassar`. */
const wita = inZone(8);

const row = (over: Record<string, unknown> = {}) => ({
  id: 'a1', branchId: 'b1', checkIn: wib('08:05'),
  scheduledWorkStart: '08:00', scheduledWorkEnd: '17:00', ...over,
});

describe('auto-checkout sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertOpen.mockResolvedValue(undefined);
    companyFindMany.mockResolvedValue([{ id: 'c1', timezone: 'Asia/Jakarta' }]);
    branchFindMany.mockResolvedValue([]);
    attendanceFindMany.mockResolvedValue([]);
    attendanceUpdate.mockResolvedValue({});
  });

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
    expect(call.data.checkOut).toEqual(wib('17:00'));
    // 17:00 in Jakarta, not in whatever timezone the process happens to run in.
    expect(call.data.checkOut.toISOString()).toBe('2026-10-04T10:00:00.000Z');
    // 08:05 to 17:00 is 535 minutes. Someone who merely forgot to tap out is
    // credited with their shift and no overtime.
    expect(call.data.workDuration).toBe(535);
    expect(call.data.source).toBe('auto-checkout');
  });

  it("follows the branch timezone over the company's", async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    branchFindMany.mockResolvedValueOnce([{ id: 'b1', timezone: 'Asia/Makassar' }]);
    attendanceFindMany.mockResolvedValueOnce([row({ checkIn: wita('08:05') })]);

    await sweepAutoCheckout(DAY);

    const [[call]] = attendanceUpdate.mock.calls;
    expect(call.data.checkOut.toISOString()).toBe('2026-10-04T09:00:00.000Z');
    expect(call.data.workDuration).toBe(535);
  });

  it('falls back to the company timezone for a row with no branch', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    companyFindMany.mockResolvedValueOnce([{ id: 'c1', timezone: 'Asia/Makassar' }]);
    attendanceFindMany.mockResolvedValueOnce([row({ branchId: null, checkIn: wita('08:05') })]);

    await sweepAutoCheckout(DAY);

    const [[call]] = attendanceUpdate.mock.calls;
    expect(call.data.checkOut.toISOString()).toBe('2026-10-04T09:00:00.000Z');
    expect(branchFindMany).not.toHaveBeenCalled();
  });

  it('rolls an overnight shift into the next morning instead of computing backwards', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoCheckoutEnabled: true }]);
    attendanceFindMany.mockResolvedValueOnce([
      row({ checkIn: wib('22:00'), scheduledWorkStart: '22:00', scheduledWorkEnd: '06:00' }),
    ]);

    await sweepAutoCheckout(DAY);

    const [[call]] = attendanceUpdate.mock.calls;
    expect(call.data.workDuration).toBe(8 * 60);
    expect(call.data.checkOut).toEqual(wib('06:00', 1));
    expect(call.data.checkOut.getTime()).toBeGreaterThan(wib('22:00').getTime());
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
      row({ checkIn: wib('18:00'), scheduledWorkStart: null, scheduledWorkEnd: '17:00' }),
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
