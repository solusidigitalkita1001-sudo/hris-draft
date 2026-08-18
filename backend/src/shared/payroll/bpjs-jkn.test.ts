/**
 * B.4 BPJS Kesehatan (JKN) Standalone Calculation Engine Tests
 *
 * Regulasi: JKN employer 4% + employee 1%, dihitung terhadap upah kerja bulanan
 * tetapi DIBATASI (capped) pada batas atas upah iuran JKN — 2024/2025 default: 12.000.000.
 *
 * Target 7 case acceptance B.4:
 *   1. Upah di bawah batas cap (5jt) → base actual wage
 *   2. Tepat di batas cap 12jt → base = 12jt (tidak over, tidak under)
 *   3. Upah 50jt OVER CAP → base hanya 12jt (aturan terpenting JKN!)
 *   4. Wage = 0 → 0
 *   5. Wage NEGATIVE guard → 0
 *   6. Custom cap override 8jt + custom rate 3% employer / 2% employee
 *   7. Default ratio employer : employee = 4 : 1 (total 5% dari base)
 */
import { calculateBpjs } from './bpjs';
import { DEFAULT_BPJS_CONFIG } from './bpjs';

function jknBreakdown(wage: number, custom: any = {}) {
  const b = calculateBpjs(wage, custom);
  const base = Math.min(Math.max(0, wage), custom.jknWageCap ?? DEFAULT_BPJS_CONFIG.jknWageCap);
  return {
    base,
    employeeJkn: b.employee.jkn,
    employerJkn: b.employer.jkn,
    total: b.employee.jkn + b.employer.jkn,
  };
}

describe('JKN BPJS Kesehatan standalone (B.4 acceptance criteria)', () => {
  const CAP_12M = DEFAULT_BPJS_CONFIG.jknWageCap;

  it('CASE 1. Upah 5.000.000 (< cap 12M) → base 5M, employee 1% = 50.000, employer 4% = 200.000', () => {
    const r = jknBreakdown(5_000_000);
    expect(r.base).toBe(5_000_000);
    expect(r.employeeJkn).toBe(50_000);
    expect(r.employerJkn).toBe(200_000);
    expect(r.total).toBe(250_000);
  });

  it('CASE 2. Tepat cap 12.000.000 → persis 1% 120rb employee, 4% 480rb employer', () => {
    const r = jknBreakdown(CAP_12M);
    expect(r.base).toBe(CAP_12M);
    expect(r.employeeJkn).toBe(120_000);
    expect(r.employerJkn).toBe(480_000);
    expect(r.total).toBe(600_000);
  });

  it('CASE 3. Upah 50.000.000 OVER CAP 12M → base HANYA 12jt, NOT 50jt! (aturan terpenting JKN)', () => {
    const r = jknBreakdown(50_000_000);
    expect(r.base).toBe(CAP_12M);
    expect(r.base).toBeLessThan(50_000_000);
    expect(r.employeeJkn).toBe(120_000);
    expect(r.employerJkn).toBe(480_000);
    expect(r.total).toBe(600_000);
  });

  it('CASE 4. Upah 0 → 0 semua (tanggung jawab perusahaan / pemerintah subsidi)', () => {
    const r = jknBreakdown(0);
    expect(r.base).toBe(0);
    expect(r.total).toBe(0);
  });

  it('CASE 5. Upah NEGATIVE guard → clamp 0, total 0 (no crash, no negative contribution)', () => {
    const r = jknBreakdown(-7_500_000);
    expect(r.base).toBe(0);
    expect(r.employeeJkn).toBeGreaterThanOrEqual(0);
    expect(r.employerJkn).toBeGreaterThanOrEqual(0);
    expect(r.total).toBe(0);
  });

  it('CASE 6. Custom override: cap 8.000.000 + rate employer 3% + employee 2% → split 160k/240k upah 30M', () => {
    const custom = { jknWageCap: 8_000_000, jknEmployerPercent: 3, jknEmployeePercent: 2 };
    const r = jknBreakdown(30_000_000, custom);
    expect(r.base).toBe(8_000_000);
    // 2% × 8M = 160.000 employee
    expect(r.employeeJkn).toBe(160_000);
    // 3% × 8M = 240.000 employer
    expect(r.employerJkn).toBe(240_000);
    expect(r.total).toBe(400_000);
  });

  it('CASE 7. Ratio default 4:1 (employer 4x employee contribution) di 3 level upah', () => {
    const cases = [3_000_000, 7_500_000, 12_000_000];
    for (const wage of cases) {
      const r = jknBreakdown(wage);
      expect(r.employerJkn).toBe(4 * r.employeeJkn);
    }
  });
});
