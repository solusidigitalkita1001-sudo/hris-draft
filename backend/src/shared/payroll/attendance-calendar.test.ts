import { countPayrollAttendance, payrollDateKey, payrollPeriodDates, resolvePayrollWorkingDates, ScheduleCalendar, ScheduleData, ScheduleEmployee, ScheduleOverride } from './attendance-calendar';
const employee: ScheduleEmployee = { id: 'employee', companyId: 'A', branchId: 'branch', departmentId: 'department', employeeCategory: 'OFFICE', shiftFormulaId: null, shiftStartDate: null };
const calendar: ScheduleCalendar = { id: 'calendar', companyId: 'A', branchId: null, departmentId: null, year: 2026,
  workDays: { mon: true, tue: { enabled: true, workStart: '09:00' }, wed: true, thu: true, fri: true, sat: false, sun: false }, days: [] };
const dates = payrollPeriodDates(new Date('2026-10-01T05:00:00Z'), new Date('2026-10-07T05:00:00Z'));
const resolve = (data: Partial<ScheduleData> = {}, person = employee, days = dates) => [...resolvePayrollWorkingDates(person, days, { calendars: [calendar], shifts: [], overrides: [], ...data })];
const swap = (changes: Partial<ScheduleOverride> = {}): ScheduleOverride => ({ companyId: 'A', employeeId: 'employee', date: new Date('2026-10-03'), source: 'SHIFT_SWAP',
  overrideSchedule: { dayType: 'WD', isWorkingDay: true }, shiftSwapRequest: { companyId: 'A', status: 'APPROVED', deletedAt: null,
    shiftDate: new Date('2026-10-03'), requesterEmployeeId: 'employee', targetEmployeeId: 'colleague' }, ...changes });
