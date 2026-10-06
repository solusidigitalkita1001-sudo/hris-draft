import { DEFAULT_TER_BRACKETS, type TerBracketRow, type TerCategoryCode } from './ter-tables';

/**
 * PPh 21 monthly withholding by Tarif Efektif Rata-rata — PP 58/2023 and
 * PMK 168/2023, in force from 1 January 2024.
 *
 * TER replaces the monthly *withholding* calculation only. It is not a new tax:
 * January to November withhold `bruto x TER`, and the final month of the year
 * settles the real liability with the Article 17 progressive calculation,
 * crediting what TER already took. So this module deliberately does not try to
 * be a complete tax engine — `pph21.ts` still owns the annual figure, and the
 * December true-up is what reconciles the two.
 *
 * The rate tables live in `ter-tables.ts`, which documents where every number
 * came from and how it was checked.
 */

export type { TerCategoryCode };

/**
 * PP 58/2023 Pasal 2 ayat (4): the category follows the employee's PTKP
 * status, which ayat (3) fixes as at the START of the tax year — a marriage or
 * a new child in March does not move anybody's category until next January.
 * Callers are responsible for passing the start-of-year status; this function
 * cannot tell which snapshot it was handed.
 */
export function terCategoryFor(married: boolean, dependents: number): TerCategoryCode {
  const deps = Math.max(0, Math.min(Math.trunc(dependents), 3));
  if (!married) {
    // tidak kawin: 0 or 1 dependent -> A, 2 or 3 -> B
    return deps <= 1 ? 'A' : 'B';
  }
  // kawin: 0 -> A, 1 or 2 -> B, 3 -> C
  if (deps === 0) return 'A';
  return deps <= 2 ? 'B' : 'C';
}

/**
 * The effective rate, as a percentage, for a month's gross income.
 *
 * The annex brackets read "di atas X sampai dengan Y", so a bound belongs to
 * its own bracket: gross exactly 5,400,000 is taxed at the first bracket's 0%,
 * not the second bracket's 0.25%.
 */
export function terRatePercent(
  category: TerCategoryCode,
  monthlyGross: number,
  tables: Partial<Record<TerCategoryCode, readonly TerBracketRow[]>> = {},
): number {
  const brackets = tables[category] ?? DEFAULT_TER_BRACKETS[category];
  if (!brackets?.length) {
    throw new Error(`No TER brackets available for category ${category}`);
  }
  const gross = Math.max(0, monthlyGross);
  for (const [upper, rate] of brackets) {
    if (upper === null || gross <= upper) return rate;
  }
  // Unreachable with a well-formed table; a table whose last bound is not open
  // would otherwise silently withhold nothing on the largest salaries.
  throw new Error(`TER table for category ${category} has no open-ended top bracket`);
}

export interface TerWithholdingInput {
  /** Taxable gross for the month, the same base the annual calculation uses. */
  monthlyGross: number;
  /** Marital status AS AT the start of the tax year. */
  married: boolean;
  /** Dependents counted for PTKP as at the start of the tax year (capped at 3). */
  dependents: number;
  /** Per-tenant overrides; falls back to the statutory annex per category. */
  tables?: Partial<Record<TerCategoryCode, readonly TerBracketRow[]>>;
}

export interface TerWithholdingResult {
  category: TerCategoryCode;
  ratePercent: number;
  /** bruto x rate. Not rounded here: the annex states no rounding rule, and
   *  the regulation's own worked examples come out exact. */
  tax: number;
}

export function calculateTerWithholding(input: TerWithholdingInput): TerWithholdingResult {
  const category = terCategoryFor(input.married, input.dependents);
  const ratePercent = terRatePercent(category, input.monthlyGross, input.tables ?? {});
  const gross = Math.max(0, input.monthlyGross);
  return { category, ratePercent, tax: (gross * ratePercent) / 100 };
}
