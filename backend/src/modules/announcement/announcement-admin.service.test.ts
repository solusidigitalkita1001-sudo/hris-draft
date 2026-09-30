type Row = Record<string, unknown>;

const state: {
  announcement: Row | null;
  departments: Row[];
  branches: Row[];
  positions: Row[];
  employees: Row[];
  reads: Row[];
  actor: Row | null;
  updateCount: number;
  created: Row[];
  updates: Array<{ where: Row; data: Row }>;
} = {
  announcement: null, departments: [], branches: [], positions: [], employees: [], reads: [],
  actor: { id: 'user-hr' }, updateCount: 1, created: [], updates: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    announcement: {
      findFirst: jest.fn(async () => state.announcement),
      findMany: jest.fn(async () => (state.announcement ? [state.announcement] : [])),
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'ann-1', ...data };
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { id: where.id, ...data };
      }),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ where, data });
        return { count: state.updateCount };
      }),
    },
    announcementRead: { findMany: jest.fn(async () => state.reads) },
    department: { findMany: jest.fn(async () => state.departments) },
    branch: { findMany: jest.fn(async () => state.branches) },
    position: { findMany: jest.fn(async () => state.positions) },
    employee: { findMany: jest.fn(async () => state.employees) },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({ getCurrentUser: () => state.actor ?? undefined }));

import { AnnouncementAdminService } from './announcement-admin.service';

const service = new AnnouncementAdminService();
const COMPANY = 'company-a';
const ID = 'ann-1';

const base = {
  title: 'Libur Nasional',
  content: 'Kantor tutup pada 25 Desember.',
  audienceType: 'COMPANY_WIDE' as const,
};

beforeEach(() => {
  jest.clearAllMocks();
  state.announcement = { id: ID, status: 'DRAFT', publishFrom: null, publishUntil: null, title: base.title };
  state.departments = [];
  state.branches = [];
  state.positions = [];
  state.employees = [];
  state.reads = [];
  state.actor = { id: 'user-hr' };
  state.updateCount = 1;
  state.created = [];
  state.updates = [];
});

/**
 * The read side shipped complete — audience targeting, publish window, pinning,
 * read tracking — and nothing could create a row for it. The portal was a
 * window onto data only a seed script could produce.
 */
describe('creating an announcement', () => {
  it('creates a company-wide draft, not a published post', async () => {
    const result = await service.create(COMPANY, base);

    expect(state.created[0]).toMatchObject({
      companyId: COMPANY, authorId: 'user-hr', status: 'DRAFT', audienceType: 'COMPANY_WIDE',
      departmentIds: null, branchIds: null, positionIds: null, employeeIds: null,
    });
    expect(result.status).toBe('DRAFT');
  });

  it('serialises the target list for a department-only announcement', async () => {
    state.departments = [{ id: 'dept-1' }, { id: 'dept-2' }];

    await service.create(COMPANY, { ...base, audienceType: 'DEPARTMENT_ONLY', departmentIds: ['dept-1', 'dept-2'] });

    expect(state.created[0].departmentIds).toBe(JSON.stringify(['dept-1', 'dept-2']));
    expect(state.created[0].branchIds).toBeNull();
  });

  it('de-duplicates a target list rather than storing the same id twice', async () => {
    state.branches = [{ id: 'branch-1' }];
    await service.create(COMPANY, { ...base, audienceType: 'BRANCH_ONLY', branchIds: ['branch-1', 'branch-1'] });
    expect(state.created[0].branchIds).toBe(JSON.stringify(['branch-1']));
  });

  /**
   * Publishing this would look like communicating and reach nobody, which is
   * worse than an error.
   */
  it.each([
    ['DEPARTMENT_ONLY', 'departmentIds'],
    ['BRANCH_ONLY', 'branchIds'],
    ['POSITION_ONLY', 'positionIds'],
    ['EMPLOYEE_SPECIFIC', 'employeeIds'],
  ])('refuses %s with an empty %s', async (audienceType, field) => {
    await expect(service.create(COMPANY, { ...base, audienceType: audienceType as never }))
      .rejects.toThrow(new RegExp(`needs at least one entry in ${field}`));
    expect(state.created).toEqual([]);
  });

  /**
   * The audience lists are opaque JSON, so nothing downstream would catch a
   * foreign id — it would simply never match, and the author would never learn
   * why their announcement was silent.
   */
  it('refuses a target from another company', async () => {
    state.departments = [{ id: 'dept-1' }]; // only one of the two exists here
    await expect(
      service.create(COMPANY, { ...base, audienceType: 'DEPARTMENT_ONLY', departmentIds: ['dept-1', 'dept-elsewhere'] }),
    ).rejects.toThrow(/1 entry outside this company/);
  });

  /** Silently dropping it would leave the author believing it was narrower. */
  it('refuses a list that does not belong to the chosen audience', async () => {
    await expect(
      service.create(COMPANY, { ...base, audienceType: 'COMPANY_WIDE', departmentIds: ['dept-1'] }),
    ).rejects.toThrow(/only used with audienceType DEPARTMENT_ONLY/);
  });

  it('refuses the platform-wide audience from a company context', async () => {
    await expect(service.create(COMPANY, { ...base, audienceType: 'ALL' as never }))
      .rejects.toThrow(/platform-wide/);
  });

  it('refuses a window that closes before it opens', async () => {
    await expect(service.create(COMPANY, {
      ...base, publishFrom: '2026-12-01T00:00:00.000Z', publishUntil: '2026-11-01T00:00:00.000Z',
    })).rejects.toThrow(/publishUntil must be after publishFrom/);
  });

  /** A pin expiring before the post is visible is a configuration nobody meant. */
  it('refuses a pin that expires before publication starts', async () => {
    await expect(service.create(COMPANY, {
      ...base, publishFrom: '2026-12-01T00:00:00.000Z', pinnedUntil: '2026-11-20T00:00:00.000Z',
    })).rejects.toThrow(/pinnedUntil must be after publishFrom/);
  });

  it('requires a signed-in author', async () => {
    state.actor = null;
    await expect(service.create(COMPANY, base)).rejects.toThrow(/signed-in user/i);
  });
});

