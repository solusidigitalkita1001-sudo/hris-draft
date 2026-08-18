/**
 * B.6 Multibank Salary Disbursement — pure utilities (no DB).
 *
 * 3 fungsi utama:
 *   a. resolveEmployeeBankInfo()   : pilih bank primary karyawan, fallback ke legacy single fields (backward compat).
 *   b. groupPayslipsByBank()       : kelompokkan payslip karyawan per bank (untuk bulk transfer batch).
 *   c. generateBankCsv()           : export file CSV / TSV sesuai format standard bank umum Indonesia (BCA, Mandiri, BNI).
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
export function groupPayslipsByBank<T extends { id: string; employeeId: string; employee?: { fullName: string } | null; netPay: number | string }>(
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
        bankName: info.bankName,
        employeeCount: 0,
        totalAmount: 0,
        rows: [],
      };
    }
    const group = acc[info.bankCode];
    if (info.bankCode !== 'OTHER') group.bankName = info.bankCode; // BCA/MANDIRI/BNI pakai enum label, OVERRIDE nama bank lain per row.
    const netPay = Number(ps.netPay) || 0;
    group.rows.push({
      payslipId: ps.id,
      employeeId: ps.employeeId,
      employeeName: (emp?.fullName || ps.employee?.fullName || `Employee ${ps.employeeId.slice(0, 6)}`).trim(),
      accountNumber: info.accountNumber,
      accountHolder: info.accountHolder,
      netPay,
      referenceNo: `PS-${ps.id.slice(0, 8)}${info.bankCode}`,
      description: `Salary payout ${info.bankCode}`,
    });
    group.employeeCount += 1;
    group.totalAmount = Math.round((group.totalAmount + netPay) * 100) / 100;
  }
  return Object.values(acc).sort((a, b) => a.bankCode.localeCompare(b.bankCode));
}

/**
 * Utility kecil escape CSV value (kompilasi RFC4180 sederhana: wrap jika ada koma / quote / newlines).
 */
export function csvEscape(val: string | number): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/**
 * Fungsi (c) — generate CSV content / TSV per bank standard.
 *
 * Format standard umum transfer bulk:
 *  - BCA     : KlikBCA format ";" delimiter: KODE_TRANSAKSI;NO_REKENING;NAMA_PENERIMA;NOMINAL;KETERANGAN
 *  - MANDIRI : Mandiri Online format "," delimiter: NO_REKENING,NAMA,NOMINAL,KETERANGAN
 *  - BNI     : BNI e-Collect format "," delimiter: REKENING,NAMA,NOMOR_REF,NOMINAL,KETERANGAN
 *  - OTHER   : fallback generic "," delimiter: BANK,REKENING,NAMA,NOMOR_REF,NOMINAL,KETERANGAN
 *  - UNASSIGNED: placeholder CSV dengan warning columns (karyawan perlu dilengkapi data bank dulu)
 *
 * Return: { header, rows: string[], content: string }
 */
export function generateBankCsv(bankCode: string, rows: DisbursementRow[], bankName?: string) {
  const code = (bankCode || 'OTHER').toUpperCase();
  const toAmount = (n: number) => Math.round(Number(n || 0)); // integer rupiah, no sen

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
      buildRow = (r) => [bankName || 'OTHER', r.accountNumber, r.accountHolder, r.referenceNo, toAmount(r.netPay), r.description];
      break;
  }

  const rowsArr: string[] = (rows || []).map((r, idx) => buildRow(r, idx).map((v) => csvEscape(v)).join(delimiter));
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
