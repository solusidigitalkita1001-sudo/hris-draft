import 'reflect-metadata';
import { errorDetail } from '@/shared/logger/error-detail';
import { webhookService } from '@/modules/webhook/webhook.service';
import { AUTO_ABSENT_JOB, runAutoAbsent, scheduleAutoAbsent } from '@/modules/attendance/auto-absent.scheduler';
import { CONTRACT_EXPIRY_REMINDER_JOB, runContractExpiryReminders, scheduleContractExpiryReminders } from '@/modules/employee/employment-contract.scheduler';
import { SIGNING_REMINDER_JOB, runSigningReminders, scheduleSigningReminders } from '@/modules/document-management/document-signing-reminder.scheduler';
import { runWebhookSweep, scheduleWebhookSweep } from '@/modules/webhook/webhook.scheduler';
import config from '@/config';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { rabbitMQBroker } from '@/infrastructure/messaging/RabbitMQBroker';
import { DomainEvent } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { logger } from '@/shared/logger/WinstonLogger';
import { prisma, disconnectDatabase, testDatabaseConnection } from '@/shared/database/prisma';
import { authRepository } from '@/modules/auth/auth.repository';
import { performanceService } from '@/modules/performance/performance.service';
import { runYearlyLeaveAccrual, scheduleYearlyLeaveAccrual } from '@/modules/leave/leave.scheduler';
import { WORKFLOW_SLA_SWEEP_JOB, runWorkflowSlaSweep, scheduleWorkflowSlaSweep } from '@/modules/workflow-engine/workflow-sla.scheduler';
import { CAREER_TRANSACTION_APPLY_JOB, runCareerTransactionApply, scheduleCareerTransactionApply } from '@/modules/employee/career-transaction.scheduler';
import { OFFBOARDING_APPLY_JOB, runOffboardingApply, scheduleOffboardingApply } from '@/modules/onboarding/offboarding.scheduler';
import { RETENTION_SWEEP_JOB, runRetentionSweep, scheduleRetentionSweep } from '@/shared/retention/retention.scheduler';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { runPushDeliverySweep, schedulePushDeliverySweep } from '@/modules/notification/push-delivery.scheduler';

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
  if (!config.redis.enabled) {
    return;
  }

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

  if (!config.redis.enabled || !config.queue.enabled || !config.rabbitmq.enabled) {
    logger.warn('Worker dependencies are disabled. Worker will not start.', {
      redisEnabled: config.redis.enabled,
      queueEnabled: config.queue.enabled,
      rabbitmqEnabled: config.rabbitmq.enabled,
    });
    process.exit(0);
  }

  const redisHealthy = await redisCache.ping();
  if (!redisHealthy) {
    logger.error('Worker failed to connect to Redis. Exiting...');
    process.exit(1);
  }

  // Each of these is a separate way to fail, and the bootstrap catch cannot
  // tell them apart. Naming the step means the next crash says which one.
  try {
    await rabbitMQBroker.connect();
  } catch (error) {
    logger.error('Worker could not connect to RabbitMQ', errorDetail(error));
    throw error;
  }

  for (const queue of [
    QueueNames.DOMAIN_EVENTS,
    QueueNames.PERFORMANCE_AUTOMATION,
    QueueNames.LEAVE_AUTOMATION,
    QueueNames.PUSH_NOTIFICATIONS,
    QueueNames.WEBHOOKS,
  ]) {
    try {
      await queueManager.getQueueEvents(queue).waitUntilReady();
    } catch (error) {
      logger.error('Worker could not open a queue', { queue, ...errorDetail(error) });
      throw error;
    }
  }


  queueManager.createWorker<DomainEvent>(
    QueueNames.DOMAIN_EVENTS,
    async (job) => {
      const event = job.data;
      // Inbox dedupe (checklist §46): a BullMQ retry after a stall re-delivers
      // the same event; without this claim the notification doubles.
      if (config.redis.enabled && event.metadata?.eventId) {
        const claimed = await redisCache.getClient().set(
          `${config.redis.keyPrefix}ops:events:inbox:${event.metadata.eventId}`,
          '1', 'EX', 7 * 24 * 3600, 'NX',
        );
        if (claimed === null) {
          return { processed: false, duplicate: true, eventName: event.name };
        }
      }
      await recordProcessedEvent(event, 'bullmq');
      await runInSystemContext('domain-event-notification', () => maybeCreateNotification(event));
      // Webhook fan-out belongs here, after the inbox claim: fanning out from
      // the publisher would duplicate deliveries on every BullMQ retry, and a
      // duplicate call into a customer's system can mean a duplicate invoice.
      const webhookDeliveries = await runInSystemContext('domain-event-webhook-fanout', () => webhookService.fanOut(event));
      return { processed: true, eventName: event.name, webhookDeliveries };
    },
    { concurrency: 10 }
  );

  queueManager.createWorker(
    QueueNames.WEBHOOKS,
    async () => runWebhookSweep(),
    { concurrency: 1 },
  );

  queueManager.createWorker<{ scheduleId: string }>(
    QueueNames.PERFORMANCE_AUTOMATION,
    async (job) => {
      return runInSystemContext('performance-automation-worker', () =>
        performanceService.runPerformanceAutomationSchedule(job.data.scheduleId)
      );
    },
    { concurrency: 3 }
  );

  queueManager.createWorker<{ year: number }>(
    QueueNames.LEAVE_AUTOMATION,
    async (job) => {
      if (job.name === WORKFLOW_SLA_SWEEP_JOB) {
        return runInSystemContext('workflow-sla-worker', () => runWorkflowSlaSweep());
      }
      if (job.name === CAREER_TRANSACTION_APPLY_JOB) {
        return runInSystemContext('career-transaction-worker', () => runCareerTransactionApply());
      }
      if (job.name === OFFBOARDING_APPLY_JOB) {
        return runInSystemContext('offboarding-worker', () => runOffboardingApply());
      }
      if (job.name === RETENTION_SWEEP_JOB) {
        return runInSystemContext('retention-worker', () => runRetentionSweep());
      }
      if (job.name === AUTO_ABSENT_JOB) {
        return runAutoAbsent();
      }
      if (job.name === SIGNING_REMINDER_JOB) {
        return runSigningReminders();
      }
      if (job.name === CONTRACT_EXPIRY_REMINDER_JOB) {
        return runContractExpiryReminders();
      }
      const year = job.data.year ?? new Date().getFullYear();
      return runInSystemContext('leave-automation-worker', () => runYearlyLeaveAccrual(year));
    },
    { concurrency: 1 }
  );

  queueManager.createWorker(
    QueueNames.PUSH_NOTIFICATIONS,
    async () => runPushDeliverySweep(),
    { concurrency: 1 },
  );

  await runInSystemContext('leave-scheduler-bootstrap', () => scheduleYearlyLeaveAccrual());
  await runInSystemContext('workflow-sla-scheduler-bootstrap', () => scheduleWorkflowSlaSweep());
  await runInSystemContext('career-scheduler-bootstrap', () => scheduleCareerTransactionApply());
  await runInSystemContext('offboarding-scheduler-bootstrap', () => scheduleOffboardingApply());
  await runInSystemContext('retention-scheduler-bootstrap', () => scheduleRetentionSweep());
  await runInSystemContext('push-scheduler-bootstrap', () => schedulePushDeliverySweep());
  await runInSystemContext('webhook-scheduler-bootstrap', () => scheduleWebhookSweep());
  await runInSystemContext('contract-reminder-bootstrap', () => scheduleContractExpiryReminders());
  await runInSystemContext('auto-absent-bootstrap', () => scheduleAutoAbsent());
  await runInSystemContext('signing-reminder-bootstrap', () => scheduleSigningReminders());

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
    queues: [QueueNames.DOMAIN_EVENTS, QueueNames.PERFORMANCE_AUTOMATION, QueueNames.LEAVE_AUTOMATION, QueueNames.WEBHOOKS, QueueNames.PUSH_NOTIFICATIONS],
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
    logger.error('Worker unhandled rejection', errorDetail(reason));
  });
}

bootstrapWorker().catch((error) => {
  // errorDetail, not the raw error: an Error serialises to {} and this line is
  // the only thing a crash-looping worker leaves behind.
  logger.error('Failed to bootstrap worker', errorDetail(error));
  process.exit(1);
});
