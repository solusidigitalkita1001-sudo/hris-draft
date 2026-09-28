import type { NextFunction, Response } from 'express';
import config from '@/config';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import type { AuthenticatedRequest } from './Authenticate';
import { idempotency } from './Idempotency';

jest.mock('@/infrastructure/cache/RedisCache', () => ({
  redisCache: {
    get: jest.fn(),
    setIfAbsent: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
  },
}));

function request(key: string, body: unknown): AuthenticatedRequest {
  return {
    method: 'POST',
    baseUrl: '/api/v1/attendance',
    path: '/me/check-in',
    body,
    query: {},
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'employee@example.test',
      companyId: '00000000-0000-4000-8000-000000000002',
      employeeId: '00000000-0000-4000-8000-000000000003',
    },
    get: (name: string) => name.toLowerCase() === 'idempotency-key' ? key : undefined,
  } as unknown as AuthenticatedRequest;
}

function response() {
  const headers: Record<string, string> = {};
  const json = jest.fn(function json(this: Response) { return this; });
  const res = {
    statusCode: 200,
    writableFinished: true,
    setHeader: jest.fn((name: string, value: string) => { headers[name] = value; }),
    status: jest.fn(function status(this: Response, code: number) {
      (this as unknown as { statusCode: number }).statusCode = code;
      return this;
    }),
    json,
    on: jest.fn(),
  } as unknown as Response;
  return { res, headers, json };
}

describe('Idempotency-Key middleware', () => {
  const originalRedisEnabled = config.redis.enabled;

  afterEach(() => {
    config.redis.enabled = originalRedisEnabled;
    jest.clearAllMocks();
  });

  it('replays the original status and body for the same request', async () => {
    const key = 'attendance-test-key-0001';
    const first = response();
    const firstNext = jest.fn() as NextFunction;
    await idempotency()(request(key, { method: 'MANUAL' }), first.res, firstNext);
    expect(firstNext).toHaveBeenCalledWith();
    first.res.statusCode = 201;
    first.res.json({ success: true, data: { id: 'attendance-1' } });

    const replay = response();
    const replayNext = jest.fn() as NextFunction;
    await idempotency()(request(key, { method: 'MANUAL' }), replay.res, replayNext);

    expect(replayNext).not.toHaveBeenCalled();
    expect(replay.res.status).toHaveBeenCalledWith(201);
    expect(replay.res.json).toHaveBeenCalledWith({ success: true, data: { id: 'attendance-1' } });
    expect(replay.headers['Idempotency-Replayed']).toBe('true');
  });

  it('rejects reuse with a different payload', async () => {
    const key = 'attendance-test-key-0002';
    const first = response();
    await idempotency()(request(key, { method: 'MANUAL' }), first.res, jest.fn());
    first.res.statusCode = 201;
    first.res.json({ success: true });

    const next = jest.fn();
    await idempotency()(request(key, { method: 'MOBILE_GPS' }), response().res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it('treats object key order as the same request', async () => {
    const key = 'attendance-test-key-0003';
    const first = response();
    await idempotency()(request(key, {
      method: 'MOBILE_GPS',
      deviceGps: { accuracyMeters: 5, isMockLocation: false },
    }), first.res, jest.fn());
    first.res.statusCode = 201;
    first.res.json({ success: true, data: { id: 'attendance-3' } });

    const replay = response();
    await idempotency()(request(key, {
      deviceGps: { isMockLocation: false, accuracyMeters: 5 },
      method: 'MOBILE_GPS',
    }), replay.res, jest.fn());

    expect(replay.res.status).toHaveBeenCalledWith(201);
    expect(replay.headers['Idempotency-Replayed']).toBe('true');
  });

  it.each([400, 409, 422, 500])('releases the key after an HTTP %s response', async (statusCode) => {
    const key = `attendance-retry-${statusCode}-key`;
    const first = response();
    await idempotency()(request(key, { method: 'MOBILE_GPS' }), first.res, jest.fn());
    first.res.statusCode = statusCode;
    first.res.json({ success: false });

    const retry = response();
    const retryNext = jest.fn();
    await idempotency()(request(key, { method: 'MOBILE_GPS' }), retry.res, retryNext);

    expect(retryNext).toHaveBeenCalledWith();
    expect(retry.headers['Idempotency-Replayed']).toBeUndefined();
  });

  it('does not send a successful response until Redis persistence completes', async () => {
    config.redis.enabled = true;
    jest.mocked(redisCache.get).mockResolvedValue(null);
    jest.mocked(redisCache.setIfAbsent).mockResolvedValue(true);

    let finishSave!: () => void;
    jest.mocked(redisCache.set).mockImplementation(() => new Promise<void>((resolve) => {
      finishSave = resolve;
    }));

    const first = response();
    const next = jest.fn();
    await idempotency()(request('attendance-redis-key-0001', { method: 'MANUAL' }), first.res, next);
    first.res.statusCode = 201;
    first.res.json({ success: true });

    expect(first.json).not.toHaveBeenCalled();
    finishSave();
    await Promise.resolve();
    await Promise.resolve();
    expect(first.json).toHaveBeenCalledWith({ success: true });
  });
});
