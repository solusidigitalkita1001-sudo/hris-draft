import { calculateEmployeePay, PayComponent, SalaryForCalculation } from './employee-pay';
import { calculatePph21 } from './pph21';
import { calculateBpjs } from './bpjs';
import { FormulaInputs } from './formula';

const inputs: FormulaInputs = { BASE_SALARY: '20000000', WORK_DAYS: '20', PRESENT_DAYS: '20', LEAVE_DAYS: '0', ABSENT_DAYS: '0', OVERTIME_HOURS: '10' };
const salary: SalaryForCalculation = { baseSalary: '20000000', currency: 'IDR', components: [
  { isActive: true, amount: '20000000', salaryComponent: { id: 'base', code: 'BASE', name: 'Gaji Pokok', type: 'ALLOWANCE', calculationMethod: 'FIXED', ratePercent: null, isTaxable: true, isActive: true, deletedAt: null } },
  { isActive: true, amount: '0', salaryComponent: { id: 'tax', code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', calculationMethod: 'FIXED', ratePercent: null, isTaxable: false, isActive: true, deletedAt: null } },
] };
const taxContext = { married: false, dependents: 0, hasNpwp: true };

const overtime: PayComponent = { salaryComponentId: 'ot', name: 'Tunjangan Lembur', type: 'ALLOWANCE', amount: 4_000_000, isTaxable: true };
const untaxedAllowance: PayComponent = { salaryComponentId: 'meal', name: 'Tunjangan Makan', type: 'ALLOWANCE', amount: 4_000_000, isTaxable: false };

const withheld = (extras: PayComponent[]) => {
  const pay = calculateEmployeePay(salary, extras, taxContext, inputs, new Map());
  return pay.components.find(component => component.salaryComponentId === 'tax')?.amount ?? 0;
};

describe('taxable extra components belong in the PPh 21 base', () => {
  it('withholds more once taxable overtime is paid', () => {
    const base = withheld([]);
    const withOvertime = withheld([overtime]);
    expect(base).toBeGreaterThan(0);
    // The whole point: this assertion fails on the previous behaviour, where
    // the tax base ignored extraComponents entirely and both figures matched.
    expect(withOvertime).toBeGreaterThan(base);
  });

  it('matches taxing the combined gross directly', () => {
    // The engine also deducts the employee's deductible pension (BPJS JHT+JP
    // on the base wage) before the tariff, so the comparison has to feed the
    // same figure in or it is measuring a different calculation.
    const bpjs = calculateBpjs(20_000_000);
    const expected = calculatePph21({
      monthlyGross: 24_000_000, ...taxContext,
      monthlyPensionContribution: bpjs.employee.jht + bpjs.employee.jp,
    }).monthlyTax;
    expect(withheld([overtime])).toBe(expected);
  });

  it('still ignores an extra component that is not taxable', () => {
    expect(withheld([untaxedAllowance])).toBe(withheld([]));
  });

  it('does not tax a deduction that happens to ride along', () => {
    const loan: PayComponent = { salaryComponentId: 'loan', name: 'Potongan Pinjaman', type: 'DEDUCTION', amount: 5_000_000, isTaxable: false };
    expect(withheld([loan])).toBe(withheld([]));
  });
});
