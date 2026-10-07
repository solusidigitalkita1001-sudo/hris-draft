let policyFindMany: jest.Mock;
let employeeFindMany: jest.Mock;
let attendanceCreateMany: jest.Mock;
let loadAttendance: jest.Mock;
let assertOpen: jest.Mock;

jest.mock('@/shared/database/prisma', () => {
  policyFindMany = jest.fn();
  employeeFindMany = jest.fn();
  attendanceCreateMany = jest.fn(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
  const client = {
    branchAttendancePolicy: { findMany: policyFindMany },
    employee: { findMany: employeeFindMany },
    attendance: { createMany: attendanceCreateMany },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: (_label: string, fn: () => unknown) => fn(),
}));
jest.mock('@/modules/payroll/payroll-attendance', () => ({
  loadPayrollAttendance: (loadAttendance = jest.fn()),
}));
jest.mock('@/shared/payroll/payroll-period-guard', () => ({
  assertPayrollDateOpen: (assertOpen = jest.fn(async () => undefined)),
}));

import { sweepAutoAbsent } from './auto-absent.service';

const DAY = new Date('2026-10-04T00:00:00Z');
const absentOne = (ids: string[]) => new Map(ids.map(id => [id, { absent: 1 }]));

describe('auto-absent sweep', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    assertOpen.mockResolvedValue(undefined);
  });

  it('does nothing for a company that has the switch off', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoAbsentEnabled: false }]);

    const result = await sweepAutoAbsent(DAY);

    expect(result).toMatchObject({ companies: 0, created: 0 });
    expect(attendanceCreateMany).not.toHaveBeenCalled();
  });

  it('marks only the employees the calendar says were absent', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoAbsentEnabled: true }]);
    employeeFindMany.mockResolvedValueOnce([{ id: 'e1', branchId: 'b1' }, { id: 'e2', branchId: 'b1' }]);
    // e2 was present, on leave, or the day was not a working day for them.
    loadAttendance.mockResolvedValueOnce(new Map([['e1', { absent: 1 }], ['e2', { absent: 0 }]]));

    const result = await sweepAutoAbsent(DAY);

    expect(result).toMatchObject({ companies: 1, candidates: 1, created: 1 });
    const [[call]] = attendanceCreateMany.mock.calls;
    expect(call.data).toHaveLength(1);
    expect(call.data[0]).toMatchObject({ employeeId: 'e1', status: 'ABSENT', source: 'auto-absent' });
    // Leaning on @@unique([employeeId, date]) is what makes a re-run harmless.
    expect(call.skipDuplicates).toBe(true);
  });

  it('honours a branch that overrides the company default', async () => {
    policyFindMany.mockResolvedValueOnce([
      { companyId: 'c1', branchId: null, autoAbsentEnabled: true },
      { companyId: 'c1', branchId: 'b-off', autoAbsentEnabled: false },
    ]);
    employeeFindMany.mockResolvedValueOnce([{ id: 'e1', branchId: 'b-off' }, { id: 'e2', branchId: 'b-on' }]);
    loadAttendance.mockResolvedValueOnce(absentOne(['e1', 'e2']));

    await sweepAutoAbsent(DAY);

    const [[call]] = attendanceCreateMany.mock.calls;
    expect(call.data.map((row: { employeeId: string }) => row.employeeId)).toEqual(['e2']);
  });

  it('refuses to write into a payroll period that is already closed', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoAbsentEnabled: true }]);
    assertOpen.mockRejectedValueOnce(new Error('period closed'));

    const result = await sweepAutoAbsent(DAY);

    expect(result).toMatchObject({ closedPeriods: 1, created: 0 });
    expect(employeeFindMany).not.toHaveBeenCalled();
    expect(attendanceCreateMany).not.toHaveBeenCalled();
  });

  it('writes nothing when everybody turned up', async () => {
    policyFindMany.mockResolvedValueOnce([{ companyId: 'c1', branchId: null, autoAbsentEnabled: true }]);
    employeeFindMany.mockResolvedValueOnce([{ id: 'e1', branchId: null }]);
    loadAttendance.mockResolvedValueOnce(new Map([['e1', { absent: 0 }]]));

    expect(await sweepAutoAbsent(DAY)).toMatchObject({ candidates: 0, created: 0 });
    expect(attendanceCreateMany).not.toHaveBeenCalled();
  });
});
