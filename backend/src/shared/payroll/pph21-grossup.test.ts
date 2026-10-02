import { calculatePph21, grossUpTaxAllowance } from './pph21';
import { calculateEmployeePay, SalaryForCalculation } from './employee-pay';
import { FormulaInputs } from './formula';

const tax = { married: false, dependents: 0, hasNpwp: true };

describe('PPh21 gross-up (GAP-17)', () => {
  // The defining property: the allowance must pay for the tax that the
  // allowance itself causes. Anything less and the employee still carries part
  // of the bill, which is the bug gross-up exists to prevent.
  it.each([5_000_000, 12_000_000, 40_000_000, 300_000_000])(
    'settles where the allowance equals the tax on gross + allowance (gross %i)',
    (monthlyGross) => {
      const { allowance, converged } = grossUpTaxAllowance({ monthlyGross, ...tax });
      expect(converged).toBe(true);
      const recomputed = calculatePph21({ monthlyGross: monthlyGross + allowance, ...tax }).monthlyTax;
      expect(Math.abs(recomputed - allowance)).toBeLessThan(1);
    },
  );

  it('costs the employer more than the tax it would have withheld', () => {
    const monthlyGross = 40_000_000;
    const plain = calculatePph21({ monthlyGross, ...tax }).monthlyTax;
    const { allowance } = grossUpTaxAllowance({ monthlyGross, ...tax });
    expect(allowance).toBeGreaterThan(plain);
  });

  it('owes nothing when the gross is below PTKP', () => {
    expect(grossUpTaxAllowance({ monthlyGross: 3_000_000, ...tax }).allowance).toBe(0);
  });

  it('carries the no-NPWP surcharge into the allowance', () => {
    const withNpwp = grossUpTaxAllowance({ monthlyGross: 20_000_000, ...tax }).allowance;
    const without = grossUpTaxAllowance({ monthlyGross: 20_000_000, ...tax, hasNpwp: false }).allowance;
    expect(without).toBeGreaterThan(withNpwp);
  });
});

const inputs: FormulaInputs = { BASE_SALARY: '20000000', WORK_DAYS: '20', PRESENT_DAYS: '20', LEAVE_DAYS: '0', ABSENT_DAYS: '0', OVERTIME_HOURS: '0' };
const salary: SalaryForCalculation = { baseSalary: '20000000', currency: 'IDR', components: [
  { isActive: true, amount: '20000000', salaryComponent: { id: 'base', code: 'BASE', name: 'Base', type: 'ALLOWANCE', calculationMethod: 'FIXED', ratePercent: null, isTaxable: true, isActive: true, deletedAt: null } },
  { isActive: true, amount: '0', salaryComponent: { id: 'tax', code: 'PPH21', name: 'Tax', type: 'DEDUCTION', calculationMethod: 'FIXED', ratePercent: null, isTaxable: false, isActive: true, deletedAt: null } },
] };
const allowance = { salaryComponentId: 'allowance', name: 'Tunjangan Pajak (Gross-Up)' };

describe('gross-up inside the payroll calculation', () => {
  it('leaves net pay untouched by the tax, and shows both sides on the payslip', () => {
    const plain = calculateEmployeePay(salary, [], tax, inputs, new Map());
    const grossed = calculateEmployeePay(salary, [], tax, inputs, new Map(), { taxAllowance: allowance });

    const net = (pay: { earningsTotal: number; deductionsTotal: number }) => pay.earningsTotal - pay.deductionsTotal;
    expect(net(plain)).toBeLessThan(20_000_000);
    // The employee now takes home the whole taxable gross: the allowance pays
    // the tax exactly, so the two cancel.
    expect(net(grossed)).toBe(20_000_000);

    const row = grossed.components.find(component => component.salaryComponentId === 'allowance');
    const withheld = grossed.components.find(component => component.name === 'Tax');
    expect(row).toMatchObject({ type: 'ALLOWANCE', isTaxable: true });
    // Pinned to a positive figure first, so a missing row cannot satisfy these
    // by comparing undefined to undefined.
    expect(grossed.taxAllowance).toBeGreaterThan(0);
    expect(row?.amount).toBe(grossed.taxAllowance);
    expect(withheld?.amount).toBe(grossed.taxAllowance);
  });

  it('does not hand out an allowance when the allocation has no PPh21 to deduct', () => {
    const untaxed = { ...salary, components: [salary.components[0]] };
    const pay = calculateEmployeePay(untaxed, [], tax, inputs, new Map(), { taxAllowance: allowance });
    expect(pay.taxAllowance).toBe(0);
    expect(pay.components.some(component => component.salaryComponentId === 'allowance')).toBe(false);
    expect(pay.earningsTotal).toBe(20_000_000);
  });
});
