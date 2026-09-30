/**
 * The production worker crash-looped on this, and the message is worth quoting
 * because it names its own fix:
 *
 *   BullMQ: ioredis does not support ioredis prefixes, use the prefix option
 *   instead.
 *
 * Redis, the database and RabbitMQ all connected first; the process died the
 * moment a repeatable job constructed `Repeat`. Only the host/port branch of
 * getRedisConnectionOptions sets `keyPrefix`, so a REDIS_URL environment never
 * saw it — local development looked perfectly healthy.
 */

const captured: {
  queues: Array<Record<string, unknown>>;
  workers: Array<Record<string, unknown>>;
  queueEvents: Array<Record<string, unknown>>;
  ioredis: Array<Record<string, unknown>>;
} = { queues: [], workers: [], queueEvents: [], ioredis: [] };

jest.mock('bullmq', () => ({
  Queue: class {
    constructor(_name: string, options: Record<string, unknown>) { captured.queues.push(options); }
    on() { return this; }
  },
  Worker: class {
    constructor(_name: string, _processor: unknown, options: Record<string, unknown>) { captured.workers.push(options); }
    on() { return this; }
  },
  QueueEvents: class {
    constructor(_name: string, options: Record<string, unknown>) { captured.queueEvents.push(options); }
    on() { return this; }
    waitUntilReady() { return Promise.resolve(); }
  },
}));

jest.mock('ioredis', () => ({
  __esModule: true,
  default: class {
    constructor(options: Record<string, unknown>) { captured.ioredis.push(options); }
    on() { return this; }
    ping() { return Promise.resolve('PONG'); }
    quit() { return Promise.resolve('OK'); }
  },
}));

jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

jest.mock('@/config', () => ({
  __esModule: true,
  default: {
    redis: { enabled: true, url: '', host: 'redis', port: 6379, password: '', db: 0, keyPrefix: 'hrms:' },
    queue: { enabled: true, defaultAttempts: 3, defaultBackoffMs: 5000 },
  },
}));

jest.mock('@/infrastructure/cache/redis-options', () => ({
  getRedisConnectionOptions: () => ({ host: 'redis', port: 6379, db: 0, keyPrefix: 'hrms:' }),
}));

import { QueueManager } from './QueueManager';

describe('BullMQ key namespacing', () => {
  const manager = new (QueueManager as unknown as { new (): QueueManager })();

  beforeAll(() => {
    manager.getQueue('webhooks');
    manager.getQueueEvents('webhooks');
    manager.createWorker('webhooks', async () => undefined);
  });

  it('never hands keyPrefix to a BullMQ connection', () => {
    for (const options of [...captured.queues, ...captured.workers, ...captured.queueEvents]) {
      expect((options.connection as Record<string, unknown>).keyPrefix).toBeUndefined();
    }
  });

  /** Dropping the namespace would be wrong too: this Redis is shared. */
  it('keeps the namespace, as BullMQ own prefix option', () => {
    expect(captured.queues[0].prefix).toBe('hrms');
    expect(captured.queueEvents[0].prefix).toBe('hrms');
  });

  /**
   * A worker watching a different prefix from the producer is the quiet
   * version of this bug: nothing errors and no job is ever processed.
   */
  it('gives the worker the same prefix as the queue', () => {
    expect(captured.workers[0].prefix).toBe(captured.queues[0].prefix);
  });

  it('strips the trailing colon, since BullMQ joins with one itself', () => {
    expect(captured.queues[0].prefix).not.toMatch(/:$/);
  });

  it('leaves the cache client its keyPrefix, which is legitimate there', () => {
    expect(captured.ioredis.some((options) => options.keyPrefix === 'hrms:')).toBe(true);
  });
});
