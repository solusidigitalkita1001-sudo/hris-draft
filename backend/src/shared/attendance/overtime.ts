/**
 * Perhitungan upah lembur & potongan keterlambatan
 * (hardening Business Rule Gap modul Attendance).
 *
 * Referensi: UU Ketenagakerjaan Pasal 78 & PP No. 35 Tahun 2021 Pasal 31–32.
 *   Upah/jam lembur = 1/173 × upah sebulan.
 *
 *   Hari kerja biasa:
 *     - jam ke-1            : 1,5×
 *     - jam ke-2 dan seterusnya : 2×
 *
 *   Hari libur mingguan / hari libur resmi:
 *     - 6 hari kerja/minggu (7 jam/hari): jam 1–7 = 2×, jam ke-8 = 3×, jam ke-9+ = 4×
 *     - 5 hari kerja/minggu (8 jam/hari): jam 1–8 = 2×, jam ke-9 = 3×, jam ke-10+ = 4×
 *
 * Semua fungsi PURE (tanpa DB).
 */

export const OVERTIME_MONTHLY_HOURS_DIVISOR = 173;

export type OvertimeDayType = 'WORKDAY' | 'HOLIDAY';

interface Band {
  hours: number; // lebar band (jam); Infinity untuk band terakhir
  rate: number; // pengali upah/jam
}

/** Upah lembur per jam = upah sebulan / 173. */
export function hourlyOvertimeRate(monthlyWage: number): number {
  return monthlyWage / OVERTIME_MONTHLY_HOURS_DIVISOR;
}

function overtimeBands(dayType: OvertimeDayType, workweekDays: 5 | 6): Band[] {
  if (dayType === 'WORKDAY') {
    return [
      { hours: 1, rate: 1.5 },
      { hours: Infinity, rate: 2 },
    ];
  }
  // HOLIDAY
  const baseHours = workweekDays === 6 ? 7 : 8;
  return [
    { hours: baseHours, rate: 2 },
    { hours: 1, rate: 3 },
    { hours: Infinity, rate: 4 },
  ];
}

export interface OvertimePayInput {
  monthlyWage: number;
  /** Total jam lembur (boleh pecahan, mis. 2,5 jam). */
  hours: number;
  dayType: OvertimeDayType;
  /** Jumlah hari kerja per minggu (5 atau 6). Default 5. */
  workweekDays?: 5 | 6;
}

export interface OvertimePayResult {
  hourlyRate: number;
  /** Total jam × pengali (equivalent hours) untuk transparansi. */
  weightedHours: number;
  amount: number;
  breakdown: Array<{ hours: number; rate: number; subtotal: number }>;
}

export function calculateOvertimePay(input: OvertimePayInput): OvertimePayResult {
  const workweekDays = input.workweekDays ?? 5;
  const rate = hourlyOvertimeRate(input.monthlyWage);
  const bands = overtimeBands(input.dayType, workweekDays);

  let remaining = Math.max(0, input.hours);
  let weightedHours = 0;
  const breakdown: OvertimePayResult['breakdown'] = [];

  for (const band of bands) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, band.hours);
    weightedHours += take * band.rate;
    breakdown.push({ hours: take, rate: band.rate, subtotal: Math.round(take * band.rate * rate) });
    remaining -= take;
  }

  return {
    hourlyRate: rate,
    weightedHours,
    amount: Math.round(weightedHours * rate),
    breakdown,
  };
}

// ─── Keterlambatan: 4 tingkat ───────────────────────────────────────────────

export type LateTier = 'ON_TIME' | 'WARNING' | 'TIER_2' | 'TIER_3' | 'TIER_4';

export interface LateDeductionInput {
  monthlyWage: number;
  lateMinutes: number;
  /** Nominal uang makan harian (parameter perusahaan). Default 0. */
  mealAllowance?: number;
  /** Hari kerja per bulan untuk konversi upah harian. Default 22. */
  workingDaysPerMonth?: number;
}

export interface LateDeductionResult {
  tier: LateTier;
  label: string;
  mealDeduction: number;
  basicDeduction: number;
  totalDeduction: number;
}

/**
 * 4 tingkat keterlambatan:
 *   0–15 mnt  : ON_TIME/WARNING — tanpa potongan
 *   16–30 mnt : potong ½ uang makan
 *   31–60 mnt : potong 1× uang makan + ½ hari upah pokok
 *   > 60 mnt  : potong 1 hari upah pokok (dianggap ½ hari tidak masuk / unpaid)
 */
export function calculateLateDeduction(input: LateDeductionInput): LateDeductionResult {
  const meal = Math.max(0, input.mealAllowance ?? 0);
  const dailyBasic = input.monthlyWage / (input.workingDaysPerMonth ?? 22);
  const m = Math.max(0, input.lateMinutes);

  if (m <= 15) {
    return { tier: m === 0 ? 'ON_TIME' : 'WARNING', label: 'Tanpa potongan', mealDeduction: 0, basicDeduction: 0, totalDeduction: 0 };
  }
  if (m <= 30) {
    const mealDeduction = Math.round(meal * 0.5);
    return { tier: 'TIER_2', label: 'Potong ½ uang makan', mealDeduction, basicDeduction: 0, totalDeduction: mealDeduction };
  }
  if (m <= 60) {
    const mealDeduction = Math.round(meal);
    const basicDeduction = Math.round(dailyBasic * 0.5);
    return {
      tier: 'TIER_3',
      label: 'Potong 1× uang makan + ½ hari upah pokok',
      mealDeduction,
      basicDeduction,
      totalDeduction: mealDeduction + basicDeduction,
    };
  }
  const basicDeduction = Math.round(dailyBasic);
  return { tier: 'TIER_4', label: 'Potong 1 hari upah pokok (unpaid)', mealDeduction: 0, basicDeduction, totalDeduction: basicDeduction };
}
