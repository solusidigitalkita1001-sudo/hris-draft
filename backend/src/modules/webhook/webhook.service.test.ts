import crypto from 'node:crypto';
import { WebhookDeliveryStatus } from '@prisma/client';

type Row = Record<string, unknown>;

const state: {
  subscriptions: Row[];
  deliveries: Row[];
  created: Row[];
  updates: Array<{ table: string; where: Row; data: Row }>;
  fetchResponses: Array<{ status: number } | Error>;
  fetchCalls: Array<{ url: string; headers: Record<string, string>; body: string }>;
} = { subscriptions: [], deliveries: [], created: [], updates: [], fetchResponses: [], fetchCalls: [] };

function subscriptionRow(over: Row = {}) {
  return {
    id: 'sub-1', companyId: 'company-a', url: 'https://hooks.example.com/hris',
    secretCipher: 'cipher', isActive: true, failureCount: 0, deletedAt: null,
    events: ['payroll.run.approved'], ...over,
  };
}

jest.mock('@/shared/database/prisma', () => {
  const findSubscription = (where: Row) =>
    state.subscriptions.find((row) =>
      Object.entries(where).every(([key, value]) => (value === null ? row[key] == null : row[key] === value))) ?? null;

  const client = {
    webhookSubscription: {
      findMany: jest.fn(async () => state.subscriptions.filter((row) => row.isActive && !row.deletedAt)),
      findFirst: jest.fn(async ({ where }: { where: Row }) => findSubscription(where)),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'sub-new', isActive: true, ...data };
        state.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'subscription', where, data });
        const row = state.subscriptions.find((candidate) => candidate.id === where.id);
        if (row) {
          if (typeof (data.failureCount as Row)?.increment === 'number') {
            row.failureCount = (row.failureCount as number) + ((data.failureCount as Row).increment as number);
          } else {
            Object.assign(row, data);
          }
        }
        return { ...(row ?? {}), ...(typeof data.failureCount === 'object' ? {} : data) };
      }),
    },
    webhookDelivery: {
      findMany: jest.fn(async () => state.deliveries),
      createMany: jest.fn(async ({ data }: { data: Row[] }) => {
        state.created.push(...data);
        return { count: data.length };
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'delivery', where, data });
        return { id: where.id, ...data };
      }),
    },
    $transaction: jest.fn(async (operations: unknown[]) => Promise.all(operations as Promise<unknown>[])),
  };
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('@/shared/logger/WinstonLogger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock('@/shared/security/secret-crypto', () => ({
  encryptSecret: (value: string) => `enc(${value})`,
  decryptSecret: () => 'the-secret',
}));
jest.mock('./webhook-url-guard', () => ({
  assertDeliverableUrl: (raw: string) => new URL(raw),
  assertResolvesPublicly: jest.fn(async () => undefined),
}));

import { WebhookService, signPayload } from './webhook.service';
import type { DomainEvent } from '@/shared/events/EventBus';

const service = new WebhookService();

const event = (over: Partial<DomainEvent> = {}): DomainEvent => ({
  name: 'payroll.run.approved',
  aggregateId: 'run-1',
  aggregateType: 'PayrollRun',
  data: { companyId: 'company-a', runNumber: 7 },
  metadata: { eventId: 'evt-1', occurredAt: new Date('2026-09-30T00:00:00Z') },
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  state.subscriptions = [];
  state.deliveries = [];
  state.created = [];
  state.updates = [];
  state.fetchResponses = [];
  state.fetchCalls = [];

  global.fetch = jest.fn(async (url: unknown, init: unknown) => {
    const request = init as { headers: Record<string, string>; body: string };
    state.fetchCalls.push({ url: String(url), headers: request.headers, body: request.body });
    const next = state.fetchResponses.shift() ?? { status: 200 };
    if (next instanceof Error) throw next;
    return { status: next.status } as Response;
  }) as unknown as typeof fetch;
});

