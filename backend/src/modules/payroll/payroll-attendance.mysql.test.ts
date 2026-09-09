import { randomUUID } from 'node:crypto';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { Prisma, PrismaClient } from '@prisma/client';

let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { PayrollService } from './payroll.service';
import { PayrollFormulaService } from './payroll-formula.service';
import { eventBus } from '@/shared/events/EventBus';

const databaseUrl = process.env.PAYROLL_ATTENDANCE_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('payroll attendance inputs (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [];
  const service = new PayrollService();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing payroll test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Payroll attendance tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.payrollFormulaCalculation.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaAudit.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaVersion.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeShiftOverride.deleteMany({ where: { companyId } });
      await mockDatabase.shiftSwapRequest.deleteMany({ where: { companyId } });
      await mockDatabase.attendance.deleteMany({ where: { companyId } });
      await mockDatabase.overtimeRequest.deleteMany({ where: { companyId } });
      await mockDatabase.leaveRequest.deleteMany({ where: { companyId } });
      await mockDatabase.leaveType.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.workCalendar.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.shiftFormula.deleteMany({ where: { companyId } });
      await mockDatabase.department.deleteMany({ where: { companyId } });
      await mockDatabase.branch.deleteMany({ where: { companyId } });
      await mockDatabase.companySetting.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });

  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(), maker = randomUUID();
    companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Calendar payroll tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    await mockDatabase.companySetting.createMany({ data: [
      { companyId, key: 'late_deduction_enabled', value: 'false' },
      { companyId, key: 'absence_deduction_daily_basic_percent', value: '0' },
    ] });
    const calendar = await mockDatabase.workCalendar.create({ data: { companyId, year: 2026, name: 'Weekly defaults', createdBy: maker,
      workDays: { mon: true, tue: true, wed: true, thu: true, fri: true } } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Salary', type: 'ALLOWANCE', amount: '1000', isTaxable: true } });
    // Same time component as Jakarta's date picker: noon local becomes 05:00Z.
    const period = await mockDatabase.payrollPeriod.create({ data: { companyId, code: randomUUID(), name: 'Synthetic period',
      startDate: new Date('2026-10-01T05:00:00Z'), endDate: new Date('2026-10-07T05:00:00Z'), payDate: new Date('2026-10-08'), attendanceReviewedAt: new Date() } });
    return { companyId, maker, calendar, component, period };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  async function employee(f: Fixture, data: Partial<Prisma.EmployeeUncheckedCreateInput> = {}, withSalary = true) {
    const person = await mockDatabase.employee.create({ data: { companyId: f.companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee', ...data } });
    if (withSalary) await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: person.id, baseSalary: '1000', effectiveDate: new Date('2026-09-01'),
      components: { create: { salaryComponentId: f.component.id, amount: '1000' } } } });
    return person;
  }
  async function formula(f: Fixture, expression: string) {
    const formulas = new PayrollFormulaService(mockDatabase), context = { companyId: f.companyId, actorId: f.maker };
    const version = await formulas.createDraft(context, f.component.id, { expression, effectiveFrom: '2026-10-01' });
    await formulas.preview(context, f.component.id, version.id, { inputs: {
      BASE_SALARY: '1000', WORK_DAYS: '4', PRESENT_DAYS: '1', LEAVE_DAYS: '2', ABSENT_DAYS: '1', OVERTIME_HOURS: '0.3',
    }, componentAmounts: {} });
    await formulas.publish({ companyId: f.companyId, actorId: randomUUID() }, f.component.id, version.id);
  }
  const asActor = <T>(f: Fixture, operation: () => T) => runInRequestContext({ user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } }, operation);
  const run = (f: Fixture) => asActor(f, () => service.createPayrollRun({ companyId: f.companyId, periodId: f.period.id, name: 'Synthetic payroll' }, f.maker));
  const review = (f: Fixture) => asActor(f, () => service.getAttendanceSummaryForPeriod(f.period.id));
  async function expectNoPayroll(f: Fixture) {
    expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(0);
    expect(await mockDatabase.payslip.count({ where: { companyId: f.companyId } })).toBe(0);
    expect(await mockDatabase.salaryComponent.count({ where: { companyId: f.companyId } })).toBe(1);
    expect(eventBus.publish).not.toHaveBeenCalled();
  }

  it('uses the same scheduled dates in review, slip and formula; clips overlapping leave and counts presence only once', async () => {
    const f = await fixture(), person = await employee(f);
    await formula(f, 'BASE_SALARY * (PRESENT_DAYS + LEAVE_DAYS) / WORK_DAYS');
    await mockDatabase.workCalendarDay.create({ data: { calendarId: f.calendar.id, date: new Date('2026-10-02'), dayType: 'NH' } });
    await mockDatabase.attendance.createMany({ data: [
      { companyId: f.companyId, employeeId: person.id, date: new Date('2026-10-01'), status: 'PRESENT' },
      { companyId: f.companyId, employeeId: person.id, date: new Date('2026-10-04'), status: 'PRESENT' },
      { companyId: f.companyId, employeeId: person.id, date: new Date('2026-10-07'), status: 'PRESENT', deletedAt: new Date() },
    ] });
    const leaveType = await mockDatabase.leaveType.create({ data: { companyId: f.companyId, name: 'Synthetic leave', code: randomUUID() } });
    const unpaidType = await mockDatabase.leaveType.create({ data: { companyId: f.companyId, name: 'Synthetic unpaid leave', code: randomUUID(), isPaid: false } });
    const leaveBase = { companyId: f.companyId, employeeId: person.id, leaveTypeId: leaveType.id, totalDays: 99, reason: 'Synthetic only' };
    await mockDatabase.leaveRequest.createMany({ data: [
      { ...leaveBase, startDate: new Date('2026-09-29'), endDate: new Date('2026-10-05'), status: 'APPROVED' },
      // Preserve the existing policy: all approved leave is excused, regardless of isPaid.
      { ...leaveBase, leaveTypeId: unpaidType.id, startDate: new Date('2026-10-05'), endDate: new Date('2026-10-06'), status: 'APPROVED' },
      { ...leaveBase, startDate: new Date('2026-10-07'), endDate: new Date('2026-10-07'), status: 'PENDING' },
      { ...leaveBase, startDate: new Date('2026-10-07'), endDate: new Date('2026-10-07'), status: 'APPROVED', deletedAt: new Date() },
    ] });
    expect((await review(f)).summary[person.id]).toEqual({ workDays: 4, present: 1, leave: 2, absent: 1, overtime: 0 });
    const completed = await run(f);
    expect(completed.payslips[0]).toMatchObject({ workDays: 4, presentDays: 1, leaveDays: 2, absentDays: 1 });
    expect(completed.totalNetPay.toFixed(2)).toBe('750.00');
    const evidence = await mockDatabase.payrollFormulaCalculation.findFirstOrThrow({ where: { runId: completed.id } });
    expect(evidence.inputs).toMatchObject({ WORK_DAYS: '4', PRESENT_DAYS: '1', LEAVE_DAYS: '2', ABSENT_DAYS: '1' });
    expect(evidence.amount.toFixed(2)).toBe('750.00');
  });

  it('selects company, branch and department calendars per employee and ignores foreign-company rows', async () => {
    const f = await fixture(), foreign = await fixture();
    const branch = await mockDatabase.branch.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Synthetic branch' } });
    const department = await mockDatabase.department.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Synthetic department' } });
    const office = await employee(f), branchWorker = await employee(f, { branchId: branch.id }), departmentWorker = await employee(f, { branchId: branch.id, departmentId: department.id });
    const notInPayroll = await employee(f, {}, false);
    const calendarBase = { companyId: f.companyId, createdBy: f.maker, year: 2026, name: 'Scoped schedule', branchId: branch.id };
    await mockDatabase.workCalendar.createMany({ data: [
      { ...calendarBase, workDays: { tue: true, wed: true } },
      { ...calendarBase, departmentId: department.id, workDays: { mon: { enabled: true } } },
      { ...calendarBase, companyId: foreign.companyId, departmentId: department.id, workDays: {} },
    ] });
    // Company and employee are separately keyed in legacy data; both predicates must apply.
    await mockDatabase.attendance.create({ data: { companyId: foreign.companyId, employeeId: office.id, date: new Date('2026-10-01'), status: 'PRESENT' } });
    const summary = (await review(f)).summary;
    expect(summary[office.id]).toMatchObject({ workDays: 5, present: 0, absent: 5 });
    expect(summary[branchWorker.id]).toMatchObject({ workDays: 2, absent: 2 });
    expect(summary[departmentWorker.id]).toMatchObject({ workDays: 1, absent: 1 });
    expect(summary[notInPayroll.id]).toBeUndefined();
    const completed = await run(f);
    expect(completed.payslips.map(slip => slip.workDays).sort()).toEqual([1, 2, 5]);
  });

  it('requires a calendar for each period year and rolls back until missing data is repaired', async () => {
    const f = await fixture(), person = await employee(f);
    await mockDatabase.payrollPeriod.update({ where: { id: f.period.id }, data: { startDate: new Date('2026-12-31T05:00:00Z'), endDate: new Date('2027-01-02T05:00:00Z') } });
    await mockDatabase.workCalendar.create({ data: { companyId: f.companyId, createdBy: f.maker, year: 2028, name: 'Future year', workDays: {} } });
    const missingYear = await mockDatabase.workCalendar.create({ data: { companyId: f.companyId, createdBy: f.maker, year: 2027, name: 'Next year', workDays: { sat: true }, isActive: false } });
    await expect(review(f)).rejects.toThrow('2027');
    await expect(run(f)).rejects.toThrow('2027'); await expectNoPayroll(f);
    await mockDatabase.workCalendar.update({ where: { id: missingYear.id }, data: { isActive: true } });
    expect((await review(f)).summary[person.id]).toMatchObject({ workDays: 2, absent: 2 });
    expect((await run(f)).payslips[0]).toMatchObject({ workDays: 2, absentDays: 2 });
  });

  it('applies factory rotation and approved swaps, rejecting a stale approval before writing any payroll', async () => {
    const f = await fixture();
    const shift = await mockDatabase.shiftFormula.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Alternating shift', cycleLength: 2,
      days: { create: [{ sequence: 1, dayType: 'WS' }, { sequence: 2, dayType: 'WE' }] } } });
    const person = await employee(f, { employeeCategory: 'FACTORY', shiftFormulaId: shift.id, shiftStartDate: new Date('2026-10-01') });
    const target = await employee(f, {}, false), approver = await employee(f, {}, false);
    const request = await mockDatabase.shiftSwapRequest.create({ data: { companyId: f.companyId, requesterEmployeeId: person.id, targetEmployeeId: target.id,
      approverEmployeeId: approver.id, shiftDate: new Date('2026-10-03'), reason: 'Synthetic swap', status: 'APPROVED' } });
    await mockDatabase.employeeShiftOverride.create({ data: { companyId: f.companyId, employeeId: person.id, shiftSwapRequestId: request.id, date: request.shiftDate,
      originalSchedule: { dayType: 'WS', isWorkingDay: true }, overrideSchedule: { dayType: 'WE', isWorkingDay: false } } });
    expect((await review(f)).summary[person.id]).toMatchObject({ workDays: 3, absent: 3 });
    await mockDatabase.shiftSwapRequest.update({ where: { id: request.id }, data: { status: 'PENDING' } });
    await expect(run(f)).rejects.toThrow('Invalid approved shift override'); await expectNoPayroll(f);
    await mockDatabase.shiftSwapRequest.update({ where: { id: request.id }, data: { status: 'APPROVED' } });
    expect((await run(f)).payslips[0]).toMatchObject({ workDays: 3, absentDays: 3 });
  });

  it('deducts lateness on the first working date but excludes lateness recorded on a rest day', async () => {
    const f = await fixture(), person = await employee(f);
    await mockDatabase.companySetting.updateMany({ where: { companyId: f.companyId, key: 'late_deduction_enabled' }, data: { value: 'true' } });
    await mockDatabase.companySetting.create({ data: { companyId: f.companyId, key: 'late_deduction_default_rate_per_minute', value: '1' } });
    await mockDatabase.attendance.createMany({ data: [
      { companyId: f.companyId, employeeId: person.id, date: new Date('2026-10-01'), status: 'LATE', lateMinutes: 10 },
      { companyId: f.companyId, employeeId: person.id, date: new Date('2026-10-04'), status: 'LATE', lateMinutes: 100 },
    ] });
    expect((await review(f)).summary[person.id]).toMatchObject({ workDays: 5, present: 1, absent: 4 });
    const completed = await run(f);
    expect(completed.totalDeductions.toFixed(2)).toBe('10.00');
    expect(completed.totalNetPay.toFixed(2)).toBe('990.00');
  });

  it('sums fractional approved overtime exactly and includes both date-only boundaries', async () => {
    const f = await fixture(), person = await employee(f);
    await formula(f, 'BASE_SALARY + OVERTIME_HOURS');
    const overtime = { companyId: f.companyId, employeeId: person.id, startTime: new Date('2026-10-01T10:00:00Z'), endTime: new Date('2026-10-01T11:00:00Z'), reason: 'Synthetic overtime' };
    await mockDatabase.overtimeRequest.createMany({ data: [
      { ...overtime, date: new Date('2026-10-01'), durationHours: '0.1', status: 'APPROVED' },
      { ...overtime, date: new Date('2026-10-07'), durationHours: '0.2', status: 'APPROVED' },
      { ...overtime, date: new Date('2026-10-02'), durationHours: '5', status: 'PENDING' },
      { ...overtime, date: new Date('2026-10-02'), durationHours: '5', status: 'APPROVED', deletedAt: new Date() },
      { ...overtime, date: new Date('2026-09-30'), durationHours: '5', status: 'APPROVED' },
    ] });
    expect((await review(f)).summary[person.id].overtime).toBe(0.3);
    const completed = await run(f);
    expect(completed.payslips[0].overtimeHours.toString()).toBe('0.3');
    const evidence = await mockDatabase.payrollFormulaCalculation.findFirstOrThrow({ where: { runId: completed.id } });
    expect(evidence.inputs).toMatchObject({ OVERTIME_HOURS: '0.3' });
    expect(evidence.amount.toFixed(2)).toBe('1000.30');
  });

  it('rejects ambiguous active calendars and accepts an explicit all-off calendar after correction', async () => {
    const f = await fixture(), person = await employee(f);
    await mockDatabase.workCalendar.update({ where: { id: f.calendar.id }, data: { workDays: {} } });
    const duplicate = await mockDatabase.workCalendar.create({ data: { companyId: f.companyId, createdBy: f.maker, year: 2026, name: 'Ambiguous calendar', workDays: { mon: true } } });
    await expect(run(f)).rejects.toThrow('Missing or ambiguous'); await expectNoPayroll(f);
    await mockDatabase.workCalendar.update({ where: { id: duplicate.id }, data: { deletedAt: new Date() } });
    expect((await review(f)).summary[person.id]).toEqual({ workDays: 0, present: 0, leave: 0, absent: 0, overtime: 0 });
    expect((await run(f)).payslips[0]).toMatchObject({ workDays: 0, absentDays: 0 });
  });
});