describe('publishing', () => {
  it('publishes a draft and stamps the publication time when none was set', async () => {
    const now = new Date('2026-09-30T08:00:00.000Z');

    await service.publish(COMPANY, ID, now);

    const update = state.updates[0];
    expect(update.where).toMatchObject({ status: 'DRAFT' });
    expect(update.data).toMatchObject({ status: 'PUBLISHED', publishFrom: now });
  });

  it('keeps a scheduled publishFrom instead of overwriting it', async () => {
    const scheduled = new Date('2026-12-01T00:00:00.000Z');
    state.announcement = { id: ID, status: 'DRAFT', publishFrom: scheduled, publishUntil: null };

    await service.publish(COMPANY, ID, new Date('2026-09-30T08:00:00.000Z'));

    expect(state.updates[0].data).toMatchObject({ publishFrom: scheduled });
  });

  /** Publishing into a closed window produces a post nobody will ever see. */
  it('refuses to publish when the window has already closed', async () => {
    state.announcement = {
      id: ID, status: 'DRAFT', publishFrom: null, publishUntil: new Date('2026-01-01T00:00:00.000Z'),
    };
    await expect(service.publish(COMPANY, ID, new Date('2026-09-30T08:00:00.000Z')))
      .rejects.toThrow(/already in the past/);
  });

  it.each([['PUBLISHED'], ['ARCHIVED']])('refuses to publish something already %s', async (status) => {
    state.announcement = { id: ID, status, publishFrom: null, publishUntil: null };
    await expect(service.publish(COMPANY, ID)).rejects.toThrow(/Only a draft can be published/);
  });

  /** Two people pressing publish must not both succeed. */
  it('refuses when someone else published it a moment ago', async () => {
    state.updateCount = 0;
    await expect(service.publish(COMPANY, ID)).rejects.toThrow(/published by someone else/);
  });

  it('refuses an announcement from another company', async () => {
    state.announcement = null;
    await expect(service.publish(COMPANY, ID)).rejects.toThrow(/not found in the active company/i);
  });
});

describe('editing and archiving', () => {
  it('refuses to edit an archived announcement', async () => {
    state.announcement = { id: ID, status: 'ARCHIVED' };
    await expect(service.update(COMPANY, ID, base)).rejects.toThrow(/cannot be edited/);
  });

  it('clears a cover image that was removed', async () => {
    await service.update(COMPANY, ID, base);
    expect(state.updates[0].data).toMatchObject({ coverImageUrl: null });
  });

  /** Archive rather than delete: read receipts are evidence of who was told what. */
  it('archives instead of deleting', async () => {
    await expect(service.archive(COMPANY, ID)).resolves.toMatchObject({ status: 'ARCHIVED' });
    expect(state.updates[0].data).toMatchObject({ status: 'ARCHIVED' });
  });

  it('treats archiving an archived announcement as already done', async () => {
    state.announcement = { id: ID, status: 'ARCHIVED' };
    await expect(service.archive(COMPANY, ID)).resolves.toMatchObject({ status: 'ARCHIVED' });
    expect(state.updates).toEqual([]);
  });
});

describe('who has read it', () => {
  it('lists readers with their employee identity', async () => {
    state.reads = [
      {
        readAt: new Date('2026-09-30T02:00:00.000Z'),
        user: { id: 'user-1', email: 'maya@example.test', employee: { employeeNumber: 'EMP001', fullName: 'Maya Putri' } },
      },
    ];

    const result = await service.readers(COMPANY, ID);

    expect(result.readCount).toBe(1);
    expect(result.readers[0]).toMatchObject({ employeeNumber: 'EMP001', fullName: 'Maya Putri' });
  });

  it('copes with a reader who has no employee record', async () => {
    state.reads = [{ readAt: new Date(), user: { id: 'user-admin', email: 'admin@example.test', employee: null } }];
    const result = await service.readers(COMPANY, ID);
    expect(result.readers[0]).toMatchObject({ employeeNumber: null, fullName: null });
  });

  it('refuses an announcement from another company', async () => {
    state.announcement = null;
    await expect(service.readers(COMPANY, ID)).rejects.toThrow(/not found in the active company/i);
  });
});
