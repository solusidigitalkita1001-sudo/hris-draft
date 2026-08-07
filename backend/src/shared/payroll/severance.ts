/**
 * Perhitungan hak akhir pemutusan hubungan kerja / pesangon
 * (hardening — Business Rule Gap modul Onboarding/Exit).
 *
 * Referensi hukum: UU No. 13 Tahun 2003 Pasal 156 (sebagaimana komponennya tetap
 * dipertahankan pada UU Cipta Kerja / PP No. 35 Tahun 2021):
 *   - Ayat (2): Uang Pesangon (UP) — tabel berdasarkan masa kerja.
 *   - Ayat (3): Uang Penghargaan Masa Kerja (UPMK) — tabel berdasarkan masa kerja.
 *   - Ayat (4): Uang Penggantian Hak (UPH) — a.l. sisa cuti tahunan yang belum diambil,
 *               biaya pemulangan, dsb. (di sini diterima sebagai input agregat).
 *
 * CATATAN: PP 35/2021 mengalikan UP/UPMK dengan FAKTOR tertentu tergantung ALASAN PHK
 * (mis. efisiensi rugi 0,5×; pensiun 1,75×; meninggal 2×; mengundurkan diri = tidak dapat
 * UP/UPMK, hanya UPH + uang pisah). Faktor dibuat sebagai parameter agar dapat dikonfigurasi.
 *
 * Semua fungsi PURE (tanpa DB) agar mudah diuji dan dipakai ulang.
 */

export type EmploymentEndReason =
  | 'RESIGN' // mengundurkan diri sukarela → tanpa UP & UPMK
  | 'TERMINATION' // PHK (sepihak perusahaan) → UP + UPMK sesuai faktor
  | 'CONTRACT_END' // PKWT selesai → uang kompensasi (bukan UP/UPMK)
  | 'RETIREMENT' // pensiun
  | 'DEATH'; // meninggal dunia

export interface SeveranceInput {
  /** Upah bulanan yang diperhitungkan (gaji pokok + tunjangan tetap). */
  monthlyWage: number;
  /** Tanggal masuk kerja. */
  joinDate: Date;
  /** Tanggal terakhir bekerja (efektif berakhirnya hubungan kerja). */
  endDate: Date;
  /** Alasan berakhirnya hubungan kerja. */
  reason: EmploymentEndReason;
  /**
   * Faktor pengali Uang Pesangon (default sesuai alasan). Override untuk kasus khusus
   * (efisiensi 0,5×–1×, pensiun 1,75×, meninggal 2×, dst).
   */
  severanceFactor?: number;
  /** Faktor pengali UPMK (default 1× jika berhak). */
  upmkFactor?: number;
  /** Uang Penggantian Hak agregat non-cuti (biaya pulang kampung, dll). Default 0. */
  compensationOfRights?: number;
  /** Sisa hari cuti tahunan yang belum diambil (dikonversi uang, bagian dari UPH). */
  unusedLeaveDays?: number;
  /** Jumlah hari kerja per bulan untuk konversi uang cuti (default 22). */
  monthlyWorkingDays?: number;
}

export interface SeveranceResult {
  tenureYears: number;
  severanceMonths: number; // bulan UP (sebelum faktor)
  longServiceMonths: number; // bulan UPMK (sebelum faktor)
  severancePay: number; // UP setelah faktor
  longServicePay: number; // UPMK setelah faktor
  leaveCompensation: number; // uang sisa cuti (bagian UPH)
  compensationOfRights: number; // UPH lainnya
  total: number;
}

/** Masa kerja dalam tahun (desimal), berbasis selisih hari kalender. */
export function calculateTenureYears(joinDate: Date, endDate: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const join = Date.UTC(joinDate.getUTCFullYear(), joinDate.getUTCMonth(), joinDate.getUTCDate());
  const end = Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate());
  const days = Math.max(0, (end - join) / MS_PER_DAY);
  return days / 365;
}

/**
 * Uang Pesangon dalam satuan BULAN upah — UU 13/2003 Pasal 156 ayat (2).
 *   <1th=1, 1–<2=2, 2–<3=3, 3–<4=4, 4–<5=5, 5–<6=6, 6–<7=7, 7–<8=8, ≥8=9.
 */
export function severanceMonths(tenureYears: number): number {
  const y = Math.floor(tenureYears);
  if (y < 1) return 1;
  if (y >= 8) return 9;
  return y + 1;
}

/**
 * Uang Penghargaan Masa Kerja (UPMK) dalam satuan BULAN upah — Pasal 156 ayat (3).
 *   3–<6=2, 6–<9=3, 9–<12=4, 12–<15=5, 15–<18=6, 18–<21=7, 21–<24=8, ≥24=10.
 *   Masa kerja < 3 tahun = 0 (tidak berhak UPMK).
 */
export function longServiceMonths(tenureYears: number): number {
  const y = Math.floor(tenureYears);
  if (y < 3) return 0;
  if (y >= 24) return 10;
  // 3–5→2, 6–8→3, ... setiap kelipatan 3 tahun naik 1 bulan mulai dari 2.
  return Math.floor(y / 3) + 1;
}

/**
 * Faktor default UP/UPMK berdasarkan alasan (penyederhanaan PP 35/2021 yang umum dipakai).
 * Dapat di-override lewat input.severanceFactor / input.upmkFactor.
 */
function defaultFactors(reason: EmploymentEndReason): { severance: number; upmk: number; entitled: boolean } {
  switch (reason) {
    case 'RESIGN':
      return { severance: 0, upmk: 0, entitled: false };
    case 'CONTRACT_END':
      return { severance: 0, upmk: 0, entitled: false };
    case 'TERMINATION':
      return { severance: 1, upmk: 1, entitled: true };
    case 'RETIREMENT':
      return { severance: 1.75, upmk: 1, entitled: true };
    case 'DEATH':
      return { severance: 2, upmk: 1, entitled: true };
    default:
      return { severance: 1, upmk: 1, entitled: true };
  }
}

export function calculateSeverance(input: SeveranceInput): SeveranceResult {
  const tenureYears = calculateTenureYears(input.joinDate, input.endDate);
  const monthlyWorkingDays = input.monthlyWorkingDays ?? 22;
  const factors = defaultFactors(input.reason);

  const severanceFactor = input.severanceFactor ?? factors.severance;
  const upmkFactor = input.upmkFactor ?? factors.upmk;

  const upMonths = factors.entitled ? severanceMonths(tenureYears) : 0;
  const upmkMonths = factors.entitled ? longServiceMonths(tenureYears) : 0;

  const severancePay = Math.round(upMonths * input.monthlyWage * severanceFactor);
  const longServicePay = Math.round(upmkMonths * input.monthlyWage * upmkFactor);

  const unusedLeaveDays = Math.max(0, input.unusedLeaveDays ?? 0);
  const leaveCompensation = Math.round((input.monthlyWage / monthlyWorkingDays) * unusedLeaveDays);

  const compensationOfRights = Math.max(0, input.compensationOfRights ?? 0);

  const total = severancePay + longServicePay + leaveCompensation + compensationOfRights;

  return {
    tenureYears,
    severanceMonths: upMonths,
    longServiceMonths: upmkMonths,
    severancePay,
    longServicePay,
    leaveCompensation,
    compensationOfRights,
    total,
  };
}
