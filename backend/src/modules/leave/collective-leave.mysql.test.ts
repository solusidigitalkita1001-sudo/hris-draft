import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { runInRequestContext } from '@/shared/context/RequestContext';

let mockDatabase: PrismaClient;
jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  get prisma() { return mockDatabase; },
  get default() { return mockDatabase; },
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { CollectiveLeaveService } from './collective-leave.service';

const databaseUrl = process.env.COLLECTIVE_LEAVE_DB_URL ?? process.env.DATABASE_URL;
const withDatabase = process.env.RUN_DB_INTEGRATION === '1' && databaseUrl ? describe : describe.skip;

/**
 * Cuti bersama against real MySQL, because the parts worth proving are the ones
 * a mock cannot: the FOR UPDATE balance read, the unique constraints, and the
 * arithmetic that must never produce a negative balance.
 */
withDatabase('collective leave (isolated real MySQL)', () => {
  const service = new CollectiveLeaveService();
  const companies: string[] = [];
  const groups: string[] = [];

  beforeAll(async () => {
    const url = new URL(databaseUrl as string);
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.pathname !== '/hris_payment_integration') {
      throw new Error('Collective leave tests require the isolated local hris_payment_integration database');
    }
    mockDatabase = new PrismaClient({ datasources: { db: { url: databaseUrl as string } } });
    await mockDatabase.$connect();
  });

  afterAll(async () => {
    if (!mockDatabase) return;
    const companyId = { in: companies };
    try {
      await mockDatabase.leaveRequest.deleteMany({ where: { companyId } });
      await mockDatabase.leaveBalance.deleteMany({ where: { companyId } });
      await mockDatabase.collectiveLeaveExclusion.deleteMany({ where: { collectiveLeave: { companyId } } });
      await mockDatabase.collectiveLeave.deleteMany({ where: { companyId } });
      await mockDatabase.leaveType.deleteMany({ where: { companyId } });
      await mockDatabase.attendance.deleteMany({ where: { companyId } });
      await mockDatabase.employee.deleteMany({ where: { companyId } });
      await mockDatabase.branch.deleteMany({ where: { companyId } });
      await mockDatabase.company.deleteMany({ where: { id: companyId } });
      await mockDatabase.companyGroup.deleteMany({ where: { id: { in: groups } } });
    } finally {
      await mockDatabase.$disconnect();
    }
  });

  const DATE = '2026-12-24T00:00:00.000Z';
  const dateOnly = new Date('2026-12-24T00:00:00.000Z');

  async function fixture() {
    const companyId = randomUUID();
    const groupId = randomUUID();
    companies.push(companyId);
    groups.push(groupId);
    await mockDatabase.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Collective leave tests' } });
    await mockDatabase.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const annual = await mockDatabase.leaveType.create({
      data: { companyId, name: 'Cuti Tahunan', code: randomUUID(), isPaid: true, isAnnual: true, maxDays: 12 },
    });
    const unpaid = await mockDatabase.leaveType.create({
      data: { companyId, name: 'Cuti Tidak Dibayar', code: randomUUID(), isPaid: false },
    });
    const branch = await mockDatabase.branch.create({
      data: { companyId, code: randomUUID(), name: 'Cabang yang tetap buka' },
    });
    return { companyId, annual, unpaid, branch };
  }

  async function employee(
    f: Awaited<ReturnType<typeof fixture>>,
    { remaining, branchId, joinDate }: { remaining: number | null; branchId?: string; joinDate?: string } = { remaining: 5 },
  ) {
    const person = await mockDatabase.employee.create({
      data: {
        companyId: f.companyId,
        employeeNumber: randomUUID(),
        firstName: 'Synthetic',
        lastName: 'Employee',
        fullName: 'Synthetic Employee',
        email: `${randomUUID()}@example.test`,
        joinDate: new Date(joinDate ?? '2020-01-06T00:00:00.000Z'),
        ...(branchId ? { branchId } : {}),
      },
    });
    if (remaining !== null) {
      await mockDatabase.leaveBalance.create({
        data: {
          companyId: f.companyId,
          employeeId: person.id,
          leaveTypeId: f.annual.id,
          year: 2026,
          totalDays: 12,
          usedDays: 12 - remaining,
          remainingDays: remaining,
        },
      });
    }
    return person;
  }

  const asHr = <T>(companyId: string, work: () => Promise<T>) =>
    runInRequestContext({ user: { id: randomUUID(), email: 'hr@example.test', companyId, companyScope: [companyId] } }, work);

  const declare = (f: Awaited<ReturnType<typeof fixture>>, excludedBranchIds?: string[]) =>
    asHr(f.companyId, () => service.declare(f.companyId, {
      date: DATE,
      name: 'Cuti Bersama Natal',
      leaveTypeId: f.annual.id,
      unpaidLeaveTypeId: f.unpaid.id,
      ...(excludedBranchIds ? { excludedBranchIds } : {}),
    }));

  it('deducts a day from the balance and records approved leave on the annual type', async () => {
    const f = await fixture();
    const person = await employee(f, { remaining: 5 });
    const declaration = await declare(f);

    const result = await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));

    expect(result).toMatchObject({ deducted: 1, unpaid: 0, skipped: 0, total: 1 });
    const balance = await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: person.id } });
    expect(balance.remainingDays).toBe(4);
    expect(balance.usedDays).toBe(8);
    const request = await mockDatabase.leaveRequest.findFirstOrThrow({ where: { employeeId: person.id } });
    expect(request.leaveTypeId).toBe(f.annual.id);
    expect(request.status).toBe('APPROVED');
    expect(request.totalDays).toBe(1);
    expect(request.collectiveLeaveId).toBe(declaration.id);
  });

  /**
   * The decision, precisely: an empty balance becomes unpaid leave, never a
   * negative balance. A negative balance would leak into payroll and severance.
   */
  it('sends an employee with no balance left to unpaid, never below zero', async () => {
    const f = await fixture();
    const empty = await employee(f, { remaining: 0 });
    const none = await employee(f, { remaining: null });
    const declaration = await declare(f);

    const result = await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));

    expect(result).toMatchObject({ deducted: 0, unpaid: 2 });
    for (const person of [empty, none]) {
      const request = await mockDatabase.leaveRequest.findFirstOrThrow({ where: { employeeId: person.id } });
      expect(request.leaveTypeId).toBe(f.unpaid.id);
    }
    const balance = await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: empty.id } });
    expect(balance.remainingDays).toBe(0);
    expect(balance.usedDays).toBe(12);
  });

  it('leaves an excluded branch working', async () => {
    const f = await fixture();
    const working = await employee(f, { remaining: 5, branchId: f.branch.id });
    const resting = await employee(f, { remaining: 5 });
    const declaration = await declare(f, [f.branch.id]);

    const plan = await asHr(f.companyId, () => service.plan(f.companyId, declaration.id));
    expect(plan.map((entry) => entry.employeeId)).toEqual([resting.id].sort());

    await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));
    expect(await mockDatabase.leaveRequest.count({ where: { employeeId: working.id } })).toBe(0);
    expect((await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: working.id } })).remainingDays).toBe(5);
  });

  it('keeps leave an employee already had that day instead of overwriting it', async () => {
    const f = await fixture();
    const person = await employee(f, { remaining: 5 });
    await mockDatabase.leaveRequest.create({
      data: {
        companyId: f.companyId, employeeId: person.id, leaveTypeId: f.annual.id,
        startDate: dateOnly, endDate: dateOnly, totalDays: 1, reason: 'Sudah cuti sendiri', status: 'APPROVED',
      },
    });
    const declaration = await declare(f);

    const result = await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));

    expect(result).toMatchObject({ deducted: 0, unpaid: 0, skipped: 1 });
    expect(await mockDatabase.leaveRequest.count({ where: { employeeId: person.id } })).toBe(1);
    expect((await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: person.id } })).remainingDays).toBe(5);
  });

  it('leaves someone who actually clocked in alone', async () => {
    const f = await fixture();
    const person = await employee(f, { remaining: 5 });
    await mockDatabase.attendance.create({
      data: { companyId: f.companyId, employeeId: person.id, date: dateOnly, checkIn: new Date('2026-12-24T01:00:00Z') },
    });
    const declaration = await declare(f);

    const result = await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));

    expect(result).toMatchObject({ skipped: 1, deducted: 0 });
    expect(await mockDatabase.leaveRequest.count({ where: { employeeId: person.id } })).toBe(0);
  });

  it('skips an employee who had not joined by that date', async () => {
    const f = await fixture();
    const future = await employee(f, { remaining: 5, joinDate: '2027-01-05T00:00:00.000Z' });
    const declaration = await declare(f);

    const plan = await asHr(f.companyId, () => service.plan(f.companyId, declaration.id));
    expect(plan.some((entry) => entry.employeeId === future.id)).toBe(false);
  });

  it('applies exactly once — a second apply is refused, and nobody is deducted twice', async () => {
    const f = await fixture();
    const person = await employee(f, { remaining: 5 });
    const declaration = await declare(f);

    await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));
    await expect(asHr(f.companyId, () => service.apply(f.companyId, declaration.id))).rejects.toThrow(/Only a declared/i);

    expect((await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: person.id } })).remainingDays).toBe(4);
    expect(await mockDatabase.leaveRequest.count({ where: { employeeId: person.id } })).toBe(1);
  });

  it('refuses a second declaration on the same date', async () => {
    const f = await fixture();
    await employee(f, { remaining: 5 });
    await declare(f);
    await expect(declare(f)).rejects.toThrow(/already declared/i);
  });

  it('refuses a cancel once the day has been applied, and explains why', async () => {
    const f = await fixture();
    await employee(f, { remaining: 5 });
    const declaration = await declare(f);
    await asHr(f.companyId, () => service.apply(f.companyId, declaration.id));

    await expect(asHr(f.companyId, () => service.cancel(f.companyId, declaration.id)))
      .rejects.toThrow(/separate decision/i);
  });

  it('cancels a declaration that never touched a balance', async () => {
    const f = await fixture();
    const person = await employee(f, { remaining: 5 });
    const declaration = await declare(f);

    await expect(asHr(f.companyId, () => service.cancel(f.companyId, declaration.id))).resolves.toMatchObject({
      status: 'CANCELLED',
    });
    expect((await mockDatabase.leaveBalance.findFirstOrThrow({ where: { employeeId: person.id } })).remainingDays).toBe(5);
    expect(await mockDatabase.leaveRequest.count({ where: { employeeId: person.id } })).toBe(0);
  });

  it.each([
    ['the deducting type is unpaid', (f: Awaited<ReturnType<typeof fixture>>) => ({ leaveTypeId: f.unpaid.id, unpaidLeaveTypeId: f.annual.id })],
    ['both types are the same', (f: Awaited<ReturnType<typeof fixture>>) => ({ leaveTypeId: f.annual.id, unpaidLeaveTypeId: f.annual.id })],
  ])('refuses a declaration where %s', async (_label, build) => {
    const f = await fixture();
    await expect(
      asHr(f.companyId, () => service.declare(f.companyId, {
        date: DATE, name: 'Salah konfigurasi', ...build(f),
      })),
    ).rejects.toThrow();
    expect(await mockDatabase.collectiveLeave.count({ where: { companyId: f.companyId } })).toBe(0);
  });
});
