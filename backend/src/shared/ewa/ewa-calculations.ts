import { calculateOvertimePay, type OvertimeDayType } from '../attendance/overtime';

/**
 * ════════════════════════════════════════════════════════════════════════
 * EWA PURE CALCULATIONS (no DB — fully testable without Prisma)
 * ════════════════════════════════════════════════════════════════════════
 *
 * Semua perhitungan matematis EWA diekstrak ke module PURE ini supaya bisa
 * di-unit-test tanpa mock prisma apa pun (sesuai rekomendasi Re-Review #5:
 * modul finansial WAJIB punya test perhitungan manual).
 *
 * Dipakai oleh:
 *   - EWAService.calculateEarnedGrossToDate() — setelah fetch raw data dari
 *     DB (salary, workDays, attendance groupBy, overtime list), hasil raw
 *     dipass ke PURE function ini untuk kalkulasi final numeric.
 */

export interface OvertimeEntrySimple {
  hours: number;
  dayType: OvertimeDayType;
}

export interface EarnedGrossCalcInput {
  baseSalary: number;
  workDaysInPeriod: number;
  presentDaysCount: number;
  overtimeEntries: OvertimeEntrySimple[];
  workweekDaysDefault?: 5 | 6;
}

export interface EarnedGrossCalcResult {
  dailyRate: number;
  baseEarnedFromPresentDays: number;
  totalOvertimePay: number;
  overtimeBreakdown: Array<{ hours: number; dayType: OvertimeDayType; subtotal: number }>;
  earnedGrossToDate: number;
  workDaysUsed: number;
  presentDaysUsed: number;
}

export const DEFAULT_WORKDAYS_FALLBACK = 22;

/**
 * Hitung pendapatan earned-to-date (EARNED GROSS) secara PURE dari input raw.
 * Formula:
 *   1. dailyRate = baseSalary / max(workDaysInPeriod, 1)
 *   2. baseEarned = dailyRate * presentDaysCount
 *   3. totalOvertimePay = Σ calculateOvertimePay(monthlyWage=baseSalary, hours, dayType)
 *        untuk setiap overtime entries
 *   4. FINAL earnedGrossToDate = MAX(0, baseEarned + totalOvertimePay) — clamp non-negatif
 *
 * Fallback guard: semua negative number di-clamp ke 0, workDays minimal 1,
 * presentDays tidak boleh exceed workDays (clamp ke atas workDays jika user
 * inject data attendance invalid untuk inflate nilai).
 */
export function computeEarnedGrossFromInputs(input: EarnedGrossCalcInput): EarnedGrossCalcResult {
  const workweekDays = input.workweekDaysDefault ?? 5;

  const baseSalarySafe = Math.max(0, Number(input.baseSalary) || 0);
  const workDaysSafe = Math.max(1, Number(input.workDaysInPeriod) || DEFAULT_WORKDAYS_FALLBACK);
  const presentDaysRaw = Math.max(0, Number(input.presentDaysCount) || 0);
  const presentDaysSafe = Math.min(presentDaysRaw, workDaysSafe); // clamp present <= workday (anti inflate)

  const dailyRate = workDaysSafe > 0 ? baseSalarySafe / workDaysSafe : 0;
  const baseEarned = dailyRate * presentDaysSafe;

  const overtimeBreakdown: EarnedGrossCalcResult['overtimeBreakdown'] = [];
  let totalOvertimePay = 0;
  for (const entry of input.overtimeEntries) {
    const h = Math.max(0, Number(entry.hours) || 0);
    if (h <= 0) continue;
    const pay = calculateOvertimePay({
      monthlyWage: baseSalarySafe,
      hours: h,
      dayType: entry.dayType,
      workweekDays,
    });
    totalOvertimePay += pay.amount;
    overtimeBreakdown.push({ hours: h, dayType: entry.dayType, subtotal: pay.amount });
  }

  const earnedGrossToDate = Math.max(0, baseEarned + totalOvertimePay);

  return {
    dailyRate,
    baseEarnedFromPresentDays: baseEarned,
    totalOvertimePay,
    overtimeBreakdown,
    earnedGrossToDate,
    workDaysUsed: workDaysSafe,
    presentDaysUsed: presentDaysSafe,
  };
}