describe('webhook fan-out', () => {
  it('creates a delivery only for subscriptions that asked for the event', async () => {
    state.subscriptions = [
      subscriptionRow({ id: 'sub-wants', events: ['payroll.run.approved'] }),
      subscriptionRow({ id: 'sub-other', events: ['employee.created'] }),
    ];

    expect(await service.fanOut(event())).toBe(1);
    expect(state.created).toHaveLength(1);
    expect(state.created[0]).toMatchObject({ subscriptionId: 'sub-wants', eventId: 'evt-1', eventName: 'payroll.run.approved' });
  });

  it('ignores an event with no company on it, because there is no tenant to route to', async () => {
    state.subscriptions = [subscriptionRow()];
    expect(await service.fanOut(event({ data: { runNumber: 7 } }))).toBe(0);
    expect(state.created).toEqual([]);
  });

  it('ignores an event outside the published catalogue', async () => {
    state.subscriptions = [subscriptionRow({ events: ['auth.user.logged_in'] })];
    expect(await service.fanOut(event({ name: 'auth.user.logged_in' }))).toBe(0);
  });

  /**
   * A queue retry re-delivers the same event. Without dedupe that becomes two
   * calls into a customer's system, which for them can mean two invoices.
   */
  it('relies on skipDuplicates so a re-delivered event cannot be sent twice', async () => {
    state.subscriptions = [subscriptionRow()];
    await service.fanOut(event());
    const { prisma } = jest.requireMock('@/shared/database/prisma') as { prisma: { webhookDelivery: { createMany: jest.Mock } } };
    expect(prisma.webhookDelivery.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
  });

  it('carries the event id, aggregate and data in the payload', async () => {
    state.subscriptions = [subscriptionRow()];
    await service.fanOut(event());
    expect(state.created[0].payload).toMatchObject({
      id: 'evt-1',
      event: 'payroll.run.approved',
      aggregate: { id: 'run-1', type: 'PayrollRun' },
      data: { companyId: 'company-a', runNumber: 7 },
    });
  });
});

describe('webhook signature', () => {
  it('signs the timestamp together with the body, so a captured payload cannot be replayed forever', () => {
    const signature = signPayload('the-secret', '1790000000', '{"a":1}');
    expect(signature).toBe(
      crypto.createHmac('sha256', 'the-secret').update('1790000000.{"a":1}').digest('hex'),
    );
    expect(signature).not.toBe(crypto.createHmac('sha256', 'the-secret').update('{"a":1}').digest('hex'));
  });
});

describe('webhook delivery sweep', () => {
  const pending = (over: Row = {}) => ({
    id: 'del-1', companyId: 'company-a', subscriptionId: 'sub-1', attempts: 0,
    eventName: 'payroll.run.approved', payload: { id: 'evt-1' },
    subscription: subscriptionRow(), ...over,
  });

  it('marks a 2xx delivery sent and resets the subscription failure count', async () => {
    state.deliveries = [pending()];
    state.fetchResponses = [{ status: 204 }];

    const result = await service.sweep();

    expect(result).toMatchObject({ due: 1, sent: 1, retrying: 0, dead: 0 });
    const delivery = state.updates.find((update) => update.table === 'delivery');
    expect(delivery?.data).toMatchObject({ status: WebhookDeliveryStatus.SENT, attempts: 1, responseStatus: 204 });
    expect(state.updates.find((update) => update.table === 'subscription')?.data).toMatchObject({ failureCount: 0 });
  });

  it('signs the request and names the event and delivery in the headers', async () => {
    state.deliveries = [pending()];
    await service.sweep();

    const call = state.fetchCalls[0];
    expect(call.headers['x-hris-event']).toBe('payroll.run.approved');
    expect(call.headers['x-hris-delivery']).toBe('del-1');
    expect(call.headers['x-hris-signature']).toBe(
      `sha256=${signPayload('the-secret', call.headers['x-hris-timestamp'], call.body)}`,
    );
  });

  it('schedules a retry with backoff on a 5xx instead of giving up', async () => {
    state.deliveries = [pending({ attempts: 1 })];
    state.fetchResponses = [{ status: 503 }];

    const result = await service.sweep();

    expect(result).toMatchObject({ retrying: 1, sent: 0, dead: 0 });
    const data = state.updates.find((update) => update.table === 'delivery')?.data as Row;
    expect(data.status).toBe(WebhookDeliveryStatus.FAILED);
    expect(data.lastError).toBe('HTTP 503');
    expect((data.nextAttemptAt as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it('treats a transport error the same way, with the reason kept', async () => {
    state.deliveries = [pending()];
    state.fetchResponses = [new Error('socket hang up')];

    const result = await service.sweep();

    expect(result).toMatchObject({ retrying: 1 });
    expect((state.updates.find((update) => update.table === 'delivery')?.data as Row).lastError).toBe('socket hang up');
  });

  it('gives up after the attempt limit rather than retrying forever', async () => {
    state.deliveries = [pending({ attempts: 5 })];
    state.fetchResponses = [{ status: 500 }];

    const result = await service.sweep();

    expect(result).toMatchObject({ dead: 1, retrying: 0 });
    const data = state.updates.find((update) => update.table === 'delivery')?.data as Row;
    expect(data.status).toBe(WebhookDeliveryStatus.DEAD);
    expect(data.nextAttemptAt).toBeNull();
  });

  /**
   * An endpoint that has failed this many times in a row is gone, not busy.
   * Knocking forever spends every sweep on a door nobody will answer.
   */
  it('switches off a subscription that keeps failing, and records why', async () => {
    state.subscriptions = [subscriptionRow({ failureCount: 19 })];
    state.deliveries = [pending({ subscription: state.subscriptions[0] })];
    state.fetchResponses = [{ status: 500 }];

    const result = await service.sweep();

    expect(result.subscriptionsDisabled).toBe(1);
    const disable = state.updates.filter((update) => update.table === 'subscription').at(-1);
    expect(disable?.data).toMatchObject({ isActive: false });
    expect(String((disable?.data as Row).disabledReason)).toMatch(/consecutive failures/);
  });

  it('does not deliver to an inactive subscription — the delivery dies instead', async () => {
    state.deliveries = [pending({ subscription: subscriptionRow({ isActive: false }) })];

    const result = await service.sweep();

    expect(result).toMatchObject({ dead: 1, sent: 0 });
    expect(state.fetchCalls).toEqual([]);
  });

  it('keeps serving the other tenants when one endpoint throws', async () => {
    state.deliveries = [
      pending({ id: 'del-broken' }),
      pending({ id: 'del-fine', subscriptionId: 'sub-2', subscription: subscriptionRow({ id: 'sub-2' }) }),
    ];
    state.fetchResponses = [new Error('ECONNREFUSED'), { status: 200 }];

    const result = await service.sweep();

    expect(result).toMatchObject({ due: 2, sent: 1, retrying: 1 });
  });
});

describe('subscription management', () => {
  it('returns the secret once and stores it encrypted, never in plain text', async () => {
    const { secret } = await service.create('company-a', {
      url: 'https://hooks.example.com/hris',
      events: ['payroll.run.approved'],
    });

    expect(secret).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(state.created[0].secretCipher).toBe(`enc(${secret})`);
  });

  it('refuses an event name outside the published catalogue', async () => {
    await expect(
      service.create('company-a', { url: 'https://hooks.example.com/hris', events: ['made.up.event'] }),
    ).rejects.toThrow(/Unknown event name/);
  });

  it('never returns the stored secret when listing', async () => {
    state.subscriptions = [subscriptionRow()];
    await service.list('company-a');
    const { prisma } = jest.requireMock('@/shared/database/prisma') as { prisma: { webhookSubscription: { findMany: jest.Mock } } };
    const select = prisma.webhookSubscription.findMany.mock.calls[0][0].select;
    expect(select.secretCipher).toBeUndefined();
  });

  /** Re-enabling has to clear the counter, or one more failure turns it off again. */
  it('clears the failure count when an administrator re-enables a subscription', async () => {
    state.subscriptions = [subscriptionRow({ failureCount: 20, isActive: false })];
    await service.update('company-a', 'sub-1', { isActive: true });
    expect(state.updates.find((update) => update.table === 'subscription')?.data).toMatchObject({
      isActive: true, failureCount: 0, disabledReason: null,
    });
  });
});
