import { DEFAULT_PPH21_CONFIG, computePtkp, taxOnPkp, type Pph21Config } from './pph21';

/**
 * PPh 21 on THR — deliberately one isolated function (A2 Fase 1).
 *
 * THR is irregular income (penghasilan tidak teratur), so its tax is the
 * INCREMENT it adds to the year's liability, not a tax computed on it in
 * isolation: the same THR costs more for someone already in a higher bracket.
 * Taxing it standalone would under-withhold for exactly the employees whose
 * December reconciliation then produces a painful correction.
 *
 *     tax = annualTax(regular + THR) - annualTax(regular)
 *
 * Nothing here is a new rate table. It composes the statutory pieces that
 * already exist — `computePtkp` and `taxOnPkp`, both parameterised per tenant
 * and per year through TaxBracket/PtkpTable — so when a company overrides its
 * brackets this follows automatically.
 *
 * ONE KNOWN LIMIT, and it is the reason this is a separate file: the monthly
 * withholding engine still uses the annualised-net method of UU HPP 2022, not
 * TER (PMK 168/2023, GAP-40). THR's treatment under TER differs, so this
 * function is the single place that changes when A1 lands — its callers do not
 * need to know which method is in force.
 */

/** Biaya jabatan is 5% capped at 500k/month, which is 6,000,000 a year. */
function annualBiayaJabatan(annualGross: number, config: Pph21Config): number {
  return Math.min(annualGross * config.biayaJabatanRate, config.biayaJabatanMaxMonth * 12);
}

function annualTaxOn(annualGross: number, params: {
  married: boolean; dependents: number; annualPension: number; hasNpwp?: boolean;
}, config: Pph21Config): number {
  const net = annualGross - annualBiayaJabatan(annualGross, config) - Math.max(0, params.annualPension);
  const ptkp = computePtkp(params.married, params.dependents, config);
  // PKP is floored to the nearest 1,000 rupiah per regulation.
  const pkp = Math.max(0, Math.floor((net - ptkp) / 1000) * 1000);
  let tax = taxOnPkp(pkp, config.brackets);
  if (params.hasNpwp === false) tax *= 1 + config.noNpwpSurcharge;
  return tax;
}

export interface ThrTaxInput {
  /** Regular taxable gross per month, the same figure the monthly run taxes. */
  monthlyGross: number;
  /** The THR about to be paid. */
  thrAmount: number;
  married: boolean;
  dependents: number;
  /** Employee-paid deductible pension per month (BPJS JHT + JP). */
  monthlyPensionContribution?: number;
  hasNpwp?: boolean;
}

export interface ThrTaxResult {
  /** Tax withheld on the THR. Never negative. */
  tax: number;
  annualTaxWithoutThr: number;
  annualTaxWithThr: number;
}

export function calculateThrTax(input: ThrTaxInput, config: Partial<Pph21Config> = {}): ThrTaxResult {
  const c = { ...DEFAULT_PPH21_CONFIG, ...config };
  const monthlyGross = Math.max(0, input.monthlyGross);
  const thr = Math.max(0, input.thrAmount);
  const params = {
    married: input.married,
    dependents: input.dependents,
    annualPension: Math.max(0, input.monthlyPensionContribution ?? 0) * 12,
    hasNpwp: input.hasNpwp,
  };

  const without = annualTaxOn(monthlyGross * 12, params, c);
  const with_ = annualTaxOn(monthlyGross * 12 + thr, params, c);

  return {
    // Clamped: a bracket table a tenant has misconfigured must not produce a
    // negative withholding, which would pay the employee extra out of tax.
    tax: Math.max(0, Math.round(with_ - without)),
    annualTaxWithoutThr: Math.round(without),
    annualTaxWithThr: Math.round(with_),
  };
}
