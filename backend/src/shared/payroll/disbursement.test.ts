/**
 * B.6 Multibank Disbursement Utilities Jest Test (6 test cases).
 *
 * Target acceptance: 3 karyawan beda bank → 3 group CSV terpisah BCA/MANDIRI/BNI.
 * Fallback legacy single bank fields (employee.bankName) tetap bisa dipakai.
 * BCA delimiter ";" sesuai KlikBCA standard, header kolom BCA/MANDIRI/BNI tepat.
 */
import { resolveEmployeeBankInfo, groupPayslipsByBank, generateBankCsv } from './disbursement';
import type { EmployeeForDisbursement } from './disbursement';

describe('resolveEmployeeBankInfo (B.6 multibank select)', () => {
  it('CASE 1: Multi bank ada primary BCA → source MULTI_BANK, code BCA, pakai primary bukan first', () => {
    const emp: EmployeeForDisbursement = {
      id: 'e1', fullName: 'Alice',
      // legacy field ada (diabaikan kalo ada primary!)
      bankName: 'Bank Legacy', bankAccount: '9999999',
      bankAccounts: [
        { bankCode: 'BNI', accountNumber: 'BNI0001', accountHolder: 'Alice BNI', isPrimary: false, isActive: true, bankName: null },
        { bankCode: 'BCA', accountNumber: 'BCA123456', accountHolder: 'Alice S', isPrimary: true, isActive: true, bankName: null },  // PRIMARY!
      ],
    };
    const r = resolveEmployeeBankInfo(emp);
    expect(r.bankCode).toBe('BCA');
    expect(r.accountNumber).toBe('BCA123456');
    expect(r.source).toBe('MULTI_BANK');
    expect(r.accountHolder).toBe('Alice S');
    expect(r.warning).toBeUndefined();
  });

  it('CASE 2: Tanpa primary (2 accounts inactive+active) → source MULTI_FIRST + warning', () => {
    const emp: EmployeeForDisbursement = {
      id: 'e2', fullName: 'Bob',
      bankAccounts: [
        { bankCode: 'MANDIRI', accountNumber: '001', accountHolder: 'Bob', isPrimary: false, isActive: false, bankName: null },
        { bankCode: 'MANDIRI', accountNumber: '002', accountHolder: 'Bob Jr', isPrimary: false, isActive: true, bankName: null },
      ],
    };
    const r = resolveEmployeeBankInfo(emp);
    expect(r.source).toBe('MULTI_FIRST');
    expect(r.accountNumber).toBe('002');
    expect(typeof r.warning === 'string').toBe(true);
  });

  it('CASE 3: EmployeeBankAccount TIDAK ADA → fallback LEGACY_SINGLE (fields lama bankCode BNI valid → enum BNI)', () => {
    const emp: EmployeeForDisbursement = {
      id: 'e3', fullName: 'Charlie',
      bankName: 'Bank Negara Indonesia KCU Jakarta',
      bankCode: 'BNI',
      bankAccount: 'BNI987654',
      bankAccountHolder: 'Charlie P',
      // bankAccounts TIDAK DIDEFINISIKAN = array empty → fallback
    };
    const r = resolveEmployeeBankInfo(emp);
    expect(r.source).toBe('LEGACY_SINGLE');
    expect(r.bankCode).toBe('BNI');
    expect(r.accountNumber).toBe('BNI987654');
    expect(r.accountHolder).toBe('Charlie P');
    expect(r.warning).toBeUndefined();
  });

  it('CASE 4: Keduanya TIDAK ADA (no multi + no legacy bankAccount) → UNASSIGNED + warning', () => {
    const r = resolveEmployeeBankInfo({ id: 'e4', fullName: 'Dody' });
    expect(r.bankCode).toBe('UNASSIGNED');
    expect(r.source).toBe('UNASSIGNED');
    expect(typeof r.warning).toBe('string');
    expect(r.accountNumber).toBe('');
  });
});

