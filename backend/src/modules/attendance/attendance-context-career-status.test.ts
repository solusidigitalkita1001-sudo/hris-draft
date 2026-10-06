type Row = Record<string, unknown>;

const state: { career: Row[]; captured: Row | null } = { career: [], captured: null };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    employee: {
      findFirst: jest.fn(async () => ({
        id: 'emp-1', companyId: 'company-a', branchId: 'branch-home', departmentId: null,
        employeeCategory: null, shiftFormulaId: null, shiftStartDate: null,
      })),
    },
    employeeCompanyAssignment: { findFirst: jest.fn(async () => null) },
    employeeCareerTransaction: {
      // Behaves like the database with respect to `status`, so a service that
      // forgets the filter really does receive the pending row.
      findFirst: jest.fn(async ({ where }: { where: Row }) => {
        state.captured = where;
        const rows = state.career.filter(
          (row) => where.status === undefined || row.status === where.status,
        );
        return rows[0] ?? null;
      }),
    },
    branch: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => ({
        id: where.id, name: String(where.id), code: String(where.id), latitude: null, longitude: null,
      })),
    },
    department: { findFirst: jest.fn(async () => null) },
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
      shiftId: null, shiftName: null, startTime: '08:00', endTime: '17:00',
    })),
  },
}));

import { AttendanceContextService } from './attendance-context.service';

/**
 * Attendance policy follows the branch: which check-in methods are allowed,
 * the geofence, the shift. The branch came from the latest career movement on
 * or before the attendance date — with no filter on status, so a movement
 * still awaiting approval, or one that had been rejected, silently decided
 * where somebody was allowed to clock in. The apply sweep has always required
 * APPROVED (career-transaction.scheduler.ts), so the read and the write
 * disagreed about the same row.
 */
const service = new AttendanceContextService();
const DATE = new Date('2026-10-06T03:00:00Z');

const movement = (toBranchId: string, status: string) => ({ toBranchId, toDepartmentId: null, status });

beforeEach(() => {
  jest.clearAllMocks();
  state.career = [];
  state.captured = null;
});

describe('attendance context and unapproved career movements', () => {
  it('ignores a movement that is still awaiting approval', async () => {
    state.career = [movement('branch-new', 'PENDING')];
    const resolved = await service.resolve('emp-1', DATE);
    expect(resolved.branchId).toBe('branch-home');
  });

  it('ignores a movement that was rejected', async () => {
    state.career = [movement('branch-new', 'REJECTED')];
    const resolved = await service.resolve('emp-1', DATE);
    expect(resolved.branchId).toBe('branch-home');
  });

  it('still follows an approved movement', async () => {
    state.career = [movement('branch-new', 'APPROVED')];
    const resolved = await service.resolve('emp-1', DATE);
    expect(resolved.branchId).toBe('branch-new');
  });

  it('asks the database for approved movements only', async () => {
    await service.resolve('emp-1', DATE);
    expect(state.captured).toMatchObject({ employeeId: 'emp-1', deletedAt: null, status: 'APPROVED' });
  });
});
