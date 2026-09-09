import { randomUUID } from 'node:crypto';
import { DataScopeType, PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { runInRequestContext, RequestUserContext } from '@/shared/context/RequestContext';
import { administrationService } from '@/modules/administration/administration.service';
import { EWAService } from './ewa.service';
import { ewaRepository } from './ewa.repository';
import { logger } from '@/shared/logger/WinstonLogger';

const databaseUrl = process.env.EWA_ACCESS_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;
withDatabase('EWA access and transitions (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [], service = new EWAService();
  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing EWA test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') throw new Error('EWA tests require the isolated local hris_payment_integration database');
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  beforeEach(() => jest.clearAllMocks());
  afterEach(() => jest.restoreAllMocks());
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.earnedWageAccess.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.attendance.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
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
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'EWA scope tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const branch = await mockDatabase.branch.create({ data: { companyId, code: randomUUID(), name: 'Permitted branch' } });
    const department = await mockDatabase.department.create({ data: { companyId, code: randomUUID(), name: 'Permitted department' } });
    const subDepartment = await mockDatabase.subDepartment.create({ data: { companyId, departmentId: department.id, code: randomUUID(), name: 'Permitted team' } });
    const person = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Employee', fullName: 'Synthetic Employee',
      branchId: branch.id, departmentId: department.id, subDepartmentId: subDepartment.id, taxId: 'PRIVATE-TAX', bankAccount: 'PRIVATE-BANK' } });
    const outside = await mockDatabase.employee.create({ data: { companyId, employeeNumber: randomUUID(), firstName: 'Outside', lastName: 'Scope', fullName: 'Outside Scope' } });
    const now = new Date(), periodStart = new Date(now.getFullYear(), now.getMonth(), 1), periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const period = await mockDatabase.payrollPeriod.create({ data: { companyId, code: randomUUID(), name: 'Synthetic period', startDate: periodStart, endDate: periodEnd, payDate: periodEnd } });
    const salary = await mockDatabase.employeeSalary.create({ data: { companyId, employeeId: person.id, baseSalary: '100000', effectiveDate: periodStart } });
    await mockDatabase.attendance.create({ data: { companyId, employeeId: person.id, date: new Date(now.getFullYear(), now.getMonth(), now.getDate()), status: 'PRESENT' } });
    const common = { companyId, payrollPeriodId: period.id, periodStart, periodEnd, earnedGrossReference: '10000', earnedGrossAtRequest: '10000', maxAllowedAtRequest: '5000', amountRequested: '100.25' };
    const own = await mockDatabase.earnedWageAccess.create({ data: { ...common, employeeId: person.id, requestCode: randomUUID(), reason: 'PRIVATE-REASON' } });
    const other = await mockDatabase.earnedWageAccess.create({ data: { ...common, employeeId: outside.id, requestCode: randomUUID(), amountRequested: '200.50' } });
    return { companyId, actorId, branch, department, subDepartment, person, outside, period, salary, own, other, common, periodStart, periodEnd };
  }
  type Fixture = Awaited<ReturnType<typeof fixture>>;
  function asActor<T>(f: Fixture, work: () => T, changes: Partial<RequestUserContext> = {}) {
    return runInRequestContext({ user: { id: f.actorId, email: 'ewa@example.test', companyId: f.companyId, companyScope: [f.companyId], employeeId: f.person.id,
      roles: ['HR_STAFF', 'FINANCE_STAFF'], permissions: ['ewa:read', 'ewa:create', 'ewa:approve', 'ewa:update', 'ewa:disburse'], ...changes } }, work);
  }
  const scope = (f: Fixture, scopeType: DataScopeType, scopeValue?: string, resource = 'ewa') => mockDatabase.roleDataScope.create({ data: {
    companyId: f.companyId, roleCode: 'HR_STAFF', resource, scopeType, scopeValue,
  } });
  const list = (f: Fixture, employeeId?: string) => asActor(f, () => service.findAll(f.companyId, { employeeId }));
  const detail = (f: Fixture, id = f.own.id) => asActor(f, () => service.findById(id));
  const gross = (f: Fixture, employeeId = f.person.id) => asActor(f, () => service.calculateEarnedGrossToDate(f.companyId, employeeId, f.periodStart, f.periodEnd));
  const create = (f: Fixture, amountRequested = 100.25, employeeId = f.person.id) => asActor(f, () => service.createRequest({ employeeId, payrollPeriodId: f.period.id, amountRequested, reason: 'PRIVATE-CREATE-REASON' }));

  it('isolates company reads and privileged users, including explicit active-company switching', async () => {
    const f = await fixture(), foreign = await fixture();
    expect((await list(f)).map(row => row.id).sort()).toEqual([f.own.id, f.other.id].sort());
    await expect(detail(f, foreign.own.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.findById(foreign.own.id), { roles: ['SUPER_ADMIN'] })).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.findAll(foreign.companyId, {}), { companyScope: [f.companyId, foreign.companyId] })).rejects.toMatchObject({ statusCode: 403 });
    const switched = await asActor(f, () => service.findById(foreign.own.id), { roles: ['SUPER_ADMIN'], companyId: foreign.companyId, companyScope: [f.companyId, foreign.companyId] });
    expect(switched.id).toBe(foreign.own.id); expect(Object.keys(switched.employee).sort()).toEqual(['employeeNumber', 'fullName', 'id']);
    expect(await list(f, foreign.person.id)).toEqual([]);
  });

  it.each(['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY', 'EMPLOYEE_SELF'] as const)('applies %s to list/detail, salary calculation, create and transitions', async scopeType => {
    const f = await fixture();
    await scope(f, scopeType, scopeType === 'BRANCH_ONLY' ? f.branch.id : scopeType === 'DEPARTMENT_ONLY' ? f.department.id : scopeType === 'SUB_DEPARTMENT_ONLY' ? f.subDepartment.id : undefined);
    expect((await list(f)).map(row => row.id)).toEqual([f.own.id]); expect(await list(f, f.outside.id)).toEqual([]);
    expect((await detail(f)).id).toBe(f.own.id);
    expect((await gross(f)).baseSalary).toBe(100000);
    const salaryReads = jest.spyOn(mockDatabase.employeeSalary, 'findMany');
    for (const operation of [() => service.findById(f.other.id), () => service.calculateEarnedGrossToDate(f.companyId, f.outside.id, f.periodStart, f.periodEnd),
      () => service.createRequest({ employeeId: f.outside.id, amountRequested: 1 }), () => service.approveRequest(f.other.id, f.actorId, {}),
      () => service.rejectRequest(f.other.id, f.actorId, { rejectReason: 'Denied' }), () => service.cancelRequest(f.other.id, f.actorId),
      () => service.markPaid(f.other.id, f.actorId, { amountPaidOut: 1, disbursementReference: 'BANK' })]) {
      await expect(asActor<Promise<unknown>>(f, operation)).rejects.toMatchObject({ statusCode: 404 });
    }
    expect(salaryReads).not.toHaveBeenCalled();
    expect((await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: f.other.id } })).status).toBe('PENDING');
  });

  it('intersects EWA and payroll scopes instead of broadening access through EWA permissions', async () => {
    const f = await fixture(); await scope(f, 'COMPANY_ONLY'); await scope(f, 'EMPLOYEE_SELF', undefined, 'payroll');
    expect((await list(f)).map(row => row.id)).toEqual([f.own.id]); await expect(detail(f, f.other.id)).rejects.toMatchObject({ statusCode: 404 });
    await mockDatabase.roleDataScope.updateMany({ where: { companyId: f.companyId, resource: 'ewa' }, data: { scopeType: 'BRANCH_ONLY', scopeValue: f.branch.id } });
    await mockDatabase.employee.update({ where: { id: f.person.id }, data: { branchId: null } });
    expect(await list(f)).toEqual([]);
    await expect(gross(f)).rejects.toMatchObject({ statusCode: 404 });
  });

  it.each(['EMPLOYEE', 'CUSTOM_ROLE'])('restricts %s to self even without configured scope and rejects on-behalf creation', async role => {
    const f = await fixture(), actor = { roles: [role] };
    expect((await asActor(f, () => service.findAll(f.companyId, {}), actor)).map(row => row.id)).toEqual([f.own.id]);
    expect(await asActor(f, () => service.findAll(f.companyId, { employeeId: f.outside.id }), actor)).toEqual([]);
    await expect(asActor(f, () => service.findById(f.other.id), actor)).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.createRequest({ employeeId: f.outside.id, amountRequested: 1 }), actor)).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.findAll(f.companyId, {}), { ...actor, employeeId: undefined })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('enforces self identity for history and limits, including finance-only on-behalf creation', async () => {
    const f = await fixture();
    expect((await asActor(f, () => service.findMyRequests(f.person.id))).map(row => row.id)).toEqual([f.own.id]);
    const limit = await asActor(f, () => service.getMyLimitServer(f.companyId, f.person.id));
    expect(limit.breakdown.baseSalary).toBe(100000); expect(limit.totalReserved).toBe(100.25);
    await expect(asActor(f, () => service.findMyRequests(f.outside.id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.getMyLimitServer(f.companyId, f.outside.id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.createRequest({ employeeId: f.outside.id, amountRequested: 1 }), { roles: ['FINANCE_STAFF'] })).rejects.toMatchObject({ statusCode: 403 });
  });

  it('excludes deleted employees and malformed foreign employee/period/run parents before reads or mutations', async () => {
    const f = await fixture(), foreign = await fixture();
    const run = await mockDatabase.payrollRun.create({ data: { companyId: foreign.companyId, periodId: foreign.period.id, name: 'Foreign', runNumber: 1 } });
    for (const overrides of [{ employeeId: foreign.person.id }, { payrollPeriodId: foreign.period.id }, { payrollRunId: run.id }]) {
      const malformed = await mockDatabase.earnedWageAccess.create({ data: { ...f.common, employeeId: f.person.id, requestCode: randomUUID(), ...overrides } });
      await expect(detail(f, malformed.id)).rejects.toMatchObject({ statusCode: 404 });
      await expect(asActor(f, () => service.cancelRequest(malformed.id, f.actorId))).rejects.toMatchObject({ statusCode: 404 });
    }
    expect((await list(f)).map(row => row.id).sort()).toEqual([f.own.id, f.other.id].sort());
    await mockDatabase.employee.update({ where: { id: f.outside.id }, data: { deletedAt: new Date() } });
    await expect(detail(f, f.other.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(create(f, 1, f.outside.id)).rejects.toMatchObject({ statusCode: 404 });
    await mockDatabase.payrollPeriod.update({ where: { id: f.period.id }, data: { deletedAt: new Date() } });
    expect(await list(f)).toEqual([]);
    await expect(create(f)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rejects foreign employees/periods before salary lookup and fails closed for missing context or failed scope resolution', async () => {
    const f = await fixture(), foreign = await fixture();
    const salaryReads = jest.spyOn(mockDatabase.employeeSalary, 'findMany'), queries = jest.spyOn(mockDatabase.earnedWageAccess, 'findMany');
    await expect(create(f, 1, foreign.person.id)).rejects.toMatchObject({ statusCode: 404 });
    await expect(asActor(f, () => service.createRequest({ employeeId: f.person.id, payrollPeriodId: foreign.period.id, amountRequested: 1 }))).rejects.toMatchObject({ statusCode: 404 });
    await expect(runInRequestContext({}, () => service.findById(f.own.id))).rejects.toMatchObject({ statusCode: 403 });
    await expect(runInRequestContext({}, () => service.createRequest({ amountRequested: 1 }))).rejects.toMatchObject({ statusCode: 403 });
    await scope(f, 'MANAGER_TEAM'); await expect(list(f)).rejects.toMatchObject({ statusCode: 403 });
    jest.spyOn(administrationService, 'findMyDataScopeByUser').mockRejectedValue(new Error('Injected scope failure'));
    await expect(list(f)).rejects.toThrow('Injected scope failure'); await expect(gross(f)).rejects.toThrow('Injected scope failure');
    expect(salaryReads).not.toHaveBeenCalled(); expect(queries).not.toHaveBeenCalled();
  });

  it('does not fall back to inactive salary and rejects ambiguous, non-IDR or invalid active allocations', async () => {
    const f = await fixture();
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { isActive: false } });
    expect((await gross(f)).baseSalary).toBe(0); await expect(create(f)).rejects.toMatchObject({ statusCode: 400 });
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { isActive: true, currency: 'USD' } });
    await expect(gross(f)).rejects.toMatchObject({ statusCode: 422 });
    await mockDatabase.employeeSalary.update({ where: { id: f.salary.id }, data: { currency: 'IDR', baseSalary: '-1' } });
    await expect(gross(f)).rejects.toMatchObject({ statusCode: 422 });
    await mockDatabase.employeeSalary.create({ data: { companyId: f.companyId, employeeId: f.person.id, baseSalary: '100000', effectiveDate: f.periodStart } });
    await expect(gross(f)).rejects.toMatchObject({ statusCode: 409 });
    expect(await mockDatabase.earnedWageAccess.count({ where: { companyId: f.companyId } })).toBe(2);
  });

  it('creates a valid scoped reservation and logs identities without salary, requested amounts or private notes', async () => {
    const f = await fixture(); await scope(f, 'BRANCH_ONLY', f.branch.id);
    const created = await create(f);
    expect(created).toMatchObject({ companyId: f.companyId, employeeId: f.person.id, status: 'PENDING' });
    expect(created.amountRequested.toString()).toBe('100.25'); expect(created.totalApprovedSamePeriod.toString()).toBe('100.25');
    expect(created.earnedGrossAtRequest.toNumber()).toBeCloseTo(100000 / 22, 2);
    expect(logger.info).toHaveBeenCalledWith(expect.any(String), { ewaId: created.id, requestCode: created.requestCode, employeeId: f.person.id });
    const logged = JSON.stringify(jest.mocked(logger.info).mock.calls);
    for (const secret of ['100000', '100.25', 'PRIVATE-CREATE-REASON', 'baseSalary', 'earnedGrossCalcBreakdown']) expect(logged).not.toContain(secret);
  });

  it('serializes overlapping requests through commit so concurrent reservations cannot exceed the same limit', async () => {
    const f = await fixture();
    const result = await Promise.allSettled([create(f, 1500), create(f, 1500)]);
    expect(result.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(result.filter(row => row.status === 'rejected')).toHaveLength(1);
    const reserved = await mockDatabase.earnedWageAccess.findMany({ where: { employeeId: f.person.id } });
    expect(reserved.reduce((sum, row) => sum + row.amountRequested.toNumber(), 0)).toBe(1600.25);
  });

  it('retains role checks, owner self-approval rejection and authenticated actor matching', async () => {
    const f = await fixture();
    await expect(asActor(f, () => service.approveRequest(f.own.id, randomUUID(), {}))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.cancelRequest(f.own.id, ''))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.approveRequest(f.own.id, f.actorId, {}))).rejects.toMatchObject({ statusCode: 403 });
    await expect(asActor(f, () => service.rejectRequest(f.own.id, f.actorId, { rejectReason: 'No' }))).rejects.toMatchObject({ statusCode: 422 });
    await expect(asActor(f, () => service.approveRequest(f.own.id, f.actorId, {}), { roles: ['FINANCE_STAFF'], employeeId: f.outside.id })).rejects.toMatchObject({ statusCode: 403 });
    const approved = await asActor(f, () => service.approveRequest(f.own.id, f.actorId, {}), { employeeId: f.outside.id });
    expect(approved).toMatchObject({ status: 'APPROVED', approverId: f.actorId });
    await expect(asActor(f, () => service.markPaid(f.own.id, f.actorId, { amountPaidOut: 100.25, disbursementReference: 'BANK-REF' }), { roles: ['HR_STAFF'], employeeId: f.outside.id })).rejects.toMatchObject({ statusCode: 403 });
  });

  async function simultaneousReads() {
    const original = ewaRepository.findById.bind(ewaRepository);
    let count = 0, release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    jest.spyOn(ewaRepository, 'findById').mockImplementation(async (...args) => {
      const row = await original(...args);
      count++; if (count === 2) release();
      await gate;
      return row;
    });
  }

  it('allows only one winner when approval races with cancellation after both read PENDING', async () => {
    const f = await fixture(); await simultaneousReads();
    const result = await Promise.allSettled([
      asActor(f, () => service.approveRequest(f.own.id, f.actorId, {}), { employeeId: f.outside.id }),
      asActor(f, () => service.cancelRequest(f.own.id, f.actorId)),
    ]);
    expect(result.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(result.find(row => row.status === 'rejected')).toMatchObject({ status: 'rejected', reason: { statusCode: 409 } });
    const stored = await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: f.own.id } });
    expect(['APPROVED', 'CANCELLED']).toContain(stored.status);
    expect(stored.status === 'APPROVED' ? stored.cancelledBy : stored.approverId).toBeNull();
  });

  it('keeps the first committed payout when duplicate payment recordings race', async () => {
    const f = await fixture(); await mockDatabase.earnedWageAccess.update({ where: { id: f.own.id }, data: { status: 'APPROVED' } });
    await simultaneousReads();
    const result = await Promise.allSettled(['FIRST', 'SECOND'].map(reference => asActor(f, () => service.markPaid(f.own.id, f.actorId, { amountPaidOut: 100.25, disbursementReference: reference }))));
    expect(result.filter(row => row.status === 'fulfilled')).toHaveLength(1);
    expect(result.find(row => row.status === 'rejected')).toMatchObject({ status: 'rejected', reason: { statusCode: 409 } });
    const winner = result.find(row => row.status === 'fulfilled');
    const stored = await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: f.own.id } });
    expect(winner?.status === 'fulfilled' && winner.value.disbursementReference).toBe(stored.disbursementReference);
    expect(stored.status).toBe('PAID');
    expect(logger.info).toHaveBeenCalledWith('EWA request marked PAID', { ewaId: f.own.id, disburserId: f.actorId });
  });

  it('rechecks employee access in the conditional mutation when assignment changes after the initial read', async () => {
    const f = await fixture(); await scope(f, 'BRANCH_ONLY', f.branch.id);
    const original = ewaRepository.findById.bind(ewaRepository);
    jest.spyOn(ewaRepository, 'findById').mockImplementationOnce(async (...args) => {
      const row = await original(...args);
      await mockDatabase.employee.update({ where: { id: f.person.id }, data: { branchId: null } });
      return row;
    });
    await expect(asActor(f, () => service.approveRequest(f.own.id, f.actorId, {}), { employeeId: f.outside.id })).rejects.toMatchObject({ statusCode: 409 });
    expect((await mockDatabase.earnedWageAccess.findUniqueOrThrow({ where: { id: f.own.id } })).status).toBe('PENDING');
  });
});
