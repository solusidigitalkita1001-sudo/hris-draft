import { Prisma, SalaryType } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { calculateBpjs, BpjsConfig } from './bpjs';
import { calculatePph21, grossUpTaxAllowance, Pph21Config } from './pph21';
import { FormulaInputs, FormulaVersionInput, resolvePayrollComponents } from './formula';

export interface PayComponent { salaryComponentId: string; name: string; type: SalaryType; amount: number; isTaxable: boolean }
export interface SalaryForCalculation {
  baseSalary: Prisma.Decimal | number | string; currency: string;
  components: { isActive: boolean; amount: Prisma.Decimal | number | string;
    salaryComponent: { id: string; code: string; name: string; type: SalaryType; calculationMethod: string;
      ratePercent: Prisma.Decimal | number | string | null; isTaxable: boolean; isActive: boolean; deletedAt: Date | null } }[];
}

export function calculateEmployeePay(salary: SalaryForCalculation, extraComponents: PayComponent[],
  taxContext: { married: boolean; dependents: number; hasNpwp: boolean }, inputs: FormulaInputs,
  versions: Map<string, FormulaVersionInput>,
  policy: {
    pph21?: Partial<Pph21Config>; bpjs?: Partial<BpjsConfig>;
    /**
     * Present only when the company pays its employees' PPh 21 (gross-up,
     * GAP-17). The component it names carries the tax allowance on the payslip.
     */
    taxAllowance?: { salaryComponentId: string; name: string } | null;
  } = {}) {
  const active = salary.components.filter(allocation => allocation.isActive);
  if (active.some(allocation => !allocation.salaryComponent.isActive || allocation.salaryComponent.deletedAt)) {
    throw new BadRequestError('An allocated salary component is inactive or deleted; review the salary allocation');
  }
  if (salary.currency !== 'IDR' && active.some(allocation => versions.has(allocation.salaryComponent.id))) {
    throw new BadRequestError('Versioned payroll formulas currently support IDR salary allocations');
  }
  const result = resolvePayrollComponents(active.map(allocation => ({
    id: allocation.salaryComponent.id, code: allocation.salaryComponent.code,
    method: allocation.salaryComponent.calculationMethod, amount: allocation.amount,
    ratePercent: allocation.salaryComponent.ratePercent,
  })), inputs, versions);
  const resolved = active.map(allocation => ({ code: allocation.salaryComponent.code, entry: {
    salaryComponentId: allocation.salaryComponent.id, name: allocation.salaryComponent.name,
    type: allocation.salaryComponent.type, amount: result.amounts.get(allocation.salaryComponent.code)!.toNumber(),
    isTaxable: allocation.salaryComponent.isTaxable,
  } }));
  const wage = Number(salary.baseSalary);
  // Overtime, rapel and leave encashment arrive as extraComponents and are
  // marked isTaxable: true by the payroll run, with comments saying exactly
  // why. They were nonetheless left out of the tax base, which was computed
  // from the salary allocation alone — so that flag was written and never
  // read, and PPh 21 came out short for everyone who worked an hour of
  // overtime. The December reconciliation then recomputes the year from the
  // payslip components, which DO include them, so the shortfall was not even
  // lost: it accumulated and landed on the employee in one December bill.
  const taxableGross = [...resolved.map(row => row.entry), ...extraComponents]
    .filter(component => component.type === 'ALLOWANCE' && component.isTaxable)
    .reduce((sum, component) => sum.plus(component.amount), new Prisma.Decimal(0)).toNumber();
  const bpjs = calculateBpjs(wage, policy.bpjs ?? {});
  const taxInput = {
    monthlyGross: taxableGross, ...taxContext,
    monthlyPensionContribution: bpjs.employee.jht + bpjs.employee.jp,
  };
  // Gross-up needs somewhere to deduct the tax it pays for. An allocation
  // without a PPH21 row has no tax deducted at all, so adding the allowance
  // alone would simply raise take-home pay — not gross-up, a pay rise.
  const grossUp = policy.taxAllowance && resolved.some(row => row.code === 'PPH21')
    ? grossUpTaxAllowance(taxInput, policy.pph21 ?? {})
    : null;
  const pph = grossUp ? grossUp.result : calculatePph21(taxInput, policy.pph21 ?? {});
  for (const row of resolved) {
    if (row.code === 'BPJS-TK') row.entry.amount = bpjs.employee.jht + bpjs.employee.jp;
    else if (row.code === 'BPJS-KES') row.entry.amount = bpjs.employee.jkn;
    else if (row.code === 'PPH21') row.entry.amount = pph.monthlyTax;
  }
  const components: PayComponent[] = [...resolved.map(row => row.entry), ...extraComponents];
  if (grossUp && policy.taxAllowance && grossUp.allowance > 0) {
    components.push({
      salaryComponentId: policy.taxAllowance.salaryComponentId,
      name: policy.taxAllowance.name,
      type: 'ALLOWANCE',
      amount: grossUp.allowance,
      // The allowance is ordinary taxable income — that is why solving for it
      // takes an iteration instead of one subtraction.
      isTaxable: true,
    });
  }
  const total = (type: SalaryType) => components.filter(component => component.type === type)
    .reduce((sum, component) => sum.plus(component.amount), new Prisma.Decimal(0)).toDecimalPlaces(2).toNumber();
  return { earningsTotal: total('ALLOWANCE'), deductionsTotal: total('DEDUCTION'), components,
    formulaCalculations: result.calculations, taxAllowance: grossUp?.allowance ?? 0 };
}
