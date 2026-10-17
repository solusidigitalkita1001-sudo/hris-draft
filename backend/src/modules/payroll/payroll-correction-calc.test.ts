import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/payroll/payroll-policy', () => ({
  loadPayrollPolicyConfig: jest.fn(async () => ({ pph21: {}, bpjs: {}, ter: {} })),
}));

// The arithmetic of the marginal tax lives in `shared/payroll/thr-tax.test.ts`.
// Here it is a visible 10% of whatever earning it was handed, so the test can
// see WHICH figure was taxed — the correction earning, not the monthly salary.
const taxCalls: Row[] = [];
let taxRate = 0.1;
jest.mock('@/shared/payroll/thr-tax', () => ({
  calculateThrTax: jest.fn((input: { thrAmount: number; method?: string }) => {
    taxCalls.push(input as Row);
    return {
      tax: Math.round(input.thrAmount * taxRate), method: input.method ?? 'ANNUALIZED',
      annualTaxWithoutThr: 0, annualTaxWithThr: 0, terRateWithoutThr: 0, terRateWithThr: 0,
    };
  }),
}));

const repo = {
  findPayrollRunById: jest.fn(),
  findAllEmployeeSalaries: jest.fn(async () => state.salaries),
  findSalaryComponentByCode: jest.fn(async () => state.taxComponent),
  reviveOrCreateSystemSalaryComponent: jest.fn(async (data: { code: string; name: string }) => ({ id: `component-${data.code}`, name: data.name })),
  createPayslip: jest.fn(async (data: Row) => {
    state.payslips.push(data);
    return { id: `payslip-${state.payslips.length}` };
  }),
  createPayslipComponents: jest.fn(async (rows: Row[]) => { state.components.push(...rows); }),
  updatePayrollRunTotals: jest.fn(async (_id: string, totals: Row) => { state.totals = totals; }),
  updatePayrollRunStatus: jest.fn(async () => undefined),
};
jest.mock('./payroll.repository', () => ({ payrollRepository: repo }));

const correctionService = {
  pendingByEmployee: jest.fn(async () => state.pending),
  markApplied: jest.fn(async (_c: string, _r: string, claims: Row[]) => { state.fullClaims.push(...claims); }),
  reduceRemaining: jest.fn(async (_c: string, claims: Row[]) => { state.partialClaims.push(...claims); }),
};
jest.mock('./payroll-correction.service', () => ({ payrollCorrectionService: correctionService }));

import { PayrollService } from './payroll.service';

const state: {
  pending: Map<string, Row[]>;
  salaries: Row[];
  taxComponent: Row | null;
  payslips: Row[];
  components: Row[];
  fullClaims: Row[];
  partialClaims: Row[];
  totals: Row | null;
  runNotes: string | null;
  employees: Row[];
} = {
  pending: new Map(), salaries: [], taxComponent: null,
  payslips: [], components: [], fullClaims: [], partialClaims: [], totals: null, runNotes: null, employees: [],
};

/** The `database` handed to the private method — only what the method touches. */
const database = {
  companySetting: { findUnique: jest.fn(async () => null) },
  employee: { findMany: jest.fn(async () => state.employees) },
  payrollRun: {
    findUnique: jest.fn(async () => ({ notes: null })),
    update: jest.fn(async ({ data }: { data: { notes: string } }) => { state.runNotes = data.notes; }),
  },
} as unknown as Prisma.TransactionClient;

