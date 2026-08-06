/**
 * Task 2.6 (FTR-011): PPh 21 monthly income tax engine.
 *
 * Uses the annualized net method (UU HPP 2022 brackets):
 *   netto/month = gross - biaya jabatan (5%, max 500k/mo) - pension contributions
 *   PKP = netto/year - PTKP (rounded down to nearest 1000)
 *   annual tax = progressive tariff on PKP; monthly = annual / 12
 * A 20% surcharge applies when the employee has no NPWP.
 */

const PTKP_BASE = 54_000_000; // TK/0
const PTKP_STEP = 4_500_000; // per spouse / per dependent
const MAX_DEPENDENTS = 3;

const BIAYA_JABATAN_RATE = 0.05;
const BIAYA_JABATAN_MAX_MONTH = 500_000;

// [upperBound, rate] — last bound is Infinity.
const BRACKETS: Array<[number, number]> = [
  [60_000_000, 0.05],
  [250_000_000, 0.15],
  [500_000_000, 0.25],
  [5_000_000_000, 0.3],
  [Infinity, 0.35],
];

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

export function computePtkp(married: boolean, dependents: number): number {
  const deps = Math.max(0, Math.min(dependents, MAX_DEPENDENTS));
  return PTKP_BASE + (married ? PTKP_STEP : 0) + deps * PTKP_STEP;
}

/** Progressive tax on annual PKP. */
export function taxOnPkp(pkp: number): number {
  let remaining = Math.max(0, pkp);
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of BRACKETS) {
    if (remaining <= 0) break;
    const slice = Math.min(remaining, upper - lower);
    tax += slice * rate;
    remaining -= slice;
    lower = upper;
  }
  return tax;
}

export function calculatePph21(input: Pph21Input): Pph21Result {
  const gross = Math.max(0, input.monthlyGross);
  const biayaJabatan = Math.min(gross * BIAYA_JABATAN_RATE, BIAYA_JABATAN_MAX_MONTH);
  const pension = Math.max(0, input.monthlyPensionContribution ?? 0);

  const monthlyNet = gross - biayaJabatan - pension;
  const annualNet = monthlyNet * 12;
  const ptkp = computePtkp(input.married, input.dependents);

  // PKP is floored to the nearest 1,000 rupiah per regulation.
  const pkp = Math.max(0, Math.floor((annualNet - ptkp) / 1000) * 1000);

  let annualTax = taxOnPkp(pkp);
  if (input.hasNpwp === false) annualTax *= 1.2; // no-NPWP surcharge

  annualTax = Math.round(annualTax);
  return { ptkp, annualNet, pkp, annualTax, monthlyTax: Math.round(annualTax / 12) };
}
