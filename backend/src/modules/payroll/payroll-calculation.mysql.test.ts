import { randomUUID } from 'node:crypto';
import { runInRequestContext } from '@/shared/context/RequestContext';
import { Prisma, PrismaClient } from '@prisma/client';
let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({ __esModule: true, get prisma() { return mockDatabase; }, get default() { return mockDatabase; } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn() } }));
import { PayrollService } from './payroll.service';
import { payrollArrearsService } from './payroll-arrears.service';
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
      await mockDatabase.payrollArrears.deleteMany({ where: { companyId } });
      await mockDatabase.payrollLoanDeductionSnapshot.deleteMany({ where: { companyId } });
      await mockDatabase.earnedWageAccess.deleteMany({ where: { companyId } });
      await mockDatabase.payslipComponent.deleteMany({ where: { payslip: { companyId } } });
      await mockDatabase.payslip.deleteMany({ where: { companyId } });
      await mockDatabase.payrollRun.deleteMany({ where: { companyId } });
      await mockDatabase.payrollPeriod.deleteMany({ where: { companyId } });
      await mockDatabase.resignation.deleteMany({ where: { companyId } });
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
  const run = (f: Awaited<ReturnType<typeof fixture>>, periodId = f.period.id) => runInRequestContext({ user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } },
    () => service.createPayrollRun({ companyId: f.companyId, periodId, name: 'Synthetic payroll' }, f.maker));
  const runOfType = (f: Awaited<ReturnType<typeof fixture>>, runType: 'THR' | 'SEVERANCE' | 'CORRECTION', thrReferenceDate?: string) =>
    runInRequestContext({ user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } },
      () => service.createPayrollRun({ companyId: f.companyId, periodId: f.period.id, name: `Synthetic ${runType}`, runType, thrReferenceDate }, f.maker));
  async function expectNoPayroll(f: Awaited<ReturnType<typeof fixture>>) {
    for (const count of [await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payslip.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payrollFormulaCalculation.count({ where: { companyId: f.companyId } }),
      await mockDatabase.payrollLoanDeductionSnapshot.count({ where: { companyId: f.companyId } })]) expect(count).toBe(0);
    expect(await mockDatabase.salaryComponent.count({ where: { companyId: f.companyId } })).toBe(1);
    expect(eventBus.publish).not.toHaveBeenCalled();
  }
  it.each(['SEVERANCE', 'CORRECTION'] as const)(
    'refuses to calculate a %s run instead of paying a second month of salary', async runType => {
      // The period's REGULAR run already exists and carries the month's pay.
      // One run per period PER TYPE means this second run is created
      // legitimately — it is the calculation that must refuse. It read no
      // runType at all before this guard, so any of these recalculated a full
      // month of salary: a second complete set of payslips for a period
      // already paid, separately approvable and separately disbursable.
      //
      // THR used to be in this list and is now calculated properly; severance
      // is computed and taxed on the exit path instead of as a run, and a
      // correction run would need to know which period it corrects.
      const f = await fixture(); await employee(f);
      const regular = await run(f);
      expect(regular.payslips).toHaveLength(1);
      await expect(runOfType(f, runType)).rejects.toThrow(
        new RegExp(`A ${runType} payroll run cannot be calculated`));
      // The refusal rolls the second run back whole: no extra slip, no extra run.
      expect(await mockDatabase.payslip.count({ where: { companyId: f.companyId } })).toBe(1);
      expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(1);
    });

  it('pays a THR run one month of upah with its PPh 21, not a second salary', async () => {
    const f = await fixture();
    // Two years of service at 1000 base: a full, unprorated THR.
    const person = await employee(f);
    await mockDatabase.employee.update({
      where: { id: person.person.id }, data: { joinDate: new Date('2024-01-01') },
    });
    await mockDatabase.salaryComponent.create({ data: {
      companyId: f.companyId, code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', amount: '0', isTaxable: false,
    } });

    const regular = await run(f);
    expect(regular.payslips).toHaveLength(1);

    const thr = await runOfType(f, 'THR');
    expect(thr.status).toBe('COMPLETED');
    expect(thr.payslips).toHaveLength(1);
    const slip = thr.payslips[0];

    // One month of upah, which here is base salary alone: the BASE component
    // is not flagged as a fixed allowance, so it does not join "upah sebulan".
    expect(Number(slip.totalEarnings)).toBe(1000);
    expect(Number(slip.netPay)).toBe(Number(slip.totalEarnings) - Number(slip.totalDeductions));
    // A THR slip has no attendance: it is not a month of work.
    expect(slip.workDays).toBe(0);
    expect(slip.presentDays).toBe(0);

    // Exactly two components: the THR and its tax. No BPJS, no loan, no
    // overtime, and — the point — the earning is the THR component, not the
    // salary allocation's own component repeated under a new run.
    //
    // This used to assert `netPay !== monthlyNetPay`, which passed for the
    // wrong reason and then failed for one: with a 1000 base, no deductions
    // configured and a THR under the PTKP threshold, both nets are 1000. The
    // coincidence said nothing either way, so the component identity is
    // asserted instead.
    const components = await mockDatabase.payslipComponent.findMany({
      where: { payslipId: slip.id }, include: { salaryComponent: true },
    });
    expect(components).toHaveLength(2);
    const earning = components.find((row) => row.type === 'ALLOWANCE');
    const deduction = components.find((row) => row.type === 'DEDUCTION');
    expect(earning?.salaryComponent.code).toBe('THR_EARNING_AUTO');
    expect(earning?.salaryComponent.code).not.toBe(f.component.code);
    expect(deduction?.salaryComponent.code).toBe('PPH21');
    // The working is frozen with the payment.
    expect((slip.employeeSnapshot as { thr?: { tenureMonths?: number } })?.thr?.tenureMonths)
      .toBeGreaterThanOrEqual(12);
  });

  it('refuses a THR run with no PPH21 component rather than paying it gross', async () => {
    const f = await fixture();
    const person = await employee(f);
    await mockDatabase.employee.update({
      where: { id: person.person.id }, data: { joinDate: new Date('2024-01-01') },
    });
    // No PPH21 component exists, so the withholding has nowhere to be recorded.
    await expect(runOfType(f, 'THR')).rejects.toThrow(/No PPH21 salary component/);
    expect(await mockDatabase.payslip.count({ where: { companyId: f.companyId } })).toBe(0);
  });

  it('skips an employee with under a month of service instead of paying nothing visibly', async () => {
    const f = await fixture();
    const person = await employee(f);
    await mockDatabase.employee.update({
      where: { id: person.person.id }, data: { joinDate: new Date('2026-10-20') },
    });
    await mockDatabase.salaryComponent.create({ data: {
      companyId: f.companyId, code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', amount: '0', isTaxable: false,
    } });
    const thr = await runOfType(f, 'THR');
    // A payslip for nothing would appear in every report as if it were paid.
    expect(thr.payslips).toHaveLength(0);
    expect(Number(thr.totalEarnings)).toBe(0);
  });

  /**
   * P-C3. The THR loop used to pay every salary row it loaded: it checked the
   * join date and the tenure fraction and nothing else — not the employee's
   * status, not `employmentStatus`, not an approved resignation. Somebody who
   * had left months earlier was paid a full THR, and the only date the run
   * had was the period end, which is not when the holiday falls.
   *
   * Permenaker 6/2016 Art. 2-3: THR is owed to whoever is in an employment
   * relationship on the holiday, plus PKWTT (permanent) staff whose
   * relationship ended within 30 days before it. PKWT (fixed-term) staff whose
   * term has ended are owed nothing, however recently it ended.
   */
  describe('THR eligibility on the holiday date (Permenaker 6/2016)', () => {
    // The fixture period runs 2026-10-01 → 2026-10-28, so the holiday sits
    // inside it and the 20/40-day cases below land on real calendar dates.
    const HOLIDAY = '2026-10-21T00:00:00.000Z';

    async function thrFixture() {
      const f = await fixture();
      await mockDatabase.salaryComponent.create({ data: {
        companyId: f.companyId, code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', amount: '0', isTaxable: false,
      } });
      return f;
    }

    /** Two years of service at 1000 base: a full, unprorated THR if owed. */
    async function veteran(
      f: Awaited<ReturnType<typeof fixture>>,
      overrides: { employmentType?: 'PERMANENT' | 'CONTRACT'; employmentStatus?: 'ACTIVE' | 'RESIGNED' | 'CONTRACT_END'; status?: 'ACTIVE' | 'INACTIVE'; joinDate?: Date } = {},
    ) {
      const person = await employee(f);
      await mockDatabase.employee.update({
        where: { id: person.person.id }, data: { joinDate: new Date('2024-01-01'), ...overrides },
      });
      return person.person;
    }

    async function resign(f: Awaited<ReturnType<typeof fixture>>, employeeId: string, lastWorkingDate: string) {
      return mockDatabase.resignation.create({ data: {
        companyId: f.companyId, employeeId, resignDate: new Date('2026-08-01'),
        lastWorkingDate: new Date(lastWorkingDate), status: 'APPROVED',
      } });
    }

    it('pays an employee still in an employment relationship on the holiday', async () => {
      const f = await thrFixture();
      const person = await veteran(f);

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.payslips).toHaveLength(1);
      expect(thr.payslips[0].employeeId).toBe(person.id);
      expect(Number(thr.payslips[0].totalEarnings)).toBe(1000);
    });

    it('pays a PKWTT whose employment ended 20 days before the holiday', async () => {
      const f = await thrFixture();
      // 2026-10-01 is 20 days before 2026-10-21: inside the 30-day window, so
      // the THR is still owed even though the person has left.
      const person = await veteran(f, { employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE' });
      await resign(f, person.id, '2026-10-01');

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.payslips).toHaveLength(1);
      expect(thr.payslips[0].employeeId).toBe(person.id);
    });

    it('skips a PKWTT whose employment ended 40 days before the holiday', async () => {
      const f = await thrFixture();
      // 2026-09-11 is 40 days before 2026-10-21: past the 30-day window.
      const person = await veteran(f, { employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE' });
      await resign(f, person.id, '2026-09-11');

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.payslips).toHaveLength(0);
      expect(Number(thr.totalEarnings)).toBe(0);
    });

    it('skips a PKWT whose fixed term had ended, inside the 30 days or not', async () => {
      const f = await thrFixture();
      // Same 20-day gap that earns a PKWTT its THR. The grace window is a
      // PKWTT rule only, so this one is owed nothing.
      const resigned = await veteran(f, { employmentType: 'CONTRACT', employmentStatus: 'RESIGNED', status: 'INACTIVE' });
      await resign(f, resigned.id, '2026-10-01');
      // And a contract that simply ran out, which leaves no resignation row at
      // all — only `employmentStatus`.
      await veteran(f, { employmentType: 'CONTRACT', employmentStatus: 'CONTRACT_END', status: 'INACTIVE' });

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.payslips).toHaveLength(0);
      expect(Number(thr.totalEarnings)).toBe(0);
    });

    it('does not let a leaver with no join date block the THR of everybody else', async () => {
      const f = await thrFixture();
      const entitled = await veteran(f);
      // Left years ago and never had a join date filled in. Tenure is only
      // needed to decide HOW MUCH, so refusing the whole run over a row that
      // is not being paid would hold up everyone else's THR for nothing.
      const departed = await employee(f);
      await mockDatabase.employee.update({
        where: { id: departed.person.id },
        data: { employmentType: 'CONTRACT', employmentStatus: 'CONTRACT_END', status: 'INACTIVE' },
      });

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.payslips).toHaveLength(1);
      expect(thr.payslips[0].employeeId).toBe(entitled.id);
    });

    it('refuses a holiday date in a different year from the period', async () => {
      const f = await thrFixture();
      await veteran(f);
      // Satu digit salah ketik. Tidak ada angka yang gagal karenanya: masa
      // kerja semua orang bergeser setahun penuh dan policy snapshot membeku
      // ke tabel pajak tahun yang salah, lalu run-nya tetap bisa dicairkan.
      await expect(runOfType(f, 'THR', '2027-10-21T00:00:00.000Z')).rejects.toThrow(
        /berada di tahun 2027, sedangkan periode payroll ini berakhir di tahun 2026/);
      // Ditolak sebelum baris run-nya ada, jadi slotnya tetap bebas.
      expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(0);
      expect(await mockDatabase.payslip.count({ where: { companyId: f.companyId } })).toBe(0);
      expect(eventBus.publish).not.toHaveBeenCalled();
    });

    it('allows a holiday outside the period as long as the year matches', async () => {
      const f = await thrFixture();
      const person = await veteran(f);
      // Periode fixture berakhir 2026-10-28; 2026-12-25 ada di luar periode
      // tapi masih di tahunnya. Inilah kasus yang kolom ini ada untuk
      // melayani — periode Maret dengan hari raya awal April — jadi ia tidak
      // boleh ikut tertolak oleh gerbang tahun.
      const thr = await runOfType(f, 'THR', '2026-12-25T00:00:00.000Z');
      expect(thr.payslips).toHaveLength(1);
      expect(thr.payslips[0].employeeId).toBe(person.id);
      expect(thr.thrReferenceDate?.toISOString()).toBe('2026-12-25T00:00:00.000Z');
    });

    it('stores the holiday as a calendar day, so a time of day cannot shift the grace window', async () => {
      const f = await thrFixture();
      // 30 hari sebelum 2026-10-21 adalah 2026-09-21: tepat di batas, jadi
      // pergeseran sehari ke arah mana pun akan terlihat.
      const person = await veteran(f, { employmentType: 'PERMANENT', employmentStatus: 'RESIGNED', status: 'INACTIVE' });
      await resign(f, person.id, '2026-09-21');

      const thr = await runOfType(f, 'THR', '2026-10-21T17:00:00.000Z');
      expect(thr.thrReferenceDate?.toISOString()).toBe('2026-10-21T00:00:00.000Z');
      expect(thr.payslips).toHaveLength(1);
      expect(thr.payslips[0].employeeId).toBe(person.id);
    });

    it('still refuses to guess tenure for somebody who IS entitled', async () => {
      const f = await thrFixture();
      // Arah kerasnya: gerbang kelayakan dipasang lebih dulu supaya orang yang
      // TIDAK dibayar tidak menggagalkan run. Orang yang berhak tapi tanggal
      // masuknya kosong tetap harus menghentikannya — jumlah THR-nya tidak
      // bisa ditebak, dan diam-diam membayar nol lebih buruk daripada menolak.
      await employee(f); // joinDate tetap null, status ACTIVE, PERMANENT
      await expect(runOfType(f, 'THR', HOLIDAY)).rejects.toThrow(/has no join date/);
      // Dan penolakannya menggulung run-nya utuh.
      expect(await mockDatabase.payrollRun.count({ where: { companyId: f.companyId } })).toBe(0);
      expect(await mockDatabase.payslip.count({ where: { companyId: f.companyId } })).toBe(0);
    });

    it('measures tenure from the holiday, not from the period end', async () => {
      const f = await thrFixture();
      // Joined 2026-09-25: one full month by the period end (2026-10-28), but
      // not yet one month on the holiday (2026-10-21). The holiday is the date
      // the law measures from, so this person is not yet entitled.
      await veteran(f, { joinDate: new Date('2026-09-25') });

      const thr = await runOfType(f, 'THR', HOLIDAY);
      expect(thr.thrReferenceDate?.toISOString()).toBe(HOLIDAY);
      expect(thr.payslips).toHaveLength(0);
    });

    it('falls back to the period end when no holiday date is given', async () => {
      const f = await thrFixture();
      // The same join date, with no holiday supplied: the period end is one
      // full month on, so the prorated THR is owed.
      await veteran(f, { joinDate: new Date('2026-09-25') });

      const thr = await runOfType(f, 'THR');
      expect(thr.thrReferenceDate).toBeNull();
      expect(thr.payslips).toHaveLength(1);
      expect(Number(thr.payslips[0].totalEarnings)).toBe(Math.round(1000 / 12));
    });
  });

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
  it('rejects unsupported currency and same-date duplicate salaries, but pays the as-of row when dates differ', async () => {
    const f = await fixture(), person = await employee(f);
    await mockDatabase.employeeSalary.update({ where: { id: person.salary.id }, data: { currency: 'USD' } });
    await expect(run(f)).rejects.toThrow('IDR'); await expectNoPayroll(f);
    await mockDatabase.employeeSalary.update({ where: { id: person.salary.id }, data: { currency: 'IDR' } });

    // Two rows with DIFFERENT dates are not ambiguous: as-of selection pays the
    // latest row effective on or before the period end.
    const baseDate = new Date(person.salary.effectiveDate);
    const later = new Date(baseDate.getTime() + 86_400_000);
    const supersede = await mockDatabase.employeeSalary.create({ data: {
      companyId: f.companyId, employeeId: person.person.id, baseSalary: '1234', effectiveDate: later,
    } });
    const committed = await run(f);
    expect(committed.payslips[0].baseSalary.toString()).toBe('1234');
    expect(committed.payslips[0].employeeSalaryId).toBe(supersede.id);

    // expectNoPayroll also asserts nothing was published, and the committed run
    // above published once.
    jest.clearAllMocks();

    // A second row sharing the selected effective date is a data error: the
    // choice between them would come down to query order.
    const ambiguous = await fixture(), other = await employee(ambiguous);
    await mockDatabase.employeeSalary.create({ data: {
      companyId: ambiguous.companyId, employeeId: other.person.id, baseSalary: '4321',
      effectiveDate: new Date(other.salary.effectiveDate),
    } });
    await expect(run(ambiguous)).rejects.toThrow('Multiple active salaries');
    await expectNoPayroll(ambiguous);
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

  /**
   * Arrears (GAP-14). A closed period is never reopened — its reports and bank
   * reconciliation have gone out — so an employee it missed is paid in the next
   * run as a component naming the period it came from. The part that matters
   * for money: it must be paid exactly once, never again by a later run.
   */
  it('pays a closed period once in the next run, names it on the slip, and never pays it twice', async () => {
    const f = await fixture();
    const person = await employee(f);
    const closed = await createPeriod(f.companyId, '2026-09-01');
    await mockDatabase.payrollPeriod.update({ where: { id: closed.id }, data: { status: 'CLOSED' } });

    const registered = await runInRequestContext(
      { user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } },
      () => payrollArrearsService.register(f.companyId, { employeeId: person.person.id, sourcePeriodId: closed.id }),
    );
    expect(registered.status).toBe('PENDING');

    const completed = await run(f);
    const slip = await mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: completed.id, employeeId: person.person.id } });
    const arrearsComponents = await mockDatabase.payslipComponent.findMany({
      where: { payslipId: slip.id, name: `Rapel ${closed.code}` },
    });
    expect(arrearsComponents).toHaveLength(1);
    expect(arrearsComponents[0].type).toBe('ALLOWANCE');
    expect(arrearsComponents[0].isTaxable).toBe(true);
    expect(arrearsComponents[0].amount.toString()).toBe(registered.grossAmount.toString());

    const claimed = await mockDatabase.payrollArrears.findUniqueOrThrow({ where: { id: registered.id } });
    expect(claimed.status).toBe('APPLIED');
    expect(claimed.payslipId).toBe(slip.id);
    expect(claimed.appliedRunId).toBe(completed.id);

    // A later run must not find it again.
    const next = await createPeriod(f.companyId, '2026-11-01');
    const secondRun = await run(f, next.id);
    const secondSlip = await mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: secondRun.id, employeeId: person.person.id } });
    expect(await mockDatabase.payslipComponent.count({ where: { payslipId: secondSlip.id, name: { startsWith: 'Rapel ' } } })).toBe(0);
  });

  it('refuses arrears for a period that is still open, because that run can still include the employee', async () => {
    const f = await fixture();
    const person = await employee(f);
    await expect(
      runInRequestContext(
        { user: { id: f.maker, email: 'payroll@example.test', companyId: f.companyId, companyScope: [f.companyId] } },
        () => payrollArrearsService.register(f.companyId, { employeeId: person.person.id, sourcePeriodId: f.period.id }),
      ),
    ).rejects.toThrow(/closed period only/i);
    expect(await mockDatabase.payrollArrears.count({ where: { companyId: f.companyId } })).toBe(0);
  });

  /**
   * The December reconciliation must only fire in the period that actually ends
   * the year. Settling a year in October would deduct a full year's correction
   * from someone with two months still to be paid.
   */
  it('leaves a non-December run alone even with the reconciliation setting on', async () => {
    const f = await fixture();
    await employee(f);
    await mockDatabase.companySetting.create({
      data: { companyId: f.companyId, key: 'pph21_december_reconciliation_enabled', value: 'true' },
    });

    const completed = await run(f); // the fixture period runs in October
    const slip = await mockDatabase.payslip.findFirstOrThrow({ where: { payrollRunId: completed.id } });

    expect(await mockDatabase.payslipComponent.count({
      where: { payslipId: slip.id, name: { contains: 'Koreksi PPh21' } },
    })).toBe(0);
    expect(await mockDatabase.salaryComponent.count({
      where: { companyId: f.companyId, code: 'PPH21_ANNUAL_CORRECTION_AUTO' },
    })).toBe(0);
  });
});
