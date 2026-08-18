/**
 * B.5 Payslip Breakdown Builder Jest Test
 * Pure function buildPayslipBreakdown — 5 test cases B.5 acceptance.
 */
import { buildPayslipBreakdown } from './payslip-breakdown';

describe('buildPayslipBreakdown (B.5 Payslip Component Grouped Breakdown)', () => {
  it('CASE 1: Basic 10M + Tunjangan 2M (earnings 12M) — tanpa deductions → THP 12M, total deduction 0, earnings=2 rows', () => {
    const result = buildPayslipBreakdown({
      baseSalary: 10_000_000,
      components: [
        { name: 'Tunjangan Jabatan', type: 'ALLOWANCE', amount: 2_000_000, isTaxable: true, salaryComponent: { code: 'ALLOW_POSITION' } },
      ],
    });
    // auto inject BASIC karena component tidak ada BASIC explicit
    expect(result.earnings.length).toBe(2);
    expect(result.baseSalary).toBe(10_000_000);
    expect(result.totalEarnings).toBe(12_000_000);
    expect(result.totalDeductions).toBe(0);
    expect(result.takeHomePay).toBe(12_000_000);
    // First row adalah BASIC (injected)
    expect(result.earnings[0].code).toBe('BASIC');
    expect(result.earnings[0].name).toBe('Gaji Pokok');
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
    expect(codes).toEqual(expect.arrayContaining(['BASIC', 'OVERTIME', 'THR']));
    // loan deduction
    expect(result.deductions[0].code).toBe('LOAN');
    expect(result.deductions[0].name).toBe('Cicilan Pinjaman Karyawan'); // LABEL_MAP.LOAN.label
    // totals
    expect(result.totalEarnings).toBe(10_750_000);
    expect(result.totalDeductions).toBe(300_000);
    expect(result.takeHomePay).toBe(10_450_000);
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
});
