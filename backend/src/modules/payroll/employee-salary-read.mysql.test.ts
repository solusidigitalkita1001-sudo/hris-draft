import { randomUUID } from 'node:crypto';
import { PrismaClient, DataScopeType } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { runInRequestContext, RequestUserContext } from '@/shared/context/RequestContext';
import { PayrollService } from './payroll.service';
import { EmployeeRepository } from '@/modules/employee/employee.repository';
import { administrationService } from '@/modules/administration/administration.service';
import { logger } from '@/shared/logger/WinstonLogger';

const databaseUrl = process.env.PAYROLL_SALARY_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('salary read isolation (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [], service = new PayrollService(), employees = new EmployeeRepository();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing salary test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Salary read tests require the isolated local hris_payment_integration database');
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
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.subDepartment.deleteMany({ where: { companyId } });
      await mockDatabase.department.deleteMany({ where: { companyId } });
      await mockDatabase.branch.deleteMany({ where: { companyId } });
      await mockDatabase.roleDataScope.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });
  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(), actorId = randomUUID(); companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Salary read tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const branch = await mockDatabase.branch.create({ data: { companyId, code: randomUUID(), name: 'Permitted branch' } });
    const department = await mockDatabase.department.create({ data: { companyId, code: randomUUID(), name: 'Permitted department' } });
    const subDepartment = await mockDatabase.subDepartment.create({ data: { companyId, departmentId: department.id, code: randomUUID(), name: 'Permitted team' } });
    const person = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee',
      joinDate: new Date('2020-01-01'), taxId: 'SYNTHETIC-TAX-ONLY', branchId: branch.id, departmentId: department.id, subDepartmentId: subDepartment.id } });
    const outside = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Outside', lastName: 'Scope', fullName: 'Outside Scope', joinDate: new Date('2020-01-01') } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Synthetic base salary', type: 'ALLOWANCE', amount: '1000' } });
    const salary = await mockDatabase.employeeSalary.create({ data: { companyId, employeeId: person.id, effectiveDate: new Date('2026-09-01'), baseSalary: '1000.25',
      components: { create: { salaryComponentId: component.id, amount: '1000.25' } } } });
    const previous = await mockDatabase.employeeSalary.create({ data: { companyId, employeeId: person.id, effectiveDate: new Date('2026-08-01'), baseSalary: '900', isActive: false } });
    const outsideSalary = await mockDatabase.employeeSalary.create({ data: { companyId, employeeId: outside.id, effectiveDate: new Date('2026-09-01'), baseSalary: '2000' } });
    return { companyId, actorId, person, outside, component, salary, previous, outsideSalary, branch, department, subDepartment };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function asActor<T>(f: Fixture, operation: () => T, changes: Partial<RequestUserContext> = {}) {
    return runInRequestContext({ user: { id: f.actorId, email: 'salary-read@example.test', companyId: f.companyId, companyScope: [f.companyId],
      employeeId: f.person.id, roles: ['PAYROLL_READ_TEST'], permissions: ['employee:read', 'payroll:read'], ...changes } }, operation);
  }
  const list = (f: Fixture, employeeId?: string) => asActor(f, () => service.findAllEmployeeSalaries(f.companyId, employeeId));
  const detail = (f: Fixture, id = f.salary.id) => asActor(f, () => service.findEmployeeSalaryById(id));
  const thr = (f: Fixture, id = f.person.id) => asActor(f, () => service.calculateEmployeeThr(id, new Date('2026-09-09')));
  const scope = (f: Fixture, scopeType: DataScopeType, scopeValue?: string) => mockDatabase.roleDataScope.create({ data: {
    companyId: f.companyId, roleCode: 'PAYROLL_READ_TEST', resource: 'payroll', scopeType, scopeValue,
  } });

  it('keeps company reads isolated and returns only public employee identifiers alongside salary history', async () => {
    const f = await fixture(), foreign = await fixture();
    const rows = await list(f);
    expect(rows.map(row => row.id).sort()).toEqual([f.salary.id, f.previous.id, f.outsideSalary.id].sort());
    expect(rows.every(row => row.companyId === f.companyId)).toBe(true);
    expect(Object.keys(rows[0].employee).sort()).toEqual(['employeeNumber', 'fullName', 'id']);
    expect((await detail(f)).components[0].amount.toString()).toBe('1000.25');
    await expect(detail(f, foreign.salary.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(await list(f, foreign.person.id)).toEqual([]);
    await expect(thr(f, foreign.person.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.findAllEmployeeSalaries(foreign.companyId), { companyScope: [f.companyId, foreign.companyId] })).rejects.toMatchObject({ statusCode: 403 });
  });

  it.each(['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY', 'EMPLOYEE_SELF'] as const)('applies %s in list, detail and THR queries, including forged employee filters', async scopeType => {
    const f = await fixture();
    const scopeValue = scopeType === 'BRANCH_ONLY' ? f.branch.id : scopeType === 'DEPARTMENT_ONLY' ? f.department.id : scopeType === 'SUB_DEPARTMENT_ONLY' ? f.subDepartment.id : undefined;
    await scope(f, scopeType, scopeValue);
    expect((await list(f)).map(row => row.id).sort()).toEqual([f.salary.id, f.previous.id].sort());
    expect((await list(f, f.person.id))).toHaveLength(2);
    expect(await list(f, f.outside.id)).toEqual([]);
    expect((await detail(f)).id).toBe(f.salary.id);
    await expect(detail(f, f.outsideSalary.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await thr(f)).monthlyWage).toBe(1000.25);
    await expect(thr(f, f.outside.id)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('excludes deleted salary/employee records and malformed cross-company parent/child references', async () => {
    const f = await fixture(), foreign = await fixture();
    const malformed = await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: foreign.person.id, effectiveDate: new Date('2026-07-01'), baseSalary: '9999' } });
    await mockDatabase.employeeSalaryComponent.create({ data: { employeeSalaryId: f.salary.id, salaryComponentId: foreign.component.id, amount: '9999' } });
    expect((await detail(f)).components.map(row => row.salaryComponentId)).toEqual([f.component.id]);
    expect((await list(f)).some(row => row.id === malformed.id)).toBe(false);
    await expect(detail(f, malformed.id)).rejects.toMatchObject({ statusCode: 404 });
    await mockDatabase.employeeSalary.update({ where: { id: f.previous.id }, data: { deletedAt: new Date() } });
    await expect(detail(f, f.previous.id)).rejects.toMatchObject({ statusCode: 404 });
    await mockDatabase.employee.update({ where: { id: f.outside.id }, data: { deletedAt: new Date() } });
    await expect(detail(f, f.outsideSalary.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(thr(f, f.outside.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await list(f)).map(row => row.id)).toEqual([f.salary.id]);
    const profile = await asActor(f, () => employees.findById(f.person.id));
    expect(profile?.employeeSalaries[0].components.map(row => row.salaryComponentId)).toEqual([f.component.id]);
  });

  it('does not expose nested salary through an employee profile without payroll permission', async () => {
    const f = await fixture();
    const hidden = await asActor(f, () => employees.findById(f.person.id), { permissions: ['employee:read'] });
    expect(hidden?.id).toBe(f.person.id); expect(hidden?.employeeSalaries).toEqual([]);
    const permitted = await asActor(f, () => employees.findById(f.person.id));
    expect(permitted?.employeeSalaries.map(row => row.id)).toEqual([f.salary.id]);
    const wildcard = await asActor(f, () => employees.findById(f.person.id), { permissions: ['employee:read', 'payroll:*'] });
    expect(wildcard?.employeeSalaries.map(row => row.id)).toEqual([f.salary.id]);
    const admin = await asActor(f, () => employees.findById(f.person.id), { roles: ['SUPER_ADMIN'], permissions: [] });
    expect(admin?.employeeSalaries.map(row => row.id)).toEqual([f.salary.id]);
  });

  it('intersects embedded salary with payroll scope even when the employee profile itself is permitted', async () => {
    const f = await fixture(); await scope(f, 'EMPLOYEE_SELF');
    const profile = await asActor(f, () => employees.findById(f.outside.id));
    expect(profile?.id).toBe(f.outside.id); expect(profile?.employeeSalaries).toEqual([]);
    expect((await asActor(f, () => employees.findById(f.person.id)))?.employeeSalaries).toHaveLength(1);
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { deletedAt: new Date() } });
    expect((await asActor(f, () => employees.findById(f.person.id)))?.employeeSalaries).toEqual([]);
  });

  it('fails closed for manager scope, missing actor and scope lookup failures', async () => {
    const f = await fixture(); await scope(f, 'MANAGER_TEAM');
    await expect(list(f)).rejects.toMatchObject({ statusCode: 403 });
    await expect(detail(f)).rejects.toMatchObject({ statusCode: 403 });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 403 });
    expect((await asActor(f, () => employees.findById(f.person.id)))?.employeeSalaries).toEqual([]);
    await expect(runInRequestContext({}, () => service.findAllEmployeeSalaries(f.companyId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(runInRequestContext({}, () => service.findEmployeeSalaryById(f.salary.id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(runInRequestContext({}, () => service.calculateEmployeeThr(f.person.id))).rejects.toMatchObject({ statusCode: 403 });
    const queries = jest.spyOn(mockDatabase.employeeSalary, 'findMany');
    jest.spyOn(administrationService, 'findMyDataScopeByUser').mockRejectedValueOnce(new Error('Injected scope lookup failure'));
    await expect(list(f)).rejects.toThrow('Injected scope lookup failure'); expect(queries).not.toHaveBeenCalled();
  });

  it('rejects ambiguous or invalid active salary inputs instead of choosing an arbitrary THR wage', async () => {
    const f = await fixture();
    await mockDatabase.employeeSalary.update({ where: { id: f.previous.id }, data: { isActive: true } });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 409 });
    await mockDatabase.employeeSalary.update({ where: { id: f.previous.id }, data: { isActive: false } });
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { currency: 'USD' } });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 422 });
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { currency: 'IDR', baseSalary: '-1' } });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 422 });
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { isActive: false } });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 400 });
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('preserves the existing THR result for an authorized employee while omitting financial values from application logs', async () => {
    const f = await fixture();
    const result = await thr(f);
    expect(result).toMatchObject({ employee: { id: f.person.id }, monthlyWage: 1000.25, amount: 1000, eligible: true, isProrated: false });
    expect(logger.info).toHaveBeenCalledWith('THR calculated', { employeeId: f.person.id });
    await expect(asActor(f, () => service.calculateEmployeeThr(f.person.id, new Date('invalid')))).rejects.toMatchObject({ statusCode: 422 });
    await mockDatabase.employee.update({ where: { id: f.person.id }, data: { joinDate: null } });
    await expect(thr(f)).rejects.toMatchObject({ statusCode: 400 });
  });
});
