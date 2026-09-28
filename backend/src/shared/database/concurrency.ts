import { Prisma } from '@prisma/client';
import { ConflictError } from '@/shared/exceptions/AppError';

/**
 * Serializable transactions that lock a company row cannot avoid losing races;
 * they can only report them honestly. MySQL surfaces a lost race in several
 * shapes, and each retry site used to recognise one of them:
 *
 * - `P2034` — Prisma's own write-conflict/deadlock signal;
 * - `P2024` — timed out waiting for a connection while a lock was held;
 * - `P2010` — a raw statement failed, carrying the MySQL code: 1213 deadlock
 *   or 1205 lock-wait timeout. The `SELECT … FOR UPDATE` that takes the company
 *   lock is a raw statement, so this is the shape the real-database suite
 *   actually hit — and the one every site missed, which turned a lost race into
 *   a 500 instead of a retryable conflict.
 *
 * Nothing else is treated as contention: a failure that is not a race keeps its
 * own meaning and must not be retried.
 */
const MYSQL_CONCURRENCY_CODES = [1213, 1205];
const CONCURRENCY_TEXT = /deadlock|lock wait timeout/i;

export function isConcurrencyFailure(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2034' || error.code === 'P2024') return true;
    if (error.code === 'P2010') {
      const message = String(error.message);
      return MYSQL_CONCURRENCY_CODES.some((code) => message.includes(`Code: \`${code}\``))
        || CONCURRENCY_TEXT.test(message);
    }
    return false;
  }
  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    return CONCURRENCY_TEXT.test(String(error.message));
  }
  return false;
}

/**
 * Run `work`, retrying only a lost race, then reporting what is left as a
 * conflict the caller may retry. `attempts` counts total tries, not retries.
 */
export async function withConcurrencyRetry<T>(
  work: () => Promise<T>,
  conflictMessage: string,
  attempts = 3,
): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!isConcurrencyFailure(error)) throw error;
      if (attempt >= attempts) throw new ConflictError(conflictMessage);
    }
  }
}
