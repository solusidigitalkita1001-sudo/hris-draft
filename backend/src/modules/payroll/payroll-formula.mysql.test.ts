import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ get prisma() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn() } }));
jest.mock('@/modules/company-settings/company-settings.service', () => ({ companySettingsService: {
  getLateDeductionConfig: jest.fn(async () => ({ enabled: false, absenceDailyPercentOfBasic: 0 })),
} }));
jest.mock('@/modules/work-calendar/work-calendar.repository', () => ({ workCalendarRepository: {
  findCalendarByContext: jest.fn(async () => ({ id: 'synthetic-calendar' })), countWorkingDays: jest.fn(async () => 20),
} }));
jest.mock('@/modules/ewa/ewa.repository', () => ({ ewaRepository: { findPAIDByEmployeeAndPeriod: jest.fn(async () => []), markPayrollDeductions: jest.fn() } }));
import { PayrollFormulaService } from './payroll-formula.service';
import { PayrollService } from './payroll.service';
import { payrollRepository } from './payroll.repository';
const databaseUrl = process.env.PAYROLL_FORMULA_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
const inputs = { BASE_SALARY: '10000000', WORK_DAYS: '20', PRESENT_DAYS: '17', LEAVE_DAYS: '0.5', ABSENT_DAYS: '2.5', OVERTIME_HOURS: '0' };
withDatabase('payroll formula revisions (isolated real MySQL)', () => {
  let service: PayrollFormulaService;
  const companies: string[] = [], groups: string[] = [];
  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Formula tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect(); service = new PayrollFormulaService(mockDatabase);
  });
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.payrollFormulaCalculation.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaAudit.deleteMany({ where: { companyId } });
      await mockDatabase.payrollFormulaVersion.deleteMany({ where: { companyId } });
      await mockDatabase.payrollLoanDeductionSnapshot.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });
  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(); companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Formula tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BONUS', name: 'Bonus', type: 'ALLOWANCE', calculationMethod: 'FIXED', amount: '100', isTaxable: true } });
    return { context: { companyId, actorId: randomUUID(), requestId: 'synthetic-request' }, checker: { companyId, actorId: randomUUID() }, component };
  }
  async function draft(f: Awaited<ReturnType<typeof fixture>>, expression = 'BASE_SALARY / 10', effectiveFrom = '2026-10-01', componentId = f.component.id) {
    return service.createDraft(f.context, componentId, { expression, effectiveFrom });
  }
  async function preview(f: Awaited<ReturnType<typeof fixture>>, version: { id: string; componentId: string }) {
    return service.preview(f.checker, version.componentId, version.id, { inputs, componentAmounts: {} });
  }
  async function period(f: Awaited<ReturnType<typeof fixture>>, start = '2026-10-01') {
    return mockDatabase.payrollPeriod.create({ data: { companyId: f.context.companyId, code: randomUUID(), name: 'Synthetic period',
      startDate: new Date(start), endDate: new Date(start.slice(0, 8) + '28'), payDate: new Date(start.slice(0, 8) + '28'), attendanceReviewedAt: new Date() } });
  }
  it('serializes concurrent draft numbers and records only one publication on concurrent retries', async () => {
    const f = await fixture();
    const revisions = await Promise.all([draft(f), draft(f)]);
    expect(revisions.map(row => row.version).sort()).toEqual([1, 2]);
    const candidate = revisions[1]; await preview(f, candidate);
    const results = await Promise.all([1, 2].map(() => service.publish(f.checker, f.component.id, candidate.id)));
    expect(results[0].publishedAt).toEqual(results[1].publishedAt);
    expect(await mockDatabase.payrollFormulaAudit.count({ where: { versionId: candidate.id, action: 'PUBLISHED' } })).toBe(1);
    const stored = await mockDatabase.payrollFormulaVersion.findUniqueOrThrow({ where: { id: candidate.id } });
    expect(stored.expression).toBe(candidate.expression); expect(stored.createdBy).toBe(f.context.actorId);
  });
  it('requires successful simulation and a different actor, without writing rejected publication audits', async () => {
    const f = await fixture(), candidate = await draft(f);
    await expect(service.publish(f.checker, f.component.id, candidate.id)).rejects.toThrow('simulation');
    await preview(f, candidate);
    await expect(service.publish(f.context, f.component.id, candidate.id)).rejects.toThrow('different user');
    expect(await mockDatabase.payrollFormulaAudit.count({ where: { versionId: candidate.id, action: 'PUBLISHED' } })).toBe(0);
    const invalid = await draft(f, 'BASE_SALARY / WORK_DAYS');
    await expect(service.preview(f.checker, f.component.id, invalid.id, { inputs: { ...inputs, WORK_DAYS: '0' }, componentAmounts: {} })).rejects.toThrow('division by zero');
    expect((await mockDatabase.payrollFormulaVersion.findUniqueOrThrow({ where: { id: invalid.id } })).previewedAt).toBeNull();
  });
  it('rejects cross-company IDs and references even when component codes overlap', async () => {
    const f = await fixture(), other = await fixture(), candidate = await draft(f);
    await mockDatabase.salaryComponent.create({ data: { companyId: other.context.companyId, code: 'FOREIGN_ONLY', name: 'Foreign', type: 'ALLOWANCE' } });
    await expect(draft(f, 'component("FOREIGN_ONLY")')).rejects.toThrow('unavailable');
    await expect(service.list(other.context, f.component.id)).rejects.toThrow('not found');
    await expect(service.preview(other.context, other.component.id, candidate.id, { inputs, componentAmounts: {} })).rejects.toThrow('not found');
    await expect(service.publish(other.checker, f.component.id, candidate.id)).rejects.toThrow('not found');
  });
  it('rechecks cycles at future publication boundaries', async () => {
    const f = await fixture();
    const other = await mockDatabase.salaryComponent.create({ data: { companyId: f.context.companyId, code: 'MEAL', name: 'Meal', type: 'ALLOWANCE', amount: '10' } });
    const later = await draft(f, 'component("BONUS")', '2026-12-01', other.id);
    await preview(f, later); await service.publish(f.checker, other.id, later.id);
    const candidate = await draft(f, 'component("MEAL")', '2026-11-01');
    await expect(preview(f, candidate)).rejects.toThrow('cyclic');
    // Simulate a formerly successful preview before the graph changed; publish must revalidate.
    await mockDatabase.payrollFormulaVersion.update({ where: { id: candidate.id }, data: { previewedAt: new Date() } });
    await expect(service.publish(f.checker, f.component.id, candidate.id)).rejects.toThrow('cyclic');
  });
  it('allows only one of two concurrent publications that would form a cycle together', async () => {
    const f = await fixture();
    const other = await mockDatabase.salaryComponent.create({ data: { companyId: f.context.companyId, code: 'MEAL', name: 'Meal', type: 'ALLOWANCE', amount: '10' } });
    const first = await draft(f, 'component("MEAL")');
    const second = await draft(f, 'component("BONUS")', '2026-10-01', other.id);
    await preview(f, first); await preview(f, second);
    const results = await Promise.allSettled([first, second].map(candidate => service.publish(f.checker, candidate.componentId, candidate.id)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.message).toContain('cyclic');
    expect(await mockDatabase.payrollFormulaAudit.count({ where: { companyId: f.context.companyId, action: 'PUBLISHED' } })).toBe(1);
  });
  it('blocks backdating over existing payroll and deleting published dependencies', async () => {
    const f = await fixture(), candidate = await draft(f); await preview(f, candidate);
    const p = await period(f);
    await mockDatabase.payrollRun.create({ data: { companyId: f.context.companyId, periodId: p.id, runNumber: 1, name: 'Existing', createdBy: f.context.actorId } });
    await expect(service.publish(f.checker, f.component.id, candidate.id)).rejects.toThrow('overlaps');
    const future = await draft(f, 'BASE_SALARY / 10', '2026-11-01'); await preview(f, future); await service.publish(f.checker, f.component.id, future.id);
    await expect(payrollRepository.softDeleteSalaryComponent(f.component.id)).rejects.toThrow('cannot be deleted');
    const dependency = await mockDatabase.salaryComponent.create({ data: { companyId: f.context.companyId, code: 'MEAL', name: 'Meal', type: 'ALLOWANCE', amount: '10' } });
    const withReference = await draft(f, 'component("MEAL")', '2026-12-01'); await preview(f, withReference); await service.publish(f.checker, f.component.id, withReference.id);
    await expect(payrollRepository.softDeleteSalaryComponent(dependency.id)).rejects.toThrow('cannot be deleted');
  });
  it('persists actual payroll execution evidence and preserves it when a later revision is published', async () => {
    const f = await fixture(), first = await draft(f, 'BASE_SALARY / WORK_DAYS + 0.105');
    await preview(f, first); await service.publish(f.checker, f.component.id, first.id);
    const employee = await mockDatabase.employee.create({ data: { companyId: f.context.companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee' } });
    await mockDatabase.employeeSalary.create({ data: { companyId: f.context.companyId, employeeId: employee.id, effectiveDate: new Date('2026-01-01'), baseSalary: '10000000',
      components: { create: { salaryComponentId: f.component.id, amount: '100' } } } });
    const p = await period(f);
    const run = await new PayrollService().createPayrollRun({ companyId: f.context.companyId, periodId: p.id, name: 'Formula payroll' }, f.context.actorId);
    const slip = await mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: run.id }, include: { formulaCalculations: true, components: true } });
    expect(slip.netPay.toFixed(2)).toBe('500000.11');
    expect(slip.components[0].amount.toFixed(2)).toBe('500000.11');
    expect(slip.formulaCalculations).toHaveLength(1);
    expect(slip.formulaCalculations[0]).toMatchObject({ versionId: first.id, expression: first.expression, engineVersion: 1,
      inputs: { BASE_SALARY: '10000000', WORK_DAYS: '20', PRESENT_DAYS: '0' }, dependencies: {} });
    const future = await draft(f, 'BASE_SALARY / 10', '2026-11-01'); await preview(f, future); await service.publish(f.checker, f.component.id, future.id);
    expect(await mockDatabase.payrollFormulaCalculation.findUniqueOrThrow({ where: { id: slip.formulaCalculations[0].id } })).toEqual(slip.formulaCalculations[0]);
    const before = await period(f, '2026-09-01');
    const baseline = await new PayrollService().createPayrollRun({ companyId: f.context.companyId, periodId: before.id, name: 'Baseline payroll' }, f.context.actorId);
    const earlier = await mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: baseline.id }, include: { formulaCalculations: true } });
    expect(earlier.netPay.toFixed(2)).toBe('100.00'); expect(earlier.formulaCalculations).toEqual([]);
  });
});
