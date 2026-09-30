type Row = Record<string, unknown>;

const state: {
  employee: Row | null;
  overlapping: Row | null;
  history: Row[];
  contracts: Row[];
  supervisors: Row[];
  hrUsers: Row[];
  created: Row[];
  notifications: Row[][];
  updates: Array<{ where: Row; data: Row }>;
} = {
  employee: null, overlapping: null, history: [], contracts: [], supervisors: [], hrUsers: [],
  created: [], notifications: [], updates: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    employee: {
      findFirst: jest.fn(async () => state.employee),
      findMany: jest.fn(async () => state.supervisors),
    },
    employmentContract: {
      findFirst: jest.fn(async () => state.overlapping),
      findMany: jest.fn(async ({ select }: { select?: Row }) =>
        (select && 'startDate' in select ? state.history : state.contracts)),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'contract-1', status: 'ACTIVE', ...data };
        state.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { id: where.id, ...data };
      }),
    },
    userRole: { findMany: jest.fn(async () => state.hrUsers) },
    notification: {
      createMany: jest.fn(async ({ data }: { data: Row[] }) => {
        state.notifications.push(data);
        return { count: data.length };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentUser: () => ({ id: 'user-hr' }),
  runInSystemContext: (_reason: string, work: () => unknown) => work(),
}));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { EmploymentContractService, monthsBetween } from './employment-contract.service';

const service = new EmploymentContractService();
const COMPANY = 'company-a';
const EMPLOYEE = 'employee-1';

const iso = (value: string) => new Date(`${value}T00:00:00.000Z`).toISOString();

const create = (over: Row = {}) =>
  service.create(COMPANY, {
    employeeId: EMPLOYEE, type: 'PKWT', startDate: iso('2026-01-01'), endDate: iso('2026-12-31'), ...over,
  } as never);

beforeEach(() => {
  jest.clearAllMocks();
  state.employee = { id: EMPLOYEE };
  state.overlapping = null;
  state.history = [];
  state.contracts = [];
  state.supervisors = [];
  state.hrUsers = [];
  state.created = [];
  state.notifications = [];
  state.updates = [];
});

describe('counting contract months', () => {
  it.each([
    ['2026-01-01', '2026-12-31', 11],
    ['2026-01-01', '2027-01-01', 12],
    ['2026-01-15', '2026-04-15', 3],
    ['2026-01-15', '2026-04-14', 2],
  ])('%s to %s is %i months', (start, end, expected) => {
    expect(monthsBetween(new Date(`${start}T00:00:00Z`), new Date(`${end}T00:00:00Z`))).toBe(expected);
  });
});

