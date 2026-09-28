/**
 * Ringkasan dokumen untuk kartu approval (inbox "My Approvals").
 *
 * Masalah domain: workflow engine hanya menyimpan `referenceType` +
 * `referenceId`. Tanpa ringkasan, approver melihat UUID mentah dan tidak bisa
 * memutuskan approve/reject tanpa membuka modul lain. Modul ini memegang
 * SATU-SATUNYA tempat aturan "bagaimana dokumen X diringkas untuk approver",
 * sebagai fungsi murni supaya bisa diuji tanpa database.
 *
 * Kontrak sengaja SERAGAM lintas tipe dokumen (`title` + identitas pengaju +
 * daftar `lines` label/nilai) agar UI tidak perlu bercabang per referenceType.
 *
 * Catatan format:
 * - Label baris berbahasa Indonesia (bahasa domain HR proyek ini) dan dikirim
 *   apa adanya ke klien; klien tidak menerjemahkan ulang.
 * - Tanggal/jam diformat dari komponen UTC secara deterministik, mengikuti cara
 *   kolom `@db.Date` disimpan, sehingga hasil tidak bergeser oleh timezone
 *   proses server maupun runner test.
 */

export interface ApprovalSummaryLine {
  label: string;
  value: string;
}

export interface ApprovalSummary {
  title: string;
  requesterName: string | null;
  requesterNumber: string | null;
  lines: ApprovalSummaryLine[];
}

/** Panjang maksimal teks bebas (alasan/keperluan) di dalam ringkasan. */
export const SUMMARY_TEXT_MAX_LENGTH = 120;

const TITLE_BY_REFERENCE_TYPE: Record<string, string> = {
  LEAVE_REQUEST: 'Pengajuan Cuti',
  LOAN_REQUEST: 'Pengajuan Pinjaman',
  BUSINESS_TRIP: 'Pengajuan Perjalanan Dinas',
  EXPENSE_CLAIM: 'Pengajuan Klaim Biaya',
  SHIFT_SWAP_REQUEST: 'Pengajuan Tukar Shift',
  OVERTIME_REQUEST: 'Pengajuan Lembur',
  CAREER_MOVEMENT: 'Pengajuan Perubahan Karier',
  PERMISSION_REQUEST: 'Pengajuan Izin',
  ATTENDANCE_CORRECTION: 'Pengajuan Koreksi Absensi',
};

const PERMISSION_TYPE_LABELS: Record<string, string> = {
  SICK: 'Sakit',
  PERSONAL: 'Keperluan Pribadi',
  LATE: 'Datang Terlambat',
  EARLY_LEAVE: 'Pulang Lebih Awal',
  LEAVE_OFFICE: 'Keluar Kantor',
  BUSINESS_TRIP: 'Perjalanan Dinas',
  WORK_FROM_HOME: 'Kerja dari Rumah',
  OTHER: 'Lainnya',
};

const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  TRANSPORTATION: 'Transportasi',
  HOTEL: 'Akomodasi / Hotel',
  MEAL: 'Konsumsi',
  ENTERTAINMENT: 'Entertainment',
  OPERATIONAL: 'Operasional',
};

const CAREER_TRANSACTION_LABELS: Record<string, string> = {
  PROMOTION: 'Promosi',
  DEMOTION: 'Demosi',
  MUTATION: 'Mutasi',
  TRANSFER: 'Transfer',
  ROTATION: 'Rotasi',
  ACTING_ASSIGNMENT: 'Penugasan Sementara',
  STATUS_CHANGE: 'Perubahan Status Kerja',
};

// ==================== pembaca dokumen yang aman ====================
// Dokumen datang dari Prisma (bentuk berbeda per tipe) dan bisa juga null saat
// record sudah terhapus. Pembacaan dibuat defensif agar ringkasan tidak pernah
// melempar error di jalur inbox approval.

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as UnknownRecord) : null;
}

function readPath(doc: unknown, path: string[]): unknown {
  let current: unknown = doc;
  for (const key of path) {
    const record = asRecord(current);
    if (!record) return undefined;
    current = record[key];
  }
  return current;
}

