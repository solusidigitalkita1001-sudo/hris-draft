import { calculateTerWithholding, terCategoryFor, terRatePercent } from './ter';
import { DEFAULT_TER_BRACKETS } from './ter-tables';

/**
 * The strongest test available for a transcribed tax table is the regulation's
 * own arithmetic. PMK 168/2023 works four examples through the PP 58/2023
 * annex; if the table were mistyped anywhere near those brackets, these fail.
 */
describe('the worked examples in PMK 168/2023', () => {
  it.each([
    ['kategori C, bruto 30.000.000', { married: true, dependents: 3, monthlyGross: 30_000_000 }, 'C', 11, 3_300_000],
    ['kategori B, bruto 6.800.000', { married: true, dependents: 1, monthlyGross: 6_800_000 }, 'B', 0.5, 34_000],
    ['kategori B, bruto 55.500.000', { married: true, dependents: 2, monthlyGross: 55_500_000 }, 'B', 19, 10_545_000],
    ['kategori A, bruto 60.000.000', { married: false, dependents: 0, monthlyGross: 60_000_000 }, 'A', 20, 12_000_000],
  ])('%s', (_label, input, category, rate, tax) => {
    const result = calculateTerWithholding(input as never);
    expect(result.category).toBe(category);
    expect(result.ratePercent).toBe(rate);
    expect(result.tax).toBe(tax);
  });
});

describe('the category follows PTKP status (PP 58/2023 Pasal 2 ayat (4))', () => {
  it.each([
    [false, 0, 'A'], [false, 1, 'A'], [false, 2, 'B'], [false, 3, 'B'],
    [true, 0, 'A'], [true, 1, 'B'], [true, 2, 'B'], [true, 3, 'C'],
  ])('married=%s dependents=%s -> %s', (married, dependents, expected) => {
    expect(terCategoryFor(married as boolean, dependents as number)).toBe(expected);
  });

  it('caps dependents at three rather than falling off the table', () => {
    // PTKP itself stops at three dependents, so a fourth child cannot create a
    // category the annex does not define.
    expect(terCategoryFor(true, 9)).toBe('C');
    expect(terCategoryFor(false, 9)).toBe('B');
    expect(terCategoryFor(true, -1)).toBe('A');
  });
});

describe('bracket boundaries', () => {
  it('taxes a bound at its own bracket, not the next one', () => {
    // The annex reads "sampai dengan Rp5.400.000" for 0% and "di atas
    // Rp5.400.000" for 0,25%, so the boundary itself is still 0%.
    expect(terRatePercent('A', 5_400_000)).toBe(0);
    expect(terRatePercent('A', 5_400_001)).toBe(0.25);
    expect(terRatePercent('A', 5_650_000)).toBe(0.25);
    expect(terRatePercent('A', 5_650_001)).toBe(0.5);
  });

  it('applies the open-ended top bracket above the last bound', () => {
    expect(terRatePercent('A', 1_400_000_000)).toBe(33);
    expect(terRatePercent('A', 1_400_000_001)).toBe(34);
    expect(terRatePercent('B', 1_405_000_001)).toBe(34);
    expect(terRatePercent('C', 1_419_000_001)).toBe(34);
    expect(terRatePercent('A', 9_999_999_999_999)).toBe(34);
  });

  it('treats zero and negative gross as the lowest bracket', () => {
    expect(terRatePercent('A', 0)).toBe(0);
    expect(calculateTerWithholding({ married: false, dependents: 0, monthlyGross: -5 }).tax).toBe(0);
  });

  it('refuses a table with no open-ended top bracket instead of withholding nothing', () => {
    // A truncated override would otherwise return no rate for a large salary.
    expect(() => terRatePercent('A', 2_000_000_000, { A: [[1_000_000, 0]] })).toThrow(/open-ended/);
  });

  it('uses a tenant override in preference to the statutory table', () => {
    expect(terRatePercent('A', 10_000_000, { A: [[50_000_000, 7.5], [null, 9]] })).toBe(7.5);
    // and leaves the other categories alone
    expect(terRatePercent('B', 10_000_000, { A: [[50_000_000, 7.5], [null, 9]] })).toBe(1.5);
  });
});

/**
 * Structural properties of the transcription itself. These would catch a typo
 * introduced later by hand, which the worked examples above only cover near
 * four specific brackets.
 */
describe('the transcribed annex is well formed', () => {
  it.each([['A', 44], ['B', 40], ['C', 41]])('kategori %s has %i brackets', (category, count) => {
    expect(DEFAULT_TER_BRACKETS[category as 'A'].length).toBe(count);
  });

  it.each(['A', 'B', 'C'] as const)('kategori %s runs 0%% to 34%% with increasing bounds', (category) => {
    const rows = DEFAULT_TER_BRACKETS[category];
    expect(rows[0][1]).toBe(0);
    expect(rows[rows.length - 1][0]).toBeNull();
    expect(rows[rows.length - 1][1]).toBe(34);
    // Only the last bracket may be open-ended.
    expect(rows.slice(0, -1).every(([upper]) => upper !== null)).toBe(true);
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i][1]).toBeGreaterThan(rows[i - 1][1]);
      if (rows[i][0] !== null) {
        expect(rows[i][0] as number).toBeGreaterThan(rows[i - 1][0] as number);
      }
    }
  });

  it.each([['A', 1_400_000_000], ['B', 1_405_000_000], ['C', 1_419_000_000]])(
    'kategori %s opens its top bracket above %i', (category, bound) => {
      const rows = DEFAULT_TER_BRACKETS[category as 'A'];
      expect(rows[rows.length - 2][0]).toBe(bound);
    });
});
