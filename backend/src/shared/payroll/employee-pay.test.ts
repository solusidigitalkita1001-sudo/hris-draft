import { calculateEmployeePay, SalaryForCalculation } from './employee-pay';
import { selectFormulaVersions, FormulaInputs } from './formula';
const inputs: FormulaInputs = { BASE_SALARY: '10000000', WORK_DAYS: '20', PRESENT_DAYS: '10', LEAVE_DAYS: '0', ABSENT_DAYS: '10', OVERTIME_HOURS: '0' };
const salary: SalaryForCalculation = { baseSalary: '10000000', currency: 'IDR', components: [
  { isActive: true, amount: '10000000', salaryComponent: { id: 'base', code: 'BASE', name: 'Base', type: 'ALLOWANCE', calculationMethod: 'FIXED', ratePercent: null, isTaxable: true, isActive: true, deletedAt: null } },
  { isActive: true, amount: '100', salaryComponent: { id: 'bonus', code: 'BONUS', name: 'Bonus', type: 'ALLOWANCE', calculationMethod: 'FIXED', ratePercent: null, isTaxable: true, isActive: true, deletedAt: null } },
  { isActive: true, amount: '0', salaryComponent: { id: 'tax', code: 'PPH21', name: 'Tax', type: 'DEDUCTION', calculationMethod: 'PERCENTAGE', ratePercent: '5', isTaxable: false, isActive: true, deletedAt: null } },
] };
const tax = { married: false, dependents: 0, hasNpwp: true };
describe('formula integration with employee payroll', () => {
  it('applies prorata via explicit formula, includes taxable result in the existing tax engine, and freezes evidence', () => {
    const versions = selectFormulaVersions([{ id: 'v1', componentId: 'bonus', expression: 'BASE_SALARY * PRESENT_DAYS / WORK_DAYS', effectiveFrom: new Date('2026-09-01'), version: 1, engineVersion: 1 }], new Date('2026-09-01'));
    const base = calculateEmployeePay(salary, [], tax, inputs, new Map());
    const result = calculateEmployeePay(salary, [], tax, inputs, versions);
    expect(result.earningsTotal).toBe(15000000);
    expect(result.deductionsTotal).toBeGreaterThan(base.deductionsTotal);
    expect(result.formulaCalculations[0]).toEqual(expect.objectContaining({ componentId: 'bonus', versionId: 'v1', expression: 'BASE_SALARY * PRESENT_DAYS / WORK_DAYS' }));
  });
  it('does not alter historical fixed amounts before a future formula effective date', () => {
    const versions = selectFormulaVersions([{ id: 'v2', componentId: 'bonus', expression: '999', effectiveFrom: new Date('2026-10-01'), version: 2, engineVersion: 1 }], new Date('2026-09-01'));
    expect(calculateEmployeePay(salary, [], tax, inputs, versions).earningsTotal).toBe(10000100);
  });
  it('rejects unsupported currency and inactive component references', () => {
    const versions = selectFormulaVersions([{ id: 'v1', componentId: 'bonus', expression: '10', effectiveFrom: new Date('2026-09-01'), version: 1, engineVersion: 1 }], new Date('2026-09-01'));
    expect(() => calculateEmployeePay({ ...salary, currency: 'USD' }, [], tax, inputs, versions)).toThrow('IDR');
    const invalid = { ...salary, components: salary.components.map(allocation => ({ ...allocation, salaryComponent: { ...allocation.salaryComponent, isActive: false } })) };
    expect(() => calculateEmployeePay(invalid, [], tax, inputs, versions)).toThrow('inactive');
  });
});

/**
 * TER (PP 58/2023) replaces the monthly withholding rate, not the tax. The
 * month takes `bruto x TER`; the final period of the year settles the real
 * liability against what was taken, which is why the payroll run forces the
 * December reconciliation on whenever TER is active.
 */
