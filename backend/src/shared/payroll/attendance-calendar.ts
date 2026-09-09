import type { Employee, WorkCalendar, WorkCalendarDay, ShiftFormula, ShiftFormulaDay, EmployeeShiftOverride, ShiftSwapRequest } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';

const DAY_MS = 86400000;
const weekdays = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const workingTypes = new Set(['WD', 'WS', 'OT']);
const dayTypes = new Set([...workingTypes, 'WE', 'NH', 'JL', 'CH', 'RH']);
export type ScheduleEmployee = Pick<Employee, 'id' | 'companyId' | 'branchId' | 'departmentId' | 'employeeCategory' | 'shiftFormulaId' | 'shiftStartDate'>;
export type ScheduleCalendar = Pick<WorkCalendar, 'id' | 'companyId' | 'branchId' | 'departmentId' | 'year' | 'workDays'> & {
  days: Pick<WorkCalendarDay, 'date' | 'dayType'>[];
};
export type ScheduleShift = Pick<ShiftFormula, 'id' | 'companyId' | 'cycleLength'> & { days: Pick<ShiftFormulaDay, 'sequence' | 'dayType'>[] };
export type ScheduleOverride = Pick<EmployeeShiftOverride, 'companyId' | 'employeeId' | 'date' | 'source' | 'overrideSchedule'> & {
  shiftSwapRequest: Pick<ShiftSwapRequest, 'companyId' | 'status' | 'deletedAt' | 'shiftDate' | 'requesterEmployeeId' | 'targetEmployeeId'> | null;
};
export interface ScheduleData { calendars: ScheduleCalendar[]; shifts: ScheduleShift[]; overrides: ScheduleOverride[] }
export function payrollDate(date: Date): Date {
  if (!Number.isFinite(date.getTime())) throw new BadRequestError('Invalid payroll calendar date');
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}
export const payrollDateKey = (date: Date) => payrollDate(date).toISOString().slice(0, 10);
export function payrollPeriodDates(start: Date, end: Date): Date[] {
  const first = payrollDate(start).getTime(), last = payrollDate(end).getTime();
  if (last < first || (last - first) / DAY_MS >= 366) throw new BadRequestError('Payroll period must contain 1–366 calendar days');
  return Array.from({ length: (last - first) / DAY_MS + 1 }, (_, index) => new Date(first + index * DAY_MS));
}
function workingType(value: unknown): boolean {
  if (typeof value !== 'string' || !dayTypes.has(value)) throw new BadRequestError('Unsupported payroll schedule day type');
  return workingTypes.has(value);
}
function weekdayEnabled(calendar: ScheduleCalendar, date: Date): boolean {
  const config = calendar.workDays;
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new BadRequestError(`Invalid working week for calendar ${calendar.id}`);
  const rule = config[weekdays[date.getUTCDay()]];
  if (rule === undefined || rule === null) return false;
  if (typeof rule === 'boolean') return rule;
  if (typeof rule === 'object' && !Array.isArray(rule) && typeof rule.enabled === 'boolean') return rule.enabled;
  throw new BadRequestError(`Invalid working week for calendar ${calendar.id}`);
}

// Mirrors schedule precedence used by work-calendar: approved swap, factory
// rotation, then department/branch/company calendar. Calendar year is explicit.
export function resolvePayrollWorkingDates(employee: ScheduleEmployee, dates: Date[], data: ScheduleData): Set<string> {
  const result = new Set<string>();
  const employeeOverrides = new Map(data.overrides.filter(row => row.companyId === employee.companyId && row.employeeId === employee.id)
    .map(row => [payrollDateKey(row.date), row]));
  const calendars = new Map<number, ScheduleCalendar>();
  const calendarDays = new Map<string, Map<string, string>>();
  const configuredShift = employee.employeeCategory === 'FACTORY' && (employee.shiftFormulaId || employee.shiftStartDate);
  let shift: ScheduleShift | undefined;
  if (configuredShift) {
    shift = data.shifts.find(row => row.id === employee.shiftFormulaId && row.companyId === employee.companyId);
    if (!shift || !employee.shiftStartDate || !shift.days.length || shift.cycleLength !== shift.days.length
      || shift.days.some((day, index) => day.sequence !== index + 1)) {
      throw new BadRequestError(`Incomplete shift schedule for employee ${employee.id}`);
    }
  }
  for (const date of dates) {
    const key = payrollDateKey(date), override = employeeOverrides.get(key);
    let working: boolean;
    if (override) {
      const request = override.shiftSwapRequest, payload = override.overrideSchedule;
      if (override.source !== 'SHIFT_SWAP' || !request || request.companyId !== employee.companyId || request.status !== 'APPROVED'
        || request.deletedAt || payrollDateKey(request.shiftDate) !== key
        || ![request.requesterEmployeeId, request.targetEmployeeId].includes(employee.id)
        || !payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new BadRequestError(`Invalid approved shift override for employee ${employee.id} on ${key}`);
      }
      working = workingType(payload.dayType);
      if (typeof payload.isWorkingDay !== 'boolean' || payload.isWorkingDay !== working) throw new BadRequestError('Shift override working-day flag is inconsistent');
    } else if (shift && employee.shiftStartDate) {
      const elapsedDays = (date.getTime() - payrollDate(employee.shiftStartDate).getTime()) / DAY_MS;
      const index = ((elapsedDays % shift.days.length) + shift.days.length) % shift.days.length;
      working = workingType(shift.days[index].dayType);
    } else {
      const year = date.getUTCFullYear();
      let calendar = calendars.get(year);
      if (!calendar) {
        const candidates = data.calendars.filter(row => row.companyId === employee.companyId && row.year === year);
        const department = candidates.filter(row => row.departmentId && row.departmentId === employee.departmentId && (!row.branchId || row.branchId === employee.branchId));
        const branch = candidates.filter(row => !row.departmentId && row.branchId && row.branchId === employee.branchId);
        const company = candidates.filter(row => !row.departmentId && !row.branchId);
        const matches = department.length ? department : branch.length ? branch : company;
        if (matches.length !== 1) throw new BadRequestError(`Missing or ambiguous payroll calendar for employee ${employee.id} in ${year}`);
        calendar = matches[0]; calendars.set(year, calendar);
        calendarDays.set(calendar.id, new Map(calendar.days.map(day => [payrollDateKey(day.date), day.dayType])));
      }
      const explicitType = calendarDays.get(calendar.id)?.get(key);
      working = explicitType === undefined ? weekdayEnabled(calendar, date) : workingType(explicitType);
    }
    if (working) result.add(key);
  }
  return result;
}

export function countPayrollAttendance(workingDates: Set<string>, attendance: { date: Date; status: string }[], leaves: { startDate: Date; endDate: Date }[]) {
  const present = new Set(attendance.filter(row => row.status === 'PRESENT' || row.status === 'LATE').map(row => payrollDateKey(row.date)));
  const ranges = leaves.map(leave => ({ start: payrollDateKey(leave.startDate), end: payrollDateKey(leave.endDate) }));
  if (ranges.some(range => range.end < range.start)) throw new BadRequestError('Approved leave has an invalid date range');
  let presentDays = 0, leaveDays = 0;
  for (const date of workingDates) {
    // A date is counted once. Actual presence takes precedence over overlapping leave.
    if (present.has(date)) presentDays++;
    else if (ranges.some(range => date >= range.start && date <= range.end)) leaveDays++;
  }
  return { workDays: workingDates.size, present: presentDays, leave: leaveDays, absent: workingDates.size - presentDays - leaveDays };
}
