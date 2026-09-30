import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { employmentContractService } from './employment-contract.service';

export const CONTRACT_EXPIRY_REMINDER_JOB = 'employee:contract-expiry-reminder';
/** Once a day is the right cadence for a reminder measured in days. */
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export function runContractExpiryReminders() {
  return employmentContractService.sweepExpiryReminders();
}

export async function scheduleContractExpiryReminders(): Promise<void> {
  if (!queueManager.isEnabled()) {
    // Worth saying out loud: without the queue, contracts lapse unannounced,
    // which is the exact failure this feature exists to prevent.
    logger.warn('Queue disabled — employment contract expiry reminders will not run');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    CONTRACT_EXPIRY_REMINDER_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'contract-expiry-reminder' },
  );
  logger.info('Employment contract expiry reminders scheduled', { intervalMs: INTERVAL_MS });
}
