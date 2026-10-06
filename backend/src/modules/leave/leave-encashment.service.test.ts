import { LeaveEncashmentStatus, Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  settings: Array<{ key: string; value: string }>;
  leaveType: Row | null;
  balance: Row | null;
  lockedBalance: Row | null;
  salary: Row | null;
  committedDays: number | null;
  encashment: Row | null;
  created: Row[];
  updates: Array<{ table: string; where: Row; data: Row }>;
  updateCount: number;
  actorId: string;
} = {
  settings: [], leaveType: null, balance: null, lockedBalance: null, salary: null,
  committedDays: null, encashment: null, created: [], updates: [], updateCount: 1, actorId: 'user-hr',
};

jest.mock('@/shared/database/prisma', () => {
  const tx = {
    leaveEncashment: {
      findFirst: jest.fn(async () => state.encashment),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'encashment', where, data });
        return { count: state.updateCount };
      }),
    },
    leaveBalance: {
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'balance', where, data });
        return { id: where.id, ...data };
      }),
    },
    $queryRaw: jest.fn(async () => (state.lockedBalance ? [state.lockedBalance] : [])),
  };
  const client = {
    companySetting: { findMany: jest.fn(async () => state.settings) },
    leaveType: { findFirst: jest.fn(async () => state.leaveType) },
    leaveBalance: { findFirst: jest.fn(async () => state.balance) },
    employeeSalary: { findFirst: jest.fn(async () => state.salary) },
    leaveEncashment: {
      aggregate: jest.fn(async () => ({ _sum: { days: state.committedDays } })),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'encashment-1', status: LeaveEncashmentStatus.PENDING, ...data };
        state.created.push(row);
        return row;
      }),
      findFirst: jest.fn(async () => state.encashment),
      findMany: jest.fn(async () => (state.encashment ? [state.encashment] : [])),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'encashment', where, data });
        return { count: state.updateCount };
      }),
    },
    $transaction: jest.fn(async (work: (client: unknown) => Promise<unknown>) => work(tx)),
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => ({ id: state.actorId }) }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));
jest.mock('@/shared/database/concurrency', () => ({
  withConcurrencyRetry: (work: () => Promise<unknown>) => work(),
}));

import { LeaveEncashmentService } from './leave-encashment.service';

const service = new LeaveEncashmentService();
const COMPANY = 'company-a';
const EMPLOYEE = 'employee-1';
const LEAVE_TYPE = 'leave-annual';

const enabled = (over: Record<string, string> = {}) =>
  Object.entries({
    leave_encashment_enabled: 'true',
    leave_encashment_max_days_per_year: '0',
    leave_encashment_daily_divisor: '21',
    leave_encashment_include_allowances: 'false',
    ...over,
  }).map(([key, value]) => ({ key, value }));

function salaryRow(over: Row = {}) {
  return {
    id: 'salary-1', currency: 'IDR', baseSalary: new Prisma.Decimal('10500000'),
    components: [
      // Tunjangan jabatan is paid every month regardless of attendance, so it
      // is tunjangan TETAP and belongs in "upah sebulan".
      { isActive: true, amount: new Prisma.Decimal('1050000'),
        salaryComponent: { name: 'Tunjangan Jabatan', type: 'ALLOWANCE', isFixedAllowance: true } },
      // Transport moves with days attended. The statute excludes it, and this
      // fixture used to have it as the ONLY allowance — so the expectation
      // below was asserting that a variable allowance inflates the daily rate,
      // which is the behaviour `isFixedAllowance` exists to end.
      { isActive: true, amount: new Prisma.Decimal('900000'),
        salaryComponent: { name: 'Tunjangan Transport', type: 'ALLOWANCE', isFixedAllowance: false } },
      { isActive: true, amount: new Prisma.Decimal('200000'),
        salaryComponent: { name: 'Potongan Koperasi', type: 'DEDUCTION' } },
    ],
    ...over,
  };
}

const request = (over: Row = {}) =>
  service.request(COMPANY, { employeeId: EMPLOYEE, leaveTypeId: LEAVE_TYPE, days: 2, year: 2026, ...over } as never);

beforeEach(() => {
  jest.clearAllMocks();
  state.settings = enabled();
  state.leaveType = { id: LEAVE_TYPE, isPaid: true, isActive: true, name: 'Cuti Tahunan' };
  state.balance = { remainingDays: 8 };
  state.lockedBalance = { id: 'balance-1', used_days: 4, remaining_days: 8 };
  state.salary = salaryRow();
  state.committedDays = null;
  state.encashment = null;
  state.created = [];
  state.updates = [];
  state.updateCount = 1;
  state.actorId = 'user-hr';
});

