import 'reflect-metadata';
import config from '@/config';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { rabbitMQBroker } from '@/infrastructure/messaging/RabbitMQBroker';
import { DomainEvent } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { logger } from '@/shared/logger/WinstonLogger';
import { prisma, disconnectDatabase, testDatabaseConnection } from '@/shared/database/prisma';
import { authRepository } from '@/modules/auth/auth.repository';

async function maybeCreateNotification(event: DomainEvent): Promise<void> {
  if (![DomainEvents.USER_LOGGED_IN, DomainEvents.PASSWORD_CHANGED].includes(event.name as any)) {
    return;
  }

  const user = await authRepository.findUserById(event.aggregateId);
  const companyId = user?.employee?.companyId;

  if (!user || !companyId) {
    return;
  }

  const title =
    event.name === DomainEvents.USER_LOGGED_IN
      ? 'Login berhasil tercatat'
      : 'Password berhasil diperbarui';
  const message =
    event.name === DomainEvents.USER_LOGGED_IN
      ? 'Aktivitas login Anda berhasil diproses oleh worker background.'
      : 'Perubahan password Anda telah diproses dan dicatat.';

  await prisma.notification.create({
    data: {
      companyId,
      userId: user.id,
      title,
      message,
      type: 'INFO',
      resource: 'system',
      action: event.name,
      referenceId: user.id,
    },
  });
}

async function recordProcessedEvent(event: DomainEvent, source: 'bullmq' | 'rabbitmq'): Promise<void> {
  const client = redisCache.getClient();
  const key = `${config.redis.keyPrefix}ops:events:processed`;
  const entry = JSON.stringify({
    source,
    eventName: event.name,
    aggregateId: event.aggregateId,
    occurredAt: event.metadata.occurredAt,
    processedAt: new Date().toISOString(),
  });

  await client.lpush(key, entry);
  await client.ltrim(key, 0, 199);
}

async function bootstrapWorker(): Promise<void> {
  logger.info('Starting HRMS worker...', {
    env: config.app.env,
  });

  const isDbConnected = await testDatabaseConnection();
  if (!isDbConnected) {
    logger.error('Worker failed to connect to database. Exiting...');
    process.exit(1);
  }

  const redisHealthy = await redisCache.ping();
  if (!redisHealthy) {
    logger.error('Worker failed to connect to Redis. Exiting...');
    process.exit(1);
  }

  await rabbitMQBroker.connect();
  await queueManager.getQueueEvents(QueueNames.DOMAIN_EVENTS).waitUntilReady();

  queueManager.createWorker<DomainEvent>(
    QueueNames.DOMAIN_EVENTS,
    async (job) => {
      const event = job.data;
      await recordProcessedEvent(event, 'bullmq');
      await maybeCreateNotification(event);
      return { processed: true, eventName: event.name };
    },
    { concurrency: 10 }
  );

  await rabbitMQBroker.subscribe<DomainEvent>(
    `${config.rabbitmq.queuePrefix}.domain-events.worker`,
    ['#'],
    async (event) => {
      await recordProcessedEvent(event, 'rabbitmq');
      logger.info('RabbitMQ event consumed by worker', {
        eventName: event.name,
        aggregateId: event.aggregateId,
      });
    }
  );

  logger.info('Worker ready', {
    queue: QueueNames.DOMAIN_EVENTS,
    exchange: config.rabbitmq.exchange,
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down worker gracefully...`);

    try {
      await rabbitMQBroker.disconnect();
      await queueManager.disconnect();
      await redisCache.disconnect();
      await disconnectDatabase();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  process.on('uncaughtException', (error) => {
    logger.error('Worker uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Worker unhandled rejection', { reason });
  });
}

bootstrapWorker().catch((error) => {
  logger.error('Failed to bootstrap worker', { error });
  process.exit(1);
});
