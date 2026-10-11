import { randomUUID } from 'node:crypto';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { PrismaClient } from '@prisma/client';

let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));

import { PayrollService } from './payroll.service';
import { payrollSeveranceService } from './payroll-severance.service';

const databaseUrl = process.env.PAYROLL_CALCULATION_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;

/**
 * The severance path against real MySQL (GAP-42): an approved termination gets
 * its figures frozen at registration (UU 13/2003 factors, PP 68/2009 final
 * tax), and a SEVERANCE run pays exactly those figures — recomputing nothing.
 */
withDatabase('severance payment run (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [];
  const service = new PayrollService();

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing payroll test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Severance run tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.severancePayment.deleteMany({ where: { companyId } });
      await mockDatabase.exitClearance.deleteMany({ where: { resignation: { companyId } } });
      await mockDatabase.resignation.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });

  it('register (TERMINATION) → SEVERANCE run: pays the frozen figures with their trace', async () => {
    const companyId = randomUUID(), groupId = randomUUID(), maker = randomUUID();
    companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Severance run tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const person = await mockDatabase.employee.create({ data: {
      companyId, employeeNumber: randomUUID(), firstName: 'Synthetic', lastName: 'Leaver', fullName: 'Synthetic Leaver',
      joinDate: new Date('2020-01-01'),
    } });
    await mockDatabase.employeeSalary.create({ data: {
      companyId, employeeId: person.id, baseSalary: '4000000', effectiveDate: new Date('2026-01-01'), isActive: true,
    } });
    const resignation = await mockDatabase.resignation.create({ data: {
      companyId, employeeId: person.id, resignDate: new Date('2026-09-01'), lastWorkingDate: new Date('2026-10-31'),
      status: 'APPROVED',
    } });

    const asUser = <T,>(work: () => Promise<T>) => runInRequestContext(
      { user: { id: maker, email: 'payroll@example.test', companyId, companyScope: [companyId] } }, work);

    const registered = await asUser(() => payrollSeveranceService.register(companyId, {
      resignationId: resignation.id, reason: 'TERMINATION',
    } as never));
    expect(registered.status).toBe('PENDING');
    expect(Number(registered.grossAmount)).toBeGreaterThan(0);
    expect(Number(registered.netAmount)).toBe(Number(registered.grossAmount) - Number(registered.taxAmount));

    const period = await mockDatabase.payrollPeriod.create({ data: {
      companyId, code: randomUUID(), name: 'Synthetic period', startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-28'), payDate: new Date('2026-11-28'), attendanceReviewedAt: new Date(),
    } });
    const run = await asUser(() => service.createPayrollRun(
      { companyId, periodId: period.id, name: 'Synthetic severance', runType: 'SEVERANCE' }, maker));

    expect(run.status).toBe('COMPLETED');
    expect(run.payslips).toHaveLength(1);
    const slip = run.payslips[0];
    expect(slip.totalEarnings.toString()).toBe(registered.grossAmount.toString());
    expect(slip.totalDeductions.toString()).toBe(registered.taxAmount.toString());
    expect(slip.netPay.toString()).toBe(registered.netAmount.toString());
    expect(slip.workDays).toBe(0);

    const components = await mockDatabase.payslipComponent.findMany({
      where: { payslipId: slip.id }, include: { salaryComponent: true },
    });
    const earning = components.find((row) => row.type === 'ALLOWANCE');
    expect(earning?.salaryComponent.code).toBe('SEVERANCE_EARNING_AUTO');
    // Final-taxed: never part of a monthly PPh 21 base again.
    expect(earning?.isTaxable).toBe(false);

    const applied = await mockDatabase.severancePayment.findUniqueOrThrow({ where: { id: registered.id } });
    expect(applied.status).toBe('APPLIED');
    expect(applied.payslipId).toBe(slip.id);
    expect(applied.appliedRunId).toBe(run.id);
    expect(applied.appliedAt).not.toBeNull();

    // A second SEVERANCE run finds nothing: the row is claimed.
    const nextPeriod = await mockDatabase.payrollPeriod.create({ data: {
      companyId, code: randomUUID(), name: 'Synthetic period', startDate: new Date('2026-12-01'),
      endDate: new Date('2026-12-28'), payDate: new Date('2026-12-28'), attendanceReviewedAt: new Date(),
    } });
    await expect(asUser(() => service.createPayrollRun(
      { companyId, periodId: nextPeriod.id, name: 'Synthetic severance 2', runType: 'SEVERANCE' }, maker)))
      .rejects.toThrow(/No pending severance payments/);

    // Void returns the claim: the payment is PENDING again (not stranded as
    // APPLIED pointing at a voided run) and the next run can pay it.
    await asUser(() => service.voidPayrollRun(run.id, maker));
    const reverted = await mockDatabase.severancePayment.findUniqueOrThrow({ where: { id: registered.id } });
    expect(reverted.status).toBe('PENDING');
    expect(reverted.appliedRunId).toBeNull();
    expect(reverted.payslipId).toBeNull();

    const retryRun = await asUser(() => service.createPayrollRun(
      { companyId, periodId: nextPeriod.id, name: 'Synthetic severance retry', runType: 'SEVERANCE' }, maker));
    expect(retryRun.payslips).toHaveLength(1);
    const reApplied = await mockDatabase.severancePayment.findUniqueOrThrow({ where: { id: registered.id } });
    expect(reApplied.status).toBe('APPLIED');
    expect(reApplied.appliedRunId).toBe(retryRun.id);
  });
});
