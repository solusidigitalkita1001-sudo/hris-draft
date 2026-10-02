/**
 * Task 2.6 (FTR-011): PPh 21 monthly income tax engine.
 *
 * Uses the annualized net method (UU HPP 2022 brackets):
 *   netto/month = gross - biaya jabatan (5%, max 500k/mo) - pension contributions
 *   PKP = netto/year - PTKP (rounded down to nearest 1000)
 *   annual tax = progressive tariff on PKP; monthly = annual / 12
 * A 20% surcharge applies when the employee has no NPWP.
 *
 * All parameters are configurable per tenant/year via the TaxBracket and
 * PtkpTable reference tables (see payroll-policy.ts). The constants below are
 * the statutory defaults and the fallback when no reference rows exist —
 * identical values are seeded, so wiring the tables is behavior-preserving
 * until a company overrides them.
 */

export interface Pph21Config {
  ptkpBase: number;
  ptkpStep: number;
  maxDependents: number;
  biayaJabatanRate: number;
  biayaJabatanMaxMonth: number;
  /** [upperBound, rate] — last bound is Infinity. */
  brackets: Array<[number, number]>;
  /** Multiplier applied when the employee has no NPWP (0.2 = +20%). */
  noNpwpSurcharge: number;
  /** Direct PTKP lookup by `${'TK'|'K'}/${dependents}`; falls back to base+step. */
  ptkpAmounts?: ReadonlyMap<string, number>;
}

export const DEFAULT_PPH21_CONFIG: Pph21Config = {
  ptkpBase: 54_000_000, // TK/0
  ptkpStep: 4_500_000, // per spouse / per dependent
  maxDependents: 3,
  biayaJabatanRate: 0.05,
  biayaJabatanMaxMonth: 500_000,
  brackets: [
    [60_000_000, 0.05],
    [250_000_000, 0.15],
    [500_000_000, 0.25],
    [5_000_000_000, 0.3],
    [Infinity, 0.35],
  ],
  noNpwpSurcharge: 0.2,
};

export interface Pph21Input {
  /** Taxable gross per month (base + taxable allowances + taxable employer benefits). */
  monthlyGross: number;
  married: boolean;
  /** Dependents counted for PTKP (capped at 3). */
  dependents: number;
  /** Employee-paid deductible pension per month (BPJS JHT 2% + JP 1%). */
  monthlyPensionContribution?: number;
  /** Employees without an NPWP pay a 20% higher rate. */
  hasNpwp?: boolean;
}

export interface Pph21Result {
  ptkp: number;
  annualNet: number;
  pkp: number;
  annualTax: number;
  monthlyTax: number;
}

export function computePtkp(married: boolean, dependents: number, config: Partial<Pph21Config> = {}): number {
  const c = { ...DEFAULT_PPH21_CONFIG, ...config };
  const deps = Math.max(0, Math.min(dependents, c.maxDependents));
  const direct = c.ptkpAmounts?.get(`${married ? 'K' : 'TK'}/${deps}`);
  if (direct !== undefined) return direct;
  return c.ptkpBase + (married ? c.ptkpStep : 0) + deps * c.ptkpStep;
}

/** Progressive tax on annual PKP. */
export function taxOnPkp(pkp: number, brackets: Array<[number, number]> = DEFAULT_PPH21_CONFIG.brackets): number {
  let remaining = Math.max(0, pkp);
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, upper - lower);
    tax += slice * rate;
    remaining -= slice;
    lower = upper;
  }
  return tax;
}

export function calculatePph21(input: Pph21Input, config: Partial<Pph21Config> = {}): Pph21Result {
  const c = { ...DEFAULT_PPH21_CONFIG, ...config };
  const gross = Math.max(0, input.monthlyGross);
  const biayaJabatan = Math.min(gross * c.biayaJabatanRate, c.biayaJabatanMaxMonth);
  const pension = Math.max(0, input.monthlyPensionContribution ?? 0);

  const monthlyNet = gross - biayaJabatan - pension;
  const annualNet = monthlyNet * 12;
  const ptkp = computePtkp(input.married, input.dependents, c);

  // PKP is floored to the nearest 1,000 rupiah per regulation.
  const pkp = Math.max(0, Math.floor((annualNet - ptkp) / 1000) * 1000);

  let annualTax = taxOnPkp(pkp, c.brackets);
  if (input.hasNpwp === false) annualTax *= 1 + c.noNpwpSurcharge;

  annualTax = Math.round(annualTax);
  return { ptkp, annualNet, pkp, annualTax, monthlyTax: Math.round(annualTax / 12) };
}

export interface Pph21GrossUp {
  /** Tax allowance to pay, equal to the tax it causes. */
  allowance: number;
  /** The tax computation at the fixed point, for the payslip breakdown. */
  result: Pph21Result;
  /** False when the iteration ran out of passes before settling. */
  converged: boolean;
}

/**
 * Gross-up (GAP-17): the company bears the employee's PPh 21 by paying a tax
 * allowance that is itself taxable income. The allowance A must therefore
 * satisfy its own consequence:
 *
 *     A = tax(gross + A)
 *
 * Across the progressive brackets that has no closed form, so it is solved by
 * fixed-point iteration from A = 0. The map is a contraction — one extra
 * rupiah of allowance raises the annual tax by at most the top marginal rate
 * net of biaya jabatan (0.35 x 0.95 < 1), so every pass cuts the gap by two
 * thirds or better and a handful of passes land inside one rupiah.
 *
 * `allowance` is read back from the final tax figure rather than from the
 * value fed into it, so the allowance and the PPh 21 deduction on the payslip
 * are the same number to the rupiah. That is the whole point of gross-up: the
 * employee's take-home must not move when the tax does.
 */
export function grossUpTaxAllowance(
  input: Pph21Input,
  config: Partial<Pph21Config> = {},
  maxPasses = 24,
): Pph21GrossUp {
  let allowance = 0;
  let result = calculatePph21(input, config);
  let passes = 0;
  while (passes < maxPasses && Math.abs(result.monthlyTax - allowance) >= 1) {
    allowance = result.monthlyTax;
    result = calculatePph21({ ...input, monthlyGross: input.monthlyGross + allowance }, config);
    passes += 1;
  }
  return { allowance: result.monthlyTax, result, converged: Math.abs(result.monthlyTax - allowance) < 1 };
}
