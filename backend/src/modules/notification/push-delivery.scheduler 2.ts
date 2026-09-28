import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import { pushDeliveryService } from './push-delivery.service';

export const PUSH_DELIVERY_SWEEP_JOB = 'notification:push-delivery-sweep';

export function runPushDeliverySweep() {
  return pushDeliveryService.sweep();
}

export async function schedulePushDeliverySweep(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — push delivery sweep will not be scheduled');
    return;
  }
  await queueManager.enqueue(
    QueueNames.PUSH_NOTIFICATIONS,
    PUSH_DELIVERY_SWEEP_JOB,
    {},
    { repeat: { every: 15_000 }, jobId: 'push-delivery-sweep' },
  );
  logger.info('Push delivery sweep scheduled', { intervalMs: 15_000 });
}
