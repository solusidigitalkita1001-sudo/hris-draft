/**
 * B.6 Multibank Disbursement Utilities Jest Test.
 *
 * Target acceptance: 3 karyawan beda bank → 3 group CSV terpisah BCA/MANDIRI/BNI.
 * Fallback legacy single bank fields (employee.bankName) tetap bisa dipakai.
 * CSV round trips preserve recipient fields and bank identity for each template.
 */
import { Prisma } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import { resolveEmployeeBankInfo, groupPayslipsByBank, generateBankCsv, csvEscape } from './disbursement';
import type { DisbursementRow, EmployeeForDisbursement } from './disbursement';

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
    // Reference contains the complete payslip ID.
    expect(bniCsv.rows[0]).toContain('BNI303');
    expect(bniCsv.rows[0]).toContain('Citra W');
    expect(bniCsv.rows[0]).toContain(',8500000,');
  });
});

describe('bank export integrity', () => {
  const row: DisbursementRow = {
    payslipId: '12345678-1234-4321-8234-123456789012',
    employeeId: 'employee-1',
    employeeName: 'Ani',
    bankName: 'Bank Alpha',
    accountNumber: '0012345678',
    accountHolder: 'Ani',
    netPay: 100_000,
    referenceNo: 'PS-12345678-1234-4321-8234-123456789012-BNI',
    description: 'Salary payout',
  };

  it.each(['BCA', 'MANDIRI', 'BNI', 'OTHER'])('%s CSV preserves delimiters, quotes, newlines and account leading zeroes', (bankCode) => {
    const accountHolder = 'Ani; "Finance", HR\r\nJakarta';
    const description = 'Payroll; September, "regular"\nRun 1';
    const csv = generateBankCsv(bankCode, [{ ...row, accountHolder, description }]);
    const records: Record<string, string>[] = parse(csv.content, { columns: true, delimiter: csv.delimiter });

    expect(records).toHaveLength(1);
    expect(Object.keys(records[0])).toHaveLength(csv.headers.length);
    expect(records[0][bankCode === 'BCA' ? 'NAMA_PENERIMA' : 'NAMA']).toBe(accountHolder);
    expect(records[0].NO_REKENING ?? records[0].REKENING).toBe('0012345678');
    expect(records[0].KETERANGAN).toBe(description);
    expect(records[0].NOMINAL).toBe('100000');
  });

  it('csvEscape retains comma as its default delimiter', () => {
    expect(csvEscape('Ani, HR')).toBe('"Ani, HR"');
    expect(csvEscape('Ani; HR', ';')).toBe('"Ani; HR"');
  });

  it('keeps distinct OTHER bank names on their own recipient rows', () => {
    const employees: Record<string, EmployeeForDisbursement> = {
      alpha: { id: 'alpha', fullName: 'Ani', bankName: 'Bank Alpha, Indonesia', bankAccount: '0001' },
      beta: { id: 'beta', fullName: 'Budi', bankName: 'Bank Beta', bankAccount: '0002' },
    };
    const [group] = groupPayslipsByBank([
      { id: 'slip-alpha', employeeId: 'alpha', netPay: 10_000 },
      { id: 'slip-beta', employeeId: 'beta', netPay: 20_000 },
    ], employees);
    const csv = generateBankCsv(group.bankCode, group.rows, group.bankName);
    const records: Record<string, string>[] = parse(csv.content, { columns: true });

    expect(group.bankCode).toBe('OTHER');
    expect(group.bankName).toBe('OTHER');
    expect(records.map((record) => [record.BANK, record.REKENING])).toEqual([
      ['Bank Alpha, Indonesia', '0001'],
      ['Bank Beta', '0002'],
    ]);
  });

  it('supports legacy manually constructed rows with a supplied bank name', () => {
    const csv = generateBankCsv('OTHER', [{ ...row, bankName: undefined }], 'Legacy Bank');
    const [record]: Record<string, string>[] = parse(csv.content, { columns: true });
    expect(record.BANK).toBe('Legacy Bank');
  });

  it('exports different full references for payslip IDs sharing their first eight characters', () => {
    const ids = ['12345678-1234-4321-8234-123456789012', '12345678-1234-4321-8234-123456789013'];
    const employees = { employee: { id: 'employee', fullName: 'Ani', bankName: 'BNI', bankAccount: '0001' } };
    const [group] = groupPayslipsByBank(ids.map((id) => ({ id, employeeId: 'employee', netPay: 100 })), employees);
    const csv = generateBankCsv('BNI', group.rows);
    const records: Record<string, string>[] = parse(csv.content, { columns: true });

    expect(records.map((record) => record.NOMOR_REF)).toEqual(ids.map((id) => `PS-${id}-BNI`));
    expect(new Set(records.map((record) => record.NOMOR_REF)).size).toBe(2);
  });

  it.each([
    NaN, Infinity, -Infinity, -1, '', ' ', 'NaN', 'Infinity', '1_000', '0x10',
    true, null, undefined, [], {}, Number.MAX_VALUE,
  ])('rejects invalid net pay %p during grouping and direct CSV export', (netPay) => {
    const invalidAmount = netPay as unknown as number;
    expect(() => groupPayslipsByBank([{ id: row.payslipId, employeeId: row.employeeId, netPay: invalidAmount }], {}))
      .toThrow('Payroll export requires a finite, non-negative net pay');
    expect(() => generateBankCsv('BNI', [{ ...row, netPay: invalidAmount }]))
      .toThrow('Payroll export requires a finite, non-negative net pay');
  });

  it('accepts database Decimal, decimal strings, and explicit zero without changing rupiah rounding', () => {
    const [group] = groupPayslipsByBank([
      { id: 'decimal', employeeId: 'employee', netPay: new Prisma.Decimal('100.49') },
      { id: 'string', employeeId: 'employee', netPay: '100.50' },
      { id: 'zero', employeeId: 'employee', netPay: 0 },
    ], { employee: { id: 'employee', fullName: 'Ani', bankName: 'BNI', bankAccount: '0001' } });
    const csv = generateBankCsv('BNI', group.rows);
    const records: Record<string, string>[] = parse(csv.content, { columns: true });

    expect(group.totalAmount).toBe(200.99);
    expect(records.map((record) => record.NOMINAL)).toEqual(['100', '101', '0']);
  });

  it('rejects group totals beyond safe numeric precision', () => {
    expect(() => groupPayslipsByBank([
      { id: 'first', employeeId: 'employee', netPay: 50_000_000_000_000 },
      { id: 'second', employeeId: 'employee', netPay: 50_000_000_000_000 },
    ], {})).toThrow('supported range');
  });
});
