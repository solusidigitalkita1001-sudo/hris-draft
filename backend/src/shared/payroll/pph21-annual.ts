import { DEFAULT_PPH21_CONFIG, Pph21Config, computePtkp, taxOnPkp } from './pph21';

export interface AnnualPph21Input {
  /** Taxable gross actually received, one entry per paid month of the year. */
  monthlyGrosses: number[];
  /** Deductible employee pension (JHT + JP) for the same months, aligned by index. */
  monthlyPensions?: number[];
  married: boolean;
  dependents: number;
  hasNpwp?: boolean;
}

export interface AnnualPph21Result {
  annualGross: number;
  biayaJabatan: number;
  pension: number;
  ptkp: number;
  annualNet: number;
  pkp: number;
  /** Tax genuinely owed for the year on the figures actually received. */
  annualTax: number;
}

/**
 * PPh21 on the year that actually happened.
 *
 * The monthly engine annualises one month twelve times, which is the correct
 * way to withhold as you go but is not the truth about the year: a bonus, a
 * THR, a mid-year raise, a change of PTKP status, or joining in March all make
 * "this month × 12" something the employee never actually earned. So the
 * December reconciliation recomputes from the real monthly figures.
 *
 * Biaya jabatan is summed **per month with its monthly cap**, not applied once
 * to the annual gross. Applying 5% to a year's income with a 6 million ceiling
 * gives the same answer only for people who earned evenly all year, and a
 * different — wrong — one for everybody else.
 */
export function calculateAnnualPph21(input: AnnualPph21Input, config: Partial<Pph21Config> = {}): AnnualPph21Result {
  const c = { ...DEFAULT_PPH21_CONFIG, ...config };

  const grosses = input.monthlyGrosses.map((value) => Math.max(0, value));
  const pensions = input.monthlyPensions ?? [];

  const annualGross = grosses.reduce((sum, value) => sum + value, 0);
  const biayaJabatan = grosses.reduce(
    (sum, gross) => sum + Math.min(gross * c.biayaJabatanRate, c.biayaJabatanMaxMonth),
    0,
  );
  const pension = grosses.reduce((sum, _gross, index) => sum + Math.max(0, pensions[index] ?? 0), 0);

  const annualNet = annualGross - biayaJabatan - pension;
  const ptkp = computePtkp(input.married, input.dependents, c);
  // PKP is floored to the nearest 1,000 rupiah per regulation, same as monthly.
  const pkp = Math.max(0, Math.floor((annualNet - ptkp) / 1000) * 1000);

  let annualTax = taxOnPkp(pkp, c.brackets);
  if (input.hasNpwp === false) annualTax *= 1 + c.noNpwpSurcharge;

  return {
    annualGross,
    biayaJabatan: Math.round(biayaJabatan),
    pension: Math.round(pension),
    ptkp,
    annualNet: Math.round(annualNet),
    pkp,
    annualTax: Math.round(annualTax),
  };
}

export interface Pph21CorrectionInput extends AnnualPph21Input {
  /** PPh21 already withheld across the year, including the month being paid. */
  withheldToDate: number;
}

export interface Pph21Correction {
  annual: AnnualPph21Result;
  withheldToDate: number;
  /** Positive: under-withheld, deduct more. Negative: over-withheld, refund. */
  delta: number;
}

/**
 * What December must settle.
 *
 * Positive delta means too little was withheld and the difference is deducted;
 * negative means too much was taken and it is refunded. Both directions are
 * real — an employee who resigned from a second job mid-year, or whose PTKP
 * status changed, is commonly over-withheld — so refusing to refund would quietly
 * keep money that is not the company's.
 */
export function calculatePph21Correction(
  input: Pph21CorrectionInput,
  config: Partial<Pph21Config> = {},
): Pph21Correction {
  const annual = calculateAnnualPph21(input, config);
  return {
    annual,
    withheldToDate: Math.round(input.withheldToDate),
    delta: Math.round(annual.annualTax - input.withheldToDate),
  };
}
