/**
 * B.6 Multibank Salary Disbursement — pure utilities (no DB).
 *
 * 3 fungsi utama:
 *   a. resolveEmployeeBankInfo()   : pilih bank primary karyawan, fallback ke legacy single fields (backward compat).
 *   b. groupPayslipsByBank()       : kelompokkan payslip karyawan per bank (untuk bulk transfer batch).
 *   c. generateBankCsv()           : export template CSV per bank (BCA, Mandiri, BNI).
 *
 * Templates must be checked against the receiving bank's import specification.
 */

/**
 * Resolved bank info untuk transfer.
 * source:
 *  - MULTI_BANK     : dari model EmployeeBankAccount primary (field isPrimary)
 *  - MULTI_FIRST    : tidak ada primary → ambil first active di EmployeeBankAccount[]
 *  - LEGACY_SINGLE  : fallback ke Employee.bankName / bankAccount (existing data lama sebelum B.6)
 *  - UNASSIGNED     : keduanya tidak ada → masuk group UNASSIGNED (wajib dihandle admin, tidak di-transfer otomatis).
 */
export interface ResolvedBankInfo {
  bankCode: 'BCA' | 'MANDIRI' | 'BNI' | 'OTHER' | 'UNASSIGNED';
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  source: 'MULTI_BANK' | 'MULTI_FIRST' | 'LEGACY_SINGLE' | 'UNASSIGNED';
  warning?: string;
}

export interface EmployeeForDisbursement {
  id: string;
  fullName: string;
  bankName?: string | null;
  bankCode?: string | null;  // legacy single field (free text, bisa "bca"/"BCA"/etc)
  bankAccount?: string | null;
  bankAccountHolder?: string | null;
  bankAccounts?: Array<{
    bankCode: 'BCA' | 'MANDIRI' | 'BNI' | 'OTHER';
    bankName?: string | null;
    accountNumber: string;
    accountHolder: string;
    isPrimary: boolean;
    isActive: boolean;
  }>;
}

export interface DisbursementRow {
  payslipId: string;
  employeeId: string;
  employeeName: string;
  /** Per-recipient bank name; OTHER groups can contain several different banks. */
  bankName?: string;
  accountNumber: string;
  accountHolder: string;
  netPay: number;
  referenceNo: string;
  description: string;
}

export interface DisbursementGroup {
  bankCode: string;
  bankName: string;
  employeeCount: number;
  totalAmount: number;
  rows: DisbursementRow[];
  /** Nama file download (diisi waktu HTTP download saja, opsional) */
  filename?: string;
}

const KNOWN_BANK_ENUM: Array<ResolvedBankInfo['bankCode']> = ['BCA', 'MANDIRI', 'BNI', 'OTHER'];

type DisbursementAmount = number | string | { toString(): string };

function parseDisbursementAmount(value: DisbursementAmount): number {
  // Prisma Decimal values expose toString(); also accept plain numeric API values.
  // Reject missing/blank amounts instead of coercing them into a zero transfer.
  const numericText = typeof value === 'number'
    ? null
    : typeof value === 'string'
      ? value.trim()
      : value && typeof value === 'object' && !Array.isArray(value)
        ? value.toString()
        : '';
  if (numericText !== null && !/^\d+(?:\.\d+)?$/.test(numericText)) {
    throw new Error('Payroll export requires a finite, non-negative net pay');
  }
  const amount = typeof value === 'number' ? value : Number(numericText);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
    throw new Error('Payroll export requires a finite, non-negative net pay within the supported range');
  }
  return amount;
}

function legacyBankCodeToEnum(bankCodeText?: string | null, bankName?: string | null): ResolvedBankInfo['bankCode'] {
  const hay = `${bankCodeText ?? ''} ${bankName ?? ''}`.trim().toUpperCase();
  if (!hay) return 'UNASSIGNED';
  if (hay.includes('BCA') || hay.includes('CENTRAL ASIA')) return 'BCA';
  if (hay.includes('MANDIRI') || hay.includes('BANK MANDIRI')) return 'MANDIRI';
  if (hay.includes('BNI') || hay.includes('NEGARA INDONESIA')) return 'BNI';
  if (hay.length > 2) return 'OTHER';
  return 'UNASSIGNED';
}

