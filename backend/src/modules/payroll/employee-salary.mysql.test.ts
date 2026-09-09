import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { runInRequestContext } from '@/shared/context/RequestContext';
import { PayrollService } from './payroll.service';
import { payrollRepository } from './payroll.repository';
import { CreateEmployeeSalaryDTO, UpdateEmployeeSalaryDTO } from './payroll.dto';

const databaseUrl = process.env.PAYROLL_SALARY_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('salary allocation integrity (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [], service = new PayrollService();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing salary test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Salary tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.workCalendar.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.branch.deleteMany({ where: { companyId } });
      await mockDatabase.companySetting.deleteMany({ where: { companyId } });
      await mockDatabase.roleDataScope.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });
  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(), actorId = randomUUID(); companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Salary allocation tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const person = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee' } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Synthetic salary', type: 'ALLOWANCE', amount: '1000', isTaxable: true } });
    const other = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'OTHER', name: 'Synthetic allowance', type: 'ALLOWANCE', amount: '50' } });
    return { companyId, actorId, person, component, other };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function asActor<T>(f: Fixture, operation: () => T) {
    return runInRequestContext({ user: { id: f.actorId, email: 'synthetic@example.test', companyId: f.companyId,
      companyScope: [f.companyId], employeeId: f.person.id, roles: ['PAYROLL_TEST'] } }, operation);
  }
  const input = (f: Fixture, changes: Partial<CreateEmployeeSalaryDTO> = {}): CreateEmployeeSalaryDTO => ({ employeeId: f.person.id,
    effectiveDate: '2026-09-01T05:00:00Z', baseSalary: 1000, currency: 'IDR', components: [{ salaryComponentId: f.component.id, amount: 1000 }], ...changes });
  const create = (f: Fixture, changes: Partial<CreateEmployeeSalaryDTO> = {}) => asActor(f, () => service.createEmployeeSalary(input(f, changes)));
  const update = (f: Fixture, id: string, data: UpdateEmployeeSalaryDTO) => asActor(f, () => service.updateEmployeeSalary(id, data));
  const stored = (id: string) => mockDatabase.employeeSalary.findUniqueOrThrow({ where: { id }, include: { components: true } });
  async function period(f: Fixture) {
    await mockDatabase.companySetting.createMany({ data: [{ companyId: f.companyId, key: 'late_deduction_enabled', value: 'false' },
      { companyId: f.companyId, key: 'absence_deduction_daily_basic_percent', value: '0' }] });
    await mockDatabase.workCalendar.create({ data: { companyId: f.companyId, createdBy: f.actorId, name: 'Synthetic calendar', year: 2026, workDays: { thu: true } } });
    return mockDatabase.payrollPeriod.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Synthetic period',
      startDate: new Date('2026-10-01'), endDate: new Date('2026-10-07'), payDate: new Date('2026-10-08'), attendanceReviewedAt: new Date() } });
  }
  const run = (f: Fixture, periodId: string) => asActor(f, () => service.createPayrollRun({ companyId: f.companyId, periodId, name: 'Synthetic payroll' }, f.actorId));

  it('replaces the active allocation atomically while preserving the old financial fields and components', async () => {
    const f = await fixture(), previous = await create(f);
    const next = await create(f, { effectiveDate: '2026-10-01T05:00:00Z', baseSalary: 1500.25, components: [{ salaryComponentId: f.component.id, amount: 1500.25 }] });
    expect(next.companyId).toBe(f.companyId); expect(next.isActive).toBe(true);
    const old = await stored(previous.id);
    expect(old.isActive).toBe(false); expect(old.baseSalary.toFixed(2)).toBe('1000.00');
    expect(old.components[0].amount.toFixed(2)).toBe('1000.00');
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId, isActive: true } })).toBe(1);
  });

  it('rolls back deactivation and the new allocation if persistence fails after the insert', async () => {
    const f = await fixture(), previous = await create(f);
    const original = payrollRepository.createEmployeeSalary.bind(payrollRepository);
    jest.spyOn(payrollRepository, 'createEmployeeSalary').mockImplementationOnce(async (...args) => {
      await original(...args); throw new Error('Injected failure after salary insert');
    });
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z' })).rejects.toThrow('Injected failure');
    expect((await stored(previous.id)).isActive).toBe(true);
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId } })).toBe(1);
    expect((await create(f, { effectiveDate: '2026-10-01T00:00:00Z' })).isActive).toBe(true);
  });

  it('rolls back replacement components and salary fields together, then permits a clean retry', async () => {
    const f = await fixture(), salary = await create(f), before = await stored(salary.id);
    const original = payrollRepository.updateEmployeeSalary.bind(payrollRepository);
    jest.spyOn(payrollRepository, 'updateEmployeeSalary').mockImplementationOnce(async (...args) => {
      await original(...args); throw new Error('Injected failure after component replacement');
    });
    const patch = { baseSalary: 1200.5, components: [{ salaryComponentId: f.other.id, amount: 50.25 }] };
    await expect(update(f, salary.id, patch)).rejects.toThrow('Injected failure');
    expect(await stored(salary.id)).toEqual(before);
    const result = await update(f, salary.id, patch);
    expect(result.baseSalary.toFixed(2)).toBe('1200.50');
    expect(result.components).toHaveLength(1); expect(result.components[0].salaryComponentId).toBe(f.other.id);
    expect(result.components[0].amount.toFixed(2)).toBe('50.25');
  });

  it('rejects cross-company employee, salary and component IDs without changing either company', async () => {
    const f = await fixture(), foreign = await fixture(), salary = await create(f), foreignSalary = await create(foreign);
    await expect(create(f, { employeeId: foreign.person.id })).rejects.toMatchObject({ statusCode: 404 });
    await expect(create(f, { companyId: foreign.companyId })).rejects.toMatchObject({ statusCode: 403 });
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z', components: [{ salaryComponentId: foreign.component.id, amount: 1 }] })).rejects.toMatchObject({ statusCode: 422 });
    await expect(update(f, foreignSalary.id, { baseSalary: 1 })).rejects.toMatchObject({ statusCode: 404 });
    await expect(update(f, salary.id, { components: [{ salaryComponentId: foreign.component.id, amount: 1 }] })).rejects.toMatchObject({ statusCode: 422 });
    for (const id of [salary.id, foreignSalary.id]) {
      const row = await stored(id); expect(row.isActive).toBe(true); expect(row.baseSalary.toString()).toBe('1000');
      expect(row.components[0].amount.toString()).toBe('1000');
    }
  });

  it('rejects inactive/deleted components and deleted employees before deactivation or replacement', async () => {
    const f = await fixture(), salary = await create(f);
    for (const data of [{ isActive: false }, { isActive: true, deletedAt: new Date() }]) {
      await mockDatabase.salaryComponent.update({ where: { id: f.other.id }, data });
      const components = [{ salaryComponentId: f.other.id, amount: 50 }];
      await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z', components })).rejects.toMatchObject({ statusCode: 422 });
      await expect(update(f, salary.id, { components })).rejects.toMatchObject({ statusCode: 422 });
    }
    await mockDatabase.employee.update({ where: { id: f.person.id }, data: { deletedAt: new Date() } });
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(update(f, salary.id, { notes: 'test' })).rejects.toMatchObject({ statusCode: 404 });
    expect((await stored(salary.id)).isActive).toBe(true);
  });

  it('serializes concurrent duplicate creation and treats timestamps on the same UTC date as one effective date', async () => {
    const f = await fixture();
    const results = await Promise.allSettled([create(f), create(f, { effectiveDate: '2026-09-01T20:00:00Z' })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(result => result.status === 'rejected');
    expect(rejected?.status === 'rejected' && rejected.reason.statusCode).toBe(409);
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId } })).toBe(1);
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId, isActive: true } })).toBe(1);
  });

  it('allows only one concurrent activation and rejects an update that collides with another effective date', async () => {
    const f = await fixture(), first = await create(f), second = await create(f, { effectiveDate: '2026-10-01T00:00:00Z' });
    await update(f, second.id, { isActive: false });
    const results = await Promise.allSettled([update(f, first.id, { isActive: true }), update(f, second.id, { isActive: true })]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId, isActive: true } })).toBe(1);
    await expect(update(f, second.id, { effectiveDate: '2026-09-01T12:00:00Z' })).rejects.toMatchObject({ statusCode: 409 });
    expect((await stored(second.id)).effectiveDate.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('freezes financial fields once a payslip references the allocation, while allowing administrative notes and deactivation', async () => {
    const f = await fixture(), salary = await create(f), p = await period(f), completed = await run(f, p.id);
    for (const patch of [{ baseSalary: 2000 }, { currency: 'IDR' as const }, { effectiveDate: '2026-10-01T00:00:00Z' }, { components: [] }]) {
      await expect(update(f, salary.id, patch)).rejects.toMatchObject({ statusCode: 409 });
    }
    await update(f, salary.id, { notes: 'Replaced by a later allocation', isActive: false });
    expect((await stored(salary.id)).baseSalary.toString()).toBe('1000');
    expect((await mockDatabase.payslip.findUniqueOrThrow({ where: { id: completed.payslips[0].id } })).netPay.toString()).toBe('1000');
    expect((await create(f, { effectiveDate: '2026-11-01T00:00:00Z', baseSalary: 2000 })).isActive).toBe(true);
  });

  it('shares the payroll lock so a financial edit cannot commit after payroll consumes the allocation', async () => {
    const f = await fixture(), salary = await create(f), p = await period(f);
    let release = () => {}, reached = () => {};
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { reached = resolve; });
    const original = payrollRepository.createPayslip.bind(payrollRepository);
    jest.spyOn(payrollRepository, 'createPayslip').mockImplementationOnce(async (...args) => {
      const slip = await original(...args); reached(); await gate; return slip;
    });
    const calculation = run(f, p.id);
    await started;
    const edit = update(f, salary.id, { baseSalary: 2000 });
    const rejectedEdit = expect(edit).rejects.toMatchObject({ statusCode: 409 });
    release();
    const completed = await calculation; await rejectedEdit;
    expect(completed.payslips[0].baseSalary.toString()).toBe('1000');
    expect((await stored(salary.id)).baseSalary.toString()).toBe('1000');
  });

  it('enforces the payroll branch scope in employee queries even when employee-module access is company-wide', async () => {
    const f = await fixture();
    const branch = await mockDatabase.branch.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Permitted branch' } });
    await mockDatabase.employee.update({ where: { id: f.person.id }, data: { branchId: branch.id } });
    const outside = await mockDatabase.employee.create({ data: { companyId: f.companyId, employeeNumber: randomUUID(), firstName: 'Outside', lastName: 'Scope', fullName: 'Outside Scope' } });
    const outsideSalary = await create(f, { employeeId: outside.id });
    await mockDatabase.roleDataScope.createMany({ data: [
      { companyId: f.companyId, roleCode: 'PAYROLL_TEST', resource: 'employee', scopeType: 'COMPANY_ONLY' },
      { companyId: f.companyId, roleCode: 'PAYROLL_TEST', resource: 'payroll', scopeType: 'BRANCH_ONLY', scopeValue: branch.id },
    ] });
    expect((await create(f)).employeeId).toBe(f.person.id);
    await expect(create(f, { employeeId: outside.id, effectiveDate: '2026-10-01T00:00:00Z' })).rejects.toMatchObject({ statusCode: 404 });
    await expect(update(f, outsideSalary.id, { baseSalary: 5 })).rejects.toMatchObject({ statusCode: 404 });
    expect((await stored(outsideSalary.id)).baseSalary.toString()).toBe('1000');
  });

  it('enforces self scope and fails closed for unavailable manager scope or a missing actor', async () => {
    const f = await fixture();
    const outside = await mockDatabase.employee.create({ data: { companyId: f.companyId, employeeNumber: randomUUID(), firstName: 'Outside', lastName: 'Scope', fullName: 'Outside Scope' } });
    const scope = await mockDatabase.roleDataScope.create({ data: { companyId: f.companyId, roleCode: 'PAYROLL_TEST', resource: 'payroll', scopeType: 'EMPLOYEE_SELF' } });
    expect((await create(f)).employeeId).toBe(f.person.id);
    await expect(create(f, { employeeId: outside.id })).rejects.toMatchObject({ statusCode: 404 });
    await mockDatabase.roleDataScope.update({ where: { id: scope.id }, data: { scopeType: 'MANAGER_TEAM' } });
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z' })).rejects.toMatchObject({ statusCode: 403 });
    await expect(runInRequestContext({}, () => service.createEmployeeSalary(input(f)))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('refuses ambiguous legacy active salaries and prevents reactivation of a foreign component allocation', async () => {
    const f = await fixture(), foreign = await fixture(), salary = await create(f);
    const legacy = await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: f.person.id, baseSalary: '1000', effectiveDate: new Date('2026-08-01'),
      components: { create: { salaryComponentId: foreign.component.id, amount: '1' } } } });
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z' })).rejects.toMatchObject({ statusCode: 409 });
    expect(await mockDatabase.employeeSalary.count({ where: { companyId: f.companyId, isActive: true } })).toBe(2);
    await update(f, legacy.id, { isActive: false }); await update(f, salary.id, { isActive: false });
    await expect(update(f, legacy.id, { isActive: true })).rejects.toMatchObject({ statusCode: 422 });
    expect((await stored(legacy.id)).isActive).toBe(false);
  });

  it('validates direct service input before writes and preserves omission versus explicitly empty components', async () => {
    const f = await fixture(), salary = await create(f);
    await expect(create(f, { effectiveDate: '2026-10-01T00:00:00Z', baseSalary: -1 })).rejects.toMatchObject({ statusCode: 422 });
    await expect(update(f, salary.id, { components: [{ salaryComponentId: f.other.id, amount: 0.001 }] })).rejects.toMatchObject({ statusCode: 422 });
    expect((await update(f, salary.id, { notes: 'Administrative note' })).components).toHaveLength(1);
    expect((await update(f, salary.id, { components: [] })).components).toHaveLength(0);
    expect((await stored(salary.id)).isActive).toBe(true);
  });
});
