import crypto from 'crypto';
import type { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';

const MYSQL_LOCK_NAME_MAX_LENGTH = 64;

function makeLockName(namespace: string, key: string): string {
  const digest = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = `${namespace}:`;
  return `${prefix}${digest.slice(0, MYSQL_LOCK_NAME_MAX_LENGTH - prefix.length)}`;
}

function lockAcquired(value: unknown): boolean {
  return value === 1 || value === BigInt(1) || value === '1';
}

/**
 * Run an operation under a MySQL connection-scoped advisory lock.
 * The transaction pins all statements to one connection, which guarantees
 * RELEASE_LOCK runs on the same connection as GET_LOCK.
 */
export async function withDatabaseAdvisoryLock<T>(
  namespace: string,
  key: string,
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
  timeoutSeconds = 10,
): Promise<T> {
  const lockName = makeLockName(namespace, key);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ acquired: number | bigint | string | null }>>`
      SELECT GET_LOCK(${lockName}, ${timeoutSeconds}) AS acquired
    `;
    if (!lockAcquired(rows[0]?.acquired)) {
      throw new Error(`Timed out acquiring database lock for ${namespace}`);
    }

    try {
      return await operation(tx);
    } finally {
      await tx.$queryRaw`SELECT RELEASE_LOCK(${lockName}) AS released`;
    }
  }, {
    maxWait: 5_000,
    timeout: Math.max(15_000, (timeoutSeconds + 5) * 1_000),
  });
}
