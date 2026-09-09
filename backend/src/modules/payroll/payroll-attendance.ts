import { Prisma } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { countPayrollAttendance, payrollPeriodDates, resolvePayrollWorkingDates } from '@/shared/payroll/attendance-calendar';

export interface PayrollAttendanceSummary { workDays: number; present: number; absent: number; leave: number; overtime: number }
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
  const [employees, calendars, shifts, overrides, attendance, leaves, overtimes] = await Promise.all([
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
      startDate: { lte: range.lte }, endDate: { gte: range.gte } }, select: { employeeId: true, startDate: true, endDate: true } }),
    database.overtimeRequest.findMany({ where: { companyId, employeeId, status: 'APPROVED', date: range, deletedAt: null }, select: { employeeId: true, durationHours: true } }),
  ]);
  if (employees.length !== employeeId.in.length) throw new BadRequestError('Payroll salary references an unavailable employee in this company');
  function group<T extends { employeeId: string }>(rows: T[]) {
    const grouped = new Map<string, T[]>();
    for (const row of rows) { const items = grouped.get(row.employeeId) ?? []; items.push(row); grouped.set(row.employeeId, items); }
    return grouped;
  }
  const attendanceByEmployee = group(attendance), leavesByEmployee = group(leaves), overtimeByEmployee = group(overtimes), overridesByEmployee = group(overrides);
  for (const employee of employees) {
    const workingDates = resolvePayrollWorkingDates(employee, dates, { calendars, shifts, overrides: overridesByEmployee.get(employee.id) ?? [] });
    const counts = countPayrollAttendance(workingDates, attendanceByEmployee.get(employee.id) ?? [], leavesByEmployee.get(employee.id) ?? []);
    const overtime = (overtimeByEmployee.get(employee.id) ?? []).reduce((sum, row) => {
      if (!row.durationHours.isFinite() || row.durationHours.isNegative()) throw new BadRequestError('Approved overtime has invalid hours');
      return sum.plus(row.durationHours);
    }, new Prisma.Decimal(0));
    if (overtime.greaterThan(10000)) throw new BadRequestError('Payroll overtime exceeds supported hours');
    results.set(employee.id, { ...counts, workingDates, overtime: overtime.toNumber() });
  }
  return results;
}
