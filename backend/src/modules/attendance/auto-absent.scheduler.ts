import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { sweepAutoAbsent } from './auto-absent.service';

export const AUTO_ABSENT_JOB = 'attendance:auto-absent';
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Yesterday, not today: nobody is absent for a day that has not finished, and
 * marking them so at 01:00 would be wrong for everyone yet to arrive.
 */
export function runAutoAbsent() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return sweepAutoAbsent(yesterday);
}

export async function scheduleAutoAbsent(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — auto-absent marking will not run');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    AUTO_ABSENT_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'attendance-auto-absent' },
  );
  logger.info('Auto-absent sweep scheduled', { intervalMs: INTERVAL_MS });
}
