type Row = Record<string, unknown>;

const state: { branchTimezone: string | null; companyTimezone: string | null } = {
  branchTimezone: 'Asia/Jakarta',
  companyTimezone: 'Asia/Jakarta',
};
let employeeFindFirst: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  employeeFindFirst = jest.fn(async () => ({
    id: 'emp-1', companyId: 'company-a', branchId: 'branch-home', departmentId: null,
    employeeCategory: null, shiftFormulaId: null, shiftStartDate: null,
  }));
  const client = {
    employee: { findFirst: employeeFindFirst },
    employeeCompanyAssignment: { findFirst: jest.fn(async () => null) },
    employeeCareerTransaction: { findFirst: jest.fn(async () => null) },
    branch: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => ({
        id: where.id, name: String(where.id), code: String(where.id),
        latitude: null, longitude: null, timezone: state.branchTimezone,
      })),
    },
    department: { findFirst: jest.fn(async () => null) },
    company: { findFirst: jest.fn(async () => ({ timezone: state.companyTimezone })) },
    branchAttendancePolicy: { findFirst: jest.fn(async () => null) },
  };
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('@/modules/work-calendar/work-calendar.repository', () => ({
  workCalendarRepository: {
    findEmployeeShiftOverrideSchedule: jest.fn(async () => null),
    resolveShiftFormulaSchedule: jest.fn(async () => null),
    findDayScheduleForContext: jest.fn(async () => ({
      calendarId: 'calendar-1', dayType: 'WD', isWorkingDay: true,
      workStart: '08:00', workEnd: '17:00', scheduleSource: 'CALENDAR',
    })),
  },
}));

import { AttendanceContextService } from './attendance-context.service';

/**
 * The resolved context is where lateness and early-leave read the schedule
 * from, so it is also where they must read the timezone from. Without it both
 * fell back to the server process timezone — UTC in the production container —
 * and judged an 08:00 Asia/Jakarta shift as 08:00 UTC.
 */
const service = new AttendanceContextService();
const DATE = new Date('2026-10-06T03:00:00Z');

beforeEach(() => {
  jest.clearAllMocks();
  state.branchTimezone = 'Asia/Jakarta';
  state.companyTimezone = 'Asia/Jakarta';
});

describe('resolved attendance context timezone', () => {
  it('follows the branch, because that is the clock the employee punches against', async () => {
    state.branchTimezone = 'Asia/Makassar';
    state.companyTimezone = 'Asia/Jakarta';

    expect((await service.resolve('emp-1', DATE)).timezone).toBe('Asia/Makassar');
  });

  it('falls back to the company for an employee with no branch', async () => {
    employeeFindFirst.mockResolvedValueOnce({
      id: 'emp-1', companyId: 'company-a', branchId: null, departmentId: null,
      employeeCategory: null, shiftFormulaId: null, shiftStartDate: null,
    });
    state.companyTimezone = 'Asia/Jayapura';

    expect((await service.resolve('emp-1', DATE)).timezone).toBe('Asia/Jayapura');
  });

  it('falls back to Asia/Jakarta when neither column carries a zone', async () => {
    state.branchTimezone = null;
    state.companyTimezone = null;

    expect((await service.resolve('emp-1', DATE)).timezone).toBe('Asia/Jakarta');
  });
});
