import { Prisma, PayrollArrearsStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  employee: Row | null;
  salary: Row | null;
  period: Row | null;
  payslip: Row | null;
  arrears: Row[];
  created: Row[];
  updates: Array<{ where: Row; data: Row }>;
  updateCount: number;
} = {
  employee: null, salary: null, period: null, payslip: null,
  arrears: [], created: [], updates: [], updateCount: 1,
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    employee: { findFirst: jest.fn(async () => state.employee) },
    employeeSalary: { findFirst: jest.fn(async () => state.salary) },
    payrollPeriod: { findFirst: jest.fn(async () => state.period) },
    payslip: { findFirst: jest.fn(async () => state.payslip) },
    payrollArrears: {
      findFirst: jest.fn(async () => state.arrears[0] ?? null),
      findMany: jest.fn(async () => state.arrears),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'arrears-1', status: PayrollArrearsStatus.PENDING, ...data };
        state.created.push(row);
        return row;
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => ({ id: 'user-hr' }) }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { payrollArrearsService } from './payroll-arrears.service';

const COMPANY = 'company-a';
const EMPLOYEE = 'employee-1';
const PERIOD = 'period-aug';

/** September period; August is the one that closed without paying this person. */
function closedPeriod(over: Row = {}) {
  return {
    id: PERIOD, name: 'Agustus 2026', code: 'PR-2026-08', status: 'CLOSED',
    startDate: new Date('2026-08-01T00:00:00Z'), endDate: new Date('2026-08-31T00:00:00Z'),
    ...over,
  };
}

function salaryRow(over: Row = {}) {
  return {
    id: 'salary-1',
    currency: 'IDR',
    baseSalary: new Prisma.Decimal('9300000'),
    effectiveDate: new Date('2026-01-01T00:00:00Z'),
    components: [
      { amount: new Prisma.Decimal('600000'), salaryComponent: { name: 'Tunjangan Transport', type: 'ALLOWANCE' } },
      { amount: new Prisma.Decimal('250000'), salaryComponent: { name: 'Potongan Koperasi', type: 'DEDUCTION' } },
    ],
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.employee = { id: EMPLOYEE, fullName: 'Maya', employeeNumber: 'EMP001', joinDate: new Date('2020-01-06T00:00:00Z'), resignations: [] };
  state.salary = salaryRow();
  state.period = closedPeriod();
  state.payslip = null;
  state.arrears = [];
  state.created = [];
  state.updates = [];
  state.updateCount = 1;
});

