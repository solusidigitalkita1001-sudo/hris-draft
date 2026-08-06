/**
 * Task 2.7 (FTR-012): BPJS tiered deduction engine.
 *
 * Splits statutory contributions into employee (deducted from net pay) and
 * employer (company cost) portions. Rates/caps are configurable per company;
 * defaults follow standard Indonesian rules.
 *
 * - JKK (work accident): employer, 0.24%–1.74% by industry risk class
 * - JKM (death): employer, 0.30%
 * - JHT (old age): 3.7% employer + 2% employee
 * - JP (pension): 2% employer + 1% employee, capped wage
 * - JKN (BPJS Kesehatan): 4% employer + 1% employee, wage capped at 12jt
 */

export interface BpjsConfig {
  jkkRatePercent: number;
  jkmRatePercent: number;
  jhtEmployerPercent: number;
  jhtEmployeePercent: number;
  jpEmployerPercent: number;
  jpEmployeePercent: number;
  jpWageCap: number;
  jknEmployerPercent: number;
  jknEmployeePercent: number;
  jknWageCap: number;
}

// Defaults: standard rates, JKK lowest risk class, 2025 JP cap, 12jt JKN cap.
export const DEFAULT_BPJS_CONFIG: BpjsConfig = {
  jkkRatePercent: 0.24,
  jkmRatePercent: 0.3,
  jhtEmployerPercent: 3.7,
  jhtEmployeePercent: 2,
  jpEmployerPercent: 2,
  jpEmployeePercent: 1,
  jpWageCap: 10_547_400,
  jknEmployerPercent: 4,
  jknEmployeePercent: 1,
  jknWageCap: 12_000_000,
};

export interface BpjsBreakdown {
  employee: { jht: number; jp: number; jkn: number; total: number };
  employer: { jkk: number; jkm: number; jht: number; jp: number; jkn: number; total: number };
}

const pct = (base: number, percent: number) => Math.round((base * percent) / 100);

export function calculateBpjs(
  monthlyWage: number,
  config: Partial<BpjsConfig> = {}
): BpjsBreakdown {
  const c = { ...DEFAULT_BPJS_CONFIG, ...config };
  const wage = Math.max(0, monthlyWage);
  const jpBase = Math.min(wage, c.jpWageCap);
  const jknBase = Math.min(wage, c.jknWageCap);

  const employee = {
    jht: pct(wage, c.jhtEmployeePercent),
    jp: pct(jpBase, c.jpEmployeePercent),
    jkn: pct(jknBase, c.jknEmployeePercent),
    total: 0,
  };
  employee.total = employee.jht + employee.jp + employee.jkn;

  const employer = {
    jkk: pct(wage, c.jkkRatePercent),
    jkm: pct(wage, c.jkmRatePercent),
    jht: pct(wage, c.jhtEmployerPercent),
    jp: pct(jpBase, c.jpEmployerPercent),
    jkn: pct(jknBase, c.jknEmployerPercent),
    total: 0,
  };
  employer.total = employer.jkk + employer.jkm + employer.jht + employer.jp + employer.jkn;

  return { employee, employer };
}
