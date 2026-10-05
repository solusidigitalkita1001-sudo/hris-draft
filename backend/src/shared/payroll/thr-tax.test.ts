import { calculateThrTax } from './thr-tax';
import { calculatePph21 } from './pph21';

const base = { married: false, dependents: 0, monthlyGross: 10_000_000 };

describe('PPh 21 on THR', () => {
  it('is the increment the THR adds to the year, not a tax on it in isolation', () => {
    const result = calculateThrTax({ ...base, thrAmount: 10_000_000 });

    expect(result.tax).toBe(result.annualTaxWithThr - result.annualTaxWithoutThr);
    expect(result.tax).toBeGreaterThan(0);
  });

  it('costs more for the same THR when the regular salary is higher', () => {
    // The whole reason for the incremental method: a 10m THR lands in whatever
    // bracket the employee has already reached.
    const low = calculateThrTax({ ...base, monthlyGross: 6_000_000, thrAmount: 10_000_000 }).tax;
    const high = calculateThrTax({ ...base, monthlyGross: 60_000_000, thrAmount: 10_000_000 }).tax;

    expect(high).toBeGreaterThan(low);
  });

  it('withholds nothing when the whole year stays under PTKP', () => {
    expect(calculateThrTax({ ...base, monthlyGross: 3_000_000, thrAmount: 3_000_000 }).tax).toBe(0);
  });

  it('withholds nothing on a zero THR', () => {
    expect(calculateThrTax({ ...base, thrAmount: 0 }).tax).toBe(0);
  });

  it('agrees with the monthly engine on the regular year', () => {
    // The without-THR figure must match what the monthly run would annualise,
    // or THR tax would be measured against a different baseline than the
    // salary it accompanies.
    const monthly = calculatePph21({ monthlyGross: base.monthlyGross, married: false, dependents: 0 });
    const thr = calculateThrTax({ ...base, thrAmount: 1 });

    expect(thr.annualTaxWithoutThr).toBe(monthly.annualTax);
  });

  it('grants no further biaya jabatan once the annual cap is reached', () => {
    // At 60m/month the 5% relief is already pinned at its 6,000,000 annual
    // ceiling, so the THR is taxable in full: the increment must be exactly
    // the THR times the marginal rate for that band (30% in 500m-5bn), with
    // no extra relief shaved off it.
    const result = calculateThrTax({ ...base, monthlyGross: 60_000_000, thrAmount: 10_000_000 });

    expect(result.tax).toBe(3_000_000);
  });

  it('does grant relief on the THR when the cap is not yet reached', () => {
    // At 5m/month the annual relief is 3m, well under the ceiling, so part of
    // the THR is relieved and the increment is below the flat marginal rate.
    const thr = 10_000_000;
    const result = calculateThrTax({ ...base, monthlyGross: 5_000_000, thrAmount: thr });

    expect(result.tax).toBeGreaterThan(0);
    expect(result.tax).toBeLessThan(thr * 0.05);
  });

  it('carries the no-NPWP surcharge', () => {
    const withNpwp = calculateThrTax({ ...base, thrAmount: 10_000_000 }).tax;
    const without = calculateThrTax({ ...base, thrAmount: 10_000_000, hasNpwp: false }).tax;

    expect(without).toBeGreaterThan(withNpwp);
  });

  it('reduces the base by the deductible pension', () => {
    const noPension = calculateThrTax({ ...base, thrAmount: 10_000_000 }).tax;
    const withPension = calculateThrTax({ ...base, thrAmount: 10_000_000, monthlyPensionContribution: 300_000 }).tax;

    expect(withPension).toBeLessThanOrEqual(noPension);
  });

  it('honours a tenant bracket override instead of a table of its own', () => {
    const flat = calculateThrTax({ ...base, thrAmount: 10_000_000 }, { brackets: [[Infinity, 0.5]] });
    const statutory = calculateThrTax({ ...base, thrAmount: 10_000_000 });

    // Nothing here is a private rate table: override the brackets and this
    // follows, which is what keeps it consistent with the monthly engine.
    expect(flat.tax).toBeGreaterThan(statutory.tax);
  });

  it('never returns a negative withholding even on a misconfigured table', () => {
    // A tenant whose bracket rows are nonsense must not be paid extra out of
    // tax. Descending "brackets" are the shape that produces this.
    const result = calculateThrTax({ ...base, thrAmount: 10_000_000 }, { brackets: [[1_000_000, 0], [Infinity, 0]] });

    expect(result.tax).toBe(0);
  });
});
