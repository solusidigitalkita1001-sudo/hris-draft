import { Prisma } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  project: Row | null;
  entry: Row | null;
  sameDay: Row[];
  existing: Row | null;
  created: Row[];
  updates: Array<{ where: Row; data: Row }>;
  updateCount: number;
} = { project: null, entry: null, sameDay: [], existing: null, created: [], updates: [], updateCount: 1 };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    project: {
      findFirst: jest.fn(async () => state.project),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'project-1', ...data })),
      update: jest.fn(async ({ data }: { data: Row }) => data),
    },
    timesheetEntry: {
      // First call patterns vary per test; findFirst answers `entry` unless a
      // test overrides with mockResolvedValueOnce.
      findFirst: jest.fn(async () => state.entry),
      findMany: jest.fn(async () => state.sameDay),
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'entry-1', ...data, project: {} };
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => ({ id: where.id, ...data, project: {} })),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
      delete: jest.fn(async () => undefined),
      groupBy: jest.fn(async () => []),
    },
    employee: { findMany: jest.fn(async () => []) },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import prisma from '@/shared/database/prisma';
import { timesheetService } from './timesheet.service';

const COMPANY = 'company-a';
const ME = 'employee-me';
const entryFindFirst = (prisma as unknown as { timesheetEntry: { findFirst: jest.Mock } }).timesheetEntry.findFirst;

beforeEach(() => {
  jest.clearAllMocks();
  state.project = { id: 'project-1', code: 'ACME' };
  state.entry = null;
  state.sameDay = [];
  state.existing = null;
  state.created = [];
  state.updates = [];
  state.updateCount = 1;
});

describe('recording hours', () => {
  it('writes an entry for an active project on a past date', async () => {
    await timesheetService.createEntry(COMPANY, ME, { projectId: 'project-1', date: '2026-10-01', hours: 7.5 });
    expect(state.created[0]).toMatchObject({ employeeId: ME, projectId: 'project-1', hours: 7.5 });
  });

  it('refuses a future date — hours are recorded, not planned', async () => {
    await expect(timesheetService.createEntry(COMPANY, ME, { projectId: 'project-1', date: '2199-01-01', hours: 8 }))
      .rejects.toThrow(/setelah dikerjakan/);
  });

  it('caps the day at 24 hours across all projects', async () => {
    state.sameDay = [{ hours: new Prisma.Decimal('20') }];
    await expect(timesheetService.createEntry(COMPANY, ME, { projectId: 'project-1', date: '2026-10-01', hours: 8 }))
      .rejects.toThrow(/24 jam/);
    expect(state.created).toHaveLength(0);
  });

  it('refuses a second row for the same project and day', async () => {
    entryFindFirst.mockResolvedValueOnce({ id: 'entry-existing' });
    await expect(timesheetService.createEntry(COMPANY, ME, { projectId: 'project-1', date: '2026-10-01', hours: 4 }))
      .rejects.toThrow(/ubah baris itu/);
  });

  it('refuses an inactive or foreign project', async () => {
    state.project = null;
    await expect(timesheetService.createEntry(COMPANY, ME, { projectId: 'project-x', date: '2026-10-01', hours: 4 }))
      .rejects.toThrow(/tidak ditemukan/i);
  });
});

describe('locking and approval', () => {
  it('an APPROVED entry is locked against its owner', async () => {
    state.entry = { id: 'entry-1', employeeId: ME, status: 'APPROVED', date: new Date('2026-10-01') };
    await expect(timesheetService.updateMine(COMPANY, ME, 'entry-1', { hours: 6 })).rejects.toThrow(/terkunci/);
    await expect(timesheetService.deleteMine(COMPANY, ME, 'entry-1')).rejects.toThrow(/terkunci/);
  });

  it('someone else\'s entry is not found, not forbidden', async () => {
    state.entry = { id: 'entry-1', employeeId: 'employee-other', status: 'SUBMITTED', date: new Date('2026-10-01') };
    await expect(timesheetService.deleteMine(COMPANY, ME, 'entry-1')).rejects.toThrow(/tidak ditemukan/i);
  });

  it('decides only SUBMITTED rows, conditionally', async () => {
    state.entry = { id: 'entry-1', status: 'SUBMITTED' };
    await timesheetService.decide(COMPANY, 'entry-1', 'user-boss', 'APPROVED');
    expect(state.updates[0].where).toMatchObject({ status: 'SUBMITTED' });
    expect(state.updates[0].data).toMatchObject({ status: 'APPROVED', approvedBy: 'user-boss' });

    state.entry = { id: 'entry-1', status: 'APPROVED' };
    state.updateCount = 0;
    await expect(timesheetService.decide(COMPANY, 'entry-1', 'user-boss', 'REJECTED'))
      .rejects.toThrow(/sudah APPROVED/);
  });
});
