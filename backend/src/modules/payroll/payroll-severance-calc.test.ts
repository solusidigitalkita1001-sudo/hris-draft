import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const repo = {
  findPayrollRunById: jest.fn(),
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

const severanceService = {
  pendingByEmployee: jest.fn(async () => state.pending),
  markApplied: jest.fn(async (_c: string, _r: string, claims: Row[]) => { state.claims.push(...claims); }),
};
jest.mock('./payroll-severance.service', () => ({ payrollSeveranceService: severanceService }));

import { PayrollService } from './payroll.service';

const state: {
  pending: Map<string, Row[]>;
  employees: Row[];
  payslips: Row[];
  components: Row[];
  claims: Row[];
  totals: Row | null;
  runNotes: string | null;
} = { pending: new Map(), employees: [], payslips: [], components: [], claims: [], totals: null, runNotes: null };

const database = {
  employee: { findMany: jest.fn(async () => state.employees) },
  payrollRun: {
    findUnique: jest.fn(async () => ({ notes: null })),
    update: jest.fn(async ({ data }: { data: { notes: string } }) => { state.runNotes = data.notes; }),
  },
} as unknown as Prisma.TransactionClient;

function run(over: Row = {}) {
  return {
    id: 'run-sev', companyId: 'company-a', periodId: 'period-nov', runType: 'SEVERANCE',
    period: { status: 'ACTIVE', code: 'PR-2026-11', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30') },
    ...over,
  };
}

const service = new PayrollService() as unknown as {
  calculateSeverancePayroll(runId: string, database: Prisma.TransactionClient): Promise<void>;
};

beforeEach(() => {
  jest.clearAllMocks();
  state.pending = new Map();
  state.employees = [{ id: 'employee-1', fullName: 'Maya', employeeNumber: 'EMP001', employmentType: 'PERMANENT', department: null, position: null }];
  state.payslips = []; state.components = []; state.claims = []; state.totals = null; state.runNotes = null;
  repo.findPayrollRunById.mockResolvedValue(run());
});

describe('a severance run pays the frozen figures and taxes nothing', () => {
  it('writes one payslip per employee: earning = frozen gross, deduction = frozen final tax', async () => {
    state.pending.set('employee-1', [{
      id: 'severance-1', resignationId: 'resignation-1',
      grossAmount: new Prisma.Decimal('36000000'), taxAmount: new Prisma.Decimal('1800000'), netAmount: new Prisma.Decimal('34200000'),
    }]);

    await service.calculateSeverancePayroll('run-sev', database);

    const payslip = state.payslips[0];
    expect(String(payslip.totalEarnings)).toBe('36000000');
    expect(String(payslip.totalDeductions)).toBe('1800000');
    expect(String(payslip.netPay)).toBe('34200000');
    expect(payslip.workDays).toBe(0);

    const earning = state.components.find((component) => component.type === 'ALLOWANCE');
    // Final-taxed: the earning must never enter a monthly PPh 21 base again.
    expect(earning?.isTaxable).toBe(false);
    expect(earning?.salaryComponentId).toBe('component-SEVERANCE_EARNING_AUTO');
    const tax = state.components.find((component) => component.type === 'DEDUCTION');
    expect(tax?.salaryComponentId).toBe('component-SEVERANCE_TAX_AUTO');

    expect(state.claims).toEqual([{ severancePaymentId: 'severance-1', payslipId: 'payslip-1' }]);
    expect(String((state.totals as Row).totalNetPay)).toBe('34200000');
  });

  it('refuses an empty run and a CLOSED period', async () => {
    await expect(service.calculateSeverancePayroll('run-sev', database)).rejects.toThrow(/No pending severance/i);

    repo.findPayrollRunById.mockResolvedValue(run({ period: { status: 'CLOSED', code: 'PR-2026-11', startDate: new Date('2026-11-01'), endDate: new Date('2026-11-30') } }));
    state.pending.set('employee-1', [{ id: 'severance-1', resignationId: 'resignation-1', grossAmount: new Prisma.Decimal('1'), taxAmount: new Prisma.Decimal('0') }]);
    await expect(service.calculateSeverancePayroll('run-sev', database)).rejects.toThrow(/CLOSED/);
  });

  it('skips a vanished employee and refuses when nobody is payable', async () => {
    state.employees = [];
    state.pending.set('employee-ghost', [{ id: 'severance-1', resignationId: 'resignation-1', grossAmount: new Prisma.Decimal('1000'), taxAmount: new Prisma.Decimal('0') }]);
    await expect(service.calculateSeverancePayroll('run-sev', database)).rejects.toThrow(/nothing can be paid/i);
    expect(state.payslips).toHaveLength(0);
    expect(state.claims).toHaveLength(0);
  });
});
