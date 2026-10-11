type Row = Record<string, unknown>;

const state: {
  post: Row | null;
  employee: Row | null;
  created: Row[];
  updated: Array<{ where: Row; data: Row }>;
} = { post: null, employee: null, created: [], updated: [] };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    feedPost: {
      findFirst: jest.fn(async () => state.post),
      findMany: jest.fn(async () => []),
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'post-1', ...data, author: {} };
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updated.push({ where, data });
        return { id: where.id, ...data };
      }),
    },
    kudos: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'kudos-1', ...data, from: {}, to: {} };
      }),
      findMany: jest.fn(async () => []),
    },
    employee: { findFirst: jest.fn(async () => state.employee) },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { engagementService } from './engagement.service';

const COMPANY = 'company-a';

beforeEach(() => {
  jest.clearAllMocks();
  state.post = { id: 'post-1', authorEmployeeId: 'employee-author' };
  state.employee = { id: 'employee-target' };
  state.created = [];
  state.updated = [];
});

describe('feed posts', () => {
  it('author soft-deletes their own post', async () => {
    await engagementService.deletePost(COMPANY, 'post-1', { employeeId: 'employee-author', isModerator: false });
    expect(state.updated[0].data.deletedAt).toBeInstanceOf(Date);
  });

  it('someone else\'s post is not found for a non-moderator, but a moderator can take it down', async () => {
    await expect(engagementService.deletePost(COMPANY, 'post-1', { employeeId: 'employee-other', isModerator: false }))
      .rejects.toThrow(/tidak ditemukan/i);

    await engagementService.deletePost(COMPANY, 'post-1', { employeeId: 'employee-other', isModerator: true });
    expect(state.updated).toHaveLength(1);
  });
});

describe('kudos', () => {
  it('refuses self-kudos', async () => {
    await expect(engagementService.giveKudos(COMPANY, 'employee-a', {
      toEmployeeId: 'employee-a', badge: 'Teamwork', message: 'mantap sekali kerjanya',
    })).rejects.toThrow(/diri sendiri/);
  });

  it('refuses a recipient outside the company', async () => {
    state.employee = null;
    await expect(engagementService.giveKudos(COMPANY, 'employee-a', {
      toEmployeeId: 'employee-ghost', badge: 'Teamwork', message: 'mantap sekali kerjanya',
    })).rejects.toThrow(/tidak ditemukan/i);
  });

  it('records who thanked whom with the badge and message', async () => {
    await engagementService.giveKudos(COMPANY, 'employee-a', {
      toEmployeeId: 'employee-target', badge: 'Going Extra Mile', message: 'begadang demi rilis',
    });
    expect(state.created[0]).toMatchObject({
      companyId: COMPANY, fromEmployeeId: 'employee-a', toEmployeeId: 'employee-target',
      badge: 'Going Extra Mile',
    });
  });
});