describe('withholding by TER instead of the annualized method', () => {
  /** One taxable allowance and a PPH21 row for the tax to land in. */
  const flat = (gross: string): SalaryForCalculation => ({
    baseSalary: gross, currency: 'IDR', components: [
      { isActive: true, amount: gross, salaryComponent: { id: 'base', code: 'BASE', name: 'Base', type: 'ALLOWANCE', calculationMethod: 'FIXED', ratePercent: null, isTaxable: true, isActive: true, deletedAt: null } },
      { isActive: true, amount: '0', salaryComponent: { id: 'tax', code: 'PPH21', name: 'Tax', type: 'DEDUCTION', calculationMethod: 'FIXED', ratePercent: null, isTaxable: false, isActive: true, deletedAt: null } },
    ],
  });
  const plainInputs: FormulaInputs = { BASE_SALARY: '0', WORK_DAYS: '20', PRESENT_DAYS: '20', LEAVE_DAYS: '0', ABSENT_DAYS: '0', OVERTIME_HOURS: '0' };
  const withheld = (result: ReturnType<typeof calculateEmployeePay>) =>
    result.components.find(component => component.salaryComponentId === 'tax')?.amount;

  it('withholds bruto x TER, reproducing the regulation worked example', () => {
    // PMK 168/2023: kategori A, bruto 60.000.000 -> 12.000.000 (20%).
    const result = calculateEmployeePay(flat('60000000'), [], { married: false, dependents: 0, hasNpwp: true },
      { ...plainInputs, BASE_SALARY: '60000000' }, new Map(), { useTer: true });
    expect(withheld(result)).toBe(12_000_000);
  });

  /** The same employee, paid the same month, under whichever policy is passed. */
  const pay = (policy?: Parameters<typeof calculateEmployeePay>[5]) =>
    calculateEmployeePay(flat('60000000'), [], { married: false, dependents: 0, hasNpwp: true },
      { ...plainInputs, BASE_SALARY: '60000000' }, new Map(), policy);

  it('differs from the annualized method, which is the whole point', () => {
    expect(withheld(pay({ useTer: true }))).not.toBe(withheld(pay()));
  });

  it('leaves the annualized method in place when the flag is absent or false', () => {
    expect(withheld(pay({}))).toBe(withheld(pay()));
    expect(withheld(pay({ useTer: false }))).toBe(withheld(pay()));
  });

  it('taxes overtime and other extras at the same rate as salary', () => {
    // The extras join the tax base, so a month with overtime can cross into a
    // higher TER bracket — the same base the annual reconciliation reads.
    const result = calculateEmployeePay(flat('6000000'), [
      { salaryComponentId: 'ot', name: 'Overtime', type: 'ALLOWANCE', amount: 800_000, isTaxable: true },
    ], { married: true, dependents: 1, hasNpwp: true }, { ...plainInputs, BASE_SALARY: '6000000' }, new Map(), { useTer: true });
    // Kategori B at 6.800.000 is 0,5% — the second worked example in PMK 168.
    expect(withheld(result)).toBe(34_000);
  });

  it('honours a tenant bracket override for the category it replaces', () => {
    const result = calculateEmployeePay(flat('10000000'), [], { married: false, dependents: 0, hasNpwp: true },
      { ...plainInputs, BASE_SALARY: '10000000' }, new Map(),
      { useTer: true, ter: { A: [[50_000_000, 4], [null, 30]] } });
    expect(withheld(result)).toBe(400_000);
  });

  it('refuses to combine TER with gross-up rather than inventing a number', () => {
    // Gross-up solves allowance = tax(gross + allowance) against the annual
    // method; against TER that is a different equation.
    expect(() => calculateEmployeePay(flat('60000000'), [], { married: false, dependents: 0, hasNpwp: true },
      { ...plainInputs, BASE_SALARY: '60000000' }, new Map(),
      { useTer: true, taxAllowance: { salaryComponentId: 'allowance', name: 'Tunjangan PPh21' } }))
      .toThrow(/cannot both be enabled/);
  });
});
