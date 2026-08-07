/**
 * Leave accrual calculation (hardening — Business Rule Gap modul Leave).
 *
 * Aturan bisnis yang di-hardening di sini:
 *  1. Pro-rate hak cuti tahunan berdasarkan tanggal masuk (join date) — dibulatkan ke bawah (floor).
 *  2. Carry-over sisa cuti tahun sebelumnya dengan batas maksimum (default 1 hari).
 *
 * Semua fungsi di file ini adalah PURE FUNCTION (tidak menyentuh DB) agar mudah diuji
 * dan dipakai ulang oleh service/scheduler akrual tahunan.
 */

/** Batas maksimum sisa cuti tahun lalu yang boleh dibawa ke tahun berjalan (hari). */
export const DEFAULT_MAX_CARRY_OVER_DAYS = 1;

/** Jumlah hari dalam satu tahun (memperhitungkan tahun kabisat). */
export function daysInYear(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 366 : 365;
}

/**
 * Hitung hak cuti tahunan pro-rata untuk seorang karyawan pada tahun tertentu.
 *
 * - Jika karyawan sudah bergabung SEBELUM tahun target → dapat kuota penuh.
 * - Jika bergabung DI TENGAH tahun target → pro-rata:
 *     floor( (sisa hari kalender sejak tanggal masuk s/d 31 Des, inklusif) / hariSetahun × kuotaTahunan )
 * - Jika bergabung SETELAH tahun target → 0 (belum berhak).
 *
 * Contoh: join 15 April 2023, kuota 12 hari, tahun 2023
 *   sisa hari 15 Apr–31 Des 2023 = 261 hari → floor(261/365 × 12) = floor(8,58) = 8 hari.
 */
export function calculateProratedEntitlement(params: {
  joinDate: Date;
  year: number;
  annualQuota: number;
}): number {
  const { joinDate, year, annualQuota } = params;
  if (annualQuota <= 0) return 0;

  const joinYear = joinDate.getUTCFullYear();

  // Sudah bekerja penuh sebelum tahun target → kuota penuh.
  if (joinYear < year) return annualQuota;

  // Belum bergabung pada tahun target → belum berhak.
  if (joinYear > year) return 0;

  // Bergabung di tengah tahun target → pro-rata berdasarkan sisa hari kalender.
  const yearEnd = Date.UTC(year, 11, 31); // 31 Desember tahun target
  const joinUTC = Date.UTC(joinDate.getUTCFullYear(), joinDate.getUTCMonth(), joinDate.getUTCDate());
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const remainingDaysInclusive = Math.floor((yearEnd - joinUTC) / MS_PER_DAY) + 1;

  const prorated = (remainingDaysInclusive / daysInYear(year)) * annualQuota;
  return Math.max(0, Math.floor(prorated));
}

/**
 * Hitung sisa cuti yang boleh dibawa (carry-over) dari tahun sebelumnya, dibatasi max.
 * Nilai negatif diperlakukan sebagai 0.
 */
export function calculateCarryOver(params: {
  previousRemaining: number;
  maxCarryOver?: number;
}): number {
  const max = params.maxCarryOver ?? DEFAULT_MAX_CARRY_OVER_DAYS;
  const previous = Math.max(0, params.previousRemaining);
  return Math.min(previous, max);
}

/**
 * Hitung total hak cuti awal tahun berjalan = pro-rate/kuota penuh + carry-over tahun lalu (dibatasi).
 * Dipakai saat inisialisasi / reset balance tahunan seorang karyawan.
 */
export function calculateOpeningBalance(params: {
  joinDate: Date;
  year: number;
  annualQuota: number;
  previousRemaining?: number;
  maxCarryOver?: number;
}): { entitlement: number; carryOver: number; totalDays: number } {
  const entitlement = calculateProratedEntitlement({
    joinDate: params.joinDate,
    year: params.year,
    annualQuota: params.annualQuota,
  });
  const carryOver = calculateCarryOver({
    previousRemaining: params.previousRemaining ?? 0,
    maxCarryOver: params.maxCarryOver,
  });
  return { entitlement, carryOver, totalDays: entitlement + carryOver };
}
