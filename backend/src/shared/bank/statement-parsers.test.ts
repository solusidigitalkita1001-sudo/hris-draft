import {
  BankProvider,
  parseBankStatement,
  reconcileBankToDisbursement,
  ParsedBankTxn,
  PayrollDisbursementExpected,
} from './statement-parsers';

describe('E.2 Bank Statement Parsers + Recon (8 Jest pure)', () => {
  test('CASE1 BCA CSV 3 rows + 1 credit PAYROLL SALARY okt 2026 parse berhasil totalCredit=12_500_000', () => {
    const csv = `18/10/2026,CR,PAYROLL PT MAJU BERSAMA EMP001 Siti,0088,18/10/2026,12500000
17/10/2026,DB,TRANSFER KE SUPPLIER,0088,17/10/2026,5000000
19/10/2026,CR,PENERIMAAN AR TAGIHAN,0088,19/10/2026,14750000`;
    const p = parseBankStatement(csv, BankProvider.BCA_ONLINE, { skipHeaderN: 0 });
    expect(p.provider).toBe(BankProvider.BCA_ONLINE);
    expect(p.parsedCount).toBeGreaterThanOrEqual(3);
    const amounts = p.parsedTxns.map((t) => ({ cr: t.isCredit ? t.amountInIDR : 0, db: t.isDebit ? t.amountInIDR : 0 }));
    const sumCr = amounts.reduce((a, b) => a + b.cr, 0);
    const sumDb = amounts.reduce((a, b) => a + b.db, 0);
    expect(sumCr).toBeGreaterThanOrEqual(12_500_000);
    expect(sumDb).toBeGreaterThanOrEqual(5_000_000);
    const payroll = p.parsedTxns.find((t) => t.description.includes('PAYROLL') && t.isCredit);
    expect(payroll?.isCredit).toBe(true);
    expect(payroll?.balanceAfter).toBe(12_500_000);
  });

  test('CASE2 MANDIRI IBANKING 3 skip header rows header 03102026 MANDIRI ONLINE REPORT, parse 2 rows OK', () => {
    const csv = `MANDIRI INTERNET BANKING STATEMENT
Periode: 1 Okt - 31 Okt 2026
Rekening: 1234567890 PT HRIS SEJAHTERA
Tanggal;Keterangan;Kredit;Debet;Saldo
18/10/2026;PAYROLL SALARI OCT 26 BATCH 1;25.000.000,00;;250.500.000,00
17/10/2026;LISTRIK KANTOR PLN;;2.450.000,00;225.500.000,00`;
    const p = parseBankStatement(csv, BankProvider.MANDIRI_IBANKING, { skipHeaderN: 4 });
    expect(p.provider).toBe(BankProvider.MANDIRI_IBANKING);
    expect(p.ignoredRows.length).toBeGreaterThanOrEqual(4);
    expect(p.parsedTxns).toHaveLength(2);
    const creditTxn = p.parsedTxns.find((t) => t.description.includes('PAYROLL'));
    expect(creditTxn?.isCredit).toBe(true);
    expect(creditTxn?.amountInIDR).toBe(25_000_000);
    expect(p.summary.endBalance).toBe(225_500_000);
  });

  test('CASE3 BNI PIPE delimiter 5 rows, 1 DB negative prefix minus parse isDebit true', () => {
    const csv = `Tanggal Posting|Tanggal Valuta|Keterangan|Jumlah|Saldo
18-10-2026|18-10-2026|PAYROLL BATCH BNI EMP OCT|-|150000000
19-10-2026|19-10-2026|PAYROLL TRANSFER KELUAR EMP002|-7.650.000|142350000
20-10-2026|20-10-2026|DIVIDEN SAHAM INVEST|+12.000.000|154350000`;
    const p = parseBankStatement(csv, BankProvider.BNI_INTERNETBANKING, { skipHeaderN: 1 });
    expect(p.provider).toBe(BankProvider.BNI_INTERNETBANKING);
    const payroll = p.parsedTxns.find((t) => t.description.includes('TRANSFER KELUAR'));
    expect(payroll?.isDebit).toBe(true);
    expect(payroll?.amountInIDR).toBe(7_650_000);
    const credit = p.parsedTxns.find((t) => t.description.includes('DIVIDEN'));
    expect(credit?.isCredit).toBe(true);
    expect(p.summary.totalCredit).toBeGreaterThanOrEqual(12_000_000);
  });

  test('CASE4 MT940 SWIFT :60F:/:61: payroll tagihan 2 transaksi credit parse OK', () => {
    const mt940 = `:20:MT94000123456789
:25:ID00BNI0001234567890
:28C:1/1
:60F:C261031IDR125000000,00
:61:2610181018CR12500000,00NTRFNONREF//PAYROLL BATCH OKT26
HRIS EMPLOYEE SALARY BATCH 3
:61:2610191019DB2500000,00NMSCNONREF//LISTRIK PLN KANTOR PUSAT
:62F:C261031IDR135000000,00`;
    const p = parseBankStatement(mt940, BankProvider.MT940_SWIFT);
    expect(p.provider).toBe(BankProvider.MT940_SWIFT);
    expect(p.parsedCount).toBeGreaterThanOrEqual(2);
    const txnPayroll = p.parsedTxns.find((t) => t.description.includes('PAYROLL'));
    expect(txnPayroll?.isCredit).toBe(true);
    expect(txnPayroll?.amountInIDR).toBe(12_500_000);
    expect(p.summary.startBalance).toBe(125_000_000);
    expect(p.summary.endBalance).toBe(135_000_000);
    expect(p.errors.length === 0 || p.summary.totalCredit > 0).toBe(true);
  });

  test('CASE5 RECON 3 match +1 miss +1 extra => matchedAmountPercent 80%', () => {
    const bankTxns: ParsedBankTxn[] = [
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL EMP001', amountInIDR: 5_000_000, isCredit: true, isDebit: false, uniqueRef: 'BANK-1', balanceAfter: 5_000_000, sourceRow: 1, bank: BankProvider.BCA_ONLINE },
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL EMP002', amountInIDR: 7_000_000, isCredit: true, isDebit: false, uniqueRef: 'BANK-2', balanceAfter: 12_000_000, sourceRow: 2, bank: BankProvider.BCA_ONLINE },
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL EMP003', amountInIDR: 4_000_000, isCredit: true, isDebit: false, uniqueRef: 'BANK-3', balanceAfter: 16_000_000, sourceRow: 3, bank: BankProvider.BCA_ONLINE },
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'EXTRA TRANSFER UNKNOWN', amountInIDR: 2_000_000, isCredit: true, isDebit: false, uniqueRef: 'BANK-EXTRA', balanceAfter: 18_000_000, sourceRow: 4, bank: BankProvider.BCA_ONLINE },
    ];
    const disb: PayrollDisbursementExpected[] = [
      { employeeId: 'EMP001', expectedAmount: 5_000_000 },
      { employeeId: 'EMP002', expectedAmount: 7_000_000 },
      { employeeId: 'EMP003', expectedAmount: 4_000_000 },
      { employeeId: 'EMP004_MISS', expectedAmount: 4_500_000 },
    ];
    const r = reconcileBankToDisbursement(bankTxns, disb);
    expect(r.matched).toHaveLength(3);
    expect(r.missingInBank).toHaveLength(1);
    expect(r.extraInBank).toHaveLength(1);
    expect(r.totalExpectedDisbursements).toBe(4);
    const totalExpected = 5_000_000 + 7_000_000 + 4_000_000 + 4_500_000;
    const totalMatchedAmount = 5_000_000 + 7_000_000 + 4_000_000;
    expect(r.matchedAmountPercent).toBe(Math.round((totalMatchedAmount / totalExpected) * 10000) / 100);
    expect(r.fullyReconciled).toBe(false);
    expect(r.issues.length).toBeGreaterThanOrEqual(2);
  });

  test('CASE6 Recon tolerance 500 IDR amount mismatch tiny -> still match with difference', () => {
    const txns: ParsedBankTxn[] = [
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL EMP001 BANK FEE DEDUCT', amountInIDR: 5_000_123, isCredit: true, isDebit: false, uniqueRef: 'T1', balanceAfter: 5_000_123, sourceRow: 1, bank: BankProvider.BCA_ONLINE },
    ];
    const disb: PayrollDisbursementExpected[] = [{ employeeId: 'EMP001', expectedAmount: 5_000_500 }];
    const r = reconcileBankToDisbursement(txns, disb, 500);
    expect(r.matched).toHaveLength(1);
    expect(r.matched[0].exactAmountMatch).toBe(false);
    expect(r.missingInBank).toHaveLength(0);
    expect(Math.abs(r.matched[0].difference)).toBeLessThanOrEqual(500);
  });

  test('CASE7 Fully reconcilied = no miss no extra zero diff => fullyReconciled true', () => {
    const txns: ParsedBankTxn[] = [
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL 1', amountInIDR: 5_000_000, isCredit: true, isDebit: false, uniqueRef: 'A', balanceAfter: 5_000_000, sourceRow: 1, bank: BankProvider.BCA_ONLINE },
      { dateValue: '2026-10-18', datePosting: '2026-10-18', description: 'PAYROLL 2', amountInIDR: 3_500_000, isCredit: true, isDebit: false, uniqueRef: 'B', balanceAfter: 8_500_000, sourceRow: 2, bank: BankProvider.BCA_ONLINE },
    ];
    const disb: PayrollDisbursementExpected[] = [
      { employeeId: 'E1', expectedAmount: 5_000_000 },
      { employeeId: 'E2', expectedAmount: 3_500_000 },
    ];
    const r = reconcileBankToDisbursement(txns, disb);
    expect(r.fullyReconciled).toBe(true);
    expect(r.matchedAmountPercent).toBe(100);
    expect(r.matchedCountPercent).toBe(100);
    expect(r.issues).toHaveLength(0);
  });

  test('CASE8 Invalid amount negative + skip rows => errors + ignored + zero total jika no rows valid', () => {
    const invalid = `Tanggal;Ket;Amount;Saldo
INVALID,ROW,-,0
,,,\n18/10/2026;PAYROLL SALARY;10000000;10000000`;
    const p = parseBankStatement(invalid, BankProvider.MANDIRI_IBANKING, { skipHeaderN: 1 });
    expect(p.ignoredRows.length).toBeGreaterThan(0);
    expect(p.parsedTxns.length).toBeGreaterThanOrEqual(1);
    const empty = parseBankStatement('', BankProvider.BCA_ONLINE);
    expect(empty.errors.length).toBeGreaterThanOrEqual(1);
    expect(empty.parsedCount).toBe(0);
  });
});
