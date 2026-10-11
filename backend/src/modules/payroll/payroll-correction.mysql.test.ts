import { randomUUID } from 'node:crypto';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { PrismaClient } from '@prisma/client';

let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));

import { PayrollService } from './payroll.service';
import { payrollCorrectionService } from './payroll-correction.service';

const databaseUrl = process.env.PAYROLL_CALCULATION_DB_URL;
const withDatabase = databaseUrl ? describe : describe.skip;

/**
 * The whole correction path against real MySQL (GAP-14/21b): a paid payslip
 * gains a registered correction, a CORRECTION run pays it, and the row ends
 * APPLIED with its trace columns — or stays PENDING for the part no earning
 * could recover. Approve/disburse after COMPLETED take the ordinary
 * maker-checker path shared by every run type and are covered by the existing
 * run-access suites.
 */
withDatabase('payroll correction run (isolated real MySQL)', () => {
  const companies: string[] = [], groups: string[] = [];
  const service = new PayrollService();

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Missing payroll test database URL');
    const url = new URL(databaseUrl);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Payroll correction tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await mockDatabase.$connect();
  });
  beforeEach(() => jest.clearAllMocks());
  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.payrollCorrection.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.employeeSalaryComponent.deleteMany({ where: { employeeSalary: { companyId } } });
      await mockDatabase.employeeSalary.deleteMany({ where: { companyId } });
      await mockDatabase.salaryComponent.deleteMany({ where: { companyId } });
      await mockDatabase.workCalendar.deleteMany({ where: { companyId } });
      await mockDatabase.companySetting.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally { await mockDatabase.$disconnect(); }
  });

  async function fixture() {
    const companyId = randomUUID(), groupId = randomUUID(), maker = randomUUID();
    companies.push(companyId); groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Correction run tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    await mockDatabase.companySetting.createMany({ data: [
      { companyId, key: 'late_deduction_enabled', value: 'false' },
      { companyId, key: 'absence_deduction_daily_basic_percent', value: '0' },
    ] });
    await mockDatabase.workCalendar.create({ data: { companyId, year: 2026, name: 'Synthetic calendar', createdBy: maker, workDays: {},
      days: { create: [{ date: new Date('2026-10-01'), dayType: 'WD' }, { date: new Date('2026-10-02'), dayType: 'WD' }] } } });
    const component = await mockDatabase.salaryComponent.create({ data: { companyId, code: 'BASE', name: 'Salary', type: 'ALLOWANCE', amount: '1000', isTaxable: true } });
    await mockDatabase.salaryComponent.create({ data: { companyId, code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', amount: '0', isTaxable: false } });
    const period = await createPeriod(companyId, '2026-10-01');
    return { companyId, maker, component, period };
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
  const asUser = <T,>(f: Awaited<ReturnType<typeof fixture>>, work: () => Promise<T>) =>
    runInRequestContext({ user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } }, work);
  const createRun = (f: Awaited<ReturnType<typeof fixture>>, periodId: string, runType?: 'CORRECTION') =>
    asUser(f, () => service.createPayrollRun({ companyId: f.companyId, periodId, name: `Synthetic ${runType ?? 'payroll'}`, ...(runType ? { runType } : {}) }, f.maker));

  /** A REGULAR run whose money already left: run APPROVED, payslip FINAL. */
  async function paidRegularRun(f: Awaited<ReturnType<typeof fixture>>, employeeId: string) {
    const regular = await createRun(f, f.period.id);
    await mockDatabase.payrollRun.update({ where: { id: regular.id }, data: { status: 'APPROVED' } });
    await mockDatabase.payslip.updateMany({ where: { payrollRunId: regular.id }, data: { status: 'FINAL' } });
    return mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: regular.id, employeeId } });
  }

  it('register → CORRECTION run: pays the delta, closes the row with its trace, totals add up', async () => {
    const f = await fixture();
    const { person } = await employee(f);
    const paidSlip = await paidRegularRun(f, person.id);

    const registered = await asUser(f, () => payrollCorrectionService.register(f.companyId, {
      sourcePayslipId: paidSlip.id, amount: 250, reason: 'Lembur Oktober tidak terbayar',
    }));
    expect(registered.status).toBe('PENDING');
    expect(registered.remainingAmount.toString()).toBe(registered.amount.toString());

    const november = await createPeriod(f.companyId, '2026-11-01');
    const correctionRun = await createRun(f, november.id, 'CORRECTION');
    expect(correctionRun.status).toBe('COMPLETED');
    expect(correctionRun.payslips).toHaveLength(1);

    const slip = correctionRun.payslips[0];
    expect(Number(slip.totalEarnings)).toBe(250);
    expect(Number(slip.netPay)).toBe(Number(slip.totalEarnings) - Number(slip.totalDeductions));
    // Not a month of work.
    expect(slip.workDays).toBe(0);

    const components = await mockDatabase.payslipComponent.findMany({
      where: { payslipId: slip.id }, include: { salaryComponent: true },
    });
    const earning = components.find((row) => row.type === 'ALLOWANCE');
    expect(earning?.salaryComponent.code).toBe('CORRECTION_EARNING_AUTO');
    expect(earning?.amount.toString()).toBe('250');

    const applied = await mockDatabase.payrollCorrection.findUniqueOrThrow({ where: { id: registered.id } });
    expect(applied.status).toBe('APPLIED');
    expect(applied.remainingAmount.toString()).toBe('0');
    expect(applied.payslipId).toBe(slip.id);
    expect(applied.appliedRunId).toBe(correctionRun.id);
    expect(applied.appliedAt).not.toBeNull();

    // The source payslip is reachable from the row, so the audit can walk
    // corrected ← correction in one join.
    expect(applied.sourcePayslipId).toBe(paidSlip.id);
  });

  it('an overpayment beyond the earning nets to zero and leaves the remainder PENDING', async () => {
    const f = await fixture();
    const { person } = await employee(f);
    const paidSlip = await paidRegularRun(f, person.id);

    const plus = await asUser(f, () => payrollCorrectionService.register(f.companyId, {
      sourcePayslipId: paidSlip.id, amount: 100, reason: 'Kurang bayar tunjangan Oktober',
    }));
    // The register endpoint allows one PENDING row per payslip, so the second
    // open row is fabricated directly: what is under test here is the ENGINE's
    // netting over whatever PENDING rows exist, not the registration guard
    // (that one is covered in payroll-correction.service.test.ts).
    const minusSame = await mockDatabase.payrollCorrection.create({ data: {
      companyId: f.companyId, employeeId: person.id, sourcePayslipId: paidSlip.id,
      amount: '-500', remainingAmount: '-500', reason: 'Transport dobel pada slip Oktober',
    } });

    const november = await createPeriod(f.companyId, '2026-11-01');
    const correctionRun = await createRun(f, november.id, 'CORRECTION');

    const slip = correctionRun.payslips.find((row) => row.employeeId === person.id);
    expect(slip).toBeDefined();
    // Earning 100 is tiny, so its PPh 21 is 0: the recoverable room is 100 of
    // the 500 owed, and the net floors at zero instead of billing the employee.
    expect(Number(slip?.netPay)).toBe(0);

    const closed = await mockDatabase.payrollCorrection.findUniqueOrThrow({ where: { id: plus.id } });
    expect(closed.status).toBe('APPLIED');
    const leftover = await mockDatabase.payrollCorrection.findUniqueOrThrow({ where: { id: minusSame.id } });
    expect(leftover.status).toBe('PENDING');
    expect(Number(leftover.remainingAmount)).toBe(-400);
  });
});
