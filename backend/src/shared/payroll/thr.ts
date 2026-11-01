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

// ==================== Kelayakan berdasarkan hubungan kerja ====================

/**
 * Tenggang PKWTT: Permenaker 6/2016 Pasal 7 ayat (1) — pekerja dengan
 * hubungan kerja PKWTT yang berakhir dalam 30 hari sebelum hari raya tetap
 * berhak atas THR.
 */
export const THR_PKWTT_GRACE_DAYS = 30;

/** Status yang artinya hubungan kerja sudah berakhir, bukan sedang berjalan. */
const ENDED_EMPLOYMENT_STATUSES = new Set(['RESIGNED', 'TERMINATED', 'CONTRACT_END']);

/**
 * PKWTT = perjanjian kerja waktu TIDAK tertentu, yaitu karyawan tetap. Semua
 * tipe lain (kontrak, magang, probation, freelance, outsourcing) adalah
 * perjanjian berjangka: tenggang 30 hari tidak berlaku untuk mereka.
 */
const PKWTT_EMPLOYMENT_TYPE = 'PERMANENT';

export interface ThrEmploymentInput {
  /** `Employee.employmentType`; PERMANENT = PKWTT, sisanya diperlakukan PKWT. */
  employmentType: string | null | undefined;
  /** `Employee.employmentStatus` (ACTIVE/RESIGNED/TERMINATED/PROBATION/CONTRACT_END). */
  employmentStatus: string | null | undefined;
  /** `Employee.status` (ACTIVE/INACTIVE/ARCHIVED). */
  status?: string | null | undefined;
  /** `lastWorkingDate` dari resignation APPROVED terakhir, bila ada. */
  lastWorkingDate: Date | null | undefined;
  /** Tanggal hari raya. */
  holidayDate: Date;
}

export type ThrEligibilityReason =
  /** Masih punya hubungan kerja pada hari raya. */
  | 'employed-on-holiday'
  /** PKWTT, berakhir ≤ 30 hari sebelum hari raya. */
  | 'pkwtt-within-grace'
  /** PKWTT, berakhir > 30 hari sebelum hari raya. */
  | 'pkwtt-beyond-grace'
  /** PKWT yang jangka waktunya sudah berakhir. */
  | 'pkwt-relationship-ended'
  /** Sudah berakhir menurut status, tapi tanpa tanggal yang bisa diukur. */
  | 'relationship-ended-without-last-working-date'
  /** Nonaktif tanpa jejak berakhirnya hubungan kerja — data bertentangan. */
  | 'inactive-without-last-working-date';

export interface ThrEmploymentEligibility {
  entitled: boolean;
  /** Alasannya, supaya keputusan "tidak dibayar" bisa dijelaskan. */
  reason: ThrEligibilityReason;
}

/** Tengah malam UTC dari sebuah DateTime: tenggang dihitung per hari kalender. */
function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * Apakah orang ini masuk daftar bayar THR — pertanyaan yang berbeda dari
 * BERAPA, yang diurus `calculateThr`.
 *
 * Permenaker 6/2016 Pasal 2-3 dan 7: THR wajib dibayar kepada pekerja yang
 * masih punya hubungan kerja pada hari raya, ditambah pekerja PKWTT yang
 * hubungan kerjanya berakhir dalam 30 hari sebelum hari raya. Pekerja PKWT
 * yang jangka waktunya sudah berakhir tidak berhak, sedekat apa pun jaraknya
 * — perbedaan itulah yang membuat `employmentType` harus ikut diperiksa dan
 * bukan hanya tanggalnya.
 *
 * Kalau datanya tidak cukup untuk membuktikan hak (sudah berakhir tapi
 * tanggalnya tidak ada; nonaktif tanpa resignation), jawabannya TIDAK berhak:
 * tidak membayar bisa diperbaiki dengan melengkapi data, sedangkan uang yang
 * sudah keluar ke orang yang tidak berhak tidak bisa ditarik kembali.
 */
export function thrEmploymentEligibility(input: ThrEmploymentInput): ThrEmploymentEligibility {
  const holiday = utcDay(input.holidayDate);
  const lastWorkingDate = input.lastWorkingDate ?? null;

  if (lastWorkingDate) {
    // Hari kerja terakhir pada atau setelah hari raya: pada hari raya orang
    // ini masih pekerja, dan jenis kontraknya tidak relevan.
    if (utcDay(lastWorkingDate) >= holiday) return { entitled: true, reason: 'employed-on-holiday' };
    if (input.employmentType !== PKWTT_EMPLOYMENT_TYPE) {
      return { entitled: false, reason: 'pkwt-relationship-ended' };
    }
    const graceStart = holiday - THR_PKWTT_GRACE_DAYS * 86_400_000;
    return utcDay(lastWorkingDate) >= graceStart
      ? { entitled: true, reason: 'pkwtt-within-grace' }
      : { entitled: false, reason: 'pkwtt-beyond-grace' };
  }

  // Tidak ada resignation yang disetujui. Statusnya yang harus menjelaskan.
  if (input.employmentStatus && ENDED_EMPLOYMENT_STATUSES.has(input.employmentStatus)) {
    return { entitled: false, reason: 'relationship-ended-without-last-working-date' };
  }
  if (input.status && input.status !== 'ACTIVE') {
    return { entitled: false, reason: 'inactive-without-last-working-date' };
  }
  // ACTIVE dan PROBATION keduanya hubungan kerja yang berjalan: masa percobaan
  // tetap karyawan. Masa kerja < 1 bulan sudah ditangani `calculateThr`.
  return { entitled: true, reason: 'employed-on-holiday' };
}
