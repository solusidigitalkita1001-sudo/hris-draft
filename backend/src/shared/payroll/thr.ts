/**
 * THR (Tunjangan Hari Raya) calculator — hardening Business Rule Gap modul Payroll.
 *
 * Referensi: Permenaker No. 6 Tahun 2016 tentang THR Keagamaan.
 *   - Masa kerja ≥ 12 bulan  → THR = 1 × upah sebulan.
 *   - Masa kerja 1 s/d < 12 bulan → THR = (masa kerja dalam bulan / 12) × upah sebulan (prorata).
 *   - Masa kerja < 1 bulan → tidak berhak (0).
 *
 * "Upah sebulan" = upah pokok + tunjangan tetap (tidak termasuk tunjangan tidak tetap).
 * Semua fungsi PURE (tanpa DB) agar mudah diuji dan dipakai ulang.
 */

export const THR_MIN_MONTHS_FULL = 12;
export const THR_MIN_MONTHS_ELIGIBLE = 1;

/** Masa kerja dalam bulan penuh (floor) dari tanggal masuk s/d tanggal referensi. */
export function tenureMonths(joinDate: Date, referenceDate: Date): number {
  let months =
    (referenceDate.getUTCFullYear() - joinDate.getUTCFullYear()) * 12 +
    (referenceDate.getUTCMonth() - joinDate.getUTCMonth());
  // Belum genap satu bulan penuh jika tanggal referensi < tanggal masuk pada bulan itu.
  if (referenceDate.getUTCDate() < joinDate.getUTCDate()) {
    months -= 1;
  }
  return Math.max(0, months);
}

export interface ThrInput {
  /** Upah sebulan = gaji pokok + tunjangan tetap. */
  monthlyWage: number;
  joinDate: Date;
  /** Tanggal pembayaran THR / H-7 hari raya (default: sekarang saat dipanggil). */
  referenceDate: Date;
}

export interface ThrResult {
  tenureMonths: number;
  eligible: boolean;
  isProrated: boolean;
  /** Nilai THR dibulatkan ke rupiah terdekat. */
  amount: number;
}

export function calculateThr(input: ThrInput): ThrResult {
  const months = tenureMonths(input.joinDate, input.referenceDate);

  if (input.monthlyWage <= 0 || months < THR_MIN_MONTHS_ELIGIBLE) {
    return { tenureMonths: months, eligible: false, isProrated: false, amount: 0 };
  }

  if (months >= THR_MIN_MONTHS_FULL) {
    return {
      tenureMonths: months,
      eligible: true,
      isProrated: false,
      amount: Math.round(input.monthlyWage),
    };
  }

  // Prorata: (masa kerja bulan / 12) × upah sebulan.
  const amount = Math.round((months / THR_MIN_MONTHS_FULL) * input.monthlyWage);
  return { tenureMonths: months, eligible: true, isProrated: true, amount };
}
