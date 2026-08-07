import {
  calculateOvertimePay,
  calculateLateDeduction,
  hourlyOvertimeRate,
} from './overtime';

describe('overtime pay — UU Pasal 78 / PP 35/2021 (hardening Attendance)', () => {
  it('upah/jam = gaji / 173', () => {
    expect(hourlyOvertimeRate(5_000_000)).toBeCloseTo(28_901.73, 1);
  });

  it('hari kerja biasa 3 jam: jam-1 1,5× + jam 2&3 2× = 5,5 equivalent hours', () => {
    const r = calculateOvertimePay({ monthlyWage: 5_000_000, hours: 3, dayType: 'WORKDAY' });
    expect(r.weightedHours).toBeCloseTo(5.5, 5);
    // 28.901,73 × 5,5 = 158.960 (dibulatkan)
    expect(r.amount).toBe(158_960);
  });

  it('hari kerja biasa 1 jam = 1,5×', () => {
    const r = calculateOvertimePay({ monthlyWage: 3_460_000, hours: 1, dayType: 'WORKDAY' });
    expect(r.weightedHours).toBeCloseTo(1.5, 5);
  });

  it('hari libur 5-hari kerja, 10 jam: 8×2 + 1×3 + 1×4 = 23 equivalent hours', () => {
    const r = calculateOvertimePay({ monthlyWage: 5_000_000, hours: 10, dayType: 'HOLIDAY', workweekDays: 5 });
    expect(r.weightedHours).toBeCloseTo(23, 5);
  });

  it('hari libur 6-hari kerja, 9 jam: 7×2 + 1×3 + 1×4 = 21 equivalent hours', () => {
    const r = calculateOvertimePay({ monthlyWage: 5_000_000, hours: 9, dayType: 'HOLIDAY', workweekDays: 6 });
    expect(r.weightedHours).toBeCloseTo(21, 5);
  });
});

describe('late deduction — 4 tingkat (hardening Attendance)', () => {
  const wage = 4_400_000; // upah harian = 4.400.000 / 22 = 200.000
  const meal = 20_000;

  it('0–15 mnt → tanpa potongan', () => {
    expect(calculateLateDeduction({ monthlyWage: wage, lateMinutes: 10, mealAllowance: meal }).totalDeduction).toBe(0);
  });

  it('16–30 mnt → potong ½ uang makan', () => {
    const r = calculateLateDeduction({ monthlyWage: wage, lateMinutes: 20, mealAllowance: meal });
    expect(r.tier).toBe('TIER_2');
    expect(r.totalDeduction).toBe(10_000);
  });

  it('31–60 mnt → 1× uang makan + ½ hari upah', () => {
    const r = calculateLateDeduction({ monthlyWage: wage, lateMinutes: 45, mealAllowance: meal });
    expect(r.tier).toBe('TIER_3');
    expect(r.mealDeduction).toBe(20_000);
    expect(r.basicDeduction).toBe(100_000); // ½ × 200.000
    expect(r.totalDeduction).toBe(120_000);
  });

  it('>60 mnt → 1 hari upah pokok', () => {
    const r = calculateLateDeduction({ monthlyWage: wage, lateMinutes: 90, mealAllowance: meal });
    expect(r.tier).toBe('TIER_4');
    expect(r.totalDeduction).toBe(200_000);
  });
});