describe('creating a contract', () => {
  it('stores a PKWT with its dates', async () => {
    const { contract } = await create();
    expect(contract).toMatchObject({ type: 'PKWT', createdBy: 'user-hr' });
    expect(state.created[0].endDate).toEqual(new Date('2026-12-31T00:00:00.000Z'));
  });

  /** "Indefinite until the 30th" is not a thing. */
  it('refuses a PKWTT carrying an end date', async () => {
    await expect(create({ type: 'PKWTT', endDate: iso('2027-01-01') })).rejects.toThrow(/tidak boleh punya tanggal berakhir/i);
  });

  it('accepts a PKWTT with no end date', async () => {
    const { contract } = await create({ type: 'PKWTT', endDate: undefined });
    expect(contract).toMatchObject({ type: 'PKWTT', endDate: null });
  });

  it.each([['PKWT'], ['PROBATION']])('requires an end date for %s', async (type) => {
    await expect(create({ type, endDate: undefined })).rejects.toThrow(/wajib punya tanggal berakhir/i);
  });

  it('refuses an end date that is not after the start', async () => {
    await expect(create({ endDate: iso('2026-01-01') })).rejects.toThrow(/harus setelah tanggal mulai/i);
  });

  /**
   * Beyond three months the probation clause is void, and dismissing someone
   * under it afterwards is an unlawful termination — so this is refused, not
   * merely flagged.
   */
  it('refuses a probation longer than three months', async () => {
    await expect(create({ type: 'PROBATION', startDate: iso('2026-01-01'), endDate: iso('2026-05-01') }))
      .rejects.toThrow(/maksimal 3 bulan/i);
    expect(state.created).toHaveLength(0);
  });

  it('accepts a probation of exactly three months', async () => {
    await expect(create({ type: 'PROBATION', startDate: iso('2026-01-01'), endDate: iso('2026-04-01') }))
      .resolves.toMatchObject({ contract: { type: 'PROBATION' } });
  });

  /** Two active contracts mean two answers to "what are they on now". */
  it('refuses an overlapping active contract', async () => {
    state.overlapping = { id: 'contract-old', type: 'PKWT', startDate: new Date('2025-06-01T00:00:00Z'), endDate: new Date('2026-06-01T00:00:00Z') };
    await expect(create()).rejects.toThrow(/tumpang tindih/i);
  });

  /**
   * The reason this is a table and not two date columns: without the history,
   * a second renewal overwrites the first and the statutory ceiling on total
   * fixed-term service becomes unknowable.
   */
  it('warns when the cumulative PKWT term passes the five-year limit', async () => {
    state.history = [
      { startDate: new Date('2021-01-01T00:00:00Z'), endDate: new Date('2024-01-01T00:00:00Z') }, // 36 months
      { startDate: new Date('2024-01-01T00:00:00Z'), endDate: new Date('2026-01-01T00:00:00Z') }, // 24 months
    ];
    const { warnings } = await create({ startDate: iso('2026-01-01'), endDate: iso('2027-01-01') });

    // 36 + 24 + 12 = 72 months against a 60-month ceiling.
    expect(warnings).toContain('pkwt:TOTAL_EXCEEDS_LEGAL_LIMIT_72_OF_60_MONTHS');
  });

  it('does not warn while the cumulative term is still inside the limit', async () => {
    state.history = [{ startDate: new Date('2025-01-01T00:00:00Z'), endDate: new Date('2026-01-01T00:00:00Z') }];
    const { warnings } = await create({ startDate: iso('2026-01-01'), endDate: iso('2027-01-01') });
    expect(warnings.some((warning) => warning.includes('EXCEEDS'))).toBe(false);
  });

  it('numbers the renewal so HR can see which one this is', async () => {
    state.history = [
      { startDate: new Date('2025-01-01T00:00:00Z'), endDate: new Date('2026-01-01T00:00:00Z') },
      { startDate: new Date('2026-01-01T00:00:00Z'), endDate: new Date('2026-06-01T00:00:00Z') },
    ];
    const { warnings } = await create({ startDate: iso('2026-06-01'), endDate: iso('2026-12-01') });
    expect(warnings).toContain('pkwt:RENEWAL_NUMBER_3');
  });

  /**
   * Reported rather than refused: there are lawful arrangements this service
   * cannot see — a genuine break in service, a different legal entity — so HR
   * is told what the law says and decides.
   */
  it('still creates the contract when the limit warning fires', async () => {
    state.history = [{ startDate: new Date('2019-01-01T00:00:00Z'), endDate: new Date('2026-01-01T00:00:00Z') }];
    const { contract, warnings } = await create({ startDate: iso('2026-01-01'), endDate: iso('2027-01-01') });
    expect(contract.id).toBe('contract-1');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('refuses an employee outside the active company', async () => {
    state.employee = null;
    await expect(create()).rejects.toThrow(/Employee not found/i);
  });
});

describe('expiry reminders', () => {
  const now = new Date('2026-06-01T03:00:00.000Z');

  function contractRow(over: Row = {}) {
    return {
      id: 'contract-1', companyId: COMPANY, type: 'PKWT',
      endDate: new Date('2026-06-15T00:00:00.000Z'), // 14 days away
      lastReminderDays: null,
      employee: {
        id: EMPLOYEE, employeeNumber: 'EMP001', fullName: 'Maya Putri',
        position: { reportsTo: { id: 'position-manager' } },
      },
      ...over,
    };
  }

  it('notifies the supervisor and HR once for an offset', async () => {
    state.contracts = [contractRow()];
    state.supervisors = [{ user: { id: 'user-manager', status: 'ACTIVE' } }];
    state.hrUsers = [{ userId: 'user-hr-manager' }];

    const result = await service.sweepExpiryReminders(now);

    expect(result).toMatchObject({ checked: 1, notified: 1, recipients: 2 });
    const rows = state.notifications[0];
    expect(rows.map((row) => row.userId).sort()).toEqual(['user-hr-manager', 'user-manager']);
    expect(String(rows[0].message)).toContain('Maya Putri');
    expect(String(rows[0].title)).toContain('14 hari');
    expect(rows[0]).toMatchObject({ action: 'CONTRACT_EXPIRING', referenceId: 'contract-1', type: 'WARNING' });
  });

  /** A reminder that arrives thirty times is noise people learn to ignore. */
  it('does not repeat the same offset on a later sweep', async () => {
    state.contracts = [contractRow({ lastReminderDays: 14 })];
    state.hrUsers = [{ userId: 'user-hr-manager' }];

    const result = await service.sweepExpiryReminders(now);

    expect(result).toMatchObject({ notified: 0, skipped: 1 });
    expect(state.notifications).toEqual([]);
  });

  it('sends the next, tighter reminder as the date approaches', async () => {
    state.contracts = [contractRow({ endDate: new Date('2026-06-06T00:00:00.000Z'), lastReminderDays: 14 })];
    state.hrUsers = [{ userId: 'user-hr-manager' }];

    const result = await service.sweepExpiryReminders(now);

    expect(result.notified).toBe(1);
    expect(String(state.notifications[0][0].title)).toContain('5 hari');
    expect(state.updates[0].data).toMatchObject({ lastReminderDays: 7 });
  });

  it('records the offset it sent, so the next sweep can tell', async () => {
    state.contracts = [contractRow()];
    state.hrUsers = [{ userId: 'user-hr-manager' }];
    await service.sweepExpiryReminders(now);
    expect(state.updates[0].data).toMatchObject({ lastReminderDays: 14 });
  });

  it('calls a probation reminder by its own name', async () => {
    state.contracts = [contractRow({ type: 'PROBATION' })];
    state.hrUsers = [{ userId: 'user-hr-manager' }];
    await service.sweepExpiryReminders(now);
    expect(String(state.notifications[0][0].title)).toMatch(/^Masa percobaan/);
  });

  it('skips an inactive supervisor account but still tells HR', async () => {
    state.contracts = [contractRow()];
    state.supervisors = [{ user: { id: 'user-manager', status: 'SUSPENDED' } }];
    state.hrUsers = [{ userId: 'user-hr-manager' }];

    const result = await service.sweepExpiryReminders(now);

    expect(result.recipients).toBe(1);
    expect(state.notifications[0][0].userId).toBe('user-hr-manager');
  });

  it('marks the offset even when nobody could be notified, rather than retrying forever', async () => {
    state.contracts = [contractRow()];

    const result = await service.sweepExpiryReminders(now);

    expect(result).toMatchObject({ notified: 0, recipients: 0 });
    expect(state.updates[0].data).toMatchObject({ lastReminderDays: 14 });
  });

  it('does nothing when no contract is near its end', async () => {
    const result = await service.sweepExpiryReminders(now);
    expect(result).toMatchObject({ checked: 0, notified: 0 });
  });
});
