import type { Prisma } from '@prisma/client';
import { TooManyRequestsError } from '@/shared/exceptions/AppError';
import { withDatabaseAdvisoryLock } from '@/shared/database/advisory-lock';
import { appendAuditLogEntry } from '@/shared/middleware/AuditLog';
import { getRequestContext } from '@/shared/context/RequestContext';

export const FACE_MATCH_MAX_FAILURES = 5;
export const FACE_MATCH_WINDOW_MS = 15 * 60 * 1000;

const HR_ALERT_ROLE_CODES = ['COMPANY_ADMIN', 'HR_MANAGER', 'HR_STAFF'];
const RATE_LIMIT_ACTION = 'FACE_MATCH_RATE_LIMITED';

export interface FaceMatchAttemptContext {
  companyId: string;
  employeeId: string;
}

type BlockedAttempt = {
  blocked: true;
  failedAttempts: number;
  retryAt: Date;
};

type AllowedAttempt<T> = {
  blocked: false;
  value: T;
};

/**
 * Serializes face-match attempts per employee and enforces a sliding failure
 * window from immutable AttendanceFaceLog rows. This deliberately uses the
 * existing MySQL advisory-lock pattern instead of an in-process counter so the
 * limit remains consistent across API instances and restarts.
 */
export async function runRateLimitedFaceMatch<T>(
  context: FaceMatchAttemptContext,
  attempt: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const outcome = await withDatabaseAdvisoryLock<BlockedAttempt | AllowedAttempt<T>>(
    'face-match-attempt',
    `${context.companyId}:${context.employeeId}`,
    async (tx) => {
      const now = new Date();
      const windowStartedAt = new Date(now.getTime() - FACE_MATCH_WINDOW_MS);
      const recentFailures = await tx.attendanceFaceLog.findMany({
        where: {
          companyId: context.companyId,
          employeeId: context.employeeId,
          isFaceMatch: false,
          createdAt: { gte: windowStartedAt },
        },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: FACE_MATCH_MAX_FAILURES,
      });

      if (recentFailures.length >= FACE_MATCH_MAX_FAILURES) {
        const oldestRelevantFailure = recentFailures[recentFailures.length - 1].createdAt;
        const retryAt = new Date(oldestRelevantFailure.getTime() + FACE_MATCH_WINDOW_MS);
        if (retryAt.getTime() > now.getTime()) {
          await notifyHrOnce(tx, context, windowStartedAt, retryAt);
          return {
            blocked: true,
            failedAttempts: recentFailures.length,
            retryAt,
          };
        }
      }

      return { blocked: false, value: await attempt(tx) };
    },
  );

  if (!outcome.blocked) return outcome.value;

  const actorId = getRequestContext()?.user?.id;
  if (!actorId) {
    throw new Error('Authenticated request context is required for face-match rate-limit audit');
  }

  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((outcome.retryAt.getTime() - Date.now()) / 1000),
  );
  await appendAuditLogEntry({
    companyId: context.companyId,
    userId: actorId,
    action: RATE_LIMIT_ACTION,
    entity: 'AttendanceFaceMatch',
    entityId: context.employeeId,
    newValue: JSON.stringify({
      failedAttempts: outcome.failedAttempts,
      limit: FACE_MATCH_MAX_FAILURES,
      windowSeconds: FACE_MATCH_WINDOW_MS / 1000,
      retryAfterSeconds,
    }),
  });

  const retryAfterMinutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  throw new TooManyRequestsError(
    `Terlalu banyak percobaan verifikasi wajah gagal. Coba lagi dalam ${retryAfterMinutes} menit.`,
  );
}

async function notifyHrOnce(
  tx: Prisma.TransactionClient,
  context: FaceMatchAttemptContext,
  windowStartedAt: Date,
  retryAt: Date,
): Promise<void> {
  const existingAlert = await tx.notification.findFirst({
    where: {
      companyId: context.companyId,
      resource: 'attendance',
      action: RATE_LIMIT_ACTION,
      referenceId: context.employeeId,
      createdAt: { gte: windowStartedAt },
    },
    select: { id: true },
  });
  if (existingAlert) return;

  const recipients = await tx.user.findMany({
    where: {
      deletedAt: null,
      status: 'ACTIVE',
      userRoles: {
        some: {
          companyId: context.companyId,
          role: {
            code: { in: HR_ALERT_ROLE_CODES },
            status: 'ACTIVE',
            deletedAt: null,
          },
        },
      },
    },
    select: { id: true },
  });
  const userIds = [...new Set(recipients.map(({ id }) => id))];
  if (userIds.length === 0) return;

  await tx.notification.createMany({
    data: userIds.map((userId) => ({
      companyId: context.companyId,
      userId,
      title: 'Percobaan face check-in diblokir',
      message: `Employee ${context.employeeId} mencapai ${FACE_MATCH_MAX_FAILURES} kegagalan face-match. Akses dikunci sampai ${retryAt.toISOString()}.`,
      type: 'WARNING' as const,
      resource: 'attendance',
      action: RATE_LIMIT_ACTION,
      referenceId: context.employeeId,
    })),
  });
}
