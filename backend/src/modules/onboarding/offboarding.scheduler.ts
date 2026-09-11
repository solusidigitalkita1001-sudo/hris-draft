import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { onboardingService } from './onboarding.service';

export const OFFBOARDING_APPLY_JOB = 'offboarding:apply-due-effects';

/**
 * Applies offboarding effects (employee inactive + user access revoked) for
 * approved resignations whose last working date has arrived. Exactly-once per
 * resignation via the effectsAppliedAt claim inside applyResignationEffects.
 */
export async function runOffboardingApply(): Promise<{ due: number; applied: number }> {
  const due = await prisma.resignation.findMany({
    where: { status: 'APPROVED', effectsAppliedAt: null, lastWorkingDate: { lte: new Date() } },
    select: { id: true },
  });
  let applied = 0;
  for (const row of due) {
    try {
      if (await onboardingService.applyResignationEffects(row.id)) applied += 1;
    } catch (error) {
      logger.error('Failed to apply offboarding effects', { resignationId: row.id, error });
    }
  }
  if (due.length) logger.info('Offboarding sweep complete', { due: due.length, applied });
  return { due: due.length, applied };
}

/** Register the hourly sweep. Safe to call repeatedly — BullMQ dedups by jobId. */
export async function scheduleOffboardingApply(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — offboarding sweep will not be scheduled');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    OFFBOARDING_APPLY_JOB,
    {},
    { repeat: { pattern: '30 * * * *' }, jobId: 'offboarding-apply-cron' },
  );
  logger.info('Offboarding effects sweep scheduled (hourly)');
}