function run(over: Row = {}) {
  return {
    id: 'run-corr', companyId: 'company-a', periodId: 'period-oct', runType: 'CORRECTION',
    period: { status: 'ACTIVE', code: 'PR-2026-10', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31') },
    ...over,
  };
}

function correction(over: Row = {}) {
  return {
    id: `correction-${Math.random().toString(36).slice(2, 8)}`,
    employeeId: 'employee-1',
    remainingAmount: new Prisma.Decimal('300000'),
    sourcePayslip: { payrollRun: { periodId: 'period-aug' } },
    ...over,
  };
}

function employeeRow(over: Row = {}) {
  return {
    id: 'employee-1', fullName: 'Maya', employeeNumber: 'EMP001', employmentType: 'PERMANENT',
    maritalStatus: 'SINGLE', taxId: '12.345', department: null, position: null,
    _count: { families: 0 },
    ...over,
  };
}

const service = new PayrollService() as unknown as {
  calculateCorrectionPayroll(runId: string, database: Prisma.TransactionClient): Promise<void>;
};

beforeEach(() => {
  jest.clearAllMocks();
  taxCalls.length = 0;
  taxRate = 0.1;
  state.pending = new Map();
  state.salaries = [{ id: 'salary-1', employeeId: 'employee-1', effectiveDate: new Date('2026-01-01'), isActive: true, baseSalary: new Prisma.Decimal('8000000') }];
  state.employees = [employeeRow()];
  state.taxComponent = { id: 'component-pph21', name: 'PPh 21' };
  state.payslips = []; state.components = []; state.fullClaims = []; state.partialClaims = [];
  state.totals = null; state.runNotes = null;
  repo.findPayrollRunById.mockResolvedValue(run());
});

describe('aggregation per employee', () => {
  it('sums positives into one earning, caps the deduction, pays earnings in full', async () => {
    state.pending.set('employee-1', [
      correction({ id: 'c-plus-1', remainingAmount: new Prisma.Decimal('300000') }),
      correction({ id: 'c-plus-2', remainingAmount: new Prisma.Decimal('200000') }),
      correction({ id: 'c-minus', remainingAmount: new Prisma.Decimal('-100000') }),
    ]);

    await service.calculateCorrectionPayroll('run-corr', database);

    const payslip = state.payslips[0];
    // earning 500.000, tax 10% = 50.000, deduction 100.000 fits inside what is left
    expect(String(payslip.totalEarnings)).toBe('500000');
    expect(String(payslip.totalDeductions)).toBe('150000');
    expect(String(payslip.netPay)).toBe('350000');
    // every row closed: two positives and the fully covered negative
    expect(state.fullClaims.map((claim) => claim.correctionId).sort()).toEqual(['c-minus', 'c-plus-1', 'c-plus-2']);
    expect(state.partialClaims).toHaveLength(0);
  });

  it('never lets the net go negative: the deduction is capped by earning minus its tax', async () => {
    state.pending.set('employee-1', [
      correction({ id: 'c-plus', remainingAmount: new Prisma.Decimal('100000') }),
      correction({ id: 'c-minus', remainingAmount: new Prisma.Decimal('-500000') }),
    ]);

    await service.calculateCorrectionPayroll('run-corr', database);

    const payslip = state.payslips[0];
    // earning 100.000, tax 10.000 → room 90.000 of the 500.000 owed
    expect(String(payslip.netPay)).toBe('0');
    expect(state.fullClaims.map((claim) => claim.correctionId)).toEqual(['c-plus']);
    // the leftover stays PENDING, shrunk to what is still owed
    expect(state.partialClaims).toHaveLength(1);
    expect(String(state.partialClaims[0].remainingAmount)).toBe('-410000');
  });

  it('skips an employee with only overpayments — no payslip, rows stay pending, run says so', async () => {
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('-200000') })]);
    state.pending.set('employee-2', [correction({ id: 'c-2', employeeId: 'employee-2', remainingAmount: new Prisma.Decimal('150000') })]);
    state.employees = [employeeRow(), employeeRow({ id: 'employee-2', employeeNumber: 'EMP002' })];

    await service.calculateCorrectionPayroll('run-corr', database);

    expect(state.payslips).toHaveLength(1);
    expect(state.fullClaims.map((claim) => claim.correctionId)).toEqual(['c-2']);
    expect(state.runNotes).toMatch(/EMP001/);
  });

  it('refuses the run when nobody has an earning to pay', async () => {
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('-200000') })]);
    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/nothing can be paid/i);
  });
});

describe('guards', () => {
  it('refuses a CLOSED period', async () => {
    repo.findPayrollRunById.mockResolvedValue(run({ period: { status: 'CLOSED', code: 'PR-2026-10', startDate: new Date('2026-10-01'), endDate: new Date('2026-10-31') } }));
    state.pending.set('employee-1', [correction()]);
    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/CLOSED/);
  });

  it('refuses when there is nothing pending', async () => {
    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/No pending corrections/i);
  });

  it('refuses the whole run when a correction targets this very period', async () => {
    state.pending.set('employee-1', [
      correction(),
      correction({ sourcePayslip: { payrollRun: { periodId: 'period-oct' } } }),
    ]);
    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/paid in a later period/i);
    expect(state.payslips).toHaveLength(0);
  });

  it('refuses without a PPH21 component to record the withholding on', async () => {
    state.taxComponent = null;
    state.pending.set('employee-1', [correction()]);
    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/PPH21/);
  });
});

describe('tax', () => {
  it('taxes the correction earning on top of the as-of monthly gross — not the monthly salary itself', async () => {
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('250000') })]);

    await service.calculateCorrectionPayroll('run-corr', database);

    expect(taxCalls).toHaveLength(1);
    expect(taxCalls[0].thrAmount).toBe(250000);
    expect(taxCalls[0].monthlyGross).toBe(8000000);
    const taxLine = state.components.find((component) => component.salaryComponentId === 'component-pph21');
    expect(String(taxLine?.amount)).toBe('25000');
  });

  it('refuses the run when the marginal tax exceeds the earning instead of writing a negative net', async () => {
    // Tepi bracket TER: tarif baru berlaku atas seluruh bruto, jadi pajak
    // marginal koreksi kecil bisa lebih besar dari koreksinya sendiri.
    taxRate = 3;
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('100000') })]);

    await expect(service.calculateCorrectionPayroll('run-corr', database)).rejects.toThrow(/melebihi earning/);
    expect(state.payslips).toHaveLength(0);
    expect(state.fullClaims).toHaveLength(0);
  });

  it('loads salaries for the corrected employees only, not the whole company', async () => {
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('250000') })]);

    await service.calculateCorrectionPayroll('run-corr', database);

    expect(repo.findAllEmployeeSalaries).toHaveBeenCalledWith('company-a', undefined, database, ['employee-1']);
  });

  it('taxes with no monthly base when the employee no longer has a salary row', async () => {
    state.salaries = [];
    state.pending.set('employee-1', [correction({ remainingAmount: new Prisma.Decimal('250000') })]);

    await service.calculateCorrectionPayroll('run-corr', database);

    expect(taxCalls[0].monthlyGross).toBe(0);
    expect(state.payslips[0].employeeSalary).toBeUndefined();
  });
});
