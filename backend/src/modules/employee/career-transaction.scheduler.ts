import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { withDatabaseAdvisoryLock } from '@/shared/database/advisory-lock';
import { employeeRepository } from './employee.repository';

export const CAREER_TRANSACTION_APPLY_JOB = 'career:apply-due-transactions';

/**
 * Applies career movements whose effective date has arrived (checklist §9:
 * future-dated movement). Rows are applied per employee in effective-date
 * order under the same advisory lock the create path uses, and marked with
 * appliedAt exactly once.
 */
export async function runCareerTransactionApply(): Promise<{ due: number; applied: number }> {
  const due = await prisma.employeeCareerTransaction.findMany({
    where: { appliedAt: null, deletedAt: null, effectiveDate: { lte: new Date() } },
    orderBy: [{ employeeId: 'asc' }, { effectiveDate: 'asc' }, { createdAt: 'asc' }],
    select: {
      id: true, employeeId: true, companyId: true, effectiveDate: true,
      toBranchId: true, toDepartmentId: true, toPositionId: true, toEmploymentType: true, toBaseSalary: true,
    },
  });

  let applied = 0;
  for (const row of due) {
    try {
      await withDatabaseAdvisoryLock('career-transaction', row.employeeId, async (tx) => {
        // Exactly-once claim; a concurrent sweep or manual apply loses here.
        const claimed = await tx.employeeCareerTransaction.updateMany({
          where: { id: row.id, appliedAt: null },
          data: { appliedAt: new Date() },
        });
        if (claimed.count !== 1) return;
        await employeeRepository.applyCareerTransactionEffects(tx, row.employeeId, {
          companyId: row.companyId,
          effectiveDate: row.effectiveDate,
          toBranchId: row.toBranchId ?? undefined,
          toDepartmentId: row.toDepartmentId ?? undefined,
          toPositionId: row.toPositionId ?? undefined,
          toEmploymentType: row.toEmploymentType ?? undefined,
          toBaseSalary: row.toBaseSalary ? Number(row.toBaseSalary) : undefined,
        });
        applied += 1;
      });
    } catch (error) {
      logger.error('Failed to apply due career transaction', { transactionId: row.id, error });
    }
  }

  if (due.length) logger.info('Career transaction sweep complete', { due: due.length, applied });
  return { due: due.length, applied };
}

/** Register the hourly sweep. Safe to call repeatedly — BullMQ dedups by jobId. */
export async function scheduleCareerTransactionApply(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — career transaction sweep will not be scheduled');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    CAREER_TRANSACTION_APPLY_JOB,
    {},
    { repeat: { pattern: '15 * * * *' }, jobId: 'career-transaction-apply-cron' },
  );
  logger.info('Career transaction apply sweep scheduled (hourly)');
}
