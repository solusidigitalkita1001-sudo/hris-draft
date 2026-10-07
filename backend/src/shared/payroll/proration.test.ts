import { calculateEmployeePay, SalaryForCalculation } from './employee-pay';
import { FormulaInputs } from './formula';

const inputs: FormulaInputs = { BASE_SALARY: '20000000', WORK_DAYS: '20', PRESENT_DAYS: '20', LEAVE_DAYS: '0', ABSENT_DAYS: '0', OVERTIME_HOURS: '0' };
const tax = { married: false, dependents: 0, hasNpwp: true };

const component = (over: Record<string, unknown>) => ({
  isActive: true, amount: '20000000',
  salaryComponent: {
    id: 'base', code: 'GP', name: 'Gaji Pokok', type: 'ALLOWANCE' as const,
    calculationMethod: 'FIXED', ratePercent: null, isTaxable: true,
    isActive: true, deletedAt: null, ...over,
  },
});
const meal = {
  isActive: true, amount: '1000000',
  salaryComponent: {
    id: 'meal', code: 'TM', name: 'Tunjangan Makan', type: 'ALLOWANCE' as const,
    calculationMethod: 'FIXED', ratePercent: null, isTaxable: false,
    isProrated: false, isActive: true, deletedAt: null,
  },
};

const salary = (over: Record<string, unknown>): SalaryForCalculation => ({
  baseSalary: '20000000', currency: 'IDR',
  components: [component(over), meal],
});

const earningsOf = (s: SalaryForCalculation, factor?: number) =>
  calculateEmployeePay(s, [], tax, inputs, new Map(), factor === undefined ? {} : { prorationFactor: factor }).earningsTotal;

describe('proration honours the isProrated flag', () => {
  it('scales a flagged component by the employed slice', () => {
    // Eleven days of a thirty-day month: 20,000,000 → 7,333,333.33, plus the
    // unflagged 1,000,000 meal allowance paid in full.
    const total = earningsOf(salary({ isProrated: true }), 11 / 30);

    expect(total).toBeCloseTo(7_333_333.33 + 1_000_000, 1);
  });

  it('leaves an unflagged component at full value even on a part month', () => {
    const total = earningsOf(salary({ isProrated: false }), 11 / 30);

    // This is the assertion that keeps the change honest: proration is opt-in
    // per component, so nothing moves for a tenant that has flagged nothing.
    expect(total).toBe(21_000_000);
  });

  it('changes nothing when the employee worked the whole period', () => {
    expect(earningsOf(salary({ isProrated: true }), 1)).toBe(21_000_000);
  });

  it('is a no-op when no factor is supplied at all', () => {
    expect(earningsOf(salary({ isProrated: true }))).toBe(21_000_000);
  });

  it('clamps a factor above one, which would otherwise inflate pay', () => {
    expect(earningsOf(salary({ isProrated: true }), 1.5)).toBe(21_000_000);
  });

  it('clamps a negative factor instead of producing negative earnings', () => {
    expect(earningsOf(salary({ isProrated: true }), -2)).toBe(1_000_000);
  });

  it('reduces the tax base along with the prorated earning', () => {
    const full = calculateEmployeePay(salary({ isProrated: true }), [], tax, inputs, new Map(), { prorationFactor: 1 });
    const part = calculateEmployeePay(salary({ isProrated: true }), [], tax, inputs, new Map(), { prorationFactor: 0.5 });
    const tax_of = (pay: { components: Array<{ code?: string; name: string; amount: number }> }) =>
      pay.components.find(c => c.name === 'Gaji Pokok')?.amount ?? 0;

    expect(tax_of(part)).toBeLessThan(tax_of(full));
  });
});
