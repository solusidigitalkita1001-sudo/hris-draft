jest.mock('@/shared/database/advisory-lock', () => ({
  withDatabaseAdvisoryLock: jest.fn(
    async (_namespace: string, _key: string, operation: (tx: unknown) => Promise<unknown>) =>
      operation(mockTransaction),
  ),
}));

jest.mock('@/shared/middleware/AuditLog', () => ({
  appendAuditLogEntry: jest.fn().mockResolvedValue(undefined),
}));

import { TooManyRequestsError } from '@/shared/exceptions/AppError';
import { appendAuditLogEntry } from '@/shared/middleware/AuditLog';
import { runInRequestContext } from '@/shared/context/RequestContext';
import {
  FACE_MATCH_MAX_FAILURES,
  runRateLimitedFaceMatch,
} from './face-match-rate-limit';

const companyId = '11111111-1111-4111-8111-111111111111';
const employeeId = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const failures: Date[] = [];
const notifications: Array<{ action?: string; referenceId?: string }> = [];

const mockTransaction: any = {
  attendanceFaceLog: {
    findMany: jest.fn(async ({ where, take }: any) => failures
      .filter((createdAt) => createdAt >= where.createdAt.gte)
      .sort((a, b) => b.getTime() - a.getTime())
      .slice(0, take)
      .map((createdAt) => ({ createdAt }))),
  },
  notification: {
    findFirst: jest.fn(async ({ where }: any) => notifications.find((item) => (
      item.action === where.action && item.referenceId === where.referenceId
    )) ?? null),
    createMany: jest.fn(async ({ data }: any) => {
      notifications.push(...data);
      return { count: data.length };
    }),
  },
  user: {
    findMany: jest.fn().mockResolvedValue([{ id: 'hr-user-1' }]),
  },
};

async function attemptFaceMatch(): Promise<string> {
  return runInRequestContext(
    { user: { id: userId, email: 'employee@example.com', companyId } },
    () => runRateLimitedFaceMatch({ companyId, employeeId }, async () => {
      failures.push(new Date());
      return 'mismatch-recorded';
    }),
  );
}

describe('face-match failed-attempt rate limit', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-03T02:00:00.000Z'));
    failures.length = 0;
    notifications.length = 0;
    jest.clearAllMocks();
    mockTransaction.user.findMany.mockResolvedValue([{ id: 'hr-user-1' }]);
  });

  afterEach(() => jest.useRealTimers());

  it('allows five failed matches, blocks attempt six, audits it, and alerts HR once', async () => {
    for (let attempt = 0; attempt < FACE_MATCH_MAX_FAILURES; attempt += 1) {
      await expect(attemptFaceMatch()).resolves.toBe('mismatch-recorded');
    }

    await expect(attemptFaceMatch()).rejects.toBeInstanceOf(TooManyRequestsError);
    expect(failures).toHaveLength(FACE_MATCH_MAX_FAILURES);
    expect(mockTransaction.notification.createMany).toHaveBeenCalledTimes(1);
    expect(appendAuditLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      companyId,
      userId,
      action: 'FACE_MATCH_RATE_LIMITED',
      entityId: employeeId,
    }));

    await expect(attemptFaceMatch()).rejects.toBeInstanceOf(TooManyRequestsError);
    expect(mockTransaction.notification.createMany).toHaveBeenCalledTimes(1);
    expect(appendAuditLogEntry).toHaveBeenCalledTimes(2);
  });

  it('allows a new attempt after the 15-minute failure window expires', async () => {
    for (let attempt = 0; attempt < FACE_MATCH_MAX_FAILURES; attempt += 1) {
      await attemptFaceMatch();
    }
    jest.advanceTimersByTime(15 * 60 * 1000 + 1);

    await expect(attemptFaceMatch()).resolves.toBe('mismatch-recorded');
  });
});
