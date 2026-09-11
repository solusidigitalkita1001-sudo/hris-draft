import { Prisma } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { countPayrollAttendance, payrollDateKey, payrollPeriodDates, resolvePayrollWorkingDates } from '@/shared/payroll/attendance-calendar';

export interface PayrollAttendanceSummary {
  workDays: number; present: number; absent: number; leave: number;
  /** Approved leave days whose LeaveType.isPaid = false (deduction is company-config-gated). */
  unpaidLeave: number;
  /** Total approved overtime hours (workday + holiday). */
  overtime: number;
  /** Hours on the employee's working dates — paid at workday bands. */
  overtimeWorkday: number;
  /** Hours on non-working dates (weekend/holiday per resolved calendar) — paid at holiday bands. */
  overtimeHoliday: number;
}
export interface PayrollAttendanceInput extends PayrollAttendanceSummary { workingDates: Set<string> }

// Bounded batch reads, shared by review and actual payroll; no query per employee/day.
export async function loadPayrollAttendance(
  database: Prisma.TransactionClient,
  companyId: string,
  employeeIds: string[],
  periodStart: Date,
  periodEnd: Date,
): Promise<Map<string, PayrollAttendanceInput>> {
  const dates = payrollPeriodDates(periodStart, periodEnd), results = new Map<string, PayrollAttendanceInput>();
  if (!employeeIds.length) return results;
  const employeeId = { in: [...new Set(employeeIds)] }, range = { gte: dates[0], lte: dates[dates.length - 1] };
  const [employees, calendars, shifts, overrides, attendance, leaves, overtimes, trips, permissions] = await Promise.all([
    database.employee.findMany({ where: { id: employeeId, companyId, deletedAt: null }, select: {
      id: true, companyId: true, branchId: true, departmentId: true, employeeCategory: true, shiftFormulaId: true, shiftStartDate: true,
    } }),
    database.workCalendar.findMany({ where: { companyId, isActive: true, deletedAt: null, year: { in: [...new Set(dates.map(date => date.getUTCFullYear()))] } },
      include: { days: { where: { date: range }, select: { date: true, dayType: true } } } }),
    database.shiftFormula.findMany({ where: { companyId, isActive: true, deletedAt: null, employees: { some: { id: employeeId, companyId, deletedAt: null } } },
      include: { days: { orderBy: { sequence: 'asc' }, select: { sequence: true, dayType: true } } } }),
    database.employeeShiftOverride.findMany({ where: { companyId, employeeId, date: range, deletedAt: null },
      include: { shiftSwapRequest: { select: { companyId: true, status: true, deletedAt: true, shiftDate: true, requesterEmployeeId: true, targetEmployeeId: true } } } }),
    database.attendance.findMany({ where: { companyId, employeeId, date: range, deletedAt: null }, select: { employeeId: true, date: true, status: true } }),
    database.leaveRequest.findMany({ where: { companyId, employeeId, status: 'APPROVED', deletedAt: null,
      startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { employeeId: true, startDate: true, endDate: true, leaveType: { select: { isPaid: true } } } }),
    database.overtimeRequest.findMany({ where: { companyId, employeeId, status: 'APPROVED', date: range, deletedAt: null }, select: { employeeId: true, durationHours: true, date: true } }),
    // Approved business trips and WFH count as PRESENT (policy decision):
    // an employee on assignment is working, not absent.
    database.businessTrip.findMany({ where: { companyId, employeeId, status: { in: ['APPROVED', 'COMPLETED'] },
      startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { employeeId: true, startDate: true, endDate: true } }),
    database.permissionRequest.findMany({ where: { companyId, employeeId, status: 'APPROVED', type: { in: ['BUSINESS_TRIP', 'WORK_FROM_HOME'] },
      startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { employeeId: true, startDate: true, endDate: true } }),
  ]);
  if (employees.length !== employeeId.in.length) throw new BadRequestError('Payroll salary references an unavailable employee in this company');
  function group<T extends { employeeId: string }>(rows: T[]) {
    const grouped = new Map<string, T[]>();
    for (const row of rows) { const items = grouped.get(row.employeeId) ?? []; items.push(row); grouped.set(row.employeeId, items); }
    return grouped;
  }
  const attendanceByEmployee = group(attendance), leavesByEmployee = group(leaves), overtimeByEmployee = group(overtimes), overridesByEmployee = group(overrides);
  const presenceByEmployee = group([...trips, ...permissions]);
  for (const employee of employees) {
    const workingDates = resolvePayrollWorkingDates(employee, dates, { calendars, shifts, overrides: overridesByEmployee.get(employee.id) ?? [] });
    const counts = countPayrollAttendance(
      workingDates,
      attendanceByEmployee.get(employee.id) ?? [],
      (leavesByEmployee.get(employee.id) ?? []).map((leave) => ({ ...leave, isPaid: leave.leaveType?.isPaid !== false })),
      presenceByEmployee.get(employee.id) ?? [],
    );
    let overtimeWorkday = new Prisma.Decimal(0);
    let overtimeHoliday = new Prisma.Decimal(0);
    for (const row of overtimeByEmployee.get(employee.id) ?? []) {
      if (!row.durationHours.isFinite() || row.durationHours.isNegative()) throw new BadRequestError('Approved overtime has invalid hours');
      // A date outside the employee's resolved working dates is a weekend or
      // holiday for THAT employee's calendar/shift → statutory holiday bands.
      if (workingDates.has(payrollDateKey(row.date))) {
        overtimeWorkday = overtimeWorkday.plus(row.durationHours);
      } else {
        overtimeHoliday = overtimeHoliday.plus(row.durationHours);
      }
    }
    const overtime = overtimeWorkday.plus(overtimeHoliday);
    if (overtime.greaterThan(10000)) throw new BadRequestError('Payroll overtime exceeds supported hours');
    results.set(employee.id, {
      ...counts, workingDates,
      overtime: overtime.toNumber(),
      overtimeWorkday: overtimeWorkday.toNumber(),
      overtimeHoliday: overtimeHoliday.toNumber(),
    });
  }
  return results;
}
