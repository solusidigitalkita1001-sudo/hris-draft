import { randomUUID } from 'node:crypto';
import { Prisma, PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { PayrollService } from './payroll.service';
import { PayrollFormulaService } from './payroll-formula.service';
import { payrollRepository } from './payroll.repository';
import { ewaRepository } from '@/modules/ewa/ewa.repository';
import { eventBus } from '@/shared/events/EventBus';
const databaseUrl = process.env.PAYROLL_CALCULATION_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('atomic payroll calculation (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [];
  const service = new PayrollService();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing payroll test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Payroll calculation tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.payrollFormulaCalculation.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaAudit.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaVersion.deleteMany({ where: { companyId } });
      await mockDatabase.payrollLoanDeductionSnapshot.deleteMany({ where: { companyId } });
      await mockDatabase.earnedWageAccess.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.loanInstallment.deleteMany({ where: { loan: { companyId } } });
      await mockDatabase.loan.deleteMany({ where: { companyId } });
      await mockDatabase.loanType.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.workCalendar.deleteMany({ where: { companyId } });
      await mockDatabase.companySetting.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });
  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(), maker = randomUUID(); companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Atomic payroll tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    await mockDatabase.companySetting.createMany({ data: [
      { companyId, key: 'late_deduction_enabled', value: 'false' },
      { companyId, key: 'absence_deduction_daily_basic_percent', value: '0' },
    ] });
    const calendar = await mockDatabase.workCalendar.create({ data: { companyId, year: 2026, name: 'Synthetic calendar', createdBy: maker, workDays: {},
      days: { create: [{ date: new Date('2026-10-01'), dayType: 'WD' }, { date: new Date('2026-10-02'), dayType: 'WD' }] } } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Salary', type: 'ALLOWANCE', amount: '1000', isTaxable: true } });
    const period = await createPeriod(companyId, '2026-10-01');
    return { companyId, maker, calendar, component, period };
  }
  async function createPeriod(companyId: string, start: string) {
    return mockDatabase.payrollPeriod.create({ data: { companyId, code: randomUUID(), name: 'Synthetic period', startDate: new Date(start),
      endDate: new Date(start.slice(0, 8) + '28'), payDate: new Date(start.slice(0, 8) + '28'), attendanceReviewedAt: new Date() } });
  }
  async function employee(f: Awaited<ReturnType<typeof fixture>>, amount = '1000.00', effective = '2026-09-01') {
    const person = await mockDatabase.employee.create({ data: { companyId: f.companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee' } });
    const salary = await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: person.id, baseSalary: amount, effectiveDate: new Date(effective),
      components: { create: { salaryComponentId: f.component.id, amount } } } });
    return { person, salary };
  }
  async function ewa(f: Awaited<ReturnType<typeof fixture>>, employeeId: string, amountPaidOut: string | null = '10.10') {
    return mockDatabase.earnedWageAccess.create({ data: { companyId: f.companyId, employeeId, requestCode: randomUUID(), periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-12-31'),
      earnedGrossReference: '1000', earnedGrossAtRequest: '1000', maxAllowedAtRequest: '500', amountRequested: '20.20', amountPaidOut, status: 'PAID' } });
  }
  async function loan(f: Awaited<ReturnType<typeof fixture>>, employeeId: string) {
    const loanType = await mockDatabase.loanType.create({ data: { companyId: f.companyId, name: 'Synthetic loan', maxAmount: 100 } });
    const row = await mockDatabase.loan.create({ data: { companyId: f.companyId, employeeId, loanTypeId: loanType.id, amount: '30.30', remainingBalance: '30.30', installmentAmount: '30.30', totalInstallments: 1, status: 'ACTIVE', reason: 'Synthetic test' } });
    return mockDatabase.loanInstallment.create({ data: { loanId: row.id, amount: '30.30', dueDate: new Date('2026-10-01') } });
  }
  const run = (f: Awaited<ReturnType<typeof fixture>>, periodId = f.period.id) => service.createPayrollRun({ companyId: f.companyId, periodId, name: 'Synthetic payroll' }, f.maker);
  async function expectNoPayroll(f: Awaited<ReturnType<typeof fixture>>) {
    for (const count of [await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payslip.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payrollFormulaCalculation.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payrollLoanDeductionSnapshot.count({ where: { companyId: f.companyId } })]) expect(count).toBe(0);
    expect(await mockDatabase.salaryComponent.count({ where: { companyId: f.companyId } })).toBe(1);
    expect(eventBus.publish).not.toHaveBeenCalled();
  }
  it('rolls back earlier slips, formula/loan snapshots and generated components when a later employee formula fails; retry succeeds', async () => {
    const f = await fixture(), first = await employee(f), second = await employee(f, '100.00', '2026-08-01');
    await loan(f, first.person.id); const advance = await ewa(f, first.person.id);
    const formulas = new PayrollFormulaService(mockDatabase), context = { companyId: f.companyId, actorId: f.maker };
    const formula = await formulas.createDraft(context, f.component.id, { expression: 'BASE_SALARY / (BASE_SALARY - 100) * 1000', effectiveFrom: '2026-10-01' });
    await formulas.preview(context, f.component.id, formula.id, { inputs: { BASE_SALARY: '1000', WORK_DAYS: '2', PRESENT_DAYS: '0', LEAVE_DAYS: '0', ABSENT_DAYS: '2', OVERTIME_HOURS: '0' }, componentAmounts: {} });
    await formulas.publish({ companyId: f.companyId, actorId: randomUUID() }, f.component.id, formula.id);
    const writes = jest.spyOn(payrollRepository, 'createPayslip');
    await expect(run(f)).rejects.toThrow('division by zero'); expect(writes).toHaveBeenCalledTimes(1);
    await expectNoPayroll(f);
    expect((await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: advance.id } })).status).toBe('PAID');
    await mockDatabase.employeeSalary.update({ where: { id: second.salary.id }, data: { baseSalary: '200' } });
    const completed = await run(f);
    expect(completed.status).toBe('COMPLETED'); expect(completed.runNumber).toBe(1); expect(completed.payslips).toHaveLength(2);
    expect(await mockDatabase.payrollFormulaCalculation.count({ where: { runId: completed.id } })).toBe(2);
    expect(completed.payslips.every(slip => slip.workDays === 2)).toBe(true);
  });
  it('rolls back EWA claims too when persistence fails after deductions have been marked', async () => {
    const f = await fixture(), person = await employee(f), advance = await ewa(f, person.person.id); await loan(f, person.person.id);
    const original = payrollRepository.updatePayrollRunTotals.bind(payrollRepository);
    jest.spyOn(payrollRepository, 'updatePayrollRunTotals').mockImplementationOnce(async (...args) => {
      const database = args[2]; if (!database) throw new Error('Missing transaction client');
      expect((await database.earnedWageAccess.findUniqueOrThrow({ where: { id: advance.id } })).status).toBe('DEDUCTED');
      await original(...args); throw new Error('Injected failure after totals write');
    });
    await expect(run(f)).rejects.toThrow('Injected failure'); await expectNoPayroll(f);
    expect(await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: advance.id } })).toMatchObject({ status: 'PAID', payrollRunId: null, amountDeductedPayroll: null });
    const completed = await run(f); expect(completed.totalNetPay.toFixed(2)).toBe('959.60');
  });
  it('serializes repeated requests for one period and publishes an event only for the committed run', async () => {
    const f = await fixture(); await employee(f);
    jest.mocked(eventBus.publish).mockImplementationOnce(async event => {
      expect((await mockDatabase.payrollRun.findUniqueOrThrow({ where: { id: event.aggregateId } })).status).toBe('COMPLETED');
    });
    const results = await Promise.allSettled([run(f), run(f)]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejection = results.find(result => result.status === 'rejected');
    expect(rejection?.status === 'rejected' && rejection.reason.message).toContain('already exists');
    expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(1); expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });
  it('assigns unique run numbers across concurrent periods and deducts each EWA and loan installment only once', async () => {
    const f = await fixture(), person = await employee(f), advance = await ewa(f, person.person.id); const installment = await loan(f, person.person.id);
    const next = await createPeriod(f.companyId, '2026-11-01');
    const runs = await Promise.all([run(f), run(f, next.id)]);
    expect(runs.map(row => row.runNumber).sort()).toEqual([1, 2]);
    expect(runs.map(row => row.totalDeductions.toFixed(2)).sort()).toEqual(['0.00', '40.40']);
    const stored = await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: advance.id } });
    expect(stored.status).toBe('DEDUCTED'); expect(stored.amountDeductedPayroll?.toFixed(2)).toBe('10.10');
    expect(await mockDatabase.payrollLoanDeductionSnapshot.count({ where: { installmentId: installment.id } })).toBe(1);
    expect((await mockDatabase.loanInstallment.findUniqueOrThrow({ where: { id: installment.id } })).status).toBe('PENDING');
  });
  it('preserves EWA without an active salary and handles null legacy payout using the requested amount', async () => {
    const f = await fixture(), paid = await employee(f), skipped = await employee(f); await mockDatabase.employeeSalary.update({ where: { id: skipped.salary.id }, data: { isActive: false } });
    const deducted = await ewa(f, paid.person.id, null), untouched = await ewa(f, skipped.person.id);
    const completed = await run(f); expect(completed.totalDeductions.toFixed(2)).toBe('20.20');
    expect(await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: untouched.id } })).toMatchObject({ status: 'PAID', payrollRunId: null });
    expect((await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: deducted.id } })).amountDeductedPayroll?.toFixed(2)).toBe('20.20');
  });
  it('rejects a stale EWA amount without marking it deducted', async () => {
    const f = await fixture(), person = await employee(f), advance = await ewa(f, person.person.id);
    await mockDatabase.earnedWageAccess.update({ where: { id: advance.id }, data: { amountPaidOut: '11.11' } });
    await expect(mockDatabase.$transaction(tx => ewaRepository.markPayrollDeductions(f.companyId, randomUUID(), [{ ...advance, amount: new Prisma.Decimal('10.10') }], tx))).rejects.toThrow('EWA changed');
    expect((await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: advance.id } })).status).toBe('PAID');
  });
  it('sums large and fractional payroll values with Decimal and rolls back total overflow', async () => {
    const f = await fixture(); await employee(f, '9999999999998.00'); await employee(f, '0.10'); await employee(f, '0.20');
    expect((await run(f)).totalNetPay.toFixed(2)).toBe('9999999999998.30');
    jest.clearAllMocks(); const overflow = await fixture(); await employee(overflow, '9999999999999.99'); await employee(overflow, '0.01');
    await expect(run(overflow)).rejects.toThrow('monetary range'); await expectNoPayroll(overflow);
  });
  it('rejects foreign periods and salary references without leaving a run', async () => {
    const f = await fixture(), foreign = await fixture(); const person = await employee(f);
    await expect(run(f, foreign.period.id)).rejects.toThrow('not found in this company');
    await mockDatabase.employeeSalaryComponent.updateMany({ where: { employeeSalaryId: person.salary.id }, data: { salaryComponentId: foreign.component.id } });
    await expect(run(f)).rejects.toThrow('outside the payroll company'); await expectNoPayroll(f);
  });
  it('rejects ambiguous active salaries and unsupported currency before committing', async () => {
    const f = await fixture(), person = await employee(f);
    await mockDatabase.employeeSalary.update({ where: { id: person.salary.id }, data: { currency: 'USD' } });
    await expect(run(f)).rejects.toThrow('IDR'); await expectNoPayroll(f);
    await mockDatabase.employeeSalary.update({ where: { id: person.salary.id }, data: { currency: 'IDR' } });
    await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: person.person.id, baseSalary: '1000', effectiveDate: new Date('2026-09-02') } });
    await expect(run(f)).rejects.toThrow('Multiple active salaries'); await expectNoPayroll(f);
  });
  it('returns the committed payroll if event publication subsequently fails', async () => {
    const f = await fixture(); await employee(f); jest.mocked(eventBus.publish).mockRejectedValueOnce(new Error('Broker unavailable'));
    expect((await run(f)).status).toBe('COMPLETED');
    expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(1);
  });
  it('rejects empty payroll, closed periods and periods without attendance review', async () => {
    const f = await fixture();
    await expect(run(f)).rejects.toThrow('No active employee salaries'); await expectNoPayroll(f);
    await employee(f);
    await mockDatabase.payrollPeriod.update({ where: { id: f.period.id }, data: { status: 'CLOSED' } });
    await expect(run(f)).rejects.toThrow('closed period');
    await mockDatabase.payrollPeriod.update({ where: { id: f.period.id }, data: { status: 'DRAFT', attendanceReviewedAt: null } });
    await expect(run(f)).rejects.toThrow('Attendance'); await expectNoPayroll(f);
  });
});
