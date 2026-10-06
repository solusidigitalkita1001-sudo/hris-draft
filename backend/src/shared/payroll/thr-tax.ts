import { DEFAULT_PPH21_CONFIG, computePtkp, taxOnPkp, type Pph21Config } from './pph21';
import { terCategoryFor as terCategoryForInput, terRatePercent } from './ter';
import type { TerBracketRow, TerCategoryCode } from './ter-tables';

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
 * THAT LIMIT IS NOW CLOSED. TER (PP 58/2023, PMK 168/2023) has landed, and
 * under it THR is not taxed by an annual increment at all. PMK 168/2023
 * Pasal 5 lists a permanent employee's income as covering both the regular and
 * the irregular kind — "bonus, tunjangan hari raya, jasa produksi, tantiem,
 * gratifikasi, premi" — and Pasal 13 applies the monthly effective rate to
 * that whole gross. So a month containing THR simply has a larger bruto and is
 * withheld at the rate that bruto attracts:
 *
 *     tax = TER(regular + THR) x (regular + THR) - TER(regular) x regular
 *
 * which is the THR's share of the month's withholding. Both methods are
 * implemented here so callers still do not need to know which is in force;
 * they pass the method and get the right answer.
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
  /**
   * Which withholding method is in force. Defaults to ANNUALIZED so existing
   * callers keep their answer; the payroll run passes what the company chose.
   */
  method?: 'ANNUALIZED' | 'TER';
  /** Tenant TER bracket overrides; the statutory annex applies per category otherwise. */
  terTables?: Partial<Record<TerCategoryCode, readonly TerBracketRow[]>>;
}

export interface ThrTaxResult {
  /** Tax withheld on the THR. Never negative. */
  tax: number;
  /** Which method produced it. */
  method: 'ANNUALIZED' | 'TER';
  /** Annual figures, for the ANNUALIZED method. Zero under TER, which has none. */
  annualTaxWithoutThr: number;
  annualTaxWithThr: number;
  /** The month's effective rates, for TER. Zero under the annual method. */
  terRateWithoutThr: number;
  terRateWithThr: number;
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

  if (input.method === 'TER') {
    // The month's gross includes the THR (PMK 168/2023 Pasal 5), so the rate
    // is read twice: once for the salary alone and once for the month the THR
    // lands in. The difference is what the THR itself costs.
    const category = { married: input.married, dependents: input.dependents };
    const rateWithout = terRatePercent(
      terCategoryForInput(category.married, category.dependents), monthlyGross, input.terTables ?? {});
    const rateWith = terRatePercent(
      terCategoryForInput(category.married, category.dependents), monthlyGross + thr, input.terTables ?? {});
    const taxWithout = (monthlyGross * rateWithout) / 100;
    const taxWith = ((monthlyGross + thr) * rateWith) / 100;
    return {
      tax: Math.max(0, Math.round(taxWith - taxWithout)),
      method: 'TER',
      annualTaxWithoutThr: 0,
      annualTaxWithThr: 0,
      terRateWithoutThr: rateWithout,
      terRateWithThr: rateWith,
    };
  }

  const without = annualTaxOn(monthlyGross * 12, params, c);
  const with_ = annualTaxOn(monthlyGross * 12 + thr, params, c);

  return {
    // Clamped: a bracket table a tenant has misconfigured must not produce a
    // negative withholding, which would pay the employee extra out of tax.
    tax: Math.max(0, Math.round(with_ - without)),
    method: 'ANNUALIZED',
    annualTaxWithoutThr: Math.round(without),
    annualTaxWithThr: Math.round(with_),
    terRateWithoutThr: 0,
    terRateWithThr: 0,
  };
}
