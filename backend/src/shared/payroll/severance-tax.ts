/**
 * PPh 21 final atas uang pesangon — PP 68/2009.
 *
 * The severance ENTITLEMENT is in `severance.ts` (UU 13/2003 pasal 156 and
 * PP 35/2021). This is the tax on it, which was missing entirely: the exit
 * calculation quoted a gross figure and nobody worked out what had to be
 * withheld, so the number an employee was shown on their last day was not the
 * number they would receive.
 *
 * Every figure below is quoted from the regulation's own text at
 * jdih.kemenkeu.go.id/api/download/fulltext/2009/68TAHUN2009PP.htm — an HTML
 * fulltext, not a scan, so the brackets are read rather than transcribed.
 *
 *   Pasal 1 angka 4: "Uang Pesangon adalah penghasilan yang dibayarkan oleh
 *     pemberi kerja ... sehubungan dengan berakhirnya masa kerja atau terjadi
 *     pemutusan hubungan kerja, TERMASUK uang penghargaan masa kerja dan uang
 *     penggantian hak." So UP, UPMK and UPH are one base, not three.
 *   Pasal 2 ayat (1): the withholding is FINAL.
 *   Pasal 2 ayat (2): payment within at most 2 calendar years still counts as
 *     "dibayarkan sekaligus".
 *   Pasal 4: 0% to 50 juta; 5% above 50 to 100 juta; 15% above 100 to 500
 *     juta; 25% above 500 juta.
 *   Pasal 5 (manfaat pensiun / THT / JHT sekaligus): 0% to 50 juta; 5% above.
 *   Pasal 6: from the THIRD calendar year the ordinary Pasal 17 tariff applies
 *     and the tax is no longer final but creditable.
 *
 * The regulation has no provision for a recipient without an NPWP, so no
 * surcharge is applied here — unlike monthly PPh 21, where the 20% surcharge
 * comes from the Pasal 21 rules rather than from this regulation.
 */

/** `[upperBound, rate]`; the last bound is Infinity. Rates are fractions. */
export type SeveranceTaxBracket = readonly [number, number];

/** PP 68/2009 Pasal 4 — uang pesangon (incl. UPMK and UPH). */
export const SEVERANCE_TAX_BRACKETS: readonly SeveranceTaxBracket[] = [
  [50_000_000, 0],
  [100_000_000, 0.05],
  [500_000_000, 0.15],
  [Infinity, 0.25],
];

/** PP 68/2009 Pasal 5 — uang manfaat pensiun, THT or JHT paid in a lump sum. */
export const PENSION_LUMP_SUM_TAX_BRACKETS: readonly SeveranceTaxBracket[] = [
  [50_000_000, 0],
  [Infinity, 0.05],
];

export type LumpSumKind = 'SEVERANCE' | 'PENSION_LUMP_SUM';

const BRACKETS: Record<LumpSumKind, readonly SeveranceTaxBracket[]> = {
  SEVERANCE: SEVERANCE_TAX_BRACKETS,
  PENSION_LUMP_SUM: PENSION_LUMP_SUM_TAX_BRACKETS,
};

/** Progressive tax on one cumulative gross figure. */
function taxOnGross(gross: number, brackets: readonly SeveranceTaxBracket[]): number {
  let lower = 0;
  let tax = 0;
  for (const [upper, rate] of brackets) {
    if (gross <= lower) break;
    tax += (Math.min(gross, upper) - lower) * rate;
    lower = upper;
  }
  return tax;
}

export interface SeveranceTaxInput {
  /** This instalment's gross. For severance that is UP + UPMK + UPH. */
  gross: number;
  kind?: LumpSumKind;
  /**
   * Gross already paid for the same termination earlier in the 2-calendar-year
   * window, so the brackets climb across instalments instead of restarting.
   *
   * The regulation states the brackets against "penghasilan bruto" without
   * spelling out that a split payment accumulates. Treating each instalment
   * separately would let a 100 juta severance paid as two 50 juta halves be
   * taxed at nothing at all — which is precisely what the 2-calendar-year rule
   * in Pasal 2 ayat (2) exists to prevent, so cumulative is the only reading
   * under which that rule does anything.
   */
  previouslyPaidGross?: number;
  /**
   * Which calendar year of the payout this instalment falls in, counting the
   * first payment's year as 1. Pasal 6 moves year three onward to the ordinary
   * Pasal 17 tariff, non-final.
   */
  calendarYearIndex?: number;
}

export interface SeveranceTaxResult {
  /** Tax on this instalment: tax(cumulative) - tax(already paid). */
  tax: number;
  /** Gross including this instalment. */
  cumulativeGross: number;
  /** Tax on the whole cumulative gross, before crediting earlier instalments. */
  cumulativeTax: number;
  /** PP 68/2009 pasal 2 ayat (1). Always true here; year 3+ is refused. */
  isFinal: true;
}

export function calculateSeveranceTax(input: SeveranceTaxInput): SeveranceTaxResult {
  const yearIndex = input.calendarYearIndex ?? 1;
  if (yearIndex >= 3) {
    // Refused rather than approximated: Pasal 6 sends this to the ordinary
    // Pasal 17 tariff on the year's gross, which needs the annual engine and
    // produces a creditable — not final — withholding. Answering with the
    // Pasal 4 brackets would be the wrong tax AND the wrong character.
    throw new Error(
      'From the third calendar year PP 68/2009 pasal 6 applies the ordinary Pasal 17 tariff '
      + 'and the withholding is no longer final; use the annual PPh 21 path instead',
    );
  }
  const brackets = BRACKETS[input.kind ?? 'SEVERANCE'];
  const already = Math.max(0, input.previouslyPaidGross ?? 0);
  const cumulativeGross = already + Math.max(0, input.gross);
  const cumulativeTax = taxOnGross(cumulativeGross, brackets);
  return {
    tax: Math.max(0, Math.round(cumulativeTax - taxOnGross(already, brackets))),
    cumulativeGross,
    cumulativeTax: Math.round(cumulativeTax),
    isFinal: true,
  };
}