function readText(doc: unknown, ...path: string[]): string | null {
  const value = readPath(doc, path);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function readDate(doc: unknown, ...path: string[]): Date | null {
  const value = readPath(doc, path);
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/** Angka, termasuk Prisma `Decimal` yang serialisasinya lewat `toString()`. */
function readNumber(doc: unknown, ...path: string[]): number | null {
  const value = readPath(doc, path);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || asRecord(value)) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function readEnumLabel(doc: unknown, labels: Record<string, string>, ...path: string[]): string | null {
  const raw = readText(doc, ...path);
  if (!raw) return null;
  return labels[raw] ?? humanizeCode(raw);
}

// ==================== formatter ====================

/** `PROMOTION` / `LEAVE_APPROVAL` → `Promotion` / `Leave Approval`. */
export function humanizeCode(code: string): string {
  return code
    .split(/[\s_-]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

/** dd/MM/yyyy dari komponen UTC. */
export function formatSummaryDate(date: Date | null): string | null {
  if (!date) return null;
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getUTCFullYear()}`;
}

/** HH:mm dari komponen UTC. */
export function formatSummaryTime(date: Date | null): string | null {
  if (!date) return null;
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Periode tanggal. Tanggal sama → satu tanggal saja (tidak ada gunanya
 * menampilkan "01/01/2026–01/01/2026" di kartu yang sempit).
 */
export function formatSummaryPeriod(start: Date | null, end: Date | null): string | null {
  const startLabel = formatSummaryDate(start);
  const endLabel = formatSummaryDate(end);
  if (startLabel && endLabel) return startLabel === endLabel ? startLabel : `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel;
}

/** Notasi angka Indonesia: titik ribuan, koma desimal, maksimal 2 desimal. */
export function formatSummaryNumber(value: number | null): string | null {
  if (value === null) return null;
  const negative = value < 0;
  const rounded = Math.round(Math.abs(value) * 100) / 100;
  const [integerPart, decimalPart] = rounded.toFixed(2).split('.');
  const grouped = (integerPart as string).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmedDecimal = (decimalPart as string).replace(/0+$/, '');
  const body = trimmedDecimal.length > 0 ? `${grouped},${trimmedDecimal}` : grouped;
  return negative ? `-${body}` : body;
}

export function formatSummaryCurrency(value: number | null): string | null {
  const formatted = formatSummaryNumber(value);
  return formatted === null ? null : `Rp ${formatted}`;
}

/** Potong teks bebas di batas kata supaya kartu approval tetap ringkas. */
export function truncateSummaryText(text: string | null, maxLength = SUMMARY_TEXT_MAX_LENGTH): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length === 0) return null;
  if (normalized.length <= maxLength) return normalized;
  const clipped = normalized.slice(0, maxLength);
  const lastSpace = clipped.lastIndexOf(' ');
  const body = lastSpace > maxLength * 0.6 ? clipped.slice(0, lastSpace) : clipped;
  return `${body.replace(/[.,;:\-–]$/, '')}…`;
}

// ==================== penyusun baris ====================

function pushLine(lines: ApprovalSummaryLine[], label: string, value: string | null): void {
  if (value !== null && value.length > 0) lines.push({ label, value });
}

function leaveRequestLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Jenis cuti', readText(doc, 'leaveType', 'name'));
  pushLine(lines, 'Periode', formatSummaryPeriod(readDate(doc, 'startDate'), readDate(doc, 'endDate')));
  const totalDays = readNumber(doc, 'totalDays');
  pushLine(lines, 'Durasi', totalDays === null ? null : `${formatSummaryNumber(totalDays)} hari`);
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function loanRequestLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Jenis pinjaman', readText(doc, 'loanType', 'name'));
  pushLine(lines, 'Jumlah', formatSummaryCurrency(readNumber(doc, 'amount')));
  const tenor = readNumber(doc, 'totalInstallments');
  const installment = formatSummaryCurrency(readNumber(doc, 'installmentAmount'));
  pushLine(
    lines,
    'Tenor',
    tenor === null ? null : `${formatSummaryNumber(tenor)} x angsuran${installment ? ` ${installment}` : ''}`,
  );
  pushLine(lines, 'Tujuan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function businessTripLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Tujuan', readText(doc, 'destination'));
  pushLine(lines, 'Periode', formatSummaryPeriod(readDate(doc, 'startDate'), readDate(doc, 'endDate')));
  pushLine(lines, 'Estimasi biaya', formatSummaryCurrency(readNumber(doc, 'estimatedCost')));
  pushLine(lines, 'Keperluan', truncateSummaryText(readText(doc, 'purpose')));
  return lines;
}

function expenseClaimLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Kategori', readEnumLabel(doc, EXPENSE_CATEGORY_LABELS, 'category'));
  pushLine(lines, 'Nominal', formatSummaryCurrency(readNumber(doc, 'amount')));
  pushLine(lines, 'Tanggal pengeluaran', formatSummaryDate(readDate(doc, 'expenseDate')));
  pushLine(lines, 'Perjalanan dinas', readText(doc, 'trip', 'destination'));
  pushLine(lines, 'Keterangan', truncateSummaryText(readText(doc, 'description')));
  return lines;
}

function shiftSwapLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Tanggal shift', formatSummaryDate(readDate(doc, 'shiftDate')));
  const targetName = readText(doc, 'targetEmployee', 'fullName');
  const targetNumber = readText(doc, 'targetEmployee', 'employeeNumber');
  pushLine(lines, 'Tukar dengan', targetName ? (targetNumber ? `${targetName} (${targetNumber})` : targetName) : null);
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function overtimeLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Tanggal', formatSummaryDate(readDate(doc, 'date')));
  const durationHours = readNumber(doc, 'durationHours');
  pushLine(lines, 'Durasi', durationHours === null ? null : `${formatSummaryNumber(durationHours)} jam`);
  const start = formatSummaryTime(readDate(doc, 'startTime'));
  const end = formatSummaryTime(readDate(doc, 'endTime'));
  pushLine(lines, 'Jam', start && end ? `${start} – ${end}` : (start ?? end));
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function careerMovementLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Jenis transaksi', readEnumLabel(doc, CAREER_TRANSACTION_LABELS, 'transactionType'));
  const fromPosition = readText(doc, 'fromPosition', 'name');
  const toPosition = readText(doc, 'toPosition', 'name');
  pushLine(lines, 'Posisi tujuan', toPosition ? (fromPosition ? `${fromPosition} → ${toPosition}` : toPosition) : null);
  pushLine(lines, 'Departemen tujuan', readText(doc, 'toDepartment', 'name'));
  pushLine(lines, 'Tanggal efektif', formatSummaryDate(readDate(doc, 'effectiveDate')));
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function permissionRequestLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Jenis izin', readEnumLabel(doc, PERMISSION_TYPE_LABELS, 'type'));
  pushLine(lines, 'Periode', formatSummaryPeriod(readDate(doc, 'startDate'), readDate(doc, 'endDate')));
  const duration = readNumber(doc, 'duration');
  pushLine(lines, 'Durasi', duration === null || duration <= 0 ? null : `${formatSummaryNumber(duration)} jam`);
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

function attendanceCorrectionLines(doc: unknown): ApprovalSummaryLine[] {
  const lines: ApprovalSummaryLine[] = [];
  pushLine(lines, 'Tanggal absensi', formatSummaryDate(readDate(doc, 'date')));
  const checkIn = formatSummaryTime(readDate(doc, 'requestedCheckIn'));
  const checkOut = formatSummaryTime(readDate(doc, 'requestedCheckOut'));
  pushLine(lines, 'Jam masuk diajukan', checkIn);
  pushLine(lines, 'Jam keluar diajukan', checkOut);
  pushLine(lines, 'Alasan', truncateSummaryText(readText(doc, 'reason')));
  return lines;
}

const LINE_BUILDERS: Record<string, (doc: unknown) => ApprovalSummaryLine[]> = {
  LEAVE_REQUEST: leaveRequestLines,
  LOAN_REQUEST: loanRequestLines,
  BUSINESS_TRIP: businessTripLines,
  EXPENSE_CLAIM: expenseClaimLines,
  SHIFT_SWAP_REQUEST: shiftSwapLines,
  OVERTIME_REQUEST: overtimeLines,
  CAREER_MOVEMENT: careerMovementLines,
  PERMISSION_REQUEST: permissionRequestLines,
  ATTENDANCE_CORRECTION: attendanceCorrectionLines,
};

/**
 * Kunci pemetaan dinormalisasi ke UPPER_SNAKE: MySQL membandingkan
 * `reference_type` secara case-insensitive, sehingga data lama bisa menyimpan
 * `leave_request` untuk dokumen yang sama dengan `LEAVE_REQUEST`. Tanpa
 * normalisasi, baris lama itu jatuh ke jalur "tipe tak dikenal" dan approver
 * kembali kehilangan konteks.
 */
export function normalizeReferenceType(referenceType: string): string {
  return (referenceType ?? '').trim().toUpperCase();
}

/** Apakah tipe referensi ini punya pemetaan ringkasan (dipakai untuk memilih query massal)? */
export function isSummarizableReferenceType(referenceType: string): boolean {
  return Object.prototype.hasOwnProperty.call(LINE_BUILDERS, normalizeReferenceType(referenceType));
}

/** Judul dokumen; tipe tak dikenal tetap dapat judul generik yang terbaca. */
export function buildSummaryTitle(referenceType: string): string {
  const known = TITLE_BY_REFERENCE_TYPE[normalizeReferenceType(referenceType)];
  if (known) return known;
  const humanized = humanizeCode(referenceType ?? '');
  return humanized.length > 0 ? `Pengajuan ${humanized}` : 'Pengajuan';
}

/**
 * Baris ringkasan untuk satu dokumen. Tipe tak dikenal atau dokumen yang sudah
 * hilang mengembalikan array kosong — bukan error: inbox approval harus tetap
 * bisa dirender dan approver tetap melihat judul + status.
 */
export function buildSummaryLines(referenceType: string, doc: unknown): ApprovalSummaryLine[] {
  if (!doc) return [];
  const builder = LINE_BUILDERS[normalizeReferenceType(referenceType)];
  return builder ? builder(doc) : [];
}

/**
 * Identitas pengaju. Sebagian dokumen memakai relasi `employee`, shift swap
 * memakai `requesterEmployee`.
 */
export function resolveSummaryRequester(doc: unknown): Pick<ApprovalSummary, 'requesterName' | 'requesterNumber'> {
  const employee = asRecord(readPath(doc, ['employee'])) ?? asRecord(readPath(doc, ['requesterEmployee']));
  return {
    requesterName: readText(employee, 'fullName'),
    requesterNumber: readText(employee, 'employeeNumber'),
  };
}

/** Ringkasan lengkap yang dikirim ke klien bersama tiap langkah approval. */
export function buildApprovalSummary(referenceType: string, doc: unknown): ApprovalSummary {
  return {
    title: buildSummaryTitle(referenceType),
    ...resolveSummaryRequester(doc),
    lines: buildSummaryLines(referenceType, doc),
  };
}
