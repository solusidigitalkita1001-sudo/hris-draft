import { calculateAnnualPph21, calculatePph21Correction } from './pph21-annual';
import { calculatePph21 } from './pph21';

const TWELVE = (value: number) => Array.from({ length: 12 }, () => value);

/**
 * The December reconciliation exists because the monthly method annualises one
 * month twelve times, which is right for withholding as you go and wrong about
 * the year whenever the months differ.
 */
describe('annual PPh21 on the year that actually happened', () => {
  it('agrees with the monthly engine when every month was identical', () => {
    const monthly = calculatePph21({ monthlyGross: 15_000_000, married: true, dependents: 2, hasNpwp: true });
    const annual = calculateAnnualPph21({ monthlyGrosses: TWELVE(15_000_000), married: true, dependents: 2, hasNpwp: true });

    // Same figures every month means the annualised guess was the truth, so the
    // reconciliation must find nothing to correct.
    expect(annual.annualTax).toBe(monthly.annualTax);
    expect(annual.ptkp).toBe(monthly.ptkp);
  });

  /**
   * The case that motivates the whole feature: a bonus month makes "this month
   * × 12" a year the employee never earned.
   */
  it('does not treat a bonus month as if it repeated all year', () => {
    const withBonus = [...TWELVE(15_000_000).slice(0, 11), 45_000_000];
    const annual = calculateAnnualPph21({ monthlyGrosses: withBonus, married: true, dependents: 2, hasNpwp: true });
    const asIfBonusEveryMonth = calculatePph21({ monthlyGross: 45_000_000, married: true, dependents: 2, hasNpwp: true });

    expect(annual.annualGross).toBe(11 * 15_000_000 + 45_000_000);
    expect(annual.annualTax).toBeLessThan(asIfBonusEveryMonth.annualTax);
  });

  it('charges a mid-year joiner only on the months they were paid', () => {
    const joinedInJuly = TWELVE(15_000_000).slice(0, 6);
    const annual = calculateAnnualPph21({ monthlyGrosses: joinedInJuly, married: false, dependents: 0, hasNpwp: true });
    const fullYear = calculateAnnualPph21({ monthlyGrosses: TWELVE(15_000_000), married: false, dependents: 0, hasNpwp: true });

    expect(annual.annualGross).toBe(6 * 15_000_000);
    expect(annual.annualTax).toBeLessThan(fullYear.annualTax);
  });

  /**
   * Biaya jabatan is 5% capped per month. Applying the cap once to the annual
   * gross gives the same answer only for an even year.
   */
  it('caps biaya jabatan per month, not once against the year', () => {
    // 20 million a month: 5% is 1 million, so each month is capped at 500k.
    const annual = calculateAnnualPph21({ monthlyGrosses: TWELVE(20_000_000), married: false, dependents: 0 });
    expect(annual.biayaJabatan).toBe(12 * 500_000);

    // A single 240 million month caps at 500k for that month alone — not
    // 6 million, which is what an annual-level cap would have allowed.
    const lumpSum = calculateAnnualPph21({ monthlyGrosses: [240_000_000], married: false, dependents: 0 });
    expect(lumpSum.biayaJabatan).toBe(500_000);
  });

  it('deducts employee pension contributions month by month', () => {
    const annual = calculateAnnualPph21({
      monthlyGrosses: TWELVE(15_000_000),
      monthlyPensions: TWELVE(450_000),
      married: false,
      dependents: 0,
    });
    expect(annual.pension).toBe(12 * 450_000);
  });

  it('ignores a pension entry with no matching paid month', () => {
    const annual = calculateAnnualPph21({
      monthlyGrosses: [15_000_000],
      monthlyPensions: [450_000, 450_000, 450_000],
      married: false,
      dependents: 0,
    });
    expect(annual.pension).toBe(450_000);
  });

  it('applies the no-NPWP surcharge', () => {
    const withNpwp = calculateAnnualPph21({ monthlyGrosses: TWELVE(15_000_000), married: false, dependents: 0, hasNpwp: true });
    const without = calculateAnnualPph21({ monthlyGrosses: TWELVE(15_000_000), married: false, dependents: 0, hasNpwp: false });
    expect(without.annualTax).toBe(Math.round(withNpwp.annualTax * 1.2));
  });

  it('owes nothing below PTKP', () => {
    const annual = calculateAnnualPph21({ monthlyGrosses: TWELVE(3_000_000), married: false, dependents: 0 });
    expect(annual.pkp).toBe(0);
    expect(annual.annualTax).toBe(0);
  });

  it('returns zeros for a year with no paid months rather than NaN', () => {
    const annual = calculateAnnualPph21({ monthlyGrosses: [], married: false, dependents: 0 });
    expect(annual).toMatchObject({ annualGross: 0, biayaJabatan: 0, pkp: 0, annualTax: 0 });
  });
});

describe('December correction', () => {
  const evenYear = { monthlyGrosses: TWELVE(15_000_000), married: true, dependents: 2, hasNpwp: true };

  it('finds nothing to settle when withholding already matched the year', () => {
    const owed = calculateAnnualPph21(evenYear).annualTax;
    const correction = calculatePph21Correction({ ...evenYear, withheldToDate: owed });
    expect(correction.delta).toBe(0);
  });

  it('deducts the shortfall when too little was withheld', () => {
    const owed = calculateAnnualPph21(evenYear).annualTax;
    const correction = calculatePph21Correction({ ...evenYear, withheldToDate: owed - 1_200_000 });
    expect(correction.delta).toBe(1_200_000);
  });

  /**
   * Both directions are real. An employee whose PTKP status changed mid-year is
   * commonly over-withheld, and refusing to refund would quietly keep money
   * that is not the company's.
   */
  it('refunds the excess when too much was withheld', () => {
    const owed = calculateAnnualPph21(evenYear).annualTax;
    const correction = calculatePph21Correction({ ...evenYear, withheldToDate: owed + 800_000 });
    expect(correction.delta).toBe(-800_000);
  });

  it('reports the annual basis alongside the delta, so a payslip can explain itself', () => {
    const correction = calculatePph21Correction({ ...evenYear, withheldToDate: 0 });
    expect(correction.annual).toMatchObject({
      annualGross: 180_000_000,
      biayaJabatan: 6_000_000,
    });
    expect(correction.delta).toBe(correction.annual.annualTax);
  });
});
