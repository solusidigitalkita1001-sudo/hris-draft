import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
  WinstonLogger: jest.fn().mockImplementation(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() })),
}));
import { runInRequestContext, RequestUserContext } from '@/shared/context/RequestContext';
import { PayrollService } from './payroll.service';
import { annualTaxRecapService } from './annual-tax-recap.service';
import { EmployeeRepository } from '@/modules/employee/employee.repository';

/**
 * S-H1, against a real database and with no RoleDataScope row in sight —
 * which is the state every deployment is in, because no seed or migration
 * ever wrote one.
 *
 * A role with no scope row resolved to an empty filter, and an empty filter
 * means "the whole company" to every caller. Together with the `payroll:read`
 * the EMPLOYEE role was seeded with, any employee could list every
 * colleague's salary, open their payslip, and pull their annual tax recap.
 *
 * The two halves have to hold at the same time: a colleague's figures are
 * unreachable, and the employee's OWN figures stay reachable without the
 * company-wide payroll permission they no longer hold.
 */
const databaseUrl = process.env.PAYROLL_SALARY_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('employee self scope with no configured data scope (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [], service = new PayrollService(), employees = new EmployeeRepository();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing salary test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Self scope tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  beforeEach(() => jest.clearAllMocks());
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
      await mockDatabase.department.updateMany({ where: { companyId }, data: { headId: null } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.department.deleteMany({ where: { companyId } });
      await mockDatabase.roleDataScope.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });

  /**
   * One company, two colleagues in one department, and a manager heading it.
   * The run is APPROVED because self-service payslip history only exposes
   * runs that reached APPROVED or DISBURSED.
   */
  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(); companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Self scope tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const department = await mockDatabase.department.create({ data: { companyId, code: randomUUID(), name: 'Managed department' } });
    const person = (name: string) => mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(),
      firstName: name, lastName: 'Synthetic', fullName: `${name} Synthetic`, joinDate: new Date('2020-01-01'), departmentId: department.id } });
    const self = await person('Self'), colleague = await person('Colleague'), manager = await person('Manager');
    await mockDatabase.department.update({ where: { id: department.id }, data: { headId: manager.id } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Synthetic base salary', type: 'ALLOWANCE', amount: '1000' } });
    const salary = (employeeId: string, amount: string) => mockDatabase.employeeSalary.create({ data: { companyId, employeeId,
      effectiveDate: new Date('2026-01-01'), baseSalary: amount, components: { create: { salaryComponentId: component.id, amount } } } });
    const ownSalary = await salary(self.id, '1000.25'), colleagueSalary = await salary(colleague.id, '9999.99');
    const period = await mockDatabase.payrollPeriod.create({ data: { companyId, code: randomUUID(), name: 'Synthetic period',
      startDate: new Date('2026-01-01'), endDate: new Date('2026-01-31'), payDate: new Date('2026-01-31') } });
    const run = await mockDatabase.payrollRun.create({ data: { companyId, periodId: period.id, name: 'Synthetic payroll', runNumber: 1,
      status: 'APPROVED', totalEmployees: 2, totalEarnings: '10999.99', totalNetPay: '10999.99' } });
    const slip = (employeeId: string, amount: string) => mockDatabase.payslip.create({ data: { companyId, payrollRunId: run.id, employeeId,
      baseSalary: amount, totalEarnings: amount, netPay: amount } });
    const ownSlip = await slip(self.id, '1000.25'), colleagueSlip = await slip(colleague.id, '9999.99');
    return { companyId, department, self, colleague, manager, ownSalary, colleagueSalary, period, run, ownSlip, colleagueSlip };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;

  /** The EMPLOYEE role as it is now seeded: no payroll permission at all. */
  function asEmployee<T>(f: Fixture, operation: () => T, changes: Partial<RequestUserContext> = {}) {
    return runInRequestContext({ user: { id: randomUUID(), email: 'self@example.test', companyId: f.companyId, companyScope: [f.companyId],
      employeeId: f.self.id, roles: ['EMPLOYEE'], permissions: ['employee:read'], ...changes } }, operation);
  }

  it('hides every colleague figure from an employee who has no configured scope', async () => {
    const f = await fixture();

    const salaries = await asEmployee(f, () => service.findAllEmployeeSalaries(f.companyId));
    expect(salaries.map(row => row.id)).toEqual([f.ownSalary.id]);
    expect(await asEmployee(f, () => service.findAllEmployeeSalaries(f.companyId, f.colleague.id))).toEqual([]);
    await expect(asEmployee(f, () => service.findEmployeeSalaryById(f.colleagueSalary.id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asEmployee(f, () => service.findPayslipById(f.colleagueSlip.id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asEmployee(f, () => service.calculateEmployeeThr(f.colleague.id, new Date('2026-06-01')))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asEmployee(f, () => annualTaxRecapService.build(f.companyId, f.colleague.id, 2026))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asEmployee(f, () => annualTaxRecapService.buildBuktiPotong(f.companyId, f.colleague.id, 2026))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asEmployee(f, () => service.findPayslipsByEmployee(f.colleague.id))).rejects.toMatchObject({ statusCode: 403 });

    // Not a single colleague rupiah is reachable through the profile either.
    expect(await asEmployee(f, () => employees.findById(f.colleague.id))).toBeNull();
    // Company aggregates stay out of reach: the run carries everybody's totals.
    await expect(asEmployee(f, () => service.findAllPayrollRuns(f.companyId))).rejects.toMatchObject({ statusCode: 403 });
  });

  it('keeps the employee own figures readable without the payroll permission', async () => {
    const f = await fixture();

    expect((await asEmployee(f, () => service.findEmployeeSalaryById(f.ownSalary.id))).id).toBe(f.ownSalary.id);
    expect((await asEmployee(f, () => service.findPayslipById(f.ownSlip.id))).id).toBe(f.ownSlip.id);
    expect((await asEmployee(f, () => service.findPayslipsByEmployee(f.self.id))).map(row => row.id)).toEqual([f.ownSlip.id]);
    expect((await asEmployee(f, () => annualTaxRecapService.build(f.companyId, f.self.id, 2026))).employee.id).toBe(f.self.id);
    expect((await asEmployee(f, () => service.calculateEmployeeThr(f.self.id, new Date('2026-06-01')))).monthlyWage).toBe(1000.25);

    // The salary on the own profile used to hang off `payroll:read`, which the
    // EMPLOYEE role no longer holds.
    const profile = await asEmployee(f, () => employees.findById(f.self.id));
    expect(profile?.employeeSalaries.map(row => row.id)).toEqual([f.ownSalary.id]);
  });

  it('keeps an HR reader company-wide while narrowing a manager to their team', async () => {
    const f = await fixture();
    // Every privileged user also holds EMPLOYEE, so the default is read off
    // the whole role set — otherwise HR would be narrowed to itself.
    const hr = await asEmployee(f, () => service.findAllEmployeeSalaries(f.companyId),
      { roles: ['HR_STAFF', 'EMPLOYEE'], permissions: ['employee:read', 'payroll:read'] });
    expect(hr.map(row => row.id).sort()).toEqual([f.ownSalary.id, f.colleagueSalary.id].sort());

    const asManager = { employeeId: f.manager.id, roles: ['MANAGER', 'EMPLOYEE'], permissions: ['employee:read', 'payroll:read'] };
    const team = await asEmployee(f, () => service.findAllEmployeeSalaries(f.companyId), asManager);
    expect(team.map(row => row.id).sort()).toEqual([f.ownSalary.id, f.colleagueSalary.id].sort());

    // A manager who heads nothing keeps their own records and nobody else's.
    await mockDatabase.department.update({ where: { id: f.department.id }, data: { headId: null } });
    const alone = await asEmployee(f, () => service.findAllEmployeeSalaries(f.companyId), asManager);
    expect(alone).toEqual([]);
    await expect(asEmployee(f, () => service.findEmployeeSalaryById(f.colleagueSalary.id), asManager)).rejects.toMatchObject({ statusCode: 404 });
  });
});
