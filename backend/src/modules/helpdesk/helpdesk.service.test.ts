type Row = Record<string, unknown>;

const state: {
  ticket: Row | null;
  tickets: Row[];
  created: Row[];
  updated: Array<{ where: Row; data: Row }>;
  comments: Row[];
  assignee: Row | null;
} = { ticket: null, tickets: [], created: [], updated: [], comments: [], assignee: null };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    hrTicket: {
      findFirst: jest.fn(async () => state.ticket),
      findMany: jest.fn(async () => state.tickets),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'ticket-1', status: 'OPEN', ...data };
        state.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updated.push({ where, data });
        return { id: where.id, ...data };
      }),
    },
    hrTicketComment: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.comments.push(data);
        return { id: 'comment-1', ...data };
      }),
    },
    user: {
      // Assignee tervalidasi se-perusahaan; default-nya ada.
      findFirst: jest.fn(async () => state.assignee),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import prisma from '@/shared/database/prisma';
import { helpdeskService } from './helpdesk.service';

const COMPANY = 'company-a';
const OWNER = 'employee-owner';

function ticket(over: Row = {}) {
  return { id: 'ticket-1', companyId: COMPANY, employeeId: OWNER, status: 'OPEN', ...over };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.ticket = ticket();
  state.tickets = [];
  state.created = [];
  state.updated = [];
  state.comments = [];
  state.assignee = { id: 'user-hr' };
});

describe('status transitions', () => {
  it.each([
    ['OPEN', 'IN_PROGRESS', true],
    ['IN_PROGRESS', 'RESOLVED', true],
    ['RESOLVED', 'OPEN', true],
    ['RESOLVED', 'IN_PROGRESS', false],
    ['CLOSED', 'OPEN', false],
  ])('%s → %s allowed=%s', async (from, to, allowed) => {
    state.ticket = ticket({ status: from });
    const attempt = helpdeskService.update(COMPANY, 'ticket-1', { status: to as never });
    if (allowed) await expect(attempt).resolves.toBeDefined();
    else await expect(attempt).rejects.toThrow(/tidak bisa pindah/);
  });

  it('reopening clears the stale resolution stamps', async () => {
    state.ticket = ticket({ status: 'RESOLVED' });
    await helpdeskService.update(COMPANY, 'ticket-1', { status: 'OPEN' });
    expect(state.updated[0].data).toMatchObject({ resolvedAt: null, closedAt: null });
  });

  it('stamps resolvedAt and closedAt with the transition', async () => {
    state.ticket = ticket({ status: 'IN_PROGRESS' });
    await helpdeskService.update(COMPANY, 'ticket-1', { status: 'RESOLVED' });
    expect(state.updated[0].data.resolvedAt).toBeInstanceOf(Date);

    state.ticket = ticket({ status: 'RESOLVED' });
    await helpdeskService.update(COMPANY, 'ticket-1', { status: 'CLOSED' });
    expect(state.updated[1].data.closedAt).toBeInstanceOf(Date);
  });
});

describe('employee side', () => {
  it('may close their own ticket, not someone else\'s', async () => {
    await expect(helpdeskService.closeMine(COMPANY, 'ticket-1', OWNER)).resolves.toBeDefined();

    state.ticket = ticket({ employeeId: 'employee-other' });
    await expect(helpdeskService.closeMine(COMPANY, 'ticket-1', OWNER)).rejects.toThrow(/tidak ditemukan/i);
  });

  it('sees someone else\'s ticket as not found, not as forbidden', async () => {
    state.ticket = ticket({ employeeId: 'employee-other' });
    await expect(helpdeskService.getForActor(COMPANY, 'ticket-1', { employeeId: OWNER, canReadAll: false }))
      .rejects.toThrow(/tidak ditemukan/i);
  });

  it('cannot comment on a closed ticket', async () => {
    state.ticket = ticket({ status: 'CLOSED' });
    await expect(helpdeskService.comment(COMPANY, 'ticket-1',
      { userId: 'user-1', employeeId: OWNER, canReadAll: false }, { body: 'halo' }))
      .rejects.toThrow(/sudah ditutup/);
  });

  it('comments on their own open ticket', async () => {
    await helpdeskService.comment(COMPANY, 'ticket-1',
      { userId: 'user-1', employeeId: OWNER, canReadAll: false }, { body: 'update dong' });
    expect(state.comments[0]).toMatchObject({ ticketId: 'ticket-1', authorUserId: 'user-1', body: 'update dong' });
  });
});

describe('HR side', () => {
  it('reads any ticket in the company', async () => {
    state.ticket = ticket({ employeeId: 'employee-other' });
    await expect(helpdeskService.getForActor(COMPANY, 'ticket-1', { employeeId: OWNER, canReadAll: true }))
      .resolves.toBeDefined();
  });

  it('assigns and reprioritises without touching status', async () => {
    await helpdeskService.update(COMPANY, 'ticket-1', { assigneeUserId: 'user-hr', priority: 'HIGH' });
    expect(state.updated[0].data).toMatchObject({ assigneeUserId: 'user-hr', priority: 'HIGH' });
    expect(state.updated[0].data.status).toBeUndefined();
  });

  it('refuses an assignee who has no access to the company', async () => {
    state.assignee = null;
    await expect(helpdeskService.update(COMPANY, 'ticket-1', { assigneeUserId: 'user-asing' }))
      .rejects.toThrow(/bukan user aktif/);
    expect(state.updated).toHaveLength(0);
  });

  it('the queue is a paginated LIST: default hides CLOSED, caps rows, and counts comments instead of shipping them', async () => {
    const findMany = (prisma as unknown as { hrTicket: { findMany: jest.Mock } }).hrTicket.findMany;
    await helpdeskService.listQueue(COMPANY, {});
    const args = findMany.mock.calls[0][0];
    expect(args.where.status).toEqual({ not: 'CLOSED' });
    expect(args.take).toBe(50);
    expect(args.include._count).toEqual({ select: { comments: true } });
    expect(args.include.comments).toBeUndefined();

    await helpdeskService.listQueue(COMPANY, { includeClosed: 'true', limit: 10 } as never);
    const second = findMany.mock.calls[1][0];
    expect(second.where.status).toBeUndefined();
    expect(second.take).toBe(10);
  });
});
