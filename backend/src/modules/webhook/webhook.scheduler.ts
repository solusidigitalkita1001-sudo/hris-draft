import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { webhookService } from './webhook.service';

export const WEBHOOK_SWEEP_JOB = 'webhook:delivery-sweep';
const INTERVAL_MS = 15_000;

export function runWebhookSweep() {
  return webhookService.sweep();
}

export async function scheduleWebhookSweep(): Promise<void> {
  if (!queueManager.isEnabled()) {
    // Worth a warning rather than silence: without the queue, deliveries pile
    // up as PENDING and an integrator waits for calls that never come.
    logger.warn('Queue disabled — webhook deliveries will not be swept');
    return;
  }
  await queueManager.enqueue(
    QueueNames.WEBHOOKS,
    WEBHOOK_SWEEP_JOB,
    {},
    { repeat: { every: INTERVAL_MS }, jobId: 'webhook-delivery-sweep' },
  );
  logger.info('Webhook delivery sweep scheduled', { intervalMs: INTERVAL_MS });
}