/**
 * Fungsi (a) — select bank info karyawan untuk payroll disbursement.
 *
 * Priority: 1) EmployeeBankAccount primary → 2) first active EmployeeBankAccount → 3) legacy single fields.
 */
export function resolveEmployeeBankInfo(emp: EmployeeForDisbursement): ResolvedBankInfo {
  if (!emp) {
    return { bankCode: 'UNASSIGNED', bankName: 'Tidak Ada Data Karyawan', accountNumber: '', accountHolder: '', source: 'UNASSIGNED', warning: 'Data karyawan tidak ditemukan' };
  }
  const accs = (emp.bankAccounts ?? []).filter((a) => a && a.isActive && a.accountNumber);
  if (accs.length > 0) {
    const primary = accs.find((a) => a.isPrimary) ?? accs[0];
    const code = KNOWN_BANK_ENUM.includes(primary.bankCode) ? primary.bankCode : 'OTHER';
    const source: ResolvedBankInfo['source'] = primary.isPrimary ? 'MULTI_BANK' : 'MULTI_FIRST';
    return {
      bankCode: code,
      bankName: (primary.bankName && primary.bankName.trim()) || code,
      accountNumber: String(primary.accountNumber).trim(),
      accountHolder: (primary.accountHolder || emp.fullName || '').trim(),
      source,
      warning: source === 'MULTI_FIRST' ? `Tidak ada bank primary untuk ${emp.fullName}, pakai account pertama (${code}).` : undefined,
    };
  }
  // Fallback legacy single fields:
  const legBankName = emp.bankName?.toString?.().trim() || '';
  const legAccount = emp.bankAccount?.toString?.().trim() || '';
  const legHolder = emp.bankAccountHolder?.toString?.().trim() || emp.fullName?.toString?.().trim() || '';
  if (!legAccount) {
    return { bankCode: 'UNASSIGNED', bankName: legBankName || '(tidak diisi)', accountNumber: '', accountHolder: legHolder, source: 'UNASSIGNED', warning: 'Karyawan belum mengisi nomor rekening bank.' };
  }
  const code = legacyBankCodeToEnum(emp.bankCode, legBankName);
  return {
    bankCode: code,
    bankName: legBankName || code,
    accountNumber: legAccount,
    accountHolder: legHolder,
    source: 'LEGACY_SINGLE',
    warning: code === 'OTHER' ? `Bank ${legBankName || emp.bankCode} belum dalam enum BCA/MANDIRI/BNI (manual export OTHER).` : undefined,
  };
}

/**
 * Fungsi (b) — group payslips per bank code.
 *
 * Input: array payslip (netPay + employeeId + employeeName + payslipId) dan map employee by id.
 * Output: Record<bankCode, DisbursementGroup> + sorted alphabetic bankCode A-Z.
 */
export function groupPayslipsByBank<T extends { id: string; employeeId: string; employee?: { fullName: string } | null; netPay: DisbursementAmount }>(
  payslips: T[],
  employeesById: Record<string, EmployeeForDisbursement>
): DisbursementGroup[] {
  const acc: Record<string, DisbursementGroup> = {};
  for (const ps of payslips || []) {
    const emp = employeesById[ps.employeeId];
    const info = resolveEmployeeBankInfo(emp ?? {
      id: ps.employeeId,
      fullName: (ps.employee?.fullName) ?? `Employee ${ps.employeeId.slice(0, 6)}`,
    });
    if (!acc[info.bankCode]) {
      acc[info.bankCode] = {
        bankCode: info.bankCode,
        bankName: info.bankCode,
        employeeCount: 0,
        totalAmount: 0,
        rows: [],
      };
    }
    const group = acc[info.bankCode];
    const netPay = parseDisbursementAmount(ps.netPay);
    group.rows.push({
      payslipId: ps.id,
      employeeId: ps.employeeId,
      employeeName: (emp?.fullName || ps.employee?.fullName || `Employee ${ps.employeeId.slice(0, 6)}`).trim(),
      bankName: info.bankName,
      accountNumber: info.accountNumber,
      accountHolder: info.accountHolder,
      netPay,
      referenceNo: `PS-${ps.id}-${info.bankCode}`,
      description: `Salary payout ${info.bankCode}`,
    });
    group.employeeCount += 1;
    group.totalAmount = parseDisbursementAmount(Math.round((group.totalAmount + netPay) * 100) / 100);
  }
  return Object.values(acc).sort((a, b) => a.bankCode.localeCompare(b.bankCode));
}

