import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { sweepCarryOverExpiry } from './carryover-expiry.service';

export const CARRYOVER_EXPIRY_JOB = 'leave:carryover-expiry';
/** Daily: the cut-off is a date inside the year, not a year boundary. */
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export function runCarryOverExpiry() {
  return sweepCarryOverExpiry();
}

export async function scheduleCarryOverExpiry(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — carried leave days will not expire on their deadline');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    CARRYOVER_EXPIRY_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'leave-carryover-expiry' },
  );
  logger.info('Carry-over expiry sweep scheduled', { intervalMs: INTERVAL_MS });
}