describe('encashment policy is per company, not hardcoded', () => {
  it('refuses when the company has not switched it on', async () => {
    state.settings = enabled({ leave_encashment_enabled: 'false' });
    await expect(request()).rejects.toThrow(/belum diaktifkan/i);
  });

  it('is off when no setting row exists at all', async () => {
    state.settings = [];
    await expect(request()).rejects.toThrow(/belum diaktifkan/i);
  });

  it('computes the daily rate on the 21-day divisor', async () => {
    await request();
    // 10.500.000 / 21 = 500.000 per day × 2 days
    expect(String(state.created[0].grossAmount)).toBe('1000000');
  });

  it('computes the daily rate on the 30-day divisor when that is the policy', async () => {
    state.settings = enabled({ leave_encashment_daily_divisor: '30' });
    await request();
    // 10.500.000 / 30 = 350.000 per day × 2 days
    expect(String(state.created[0].grossAmount)).toBe('700000');
  });

  it('includes fixed allowances when the policy says so', async () => {
    state.settings = enabled({ leave_encashment_include_allowances: 'true' });
    await request();
    // (10.500.000 + 1.050.000) / 21 = 550.000 per day × 2. The deduction is
    // not part of a wage basis, and neither is the 900.000 transport
    // allowance — it is tunjangan tidak tetap.
    expect(String(state.created[0].grossAmount)).toBe('1100000');
  });

  /** A zero divisor would divide by zero straight into someone's pay. */
  it.each([['0'], ['-5'], ['abc']])('falls back to 21 for an invalid divisor %p', async (divisor) => {
    state.settings = enabled({ leave_encashment_daily_divisor: divisor });
    await request();
    expect(String(state.created[0].grossAmount)).toBe('1000000');
  });

  it('leaves a variable allowance out of the daily rate even when allowances count', async () => {
    // The whole point of the flag. Transport is paid per day attended, so
    // including it would pay out leave at a rate the employee never earns on
    // a non-working day.
    state.settings = enabled({ leave_encashment_include_allowances: 'true' });
    await request();
    expect(String(state.created[0].grossAmount)).toBe('1100000');
    expect(state.created[0].basis).toMatchObject({
      allowances: [{ name: 'Tunjangan Jabatan', amount: '1050000' }],
    });
  });

  it('keeps the derivation with the row so the payout can be traced', async () => {
    await request();
    expect(state.created[0].basis).toMatchObject({
      baseSalary: '10500000', divisor: 21, dailyRate: '500000', days: 2, includeAllowances: false,
    });
  });

  it('describes the policy for the UI, formula included', async () => {
    state.settings = enabled({ leave_encashment_daily_divisor: '30', leave_encashment_include_allowances: 'true' });
    await expect(service.describePolicy(COMPANY)).resolves.toMatchObject({
      enabled: true,
      divisor: 30,
      dailyRateFormula: '(gaji pokok + tunjangan tetap) / 30',
    });
  });
});

describe('requesting encashment', () => {
  it('refuses more days than the employee has left', async () => {
    state.balance = { remainingDays: 1 };
    await expect(request({ days: 3 })).rejects.toThrow(/Saldo cuti tidak cukup: tersisa 1 hari/);
  });

  it('refuses when no balance row exists for that year', async () => {
    state.balance = null;
    await expect(request()).rejects.toThrow(/tersisa 0 hari/);
  });

  /**
   * The ceiling counts days already committed, paid or not — two pending
   * requests could otherwise pass a limit each of them respects alone.
   */
  it('counts days already requested or paid against the yearly ceiling', async () => {
    state.settings = enabled({ leave_encashment_max_days_per_year: '5' });
    state.committedDays = 4;
    await expect(request({ days: 2 })).rejects.toThrow(/Batas pencairan 5 hari per tahun terlampaui/);
  });

  it('allows a request that fits inside the ceiling', async () => {
    state.settings = enabled({ leave_encashment_max_days_per_year: '5' });
    state.committedDays = 3;
    await expect(request({ days: 2 })).resolves.toMatchObject({ status: LeaveEncashmentStatus.PENDING });
  });

  it('treats a zero ceiling as no ceiling beyond the balance', async () => {
    state.committedDays = 100;
    await expect(request({ days: 2 })).resolves.toMatchObject({ status: LeaveEncashmentStatus.PENDING });
  });

  /** Encashing unpaid leave would pay for days that were never earned as pay. */
  it('refuses an unpaid leave type', async () => {
    state.leaveType = { id: LEAVE_TYPE, isPaid: false, isActive: true, name: 'Cuti Tidak Dibayar' };
    await expect(request()).rejects.toThrow(/Only a paid leave type/i);
  });

  it('refuses an inactive leave type', async () => {
    state.leaveType = { id: LEAVE_TYPE, isPaid: true, isActive: false, name: 'Cuti Lama' };
    await expect(request()).rejects.toThrow(/inactive/i);
  });

  it('refuses a leave type from another company', async () => {
    state.leaveType = null;
    await expect(request()).rejects.toThrow(/does not belong to the active company/i);
  });

  it('refuses a non-IDR salary rather than paying an unconverted figure', async () => {
    state.salary = salaryRow({ currency: 'USD' });
    await expect(request()).rejects.toThrow(/IDR/);
  });

  it('refuses when the employee has no active salary', async () => {
    state.salary = null;
    await expect(request()).rejects.toThrow(/no active salary/i);
  });

  it.each([[0], [-1], [1.5]])('refuses %p days', async (days) => {
    await expect(request({ days })).rejects.toThrow(/positive whole number/i);
  });

  it('does not touch the balance at request time', async () => {
    await request();
    expect(state.updates.filter((update) => update.table === 'balance')).toEqual([]);
  });
});

