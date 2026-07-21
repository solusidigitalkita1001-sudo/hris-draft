import IORedis from 'ioredis';
import { ConnectionOptions, JobsOptions, Processor, Queue, QueueEvents, Worker, WorkerOptions } from 'bullmq';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { getRedisConnectionOptions } from '@/infrastructure/cache/redis-options';

export const QueueNames = {
  DOMAIN_EVENTS: 'domain-events',
  PERFORMANCE_AUTOMATION: 'performance-automation',
} as const;

export class QueueManager {
  private static instance: QueueManager;
  private queues = new Map<string, Queue>();
  private queueEvents = new Map<string, QueueEvents>();
  private workers: Worker[] = [];
  private connection: ConnectionOptions;
  private healthClient?: IORedis;
  private readonly healthTimeoutMs: number = 1000;
  private readonly enabled: boolean;

  private constructor() {
    this.enabled = config.queue.enabled && config.redis.enabled;
    this.connection = {};
    if (!this.enabled) {
      logger.info('BullMQ queue disabled via configuration');
      return;
    }

    const baseOptions = getRedisConnectionOptions();

    this.connection = {
      ...baseOptions,
      maxRetriesPerRequest: null,
    };

    this.healthClient = new IORedis({
      ...baseOptions,
      maxRetriesPerRequest: null,
    });

    this.healthClient.on('connect', () => {
      logger.info('BullMQ Redis connection established');
    });

    this.healthClient.on('error', (error) => {
      logger.error('BullMQ Redis connection error', { error });
    });
  }

  static getInstance(): QueueManager {
    if (!QueueManager.instance) {
      QueueManager.instance = new QueueManager();
    }

    return QueueManager.instance;
  }

  getQueue(name: string): Queue {
    if (!this.enabled) {
      throw new Error('Queue is disabled');
    }

    if (!this.queues.has(name)) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.connection,
          defaultJobOptions: {
            attempts: config.queue.defaultAttempts,
            backoff: {
              type: 'exponential',
              delay: config.queue.defaultBackoffMs,
            },
            removeOnComplete: 1000,
            removeOnFail: 1000,
          },
        })
      );
    }

    return this.queues.get(name)!;
  }

  getQueueEvents(name: string): QueueEvents {
    if (!this.enabled) {
      throw new Error('Queue is disabled');
    }

    if (!this.queueEvents.has(name)) {
      this.queueEvents.set(
        name,
        new QueueEvents(name, {
          connection: this.connection,
        })
      );
    }

    return this.queueEvents.get(name)!;
  }

  async enqueue<T>(queueName: string, jobName: string, data: T, options?: JobsOptions): Promise<ReturnType<Queue['add']> | null> {
    if (!this.enabled) {
      logger.debug('Skipping BullMQ enqueue because queue is disabled', { queueName, jobName });
      return null;
    }

    const queue = this.getQueue(queueName);
    return queue.add(jobName, data, options);
  }

  createWorker<T = unknown>(
    queueName: string,
    processor: Processor<T>,
    options?: Omit<WorkerOptions, 'connection'>
  ): Worker<T> {
    if (!this.enabled) {
      throw new Error('Queue is disabled');
    }

    const worker = new Worker<T>(queueName, processor, {
      connection: this.connection,
      concurrency: 5,
      ...options,
    });

    worker.on('completed', (job) => {
      logger.info('Queue job completed', {
        queueName,
        jobId: job.id,
        jobName: job.name,
      });
    });

    worker.on('failed', (job, error) => {
      logger.error('Queue job failed', {
        queueName,
        jobId: job?.id,
        jobName: job?.name,
        error,
      });
    });

    this.workers.push(worker);
    return worker;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.enabled || !this.healthClient) {
      return false;
    }

    try {
      const response = await Promise.race([
        this.healthClient.ping(),
        new Promise<'TIMEOUT'>((resolve) =>
          setTimeout(() => resolve('TIMEOUT'), this.healthTimeoutMs)
        ),
      ]);
      return response === 'PONG';
    } catch {
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.enabled || !this.healthClient) return;

    await Promise.all(this.workers.map((worker) => worker.close()));
    await Promise.all(Array.from(this.queueEvents.values()).map((queueEvents) => queueEvents.close()));
    await Promise.all(Array.from(this.queues.values()).map((queue) => queue.close()));
    await this.healthClient.quit();
    logger.info('BullMQ connections closed');
  }
}

export const queueManager = QueueManager.getInstance();
