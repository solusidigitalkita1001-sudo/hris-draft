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
