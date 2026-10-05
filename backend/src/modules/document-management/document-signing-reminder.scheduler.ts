import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { sweepSigningReminders } from './document-signing-reminder.service';

export const SIGNING_REMINDER_JOB = 'document:signing-reminder';
/** Daily, like the contract sweep: the reminder is measured in days. */
const INTERVAL_MS = 24 * 60 * 60 * 1000;

export function runSigningReminders() {
  return sweepSigningReminders();
}

export async function scheduleSigningReminders(): Promise<void> {
  if (!queueManager.isEnabled()) {
    // Said out loud, because the silent version of this is a document sitting
    // past its deadline with nobody told — exactly what the feature prevents.
    logger.warn('Queue disabled — document signing reminders will not run');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    SIGNING_REMINDER_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'document-signing-reminder' },
  );
  logger.info('Document signing reminders scheduled', { intervalMs: INTERVAL_MS });
}
