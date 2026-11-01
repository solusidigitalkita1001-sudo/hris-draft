let repositoryCreate: jest.Mock;
let repositoryUpdate: jest.Mock;
let repositoryFindById: jest.Mock;
let resolveContext: jest.Mock;

const schedule = { calendarId: 'cal-1', dayType: 'WD', workStart: '08:00', workEnd: '17:00', isWorkingDay: true, scheduleSource: 'CALENDAR' };
const policy = {
  id: 'pol-1', attendanceMethod: 'MANUAL',
  gpsLatitude: null, gpsLongitude: null, gpsRadiusMeters: null,
  allowOutsideRadius: false, outsideRadiusAction: 'REVIEW',
  lateToleranceMinutes: 0, earlyCheckoutToleranceMinutes: 0,
  allowHolidayAttendance: false, allowWeekendAttendance: false,
  autoAbsentEnabled: false, autoCheckoutEnabled: false,
  requiresSelfie: false, requiresLocation: false, isActive: true, notes: null,
};

jest.mock('./attendance.repository', () => {
  repositoryCreate = jest.fn(async (data: Record<string, unknown>) => ({ id: 'att-1', ...data }));
  repositoryUpdate = jest.fn(async (id: string, data: Record<string, unknown>) => ({ id, ...data }));
  repositoryFindById = jest.fn();
  return {
    attendanceRepository: {
      create: repositoryCreate,
      update: repositoryUpdate,
      findById: repositoryFindById,
      findByEmployeeAndDate: jest.fn(async () => null),
      createWithFaceLog: jest.fn(),
    },
  };
});
jest.mock('./attendance-context.service', () => {
  resolveContext = jest.fn(async () => ({
    employeeId: 'emp-1', companyId: 'c1', branchId: 'b1',
    branch: { id: 'b1', name: 'Kantor Pusat', code: 'HO', latitude: null, longitude: null },
    departmentId: null, timezone: 'Asia/Jakarta', calendarId: 'cal-1',
    schedule, policy, warnings: [],
  }));
  return { attendanceContextService: { resolve: resolveContext } };
});
jest.mock('@/shared/payroll/payroll-period-guard', () => ({ assertPayrollDateOpen: jest.fn(async () => undefined) }));
jest.mock('@/shared/security/employee-data-scope', () => ({
  employeeAccessWhere: jest.fn(async () => ({})),
  assertEmployeeInScope: jest.fn(async () => undefined),
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
// The face pipeline pulls in TensorFlow at import time and none of it is
// exercised by a MANUAL punch.
jest.mock('@/shared/attendance/face-extractor', () => ({
  extractFaceVectorFromImage: jest.fn(),
  FaceExtractionError: class FaceExtractionError extends Error { code = 'MODEL_UNAVAILABLE'; },
}));
jest.mock('@/shared/database/prisma', () => {
  const client = { employee: { findUnique: jest.fn(async () => null) } };
  return { __esModule: true, default: client, prisma: client };
});

import { attendanceService } from './attendance.service';

/**
 * Lateness and early-leave are the two numbers the timezone bug reached, and
 * both are read straight off the resolved context's schedule. These cases pin
 * the whole path — context timezone → composed instant → minutes — rather than
 * the composer alone, because the composer was never the part that was missing
 * a timezone: the call sites were.
 *
 * Run under `TZ=UTC`. On a developer machine set to Asia/Jakarta the old code
 * passed these too, which is exactly how the bug shipped.
 */
describe('lateness judged in the employee timezone', () => {
  beforeEach(() => jest.clearAllMocks());

  const punch = (checkIn: string) => attendanceService.create({
    employeeId: 'emp-1', companyId: 'c1',
    date: '2026-10-04T12:00:00.000Z',
    checkIn,
    status: 'PRESENT',
    method: 'MANUAL',
    source: 'TEST',
  } as never);

  it('marks 08:10 WIB against an 08:00 WIB shift as ten minutes late', async () => {
    await punch('2026-10-04T01:10:00.000Z');

    const [[created]] = repositoryCreate.mock.calls;
    expect(created.status).toBe('LATE');
    expect(created.lateMinutes).toBe(10);
  });

  it('freezes the timezone on the row, so the stored lateMinutes stays re-derivable', async () => {
    await punch('2026-10-04T01:10:00.000Z');

    const [[created]] = repositoryCreate.mock.calls;
    expect(created.policySnapshot).toMatchObject({ workStart: '08:00', workEnd: '17:00', timezone: 'Asia/Jakarta' });
  });

  it('leaves an on-time 07:55 WIB arrival PRESENT', async () => {
    await punch('2026-10-04T00:55:00.000Z');

    const [[created]] = repositoryCreate.mock.calls;
    expect(created.status).toBe('PRESENT');
    expect(created.lateMinutes).toBe(0);
  });

  it('judges a WITA branch by its own clock', async () => {
    resolveContext.mockResolvedValueOnce({
      employeeId: 'emp-1', companyId: 'c1', branchId: 'b2',
      branch: { id: 'b2', name: 'Makassar', code: 'MKS', latitude: null, longitude: null },
      departmentId: null, timezone: 'Asia/Makassar', calendarId: 'cal-1',
      schedule, policy, warnings: [],
    });

    // 08:10 WITA is 00:10 UTC — an hour earlier in absolute terms than the
    // same wall-clock arrival in Jakarta, and still ten minutes late.
    await punch('2026-10-04T00:10:00.000Z');

    const [[created]] = repositoryCreate.mock.calls;
    expect(created.status).toBe('LATE');
    expect(created.lateMinutes).toBe(10);
  });
});

describe('early leave judged in the employee timezone', () => {
  const record = {
    id: 'att-1', employeeId: 'emp-1', companyId: 'c1',
    date: new Date('2026-10-04T00:00:00.000Z'),
    checkIn: new Date('2026-10-04T01:00:00.000Z'),
    checkOut: null, method: 'MANUAL', status: 'PRESENT',
    distanceMeters: null, isWithinRadius: null,
    isException: false, exceptionType: null, exceptionReason: null,
    requiresReview: false, policySnapshot: null, notes: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repositoryFindById.mockResolvedValue(record);
  });

  it('counts a 16:30 WIB check-out against a 17:00 WIB shift as thirty minutes early', async () => {
    await attendanceService.checkOut('att-1', { checkOut: '2026-10-04T09:30:00.000Z' } as never);

    const [[, updated]] = repositoryUpdate.mock.calls;
    expect(updated.earlyLeaveMinutes).toBe(30);
  });

  it('does not accuse a full 17:00 WIB shift of leaving early', async () => {
    await attendanceService.checkOut('att-1', { checkOut: '2026-10-04T10:00:00.000Z' } as never);

    const [[, updated]] = repositoryUpdate.mock.calls;
    expect(updated.earlyLeaveMinutes).toBe(0);
    expect(updated.workDuration).toBe(9 * 60);
  });

  it('ends an overnight shift on the next calendar day in that timezone', async () => {
    resolveContext.mockResolvedValueOnce({
      employeeId: 'emp-1', companyId: 'c1', branchId: 'b1',
      branch: { id: 'b1', name: 'Kantor Pusat', code: 'HO', latitude: null, longitude: null },
      departmentId: null, timezone: 'Asia/Jakarta', calendarId: 'cal-1',
      schedule: { ...schedule, workStart: '22:00', workEnd: '06:00' },
      policy, warnings: [],
    });
    // Checked in 22:00 WIB on the 4th, out 06:00 WIB on the 5th — the full
    // shift, which the server-timezone version scored as hours of early leave.
    repositoryFindById.mockResolvedValueOnce({ ...record, checkIn: new Date('2026-10-04T15:00:00.000Z') });

    await attendanceService.checkOut('att-1', { checkOut: '2026-10-04T23:00:00.000Z' } as never);

    const [[, updated]] = repositoryUpdate.mock.calls;
    expect(updated.earlyLeaveMinutes).toBe(0);
    expect(updated.workDuration).toBe(8 * 60);
  });
});