/**
 * Escape CSV values using the delimiter of the selected export template.
 */
export function csvEscape(val: string | number, delimiter = ','): string {
  const s = String(val ?? '');
  if (s.includes(delimiter) || /["\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Fungsi (c) — generate CSV content per bank template.
 *
 * Existing export templates (bank acceptance is not implied):
 *  - BCA     : KlikBCA format ";" delimiter: KODE_TRANSAKSI;NO_REKENING;NAMA_PENERIMA;NOMINAL;KETERANGAN
 *  - MANDIRI : Mandiri Online format "," delimiter: NO_REKENING,NAMA,NOMINAL,KETERANGAN
 *  - BNI     : BNI e-Collect format "," delimiter: REKENING,NAMA,NOMOR_REF,NOMINAL,KETERANGAN
 *  - OTHER   : fallback generic "," delimiter: BANK,REKENING,NAMA,NOMOR_REF,NOMINAL,KETERANGAN
 *  - UNASSIGNED: placeholder CSV dengan warning columns (karyawan perlu dilengkapi data bank dulu)
 *
 * Return: { header, rows: string[], content: string }
 */
export function generateBankCsv(bankCode: string, rows: DisbursementRow[], bankName?: string, options: { amountPrecision?: 0 | 2 } = {}) {
  const code = (bankCode || 'OTHER').toUpperCase();
  const toAmount = (n: number) => options.amountPrecision === 2
    ? parseDisbursementAmount(n).toFixed(2)
    : Math.round(parseDisbursementAmount(n)); // preserve existing callers' integer-rupiah rounding

  let headers: string[] = [];
  let buildRow: (r: DisbursementRow, idx: number) => (string | number)[];
  let delimiter = ',';

  switch (code) {
    case 'BCA':
      delimiter = ';';
      headers = ['KODE_TRANSAKSI', 'NO_REKENING', 'NAMA_PENERIMA', 'NOMINAL', 'KETERANGAN'];
      buildRow = (r) => ['TRFO', r.accountNumber, r.accountHolder, toAmount(r.netPay), r.description];
      break;
    case 'MANDIRI':
      delimiter = ',';
      headers = ['NO_REKENING', 'NAMA', 'NOMINAL', 'KETERANGAN'];
      buildRow = (r) => [r.accountNumber, r.accountHolder, toAmount(r.netPay), r.description];
      break;
    case 'BNI':
      delimiter = ',';
      headers = ['REKENING', 'NAMA', 'NOMOR_REF', 'NOMINAL', 'KETERANGAN'];
      buildRow = (r) => [r.accountNumber, r.accountHolder, r.referenceNo, toAmount(r.netPay), r.description];
      break;
    case 'UNASSIGNED':
      delimiter = ',';
      headers = ['WARNING', 'PAYSLIP_ID', 'EMPLOYEE_ID', 'NAMA_KARYAWAN', 'NET_PAY', 'ALASAN'];
      buildRow = (r) => ['[ISIKAN DATA BANK DAHULU]', r.payslipId, r.employeeId, r.employeeName, toAmount(r.netPay), 'Rekening bank tidak ditemukan / tidak aktif di EmployeeBankAccount + legacy field bankAccount kosong.'];
      break;
    case 'OTHER':
    default:
      delimiter = ',';
      headers = ['BANK', 'REKENING', 'NAMA', 'NOMOR_REF', 'NOMINAL', 'KETERANGAN'];
      buildRow = (r) => [r.bankName || bankName || 'OTHER', r.accountNumber, r.accountHolder, r.referenceNo, toAmount(r.netPay), r.description];
      break;
  }

  const rowsArr: string[] = (rows || []).map((r, idx) => buildRow(r, idx).map((v) => csvEscape(v, delimiter)).join(delimiter));
  const headerLine = headers.join(delimiter);
  const content = [headerLine, ...rowsArr].join('\n') + '\n';
  const filename = `disbursement_${code}_${rows.length}karyawan_${new Date().toISOString().slice(0, 10)}.${code === 'BCA' ? 'csv' : 'csv'}`;
  return {
    bankCode: code,
    headers,
    delimiter,
    rows: rowsArr,
    content,
    filename,
    totalRows: rowsArr.length,
  };
}
