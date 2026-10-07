import {
  calculateSeveranceTax,
  PENSION_LUMP_SUM_TAX_BRACKETS,
  SEVERANCE_TAX_BRACKETS,
} from './severance-tax';

/**
 * PP 68/2009. The figures are read from the regulation's HTML fulltext, so the
 * tests assert the brackets it states rather than a worked example it does not
 * contain — plus the structural properties that would catch a later typo.
 */
describe('the bracket boundaries PP 68/2009 pasal 4 states', () => {
  const tax = (gross: number) => calculateSeveranceTax({ gross }).tax;

  it('takes nothing up to 50 juta', () => {
    expect(tax(0)).toBe(0);
    expect(tax(1_000_000)).toBe(0);
    expect(tax(50_000_000)).toBe(0);
  });

  it('takes 5% only on the slice above 50 juta, up to 100 juta', () => {
    expect(tax(50_000_001)).toBe(0);           // 5% of one rupiah, rounded
    expect(tax(60_000_000)).toBe(500_000);     // 5% x 10 juta
    expect(tax(100_000_000)).toBe(2_500_000);  // 5% x 50 juta
  });

  it('takes 15% on the slice above 100 juta, up to 500 juta', () => {
    expect(tax(200_000_000)).toBe(2_500_000 + 15_000_000);
    expect(tax(500_000_000)).toBe(2_500_000 + 60_000_000);
  });

  it('takes 25% above 500 juta', () => {
    expect(tax(600_000_000)).toBe(2_500_000 + 60_000_000 + 25_000_000);
  });

  it('is progressive, not a flat rate on the whole amount', () => {
    // A flat 25% on 600 juta would be 150 juta; the brackets give 87,5 juta.
    expect(tax(600_000_000)).toBe(87_500_000);
  });
});

describe('pasal 5 — pension, THT or JHT paid in a lump sum', () => {
  const tax = (gross: number) => calculateSeveranceTax({ gross, kind: 'PENSION_LUMP_SUM' }).tax;

  it('has only two brackets, 0% then 5%', () => {
    expect(tax(50_000_000)).toBe(0);
    expect(tax(100_000_000)).toBe(2_500_000);
    // Severance would reach 15% here; pasal 5 never does.
    expect(tax(600_000_000)).toBe(27_500_000);
    expect(calculateSeveranceTax({ gross: 600_000_000 }).tax).toBeGreaterThan(tax(600_000_000));
  });
});

describe('instalments inside the two-calendar-year window', () => {
  it('climbs the brackets across instalments instead of restarting them', () => {
    // Paid as two halves, an un-accumulated reading would tax neither: both
    // sit under 50 juta. The 2-year rule in pasal 2 ayat (2) exists to stop
    // exactly that.
    const first = calculateSeveranceTax({ gross: 50_000_000 });
    const second = calculateSeveranceTax({ gross: 50_000_000, previouslyPaidGross: 50_000_000 });
    expect(first.tax).toBe(0);
    expect(second.tax).toBe(2_500_000);
    expect(first.tax + second.tax).toBe(calculateSeveranceTax({ gross: 100_000_000 }).tax);
  });

  it('splits any amount without changing the total tax', () => {
    const whole = calculateSeveranceTax({ gross: 750_000_000 }).tax;
    let paid = 0;
    let total = 0;
    for (const slice of [100_000_000, 250_000_000, 400_000_000]) {
      total += calculateSeveranceTax({ gross: slice, previouslyPaidGross: paid }).tax;
      paid += slice;
    }
    expect(total).toBe(whole);
  });

  it('reports the cumulative figures, not just this instalment', () => {
    const result = calculateSeveranceTax({ gross: 40_000_000, previouslyPaidGross: 80_000_000 });
    expect(result.cumulativeGross).toBe(120_000_000);
    expect(result.cumulativeTax).toBe(2_500_000 + 3_000_000);
    expect(result.isFinal).toBe(true);
  });

  it('never refunds when an earlier instalment already covered the bracket', () => {
    expect(calculateSeveranceTax({ gross: 0, previouslyPaidGross: 600_000_000 }).tax).toBe(0);
  });
});

describe('the third calendar year', () => {
  it('is refused rather than taxed with the wrong brackets', () => {
    // Pasal 6: the ordinary Pasal 17 tariff applies and the withholding stops
    // being final. Answering with pasal 4 would be the wrong tax and the wrong
    // character of tax.
    expect(() => calculateSeveranceTax({ gross: 100_000_000, calendarYearIndex: 3 }))
      .toThrow(/no longer final/);
    expect(() => calculateSeveranceTax({ gross: 100_000_000, calendarYearIndex: 1 })).not.toThrow();
    expect(() => calculateSeveranceTax({ gross: 100_000_000, calendarYearIndex: 2 })).not.toThrow();
  });
});

describe('the bracket tables are well formed', () => {
  it.each([['severance', SEVERANCE_TAX_BRACKETS], ['pension lump sum', PENSION_LUMP_SUM_TAX_BRACKETS]])(
    '%s runs from 0%% with increasing bounds and an open top', (_label, brackets) => {
      const rows = brackets as readonly (readonly [number, number])[];
      expect(rows[0][1]).toBe(0);
      expect(rows[rows.length - 1][0]).toBe(Infinity);
      for (let i = 1; i < rows.length; i += 1) {
        expect(rows[i][0]).toBeGreaterThan(rows[i - 1][0]);
        expect(rows[i][1]).toBeGreaterThan(rows[i - 1][1]);
      }
    });

  it('starts both tables at the same 50 juta exemption', () => {
    expect(SEVERANCE_TAX_BRACKETS[0][0]).toBe(50_000_000);
    expect(PENSION_LUMP_SUM_TAX_BRACKETS[0][0]).toBe(50_000_000);
  });
});