describe('approving encashment', () => {
  beforeEach(() => {
    state.encashment = {
      id: 'encashment-1', companyId: COMPANY, employeeId: EMPLOYEE, leaveTypeId: LEAVE_TYPE,
      year: 2026, days: 2, grossAmount: new Prisma.Decimal('1000000'),
      status: LeaveEncashmentStatus.PENDING, requestedBy: 'user-employee',
    };
  });

  it('deducts the balance and marks the row approved', async () => {
    await expect(service.approve(COMPANY, 'encashment-1')).resolves.toMatchObject({
      status: LeaveEncashmentStatus.APPROVED, days: 2,
    });

    expect(state.updates.find((update) => update.table === 'balance')?.data).toMatchObject({
      usedDays: 6, remainingDays: 6,
    });
    expect(state.updates.find((update) => update.table === 'encashment')?.where).toMatchObject({
      status: LeaveEncashmentStatus.PENDING,
    });
  });

  /**
   * The balance is re-read under a lock rather than trusted from the request:
   * an ordinary leave approval may have spent those days in between, and paying
   * for leave the employee no longer has pays twice for one entitlement.
   */
  it('refuses when the balance was spent between request and approval', async () => {
    state.lockedBalance = { id: 'balance-1', used_days: 11, remaining_days: 1 };
    await expect(service.approve(COMPANY, 'encashment-1')).rejects.toThrow(/sudah tidak cukup: tersisa 1 hari/);
  });

  it('refuses when the balance row has gone', async () => {
    state.lockedBalance = null;
    await expect(service.approve(COMPANY, 'encashment-1')).rejects.toThrow(/tersisa 0 hari/);
  });

  /** Maker-checker: nobody approves their own payout. */
  it('refuses when the approver is the requester', async () => {
    state.actorId = 'user-employee';
    await expect(service.approve(COMPANY, 'encashment-1')).rejects.toThrow(/cannot approve their own/i);
  });

  it('refuses a row that is no longer pending', async () => {
    state.encashment = { ...state.encashment, status: LeaveEncashmentStatus.PAID };
    await expect(service.approve(COMPANY, 'encashment-1')).rejects.toThrow(/Only a pending request/i);
  });

  it('refuses when someone else decided it mid-approval', async () => {
    state.updateCount = 0;
    await expect(service.approve(COMPANY, 'encashment-1')).rejects.toThrow(/decided by someone else/i);
  });
});

describe('paying encashment through payroll', () => {
  it('claims each row conditionally on APPROVED', async () => {
    await service.markPaid(COMPANY, 'run-1', [{ encashmentId: 'encashment-1', payslipId: 'payslip-1' }]);

    expect(state.updates[0].where).toMatchObject({ id: 'encashment-1', status: LeaveEncashmentStatus.APPROVED });
    expect(state.updates[0].data).toMatchObject({
      status: LeaveEncashmentStatus.PAID, payslipId: 'payslip-1', appliedRunId: 'run-1',
    });
  });

  /** If another run took the row first, this run must fail rather than pay twice. */
  it('fails the run when a row was already claimed', async () => {
    state.updateCount = 0;
    await expect(
      service.markPaid(COMPANY, 'run-1', [{ encashmentId: 'encashment-1', payslipId: 'payslip-1' }]),
    ).rejects.toThrow(/changed while this payroll run was calculating/i);
  });
});