describe('registering arrears for a closed period', () => {
  it('computes the gross from the salary effective in that period, allowances included', async () => {
    await payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD });

    const created = state.created[0];
    // 9.300.000 base + 600.000 allowance. The deduction component is not part
    // of a gross figure, and tax belongs to the period that pays it.
    expect(String(created.grossAmount)).toBe('9900000');
    expect(created.status).toBe(PayrollArrearsStatus.PENDING);
    expect(created.registeredBy).toBe('user-hr');
  });

  /**
   * The usual reason someone is missed: they joined partway through the month
   * and were not on the payroll list when it ran.
   */
  it('prorates for an employee who joined inside the period', async () => {
    state.employee = { ...state.employee, joinDate: new Date('2026-08-21T00:00:00Z') };

    await payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD });

    // 21 Aug–31 Aug inclusive is 11 of 31 days: 9.900.000 × 11 / 31.
    expect(String(state.created[0].grossAmount)).toBe('3512903.23');
    expect((state.created[0].basis as Row).prorated).toBe(true);
    expect((state.created[0].basis as Row).payableDays).toBe(11);
  });

  /**
   * Someone who left on the 10th and was missed must not be handed a whole
   * month — that is real money, paid once and hard to recover.
   */
  it('caps the window at an approved resignation last working date', async () => {
    state.employee = {
      ...state.employee,
      resignations: [{ lastWorkingDate: new Date('2026-08-10T00:00:00Z') }],
    };

    await payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD });

    // 1 Aug–10 Aug inclusive is 10 of 31 days.
    expect((state.created[0].basis as Row).payableDays).toBe(10);
    expect(String(state.created[0].grossAmount)).toBe('3193548.39');
  });

  it('keeps the derivation with the row so the figure can be traced', async () => {
    await payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD });

    expect(state.created[0].basis).toMatchObject({
      employeeNumber: 'EMP001',
      salaryId: 'salary-1',
      baseSalary: '9300000',
      monthlyGross: '9900000',
      periodDays: 31,
      payableDays: 31,
      prorated: false,
      allowances: [{ name: 'Tunjangan Transport', amount: '600000' }],
    });
  });

  it.each([['DRAFT'], ['ACTIVE']])('refuses a %s period — an open period should just include the employee', async (status) => {
    state.period = closedPeriod({ status });
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/closed period only/i);
    expect(state.created).toHaveLength(0);
  });

  it('refuses when the employee already has a payslip for that period', async () => {
    state.payslip = { id: 'payslip-existing' };
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/correction, not arrears/i);
  });

  it('refuses a second entry for the same employee and period', async () => {
    state.arrears = [{ id: 'arrears-existing', status: PayrollArrearsStatus.APPLIED }];
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/already exist \(APPLIED\)/i);
  });

  it('refuses when no salary was effective in that period', async () => {
    state.salary = null;
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/No salary was effective/i);
  });

  it('refuses a non-IDR salary rather than paying an unconverted figure', async () => {
    state.salary = salaryRow({ currency: 'USD' });
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/IDR/);
  });

  it('refuses when the employee was not employed during the period at all', async () => {
    state.employee = { ...state.employee, joinDate: new Date('2026-09-15T00:00:00Z') };
    await expect(
      payrollArrearsService.register(COMPANY, { employeeId: EMPLOYEE, sourcePeriodId: PERIOD }),
    ).rejects.toThrow(/not employed during any part/i);
  });
});

describe('claiming and cancelling', () => {
  it('claims each row conditionally on PENDING', async () => {
    await payrollArrearsService.markApplied(COMPANY, 'run-1', [{ arrearsId: 'arrears-1', payslipId: 'payslip-1' }]);

    expect(state.updates[0].where).toMatchObject({ id: 'arrears-1', companyId: COMPANY, status: PayrollArrearsStatus.PENDING });
    expect(state.updates[0].data).toMatchObject({ status: PayrollArrearsStatus.APPLIED, payslipId: 'payslip-1', appliedRunId: 'run-1' });
  });

  /**
   * The guard that matters: if another run took the row first, this run must
   * fail rather than pay the same arrears a second time.
   */
  it('fails the run when a row was already claimed elsewhere', async () => {
    state.updateCount = 0;
    await expect(
      payrollArrearsService.markApplied(COMPANY, 'run-1', [{ arrearsId: 'arrears-1', payslipId: 'payslip-1' }]),
    ).rejects.toThrow(/changed while this payroll run was calculating/i);
  });

  it('refuses to cancel a row that is already applied', async () => {
    state.arrears = [{ id: 'arrears-1', status: PayrollArrearsStatus.APPLIED }];
    await expect(payrollArrearsService.cancel(COMPANY, 'arrears-1')).rejects.toThrow(/Only pending arrears/i);
  });

  it('refuses to cancel a row a run claimed mid-cancellation', async () => {
    state.arrears = [{ id: 'arrears-1', status: PayrollArrearsStatus.PENDING }];
    state.updateCount = 0;
    await expect(payrollArrearsService.cancel(COMPANY, 'arrears-1')).rejects.toThrow(/claimed by a payroll run/i);
  });

  it('cancels a pending row', async () => {
    state.arrears = [{ id: 'arrears-1', status: PayrollArrearsStatus.PENDING }];
    await expect(payrollArrearsService.cancel(COMPANY, 'arrears-1')).resolves.toMatchObject({
      status: PayrollArrearsStatus.CANCELLED,
    });
  });
});