describe('payroll calendar and leave date arithmetic', () => {
  it('counts default weekly rules even without exception rows and includes date-only boundary days', () => {
    expect(resolve()).toEqual(['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06', '2026-10-07']);
    expect(dates[0].toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });
  it('lets explicit holidays and working weekends override the weekly default', () => {
    expect(resolve({ calendars: [{ ...calendar, days: [{ date: new Date('2026-10-02'), dayType: 'NH' }, { date: new Date('2026-10-03'), dayType: 'OT' }] }] }))
      .toEqual(['2026-10-01', '2026-10-03', '2026-10-05', '2026-10-06', '2026-10-07']);
  });
  it('chooses department, then branch, then company; unrelated scopes cannot override', () => {
    const branch = { ...calendar, id: 'branch-calendar', branchId: 'branch', workDays: { tue: true } };
    const department = { ...calendar, id: 'department-calendar', departmentId: 'department', workDays: { mon: true } };
    const foreign = { ...department, id: 'foreign', companyId: 'B', workDays: { thu: true } };
    expect(resolve({ calendars: [calendar, branch, department, foreign] })).toEqual(['2026-10-05']);
    expect(resolve({ calendars: [calendar, branch, foreign] })).toEqual(['2026-10-06']);
    expect(resolve({ calendars: [calendar, foreign] })).toHaveLength(5);
  });
  it('resolves each year separately and never substitutes the newest calendar', () => {
    const period = payrollPeriodDates(new Date('2026-12-31'), new Date('2027-01-02'));
    const next = { ...calendar, id: 'next', year: 2027, workDays: { sat: true } };
    expect(resolve({ calendars: [calendar, next, { ...calendar, id: 'future', year: 2028 }] }, employee, period)).toEqual(['2026-12-31', '2027-01-02']);
    expect(() => resolve({ calendars: [calendar] }, employee, period)).toThrow('2027');
  });
  it('rejects missing and ambiguous calendars instead of treating them as zero workdays', () => {
    expect(() => resolve({ calendars: [] })).toThrow('Missing or ambiguous');
    expect(() => resolve({ calendars: [calendar, { ...calendar, id: 'duplicate' }] })).toThrow('ambiguous');
  });
  it('accepts an explicit all-off calendar', () => expect(resolve({ calendars: [{ ...calendar, workDays: {} }] })).toEqual([]));
  it('uses a factory rotation anchored to UTC date-only arithmetic, including dates before its anchor', () => {
    const person = { ...employee, employeeCategory: 'FACTORY' as const, shiftFormulaId: 'rotation', shiftStartDate: new Date('2026-10-02') };
    const shifts = [{ id: 'rotation', companyId: 'A', cycleLength: 2, days: [{ sequence: 1, dayType: 'WS' }, { sequence: 2, dayType: 'WE' }] }];
    expect(resolve({ calendars: [], shifts }, person)).toEqual(['2026-10-02', '2026-10-04', '2026-10-06']);
    expect(() => resolve({ shifts: [{ ...shifts[0], companyId: 'B' }] }, person)).toThrow('Incomplete shift');
    expect(() => resolve({ shifts: [{ ...shifts[0], cycleLength: 3 }] }, person)).toThrow('Incomplete shift');
  });
  it('applies approved swap snapshots before the normal schedule', () => {
    expect(resolve({ overrides: [swap()] })).toContain('2026-10-03');
    expect(resolve({ overrides: [swap({ employeeId: 'other' }), swap({ companyId: 'B' })] })).not.toContain('2026-10-03');
  });
  it.each(['PENDING', 'REJECTED', 'CANCELLED'] as const)('rejects an override whose request is %s', status => {
    const override = swap(); if (!override.shiftSwapRequest) throw new Error('Fixture request missing');
    override.shiftSwapRequest.status = status;
    expect(() => resolve({ overrides: [override] })).toThrow('Invalid approved shift override');
  });
  it.each([
    { shiftSwapRequest: null }, { source: 'UNKNOWN' }, { overrideSchedule: { dayType: 'WD', isWorkingDay: false } },
    { overrideSchedule: { dayType: 'UNKNOWN', isWorkingDay: true } },
  ])('rejects invalid override metadata %j', changes => expect(() => resolve({ overrides: [swap(changes)] })).toThrow());
  it('counts each scheduled date once despite overlapping leave, presence on leave, duplicate attendance, or attendance on a rest day', () => {
    const result = countPayrollAttendance(new Set(resolve()), [
      { date: new Date('2026-10-01'), status: 'PRESENT' }, { date: new Date('2026-10-01'), status: 'LATE' },
      { date: new Date('2026-10-04'), status: 'PRESENT' }, { date: new Date('2026-09-30'), status: 'PRESENT' },
    ], [{ startDate: new Date('2026-09-01'), endDate: new Date('2026-10-02') }, { startDate: new Date('2026-10-02'), endDate: new Date('2026-10-05') }]);
    expect(result).toEqual({ workDays: 5, present: 1, leave: 2, absent: 2 });
  });
  it('intersects leave with a leap-day period and ignores the rest of a long request', () => {
    const work = new Set(payrollPeriodDates(new Date('2028-02-28'), new Date('2028-03-01')).map(payrollDateKey));
    expect(countPayrollAttendance(work, [], [{ startDate: new Date('2028-01-01'), endDate: new Date('2028-02-29') }]))
      .toEqual({ workDays: 3, present: 0, leave: 2, absent: 1 });
  });
  it('rejects reversed or unbounded periods and invalid calendar configuration', () => {
    expect(() => payrollPeriodDates(new Date('2026-10-02'), new Date('2026-10-01'))).toThrow();
    expect(() => payrollPeriodDates(new Date('2026-01-01'), new Date('2027-01-02'))).toThrow('1–366');
    expect(() => payrollDateKey(new Date('invalid'))).toThrow();
    expect(() => resolve({ calendars: [{ ...calendar, workDays: { thu: { enabled: 'false' } } }] })).toThrow('Invalid working week');
    expect(() => countPayrollAttendance(new Set(resolve()), [], [{ startDate: new Date('2026-10-02'), endDate: new Date('2026-10-01') }])).toThrow('invalid date range');
  });
});
