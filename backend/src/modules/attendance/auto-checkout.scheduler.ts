import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { sweepAutoCheckout } from './auto-checkout.service';

export const AUTO_CHECKOUT_JOB = 'attendance:auto-checkout';
const INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Yesterday: a shift that has not ended cannot be closed out. */
export function runAutoCheckout() {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return sweepAutoCheckout(yesterday);
}

export async function scheduleAutoCheckout(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — open attendance rows will not be closed out');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    AUTO_CHECKOUT_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'attendance-auto-checkout' },
  );
  logger.info('Auto-checkout sweep scheduled', { intervalMs: INTERVAL_MS });
}