describe('groupPayslipsByBank + generateBankCsv (B.6 grouping + CSV)', () => {
  const employees: Record<string, EmployeeForDisbursement> = {
    emp_bca: { id: 'emp_bca', fullName: 'Ani', bankAccounts: [{ bankCode: 'BCA', bankName: null, accountNumber: 'BCA101', accountHolder: 'Ani', isPrimary: true, isActive: true }] },
    emp_mandiri: { id: 'emp_mandiri', fullName: 'Budi', bankAccounts: [{ bankCode: 'MANDIRI', bankName: null, accountNumber: 'MANDIRI202', accountHolder: 'Budi S', isPrimary: true, isActive: true }] },
    emp_bni: { id: 'emp_bni', fullName: 'Citra', bankAccounts: [{ bankCode: 'BNI', bankName: null, accountNumber: 'BNI303', accountHolder: 'Citra W', isPrimary: true, isActive: true }] },
    emp_no_bank: { id: 'emp_no_bank', fullName: 'Dino' }, // → UNASSIGNED group
  };
  const payslips = [
    { id: 'ps1', employeeId: 'emp_bca',     netPay: 10_000_000 },
    { id: 'ps2', employeeId: 'emp_mandiri', netPay: 12_000_000 },
    { id: 'ps3', employeeId: 'emp_bni',     netPay: 8_500_000 },
    { id: 'ps4', employeeId: 'emp_no_bank', netPay: 5_000_000 },
  ];

  it('CASE 5: 4 payslip (3 beda bank + 1 UNASSIGNED) → 4 group BCA/MANDIRI/BNI/UNASSIGNED, total amount & counts tepat', () => {
    const groups = groupPayslipsByBank(payslips, employees);
    expect(groups.map((g) => g.bankCode)).toEqual(['BCA', 'BNI', 'MANDIRI', 'UNASSIGNED']); // alphabetic sorted
    const bca = groups.find((g) => g.bankCode === 'BCA')!;
    expect(bca.employeeCount).toBe(1);
    expect(bca.totalAmount).toBe(10_000_000);
    expect(bca.rows[0].accountNumber).toBe('BCA101');
    const unassigned = groups.find((g) => g.bankCode === 'UNASSIGNED')!;
    expect(unassigned.employeeCount).toBe(1);
    expect(unassigned.totalAmount).toBe(5_000_000);
  });

  it('CASE 6: generateBankCsv 3 banks — HEADER kolom + DELIMITER sesuai standard (BCA ";", MANDIRI/BNI ",")', () => {
    const grouped = groupPayslipsByBank(payslips.slice(0, 3), employees);
    const bcaCsv = generateBankCsv('BCA', grouped.find(g => g.bankCode === 'BCA')!.rows);
    const mandiriCsv = generateBankCsv('MANDIRI', grouped.find(g => g.bankCode === 'MANDIRI')!.rows);
    const bniCsv = generateBankCsv('BNI', grouped.find(g => g.bankCode === 'BNI')!.rows);

    // BCA pakai semicolon delimiter KlikBCA standard
    expect(bcaCsv.delimiter).toBe(';');
    expect(bcaCsv.headers).toEqual(['KODE_TRANSAKSI', 'NO_REKENING', 'NAMA_PENERIMA', 'NOMINAL', 'KETERANGAN']);
    expect(bcaCsv.content).toContain(';BCA101;Ani;10000000;');

    // MANDIRI header standard 4 kolom
    expect(mandiriCsv.delimiter).toBe(',');
    expect(mandiriCsv.headers).toEqual(['NO_REKENING', 'NAMA', 'NOMINAL', 'KETERANGAN']);
    expect(mandiriCsv.content).toContain('MANDIRI202,Budi S,12000000,');

    // BNI e-Collect punya NOMOR_REF kolom
    expect(bniCsv.headers).toEqual(['REKENING', 'NAMA', 'NOMOR_REF', 'NOMINAL', 'KETERANGAN']);
    // rows 1 kolom referenceNo: 'PS-ps33xxxBNI' — berisi BNI & ID potong ps3
    expect(bniCsv.rows[0]).toContain('BNI303');
    expect(bniCsv.rows[0]).toContain('Citra W');
    expect(bniCsv.rows[0]).toContain(',8500000,');
  });
});
