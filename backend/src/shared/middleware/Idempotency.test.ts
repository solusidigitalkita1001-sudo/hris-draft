import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from './Authenticate';
import { idempotency } from './Idempotency';

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
  const res = {
    statusCode: 200,
    writableFinished: true,
    setHeader: jest.fn((name: string, value: string) => { headers[name] = value; }),
    status: jest.fn(function status(this: Response, code: number) {
      (this as unknown as { statusCode: number }).statusCode = code;
      return this;
    }),
    json: jest.fn(function json(this: Response) { return this; }),
    on: jest.fn(),
  } as unknown as Response;
  return { res, headers };
}

describe('Idempotency-Key middleware', () => {
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
});
