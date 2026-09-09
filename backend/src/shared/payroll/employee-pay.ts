import { Prisma, SalaryType } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { calculateBpjs } from './bpjs';
import { calculatePph21 } from './pph21';
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
  versions: Map<string, FormulaVersionInput>) {
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
  const taxableGross = resolved.filter(row => row.entry.type === 'ALLOWANCE' && row.entry.isTaxable)
    .reduce((sum, row) => sum.plus(row.entry.amount), new Prisma.Decimal(0)).toNumber();
  const bpjs = calculateBpjs(wage);
  const pph = calculatePph21({ monthlyGross: taxableGross, ...taxContext, monthlyPensionContribution: bpjs.employee.jht + bpjs.employee.jp });
  for (const row of resolved) {
    if (row.code === 'BPJS-TK') row.entry.amount = bpjs.employee.jht + bpjs.employee.jp;
    else if (row.code === 'BPJS-KES') row.entry.amount = bpjs.employee.jkn;
    else if (row.code === 'PPH21') row.entry.amount = pph.monthlyTax;
  }
  const components: PayComponent[] = [...resolved.map(row => row.entry), ...extraComponents];
  const total = (type: SalaryType) => components.filter(component => component.type === type)
    .reduce((sum, component) => sum.plus(component.amount), new Prisma.Decimal(0)).toDecimalPlaces(2).toNumber();
  return { earningsTotal: total('ALLOWANCE'), deductionsTotal: total('DEDUCTION'), components, formulaCalculations: result.calculations };
}
