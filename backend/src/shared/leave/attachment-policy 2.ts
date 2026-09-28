/**
 * Kebijakan lampiran pengajuan cuti (aturan H-7).
 *
 * Aturan bisnis: cuti minimal diajukan H-7 sebelum tanggal mulai. Pengajuan
 * pada H-7 atau lebih awal (>= 7 hari kalender sebelum tanggal mulai) boleh
 * tanpa lampiran; pengajuan H-6 ke bawah (termasuk hari-H dan tanggal mundur)
 * WAJIB menyertakan lampiran dokumen pendukung.
 *
 * Perhitungan berbasis kalender harian dan timezone-safe: kedua tanggal
 * dinormalisasi ke UTC date-only (komponen jam dibuang) sebelum selisih hari
 * dihitung, sehingga jam pengajuan tidak menggeser hasil.
 */

/** Batas minimal hari kalender (H-7) agar pengajuan cuti bebas lampiran. */
export const LEAVE_ATTACHMENT_MIN_DAYS_BEFORE = 7;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Normalisasi ke epoch UTC date-only (00:00:00 UTC pada tanggal UTC tsb). */
function toUtcDateOnly(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Selisih hari kalender (UTC date-only) antara tanggal mulai cuti dan tanggal
 * pengajuan. H-7 => 7, hari-H => 0, tanggal mundur => negatif.
 */
export function daysBeforeLeaveStart(startDate: Date, submittedAt: Date): number {
  return Math.round((toUtcDateOnly(startDate) - toUtcDateOnly(submittedAt)) / MS_PER_DAY);
}

/**
 * Apakah pengajuan cuti ini wajib menyertakan lampiran menurut aturan H-7?
 * - Diajukan pada H-{minDaysBefore} atau lebih awal → tidak wajib (false).
 * - Diajukan kurang dari H-{minDaysBefore} → wajib lampiran (true).
 */
export function leaveNeedsAttachment(
  startDate: Date,
  submittedAt: Date,
  minDaysBefore: number = LEAVE_ATTACHMENT_MIN_DAYS_BEFORE
): boolean {
  return daysBeforeLeaveStart(startDate, submittedAt) < minDaysBefore;
}
