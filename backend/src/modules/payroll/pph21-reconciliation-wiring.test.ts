import { Prisma } from '@prisma/client';

jest.mock('@/shared/database/prisma', () => ({ __esModule: true, default: {}, prisma: {} }));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { PayrollService } from './payroll.service';
import { calculateAnnualPph21 } from '@/shared/payroll/pph21-annual';

const TAX_COMPONENT = 'component-pph21';

/**
 * The arithmetic lives in pph21-annual and is tested there. What is tested here
 * is the wiring: which numbers the run feeds it. Getting the arithmetic right
 * and then handing it the wrong months would settle the wrong year.
 */
const correction = (service: PayrollService, input: unknown) =>
  (service as unknown as {
    annualTaxCorrection: (arg: unknown) => {
      annual: { annualGross: number; annualTax: number };
      withheldToDate: number;
      delta: number;
    } | null;
  }).annualTaxCorrection(input);

const taxContext = { married: true, dependents: 2, hasNpwp: true };

function priorSlip(taxableGross: number, withheld: number) {
  return {
    components: [
      { salaryComponentId: 'component-base', amount: new Prisma.Decimal(taxableGross), type: 'ALLOWANCE', isTaxable: true },
      { salaryComponentId: TAX_COMPONENT, amount: new Prisma.Decimal(withheld), type: 'DEDUCTION', isTaxable: false },
    ],
  };
}

function thisPeriod(taxableGross: number, withheld: number) {
  return [
    { salaryComponentId: 'component-base', name: 'Gaji Pokok', type: 'ALLOWANCE' as const, amount: taxableGross, isTaxable: true },
    { salaryComponentId: TAX_COMPONENT, name: 'PPh 21', type: 'DEDUCTION' as const, amount: withheld, isTaxable: false },
  ];
}

describe('what the December run feeds the reconciliation', () => {
  let service: PayrollService;
  beforeEach(() => { service = new PayrollService(); });

  it('counts the month being paid as part of the year', () => {
    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: thisPeriod(15_000_000, 1_000_000),
      priorSlips: [priorSlip(15_000_000, 1_000_000)],
      taxContext,
      pension: 450_000,
      policy: {},
    });

    // Two months of gross, and both months' withholding — not just the prior one.
    expect(result?.annual.annualGross).toBe(30_000_000);
    expect(result?.withheldToDate).toBe(2_000_000);
  });

  it('sums only taxable earnings, never deductions or untaxed allowances', () => {
    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: [
        { salaryComponentId: 'base', name: 'Gaji', type: 'ALLOWANCE', amount: 10_000_000, isTaxable: true },
        { salaryComponentId: 'meal', name: 'Uang Makan', type: 'ALLOWANCE', amount: 1_000_000, isTaxable: false },
        { salaryComponentId: 'loan', name: 'Pinjaman', type: 'DEDUCTION', amount: 500_000, isTaxable: false },
      ],
      priorSlips: [],
      taxContext,
      pension: 0,
      policy: {},
    });

    expect(result?.annual.annualGross).toBe(10_000_000);
  });

  it('reads withholding from the tax component alone, not from every deduction', () => {
    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: [
        { salaryComponentId: 'base', name: 'Gaji', type: 'ALLOWANCE', amount: 15_000_000, isTaxable: true },
        { salaryComponentId: TAX_COMPONENT, name: 'PPh 21', type: 'DEDUCTION', amount: 900_000, isTaxable: false },
        { salaryComponentId: 'bpjs', name: 'BPJS', type: 'DEDUCTION', amount: 450_000, isTaxable: false },
      ],
      priorSlips: [],
      taxContext,
      pension: 450_000,
      policy: {},
    });

    expect(result?.withheldToDate).toBe(900_000);
  });

  it('agrees with the annual engine on the same figures', () => {
    const months = Array.from({ length: 12 }, () => 15_000_000);
    const expected = calculateAnnualPph21({ ...taxContext, monthlyGrosses: months, monthlyPensions: months.map(() => 450_000) });

    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: thisPeriod(15_000_000, 0),
      priorSlips: Array.from({ length: 11 }, () => priorSlip(15_000_000, 0)),
      taxContext,
      pension: 450_000,
      policy: {},
    });

    expect(result?.annual.annualTax).toBe(expected.annualTax);
    expect(result?.delta).toBe(expected.annualTax); // nothing withheld all year
  });

  /**
   * A confident zero would be worse than doing nothing: it would put a
   * "correction: 0" line on a payslip for a year the system cannot actually
   * settle.
   */
  it('declines to settle a year with no taxable income at all', () => {
    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: [{ salaryComponentId: 'loan', name: 'Pinjaman', type: 'DEDUCTION', amount: 500_000, isTaxable: false }],
      priorSlips: [],
      taxContext,
      pension: 0,
      policy: {},
    });

    expect(result).toBeNull();
  });

  it('carries the company tax policy through, so overridden brackets are respected', () => {
    const generous = { pph21: { ptkpBase: 500_000_000 } };
    const result = correction(service, {
      taxComponentId: TAX_COMPONENT,
      thisPeriod: thisPeriod(15_000_000, 0),
      priorSlips: [],
      taxContext,
      pension: 0,
      policy: generous,
    });

    // With PTKP raised above the annual income, nothing is owed.
    expect(result?.annual.annualTax).toBe(0);
  });
});
