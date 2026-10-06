/**
 * Tarif Efektif Rata-rata (TER) bulanan — PP 58/2023, Lampiran huruf A, B, C.
 *
 * WHERE THESE NUMBERS COME FROM, because tax tables must never be written from
 * memory: transcribed mechanically from the official PDF at
 * peraturan.bpk.go.id/Download/332609 (PP Nomor 58 Tahun 2023), pages 11-24.
 * The scan's numerals are unreliable — it renders 0 as O, 1 as l, even 7 as T —
 * so the figures were read from the SPELLED-OUT Indonesian words the annex
 * prints beside every amount, and then checked three ways:
 *
 *   1. Every bracket's lower bound restates the previous bracket's upper bound,
 *      so each boundary is read twice. 121 of 122 agreed; the one exception had
 *      its value confirmed twice over by the numeric column.
 *   2. All 122 upper bounds were matched against the numeric column, read
 *      independently of the words. 122 of 122 agreed.
 *   3. The four worked examples in PMK 168/2023 reproduce exactly:
 *        kategori C, bruto 30.000.000 -> 3.300.000  (11%)
 *        kategori B, bruto  6.800.000 ->     34.000 (0,5%)
 *        kategori B, bruto 55.500.000 -> 10.545.000 (19%)
 *        kategori A, bruto 60.000.000 -> 12.000.000 (20%)
 *
 * Row counts: A 44, B 40, C 41. Top brackets: above 1.400.000.000 (A),
 * 1.405.000.000 (B), 1.419.000.000 (C), all at 34%.
 *
 * A single blog table was tried first and was wrong throughout its upper half —
 * it claimed 42 rows for A and 8,5% where the regulation says 25%. That is why
 * this came from the regulation and carries its checks with it.
 */

/** `[upperBound, ratePercent]`; a null bound is the open-ended top bracket. */
export type TerBracketRow = readonly [number | null, number];

export type TerCategoryCode = 'A' | 'B' | 'C';

/** Lampiran huruf A — 44 lapisan. */
const TER_A: readonly TerBracketRow[] = [
  [5_400_000, 0],
  [5_650_000, 0.25],
  [5_950_000, 0.5],
  [6_300_000, 0.75],
  [6_750_000, 1],
  [7_500_000, 1.25],
  [8_550_000, 1.5],
  [9_650_000, 1.75],
  [10_050_000, 2],
  [10_350_000, 2.25],
  [10_700_000, 2.5],
  [11_050_000, 3],
  [11_600_000, 3.5],
  [12_500_000, 4],
  [13_750_000, 5],
  [15_100_000, 6],
  [16_950_000, 7],
  [19_750_000, 8],
  [24_150_000, 9],
  [26_450_000, 10],
  [28_000_000, 11],
  [30_050_000, 12],
  [32_400_000, 13],
  [35_400_000, 14],
  [39_100_000, 15],
  [43_850_000, 16],
  [47_800_000, 17],
  [51_400_000, 18],
  [56_300_000, 19],
  [62_200_000, 20],
  [68_600_000, 21],
  [77_500_000, 22],
  [89_000_000, 23],
  [103_000_000, 24],
  [125_000_000, 25],
  [157_000_000, 26],
  [206_000_000, 27],
  [337_000_000, 28],
  [454_000_000, 29],
  [550_000_000, 30],
  [695_000_000, 31],
  [910_000_000, 32],
  [1_400_000_000, 33],
  [null, 34],
];

/** Lampiran huruf B — 40 lapisan. */
const TER_B: readonly TerBracketRow[] = [
  [6_200_000, 0],
  [6_500_000, 0.25],
  [6_850_000, 0.5],
  [7_300_000, 0.75],
  [9_200_000, 1],
  [10_750_000, 1.5],
  [11_250_000, 2],
  [11_600_000, 2.5],
  [12_600_000, 3],
  [13_600_000, 4],
  [14_950_000, 5],
  [16_400_000, 6],
  [18_450_000, 7],
  [21_850_000, 8],
  [26_000_000, 9],
  [27_700_000, 10],
  [29_350_000, 11],
  [31_450_000, 12],
  [33_950_000, 13],
  [37_100_000, 14],
  [41_100_000, 15],
  [45_800_000, 16],
  [49_500_000, 17],
  [53_800_000, 18],
  [58_500_000, 19],
  [64_000_000, 20],
  [71_000_000, 21],
  [80_000_000, 22],
  [93_000_000, 23],
  [109_000_000, 24],
  [129_000_000, 25],
  [163_000_000, 26],
  [211_000_000, 27],
  [374_000_000, 28],
  [459_000_000, 29],
  [555_000_000, 30],
  [704_000_000, 31],
  [957_000_000, 32],
  [1_405_000_000, 33],
  [null, 34],
];

/** Lampiran huruf C — 41 lapisan. */
const TER_C: readonly TerBracketRow[] = [
  [6_600_000, 0],
  [6_950_000, 0.25],
  [7_350_000, 0.5],
  [7_800_000, 0.75],
  [8_850_000, 1],
  [9_800_000, 1.25],
  [10_950_000, 1.5],
  [11_200_000, 1.75],
  [12_050_000, 2],
  [12_950_000, 3],
  [14_150_000, 4],
  [15_550_000, 5],
  [17_050_000, 6],
  [19_500_000, 7],
  [22_700_000, 8],
  [26_600_000, 9],
  [28_100_000, 10],
  [30_100_000, 11],
  [32_600_000, 12],
  [35_400_000, 13],
  [38_900_000, 14],
  [43_000_000, 15],
  [47_400_000, 16],
  [51_200_000, 17],
  [55_800_000, 18],
  [60_400_000, 19],
  [66_700_000, 20],
  [74_500_000, 21],
  [83_200_000, 22],
  [95_600_000, 23],
  [110_000_000, 24],
  [134_000_000, 25],
  [169_000_000, 26],
  [221_000_000, 27],
  [390_000_000, 28],
  [463_000_000, 29],
  [561_000_000, 30],
  [709_000_000, 31],
  [965_000_000, 32],
  [1_419_000_000, 33],
  [null, 34],
];

export const DEFAULT_TER_BRACKETS: Readonly<Record<TerCategoryCode, readonly TerBracketRow[]>> = {
  A: TER_A,
  B: TER_B,
  C: TER_C,
};
