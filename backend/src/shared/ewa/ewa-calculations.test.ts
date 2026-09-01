import { computeEarnedGrossFromInputs, DEFAULT_WORKDAYS_FALLBACK } from './ewa-calculations';
import { calculateOvertimePay } from '../attendance/overtime';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * EWA Calculate Earned Gross — UNIT TEST PURE FUNCTIONS
 * (Re-Review #5 Rekomendasi user explicit Priority #1 Scenario b)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Semua test membandingkan hasil computeEarnedGrossFromInputs dengan
 * perhitungan manual step-by-step (bukan percaya nilai return → verify
 * tiap komponen breakdown: dailyRate, baseEarned, overtime sum, total).
 */

// Fixture: baseSalary 10 juta rupiah (contoh gaji umum staff entry level)
const SALARY_10JT = 10_000_000;
// Divisor 173 dari overtime rules
const OVERTIME_DIVISOR = 173;
const HOURLY_RATE_10JT = SALARY_10JT / OVERTIME_DIVISOR; // ≈57.803,468

describe('EWA :: computeEarnedGrossFromInputs PURE calculations (Re-Review #5 Coverage)', () => {
  it('EWA-CALC CASE1: Skenario Normal 21 Present Days (20 PRESENT + 1 LATE), workDays 22, Overtime 2h WORKDAY → match perhitungan manual 100%', () => {
    const workDays = 22;
    const presentDays = 21;
    const overtime2hWorkday = [{ hours: 2, dayType: 'WORKDAY' as const }];

    // Step manual:
    const dailyRateManual = SALARY_10JT / workDays; // ≈454.545,45
    const baseEarnedManual = dailyRateManual * presentDays; // ≈9.545.454,55
    // Overtime WORKDAY 2 jam: jam ke-1 = 1,5x; jam ke-2 = 2x → weighted 1,5+2 = 3,5 hours
    const otManual = (1.5 * HOURLY_RATE_10JT) + (2 * HOURLY_RATE_10JT); // ≈57.803,468 × 3,5 = 202.312,14
    const expectedTotal = Math.max(0, baseEarnedManual + otManual);

    const res = computeEarnedGrossFromInputs({
      baseSalary: SALARY_10JT,
      workDaysInPeriod: workDays,
      presentDaysCount: presentDays,
      overtimeEntries: overtime2hWorkday,
    });

    // Assert tiap komponen (bukan cuma total → detect breakdown salah)
    expect(res.workDaysUsed).toBe(workDays);
    expect(res.presentDaysUsed).toBe(presentDays);
    expect(res.dailyRate).toBeCloseTo(dailyRateManual, 5);
    expect(res.baseEarnedFromPresentDays).toBeCloseTo(baseEarnedManual, 2);
    expect(res.totalOvertimePay).toBeCloseTo(otManual, 0);
    expect(res.overtimeBreakdown).toHaveLength(1);
    expect(res.overtimeBreakdown[0].hours).toBe(2);
    expect(res.overtimeBreakdown[0].dayType).toBe('WORKDAY');
    expect(res.earnedGrossToDate).toBeCloseTo(expectedTotal, 0);

    // Cross-verify dengan calculateOvertimePay asli (pastikan integration match)
    const otDirect = calculateOvertimePay({ monthlyWage: SALARY_10JT, hours: 2, dayType: 'WORKDAY' });
    expect(res.totalOvertimePay).toBeCloseTo(otDirect.amount, 0);
  });

  it('EWA-CALC CASE2: Active salary TIDAK DITEMUKAN baseSalary=0 → earnedGross 0 (EWA TIDAK BISA diajukan sesuai fallback guard service)', () => {
    const res = computeEarnedGrossFromInputs({
      baseSalary: 0,
      workDaysInPeriod: 22,
      presentDaysCount: 21,
      overtimeEntries: [{ hours: 2, dayType: 'WORKDAY' }],
    });

    expect(res.baseEarnedFromPresentDays).toBe(0);
    expect(res.totalOvertimePay).toBe(0); // base salary 0 → overtime 0 juga (upah/jam = 0/173=0)
    expect(res.earnedGrossToDate).toBe(0);
  });

  it('EWA-CALC CASE3: Present days = 0 (belum pernah masuk sama sekali) → earnedGross 0 walaupun overtime 0', () => {
    const res = computeEarnedGrossFromInputs({
      baseSalary: SALARY_10JT,
      workDaysInPeriod: 22,
      presentDaysCount: 0,
      overtimeEntries: [],
    });

    expect(res.presentDaysUsed).toBe(0);
    expect(res.baseEarnedFromPresentDays).toBe(0);
    expect(res.totalOvertimePay).toBe(0);
    expect(res.earnedGrossToDate).toBe(0);
  });

  it('EWA-CALC CASE4: Overtime CAMPURAN 2h WORKDAY + 4h HOLIDAY (weekend) → overtime sum sesuai 2x/3x rate', () => {
    const workDays = 22;
    const presentDays = 22; // full hadir semua hari kerja
    // 2h WORKDAY + 4h HOLIDAY (workweek default 5 hari → HOLIDAY band 8jam pertama = 2x semua)
    const overtimeEntries = [
      { hours: 2, dayType: 'WORKDAY' as const },
      { hours: 4, dayType: 'HOLIDAY' as const },
    ];

    const res = computeEarnedGrossFromInputs({
      baseSalary: SALARY_10JT,
      workDaysInPeriod: workDays,
      presentDaysCount: presentDays,
      overtimeEntries,
    });

    // Manual verify: HOLIDAY 4h = 4×2×hourly = 8×HOURLY_RATE; WORKDAY 2h = 3.5×HOURLY_RATE; TOTAL weighted = 11,5×HOURLY_RATE
    const otWorkday = calculateOvertimePay({ monthlyWage: SALARY_10JT, hours: 2, dayType: 'WORKDAY' }).amount;
    const otHoliday = calculateOvertimePay({ monthlyWage: SALARY_10JT, hours: 4, dayType: 'HOLIDAY' }).amount;
    expect(res.totalOvertimePay).toBeCloseTo(otWorkday + otHoliday, 0);

    // 22 days present + workDays 22 → baseEarned = baseSalary FULL (tanpa overtime)
    expect(res.baseEarnedFromPresentDays).toBeCloseTo(SALARY_10JT, 2);
    expect(res.earnedGrossToDate).toBeCloseTo(SALARY_10JT + otWorkday + otHoliday, 0);
  });

  it('EWA-CALC CASE5: Anti-Inflate Guard — presentDays 30 melebihi workDays 22 → CLAMP presentDays ke workDays (22) untuk mencegah nilai melebihi gaji bulanan jika data attendance di-spoof', () => {
    const res = computeEarnedGrossFromInputs({
      baseSalary: SALARY_10JT,
      workDaysInPeriod: 22,
      presentDaysCount: 30, // spoof: 30 hari hadir padahal cuma 22 hari kerja
      overtimeEntries: [],
    });

    expect(res.presentDaysUsed).toBe(22); // DICLAMP ke workDays (22), BUKAN 30
    expect(res.baseEarnedFromPresentDays).toBeCloseTo(SALARY_10JT, 2); // tepat 1 gaji, TIDAK LEBIH
    expect(res.earnedGrossToDate).toBeCloseTo(SALARY_10JT, 2);
  });

  it('EWA-CALC CASE6: workDaysInPeriod 0 (data tidak lengkap) → FALLBACK ke DEFAULT_WORKDAYS_FALLBACK = 22', () => {
    const res = computeEarnedGrossFromInputs({
      baseSalary: SALARY_10JT,
      workDaysInPeriod: 0,
      presentDaysCount: 11,
      overtimeEntries: [],
    });

    expect(res.workDaysUsed).toBe(DEFAULT_WORKDAYS_FALLBACK);
    // 11 present / 22 hari = 50% gaji
    expect(res.baseEarnedFromPresentDays).toBeCloseTo(SALARY_10JT * 0.5, 2);
    expect(res.earnedGrossToDate).toBeCloseTo(SALARY_10JT * 0.5, 2);
  });
});
