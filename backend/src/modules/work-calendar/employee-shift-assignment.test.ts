import { BadRequestError } from '@/shared/exceptions/AppError';

let overrideFindMany: jest.Mock;
let overrideUpsert: jest.Mock;
let overrideUpdateMany: jest.Mock;
jest.mock('@/shared/database/prisma', () => {
  overrideFindMany = jest.fn(async () => []);
  overrideUpsert = jest.fn(async () => ({ id: 'override-1' }));
  overrideUpdateMany = jest.fn(async () => ({ count: 0 }));
  const client = {
    employeeShiftOverride: { findMany: overrideFindMany, upsert: overrideUpsert, updateMany: overrideUpdateMany },
    $transaction: (work: (tx: unknown) => unknown) => work(client),
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentCompanyId: () => 'company-a',
  getCurrentRoles: () => ['HR_MANAGER'],
  getRequestContext: () => ({ user: { id: 'actor', roles: ['HR_MANAGER'] } }),
}));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn() }));
jest.mock('@/shared/payroll/payroll-period-guard', () => ({ assertPayrollRangeOpen: jest.fn() }));
jest.mock('./work-calendar.repository', () => ({
  workCalendarRepository: { findEmployeeDaySchedule: jest.fn(async () => ({ calendarId: 'cal-1' })) },
}));
jest.mock('@/modules/workflow-engine/workflow-engine.repository', () => ({ workflowEngineRepository: {} }));

import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { assertPayrollRangeOpen } from '@/shared/payroll/payroll-period-guard';
import { workCalendarService, enumerateDateRange } from './work-calendar.service';

/**
 * Until now an approved shift swap was the only writer of
 * EmployeeShiftOverride, so HR had to stage a roster change as a swap between
 * two people. These pin the guards that make a direct assignment safe.
 */
const EMPLOYEE = '11111111-1111-4111-8111-111111111111';
const workday = { startDate: '2026-10-01', endDate: '2026-10-03', isWorkingDay: true, workStart: '08:00', workEnd: '17:00' };

describe('enumerateDateRange', () => {
  it('is inclusive and date-only in UTC', () => {
    expect(enumerateDateRange('2026-10-01', '2026-10-03').map((date) => date.toISOString()))
      .toEqual(['2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z', '2026-10-03T00:00:00.000Z']);
  });

  it('rejects a reversed range', () => {
    expect(() => enumerateDateRange('2026-10-03', '2026-10-01')).toThrow(BadRequestError);
  });
});

describe('assignEmployeeShift', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    overrideFindMany.mockResolvedValue([]);
    overrideUpsert.mockResolvedValue({ id: 'override-1' });
  });

  it('writes one HR_ASSIGNMENT row per day, which payroll accepts on its own terms', async () => {
    const result = await workCalendarService.assignEmployeeShift(EMPLOYEE, workday as never);

    expect(result).toEqual({ employeeId: EMPLOYEE, days: 3, dates: ['2026-10-01', '2026-10-02', '2026-10-03'] });
    expect(overrideUpsert).toHaveBeenCalledTimes(3);
    const created = overrideUpsert.mock.calls[0][0].create;
    expect(created).toMatchObject({ companyId: 'company-a', employeeId: EMPLOYEE, source: 'HR_ASSIGNMENT' });
    // The flag payroll cross-checks against dayType.
    expect(created.overrideSchedule).toMatchObject({ dayType: 'WD', isWorkingDay: true, workStart: '08:00', workEnd: '17:00' });
  });

  it('marks an assigned day off as a non-working day', async () => {
    await workCalendarService.assignEmployeeShift(
      EMPLOYEE, { startDate: '2026-10-01', endDate: '2026-10-01', isWorkingDay: false } as never,
    );
    expect(overrideUpsert.mock.calls[0][0].create.overrideSchedule)
      .toMatchObject({ dayType: 'WE', isWorkingDay: false, workStart: null, workEnd: null });
  });

  it('flags a shift that crosses midnight', async () => {
    await workCalendarService.assignEmployeeShift(
      EMPLOYEE, { startDate: '2026-10-01', endDate: '2026-10-01', isWorkingDay: true, workStart: '22:00', workEnd: '06:00' } as never,
    );
    expect(overrideUpsert.mock.calls[0][0].create.overrideSchedule.crossesMidnight).toBe(true);
  });

  it('refuses to overwrite an approved shift swap', async () => {
    overrideFindMany.mockResolvedValue([{ date: new Date('2026-10-02T00:00:00.000Z'), source: 'SHIFT_SWAP' }]);

    await expect(workCalendarService.assignEmployeeShift(EMPLOYEE, workday as never))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(overrideUpsert).not.toHaveBeenCalled();
  });

  it('checks the employee scope and the payroll period before writing', async () => {
    await workCalendarService.assignEmployeeShift(EMPLOYEE, workday as never);

    expect(assertEmployeeInScope).toHaveBeenCalledWith(EMPLOYEE, 'work-calendar');
    // Rewriting the schedule inside a settled period would change paid time.
    expect(assertPayrollRangeOpen).toHaveBeenCalledWith(
      'company-a', new Date('2026-10-01T00:00:00.000Z'), new Date('2026-10-03T00:00:00.000Z'),
    );
  });

  it('bounds the range so one call cannot rewrite a year', async () => {
    await expect(workCalendarService.assignEmployeeShift(
      EMPLOYEE, { ...workday, endDate: '2027-10-01' } as never,
    )).rejects.toThrow(BadRequestError);
    expect(overrideUpsert).not.toHaveBeenCalled();
  });
});

describe('clearEmployeeShiftAssignment', () => {
  beforeEach(() => jest.clearAllMocks());

  it('withdraws only HR assignments, never an approved swap', async () => {
    overrideUpdateMany.mockResolvedValue({ count: 2 });

    await expect(workCalendarService.clearEmployeeShiftAssignment(
      EMPLOYEE, { startDate: '2026-10-01', endDate: '2026-10-03' },
    )).resolves.toEqual({ employeeId: EMPLOYEE, cleared: 2 });

    expect(overrideUpdateMany.mock.calls[0][0].where).toMatchObject({
      companyId: 'company-a', employeeId: EMPLOYEE, source: 'HR_ASSIGNMENT',
    });
  });
});
