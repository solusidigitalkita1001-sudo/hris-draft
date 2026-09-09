import { randomUUID } from 'node:crypto';
import { DataScopeType, PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { RequestUserContext, runInRequestContext } from '@/shared/context/RequestContext';
import { administrationService } from '@/modules/administration/administration.service';
import { PayrollService } from './payroll.service';
import { eventBus } from '@/shared/events/EventBus';

const databaseUrl = process.env.PAYROLL_ACCESS_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('payroll run and payslip access (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [], service = new PayrollService();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing payroll access database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Payroll access tests require the isolated local hris_payment_integration database');
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
      await mockDatabase.payrollFormulaVersion.deleteMany({ where: { companyId } });
      await mockDatabase.benefitDeduction.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.benefitEnrollment.deleteMany({ where: { companyId } });
      await mockDatabase.benefitPlan.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
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
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Payroll scope tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const branch = await mockDatabase.branch.create({ data: { companyId, code: randomUUID(), name: 'Permitted branch' } });
    const department = await mockDatabase.department.create({ data: { companyId, code: randomUUID(), name: 'Permitted department' } });
    const subDepartment = await mockDatabase.subDepartment.create({ data: { companyId, departmentId: department.id, code: randomUUID(), name: 'Permitted team' } });
    const person = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee',
      branchId: branch.id, departmentId: department.id, subDepartmentId: subDepartment.id, bankAccount: 'SYNTHETIC-BANK-SECRET', taxId: 'SYNTHETIC-TAX-SECRET' } });
    const outside = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Outside', lastName: 'Scope', fullName: 'Outside Scope' } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASIC', name: 'Synthetic salary', type: 'ALLOWANCE' } });
    const period = await mockDatabase.payrollPeriod.create({ data: { companyId, code: randomUUID(), name: 'Synthetic period', startDate: new Date('2026-09-01'),
      endDate: new Date('2026-09-30'), payDate: new Date('2026-09-30'), notes: 'COMPANY-PERIOD-NOTES' } });
    const run = await mockDatabase.payrollRun.create({ data: { companyId, periodId: period.id, name: 'Synthetic payroll', runNumber: 1, createdBy: actorId,
      status: 'COMPLETED', totalEmployees: 2, totalEarnings: '3000.75', totalNetPay: '3000.75', notes: 'COMPANY-RUN-NOTES' } });
    const slip = await mockDatabase.payslip.create({ data: { companyId, payrollRunId: run.id, employeeId: person.id, baseSalary: '1000.25', totalEarnings: '1000.25', netPay: '1000.25',
      components: { create: { salaryComponentId: component.id, name: 'Frozen salary', type: 'ALLOWANCE', amount: '1000.25' } } } });
    const outsideSlip = await mockDatabase.payslip.create({ data: { companyId, payrollRunId: run.id, employeeId: outside.id, baseSalary: '2000.50', totalEarnings: '2000.50', netPay: '2000.50' } });
    return { companyId, actorId, branch, department, subDepartment, person, outside, component, period, run, slip, outsideSlip };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function asActor<T>(f: Fixture, operation: () => T, changes: Partial<RequestUserContext> = {}) {
    return runInRequestContext({ user: { id: f.actorId, email: 'scope@example.test', companyId: f.companyId, companyScope: [f.companyId], employeeId: f.person.id,
      roles: ['PAYROLL_SCOPE_TEST'], permissions: ['payroll:read', 'payroll:process', 'payroll:approve', 'payroll:update'], ...changes } }, operation);
  }
  const scope = (f: Fixture, scopeType: DataScopeType, scopeValue?: string) => mockDatabase.roleDataScope.create({ data: {
    companyId: f.companyId, roleCode: 'PAYROLL_SCOPE_TEST', resource: 'payroll', scopeType, scopeValue,
  } });
  const detail = (f: Fixture, id = f.slip.id) => asActor(f, () => service.findPayslipById(id));
  const own = (f: Fixture) => asActor(f, () => service.findPayslipsByEmployee(f.person.id));
  const runDetail = (f: Fixture, id = f.run.id) => asActor(f, () => service.findPayrollRunById(id));

  it('keeps company totals on authorized runs while excluding them and bank data from payslip detail/history', async () => {
    const f = await fixture();
    const runs = await asActor(f, () => service.findAllPayrollRuns(f.companyId));
    expect(runs.map(row => row.id)).toEqual([f.run.id]); expect(runs[0]._count.payslips).toBe(2);
    const run = await runDetail(f);
    expect(run.totalNetPay.toString()).toBe('3000.75'); expect(run.payslips).toHaveLength(2);
    expect(Object.keys(run.payslips[0].employee).sort()).toEqual(['employeeNumber', 'fullName', 'id']);
    const slip = await detail(f), history = await own(f);
    expect(slip.netPay.toString()).toBe('1000.25'); expect(slip.breakdown.takeHomePay).toBe(1000.25);
    for (const row of [slip, ...history]) {
      expect(Object.keys(row.payrollRun).sort()).toEqual(['id', 'name', 'period', 'runNumber', 'status']);
      expect(row.payrollRun.period).not.toHaveProperty('notes');
      const json = JSON.stringify(row);
      for (const hidden of ['3000.75', '2000.5', 'COMPANY-RUN-NOTES', 'COMPANY-PERIOD-NOTES', 'SYNTHETIC-BANK-SECRET', 'SYNTHETIC-TAX-SECRET']) expect(json).not.toContain(hidden);
    }
  });

  it('intersects IDs with the active company, including privileged users and assigned company switches', async () => {
    const f = await fixture(), foreign = await fixture();
    await expect(detail(f, foreign.slip.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(runDetail(f, foreign.run.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.findPayrollPeriodById(foreign.period.id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.getAttendanceSummaryForPeriod(foreign.period.id))).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.findAllPayrollRuns(foreign.companyId), { roles: ['SUPER_ADMIN'], companyScope: [f.companyId, foreign.companyId] })).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.findPayslipById(foreign.slip.id), { roles: ['SUPER_ADMIN'] })).rejects.toMatchObject({ statusCode: 404 });
    const switched = await asActor(f, () => service.findPayrollRunById(foreign.run.id), { companyId: foreign.companyId, companyScope: [f.companyId, foreign.companyId] });
    expect(switched.id).toBe(foreign.run.id);
  });

  it.each(['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY', 'EMPLOYEE_SELF'] as const)('allows scoped payslips but denies company aggregates and mutations for %s', async scopeType => {
    const f = await fixture();
    await scope(f, scopeType, scopeType === 'BRANCH_ONLY' ? f.branch.id : scopeType === 'DEPARTMENT_ONLY' ? f.department.id : scopeType === 'SUB_DEPARTMENT_ONLY' ? f.subDepartment.id : undefined);
    expect((await detail(f)).id).toBe(f.slip.id); expect((await own(f)).map(row => row.id)).toEqual([f.slip.id]);
    await expect(detail(f, f.outsideSlip.id)).rejects.toMatchObject({ statusCode: 404 });
    const readRuns = jest.spyOn(mockDatabase.payrollRun, 'findMany'), writeRuns = jest.spyOn(mockDatabase.payrollRun, 'create');
    const approve = jest.spyOn(mockDatabase.payrollRun, 'updateMany'), updatePeriod = jest.spyOn(mockDatabase.payrollPeriod, 'update');
    for (const operation of [
      () => service.findAllPayrollRuns(f.companyId), () => service.findPayrollRunById(f.run.id),
      () => service.findAllPayrollPeriods(f.companyId), () => service.findPayrollPeriodById(f.period.id),
      () => service.getAttendanceSummaryForPeriod(f.period.id), () => service.confirmAttendanceReview(f.period.id, f.actorId),
      () => service.closePayrollPeriod(f.period.id), () => service.updatePayrollPeriod(f.period.id, { name: 'Forged' }),
      () => service.createPayrollRun({ companyId: f.companyId, periodId: f.period.id, name: 'Forged' }, f.actorId),
      () => service.approvePayrollRun(f.run.id, f.actorId), () => service.disbursePayrollRun(f.run.id, f.actorId),
      () => service.getPayrollRunDisbursements(f.run.id),
    ]) await expect(asActor<Promise<unknown>>(f, operation)).rejects.toMatchObject({ statusCode: 403 });
    for (const query of [readRuns, writeRuns, approve, updatePeriod]) expect(query).not.toHaveBeenCalled();
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it.each(['ALL', 'COMPANY_ONLY'] as const)('allows full company access under explicit %s configuration', async scopeType => {
    const f = await fixture(); await scope(f, scopeType);
    expect((await runDetail(f)).id).toBe(f.run.id);
    expect((await detail(f, f.outsideSlip.id)).id).toBe(f.outsideSlip.id);
  });

  it('enforces self identity in the service and intersects history with current organization scope', async () => {
    const f = await fixture();
    await expect(asActor(f, () => service.findPayslipsByEmployee(f.outside.id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.findPayslipsByEmployee(f.person.id), { employeeId: undefined })).rejects.toMatchObject({ statusCode: 403 });
    await scope(f, 'BRANCH_ONLY', f.branch.id);
    await mockDatabase.employee.update({ where: { id: f.person.id }, data: { branchId: null } });
    expect(await own(f)).toEqual([]); await expect(detail(f)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(['employee', 'run', 'period'] as const)('hides slips with a deleted %s parent from detail and history', async parent => {
    const f = await fixture();
    if (parent === 'employee') await mockDatabase.employee.update({ where: { id: f.person.id }, data: { deletedAt: new Date() } });
    if (parent === 'run') await mockDatabase.payrollRun.update({ where: { id: f.run.id }, data: { deletedAt: new Date() } });
    if (parent === 'period') await mockDatabase.payrollPeriod.update({ where: { id: f.period.id }, data: { deletedAt: new Date() } });
    await expect(detail(f)).rejects.toMatchObject({ statusCode: 404 }); expect(await own(f)).toEqual([]);
    if (parent !== 'employee') {
      await expect(runDetail(f)).rejects.toMatchObject({ statusCode: 404 });
      expect(await asActor(f, () => service.findAllPayrollRuns(f.companyId))).toEqual([]);
    }
  });

  it('rejects malformed cross-company employee/run/period parents even when the slip itself has the active company ID', async () => {
    const f = await fixture(), foreign = await fixture();
    const invalidRun = await mockDatabase.payrollRun.create({ data: { companyId: f.companyId, periodId: foreign.period.id, name: 'Malformed', runNumber: 2 } });
    const data = { companyId: f.companyId, employeeId: f.person.id, payrollRunId: f.run.id, baseSalary: '9999' };
    for (const overrides of [{ employeeId: foreign.person.id }, { payrollRunId: foreign.run.id }, { payrollRunId: invalidRun.id }]) {
      const invalid = await mockDatabase.payslip.create({ data: { ...data, ...overrides } });
      await expect(detail(f, invalid.id)).rejects.toMatchObject({ statusCode: 404 });
    }
    expect((await own(f)).map(row => row.id)).toEqual([f.slip.id]);
    expect((await runDetail(f)).payslips.map(row => row.id).sort()).toEqual([f.slip.id, f.outsideSlip.id].sort());
    await expect(runDetail(f, invalidRun.id)).rejects.toMatchObject({ statusCode: 404 });
    expect((await asActor(f, () => service.findAllPayrollRuns(f.companyId))).map(row => row.id)).toEqual([f.run.id]);
  });

  it('keeps authorized historical evidence and excludes foreign components, formula evidence and other employee benefits', async () => {
    const f = await fixture(), foreign = await fixture();
    const version = await mockDatabase.payrollFormulaVersion.create({ data: { companyId: f.companyId, componentId: f.component.id, version: 1,
      expression: 'BASE_SALARY', expressionHash: 'a'.repeat(64), effectiveFrom: new Date('2026-09-01'), createdBy: f.actorId } });
    const evidence = await mockDatabase.payrollFormulaCalculation.create({ data: { companyId: f.companyId, runId: f.run.id, payslipId: f.slip.id,
      componentId: f.component.id, versionId: version.id, expression: 'BASE_SALARY', amount: '1000.25', inputs: { BASE_SALARY: '1000.25' }, dependencies: {}, engineVersion: 1 } });
    await mockDatabase.payslipComponent.create({ data: { payslipId: f.slip.id, salaryComponentId: foreign.component.id, name: 'FOREIGN-COMPONENT', type: 'ALLOWANCE', amount: '9999' } });
    await mockDatabase.payrollFormulaCalculation.create({ data: { companyId: foreign.companyId, runId: foreign.run.id, payslipId: f.slip.id,
      componentId: foreign.component.id, versionId: version.id, expression: 'FOREIGN-FORMULA', amount: '9999', inputs: {}, dependencies: {}, engineVersion: 1 } });
    const plan = await mockDatabase.benefitPlan.create({ data: { companyId: f.companyId, code: randomUUID(), name: 'Own plan', type: 'HEALTH' } });
    const foreignPlan = await mockDatabase.benefitPlan.create({ data: { companyId: foreign.companyId, code: randomUUID(), name: 'FOREIGN-PLAN', type: 'HEALTH' } });
    const deductions: string[] = [];
    for (const [employeeId, benefitPlanId] of [[f.person.id, plan.id], [f.outside.id, plan.id], [f.person.id, foreignPlan.id]]) {
      const enrollment = await mockDatabase.benefitEnrollment.create({ data: { companyId: f.companyId, employeeId, benefitPlanId, effectiveDate: new Date('2026-09-01') } });
      const deduction = await mockDatabase.benefitDeduction.create({ data: { payslipId: f.slip.id, benefitEnrollmentId: enrollment.id, employeeAmount: '10', totalAmount: '10' } });
      deductions.push(deduction.id);
    }
    // A later master deactivation must not erase same-company frozen evidence.
    await mockDatabase.salaryComponent.update({ where: { id: f.component.id }, data: { isActive: false, deletedAt: new Date() } });
    const slip = await detail(f);
    expect(slip.components.map(row => row.name)).toEqual(['Frozen salary']);
    expect(slip.formulaCalculations.map(row => row.id)).toEqual([evidence.id]);
    expect(slip.benefitDeductions.map(row => row.id)).toEqual([deductions[0]]);
    expect((await own(f))[0].components.map(row => row.name)).toEqual(['Frozen salary']);
    expect((await runDetail(f)).payslips.find(row => row.id === f.slip.id)?.components.map(row => row.name)).toEqual(['Frozen salary']);
  });

  it('fails closed before reading payroll on manager scope, missing context and scope lookup failures', async () => {
    const f = await fixture(); await scope(f, 'MANAGER_TEAM');
    const query = jest.spyOn(mockDatabase.payslip, 'findFirst'), runs = jest.spyOn(mockDatabase.payrollRun, 'findFirst');
    await expect(detail(f)).rejects.toMatchObject({ statusCode: 403 });
    await expect(runDetail(f)).rejects.toMatchObject({ statusCode: 403 });
    for (const operation of [() => service.findPayslipById(f.slip.id), () => service.findPayrollRunById(f.run.id), () => service.findAllPayrollPeriods(f.companyId)]) {
      await expect(runInRequestContext<Promise<unknown>>({}, operation)).rejects.toMatchObject({ statusCode: 403 });
    }
    jest.spyOn(administrationService, 'findMyDataScopeByUser').mockRejectedValue(new Error('Injected scope failure'));
    await expect(detail(f)).rejects.toThrow('Injected scope failure'); await expect(runDetail(f)).rejects.toThrow('Injected scope failure');
    expect(query).not.toHaveBeenCalled(); expect(runs).not.toHaveBeenCalled();
  });

  it('preserves maker-checker approval and rejects forged actors, foreign runs and repeated transitions', async () => {
    const f = await fixture(), foreign = await fixture(), checker = randomUUID();
    await expect(asActor(f, () => service.approvePayrollRun(f.run.id, checker))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.approvePayrollRun(f.run.id, f.actorId))).rejects.toMatchObject({ statusCode: 409 });
    await expect(asActor(f, () => service.approvePayrollRun(foreign.run.id, checker), { id: checker })).rejects.toMatchObject({ statusCode: 404 });
    const approved = await asActor(f, () => service.approvePayrollRun(f.run.id, checker), { id: checker });
    expect(approved).toMatchObject({ companyId: f.companyId, status: 'APPROVED', approvedBy: checker });
    await expect(asActor(f, () => service.approvePayrollRun(f.run.id, checker), { id: checker })).rejects.toMatchObject({ statusCode: 400 });
    expect((await mockDatabase.payrollRun.findUniqueOrThrow({ where: { id: foreign.run.id } })).status).toBe('COMPLETED');
    expect(eventBus.publish).toHaveBeenCalledTimes(1);
  });

  it('rejects forged run company/creator and confirmation actor before changing any rows', async () => {
    const f = await fixture(), foreign = await fixture();
    const transaction = jest.spyOn(mockDatabase, '$transaction');
    await expect(asActor(f, () => service.createPayrollRun({ companyId: foreign.companyId, periodId: foreign.period.id, name: 'Forged company' }, f.actorId))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.createPayrollRun({ companyId: f.companyId, periodId: f.period.id, name: 'Forged actor' }, randomUUID()))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.confirmAttendanceReview(f.period.id, randomUUID()))).rejects.toMatchObject({ statusCode: 403 });
    expect(transaction).not.toHaveBeenCalled(); expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('keeps concurrent company contexts separate across asynchronous scope lookups', async () => {
    const f = await fixture(), other = await fixture(); await scope(f, 'EMPLOYEE_SELF'); await scope(other, 'EMPLOYEE_SELF');
    const results = await Promise.all([detail(f), detail(other), own(f), own(other)]);
    expect(results[0]).toMatchObject({ id: f.slip.id }); expect(results[1]).toMatchObject({ id: other.slip.id });
    expect(results[2]).toMatchObject([{ id: f.slip.id }]); expect(results[3]).toMatchObject([{ id: other.slip.id }]);
  });
});
