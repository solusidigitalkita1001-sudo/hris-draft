/**
 * B.5 Payslip Breakdown Builder Jest Test
 * Pure function buildPayslipBreakdown — 5 test cases B.5 acceptance.
 */
import { buildPayslipBreakdown } from './payslip-breakdown';

describe('buildPayslipBreakdown (B.5 Payslip Component Grouped Breakdown)', () => {
  /**
   * This case used to demand the opposite: two earning rows and a 12M take-home,
   * produced by INVENTING a 10M "Gaji Pokok" row because the allocation had
   * none. The payslip is built from a stored payslip whose netPay is computed
   * from the components alone, so that invented row made the slip show 12M
   * while the bank transferred 2M. The slip must show what was paid.
   */
  it('CASE 1: an allocation with no base-pay component shows only what it recorded', () => {
    const result = buildPayslipBreakdown({
      baseSalary: 10_000_000,
      components: [
        { name: 'Tunjangan Jabatan', type: 'ALLOWANCE', amount: 2_000_000, isTaxable: true, salaryComponent: { code: 'ALLOW_POSITION' } },
      ],
    });
    expect(result.earnings.length).toBe(1);
    expect(result.earnings.map((row) => row.code)).not.toContain('BASIC');
    expect(result.baseSalary).toBe(10_000_000);
    expect(result.totalEarnings).toBe(2_000_000);
    expect(result.takeHomePay).toBe(2_000_000);
    // And it says why the two differ, rather than hiding it.
    expect(result.reconciliation.unallocatedBaseSalary).toBe(10_000_000);
  });

  it('CASE 2: Match regex component code (BPJS TK / KES / PPH21) — statutory summary akurat', () => {
    const result = buildPayslipBreakdown({
      baseSalary: 6_000_000,
      components: [
        // Nama component sesuai payroll calculateEmployeePay label mapping (cuma "BPJS TK" text, tanpa salaryComponent.code)
        { name: 'BPJS TK (JHT+JP)', type: 'DEDUCTION', amount: 180_000, isTaxable: false },
        { name: 'BPJS Kesehatan', type: 'DEDUCTION', amount: 60_000, isTaxable: false },
        { name: 'PPh 21', type: 'DEDUCTION', amount: 60_000, isTaxable: false },
      ],
    });
    expect(result.deductions.length).toBe(3);
    // cek auto-detect code berdasarkan keyword regex
    expect(result.statutorySummary.bpjsTK).toBe(180_000);
    expect(result.statutorySummary.bpjsKesehatan).toBe(60_000);
    expect(result.statutorySummary.pph21).toBe(60_000);
    expect(result.deductions[0].description).toContain('Jaminan Hari Tua 2%'); // label ID mapped
    expect(result.deductions[1].description).toContain('cap 12jt');
    expect(result.deductions[2].description).toContain('UU HPP 2022');
  });

  it('CASE 3: Sudah ada component BASIC explicit → JANGAN inject BASIC duplicate (tetap 1 row BASIC)', () => {
    const result = buildPayslipBreakdown({
      baseSalary: 8_000_000,
      components: [
        { name: 'Gaji Pokok', type: 'ALLOWANCE', amount: 8_000_000, isTaxable: true, salaryComponent: { code: 'BASIC' } },
        { name: 'Tunjangan Makan', type: 'ALLOWANCE', amount: 500_000 },
      ],
    });
    const basicRows = result.earnings.filter((r) => r.code === 'BASIC');
    expect(basicRows.length).toBe(1); // TIDAK ADA duplicate
    expect(result.earnings.length).toBe(2); // BASIC + MEAL
    expect(result.earnings[1].code).toBe('MEAL');
  });

  it('CASE 4: Keywords mapping Lembur/Overtime, Kasbon/Loan, THR → code benar & type tepat', () => {
    const result = buildPayslipBreakdown({
      baseSalary: 5_000_000,
      components: [
        { name: 'Uang Lembur Total', type: 'ALLOWANCE', amount: 750_000 },
        { name: 'THR Lebaran', type: 'ALLOWANCE', amount: 5_000_000 },
        { name: 'Kasbon Cicilan Motor', type: 'DEDUCTION', amount: 300_000 },
      ],
    });
    const codes = result.earnings.map((r) => r.code);
    // No BASIC: this allocation does not record base pay, and this case used
    // to expect the invented row that made the total 10.750.000.
    expect(codes).toEqual(['OVERTIME', 'THR']);
    // loan deduction
    expect(result.deductions[0].code).toBe('LOAN');
    expect(result.deductions[0].name).toBe('Cicilan Pinjaman Karyawan'); // LABEL_MAP.LOAN.label
    // totals, from the rows that exist
    expect(result.totalEarnings).toBe(5_750_000);
    expect(result.totalDeductions).toBe(300_000);
    expect(result.takeHomePay).toBe(5_450_000);
    expect(result.reconciliation.unallocatedBaseSalary).toBe(5_000_000);
  });

  it('CASE 5: Zero / negative amount guards — tidak throw, THP valid non negative', () => {
    // base 0, components ada negatif (data DB korup) — builder tetap aman, no crash
    const result = buildPayslipBreakdown({
      baseSalary: 0,
      components: [
        { name: 'Tunjangan X', type: 'ALLOWANCE', amount: -1_000_000 }, // amount corruption
        { name: 'Potongan', type: 'DEDUCTION', amount: 0 },
      ],
    });
    // tidak throw
    expect(typeof result.takeHomePay).toBe('number');
    // take home = (-1M) - 0 = -1M (benerin manual di sistem, pure function jujur sesuai data)
    expect(result.earnings[0].amount).toBe(-1_000_000);
    expect(result.totalDeductions).toBe(0);
  });

  /**
   * Every production caller reads a stored payslip and passes its totals in.
   * They were accepted and then ignored, recomputed from the rows — which is
   * how an invented row could change the displayed take-home without changing
   * the money.
   */
  describe('the stored totals are the money', () => {
    const storedSlip = (over: Record<string, unknown> = {}) => buildPayslipBreakdown({
      baseSalary: 10_000_000,
      totalEarnings: 12_000_000,
      totalDeductions: 1_000_000,
      netPay: 11_000_000,
      components: [
        { name: 'Gaji Pokok', type: 'ALLOWANCE', amount: 10_000_000, salaryComponent: { code: 'BASIC' } },
        { name: 'Tunjangan Jabatan', type: 'ALLOWANCE', amount: 2_000_000 },
        { name: 'PPh 21', type: 'DEDUCTION', amount: 1_000_000 },
      ],
      ...over,
    });

    it('reports the stored take-home, not a recomputed one', () => {
      const result = storedSlip();
      expect(result.takeHomePay).toBe(11_000_000);
      expect(result.totalEarnings).toBe(12_000_000);
      expect(result.reconciliation.matchesStored).toBe(true);
      expect(result.reconciliation.unallocatedBaseSalary).toBe(0);
    });

    it('says so when the rows do not account for the stored totals', () => {
      // A slip whose components were deleted, or whose base pay was never
      // allocated: the money still moved, and the gap is now visible instead
      // of being papered over.
      const result = storedSlip({ components: [{ name: 'Tunjangan Jabatan', type: 'ALLOWANCE', amount: 2_000_000 }] });
      expect(result.takeHomePay).toBe(11_000_000);
      expect(result.reconciliation.rowsEarnings).toBe(2_000_000);
      expect(result.reconciliation.unaccountedEarnings).toBe(10_000_000);
      expect(result.reconciliation.matchesStored).toBe(false);
    });

    it('falls back to the rows when no totals were stored', () => {
      const result = buildPayslipBreakdown({
        baseSalary: 0,
        components: [
          { name: 'Tunjangan Jabatan', type: 'ALLOWANCE', amount: 2_000_000 },
          { name: 'PPh 21', type: 'DEDUCTION', amount: 100_000 },
        ],
      });
      expect(result.takeHomePay).toBe(1_900_000);
      // Nothing to contradict, so nothing is claimed to mismatch.
      expect(result.reconciliation.matchesStored).toBe(true);
    });

    it('never counts unallocated base salary as income', () => {
      const result = storedSlip({ components: [], totalEarnings: 0, totalDeductions: 0, netPay: 0 });
      expect(result.totalEarnings).toBe(0);
      expect(result.takeHomePay).toBe(0);
      expect(result.reconciliation.unallocatedBaseSalary).toBe(10_000_000);
    });
  });
});
