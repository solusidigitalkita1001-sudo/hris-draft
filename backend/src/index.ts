import 'reflect-metadata';
import app from './app';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { testDatabaseConnection } from '@/shared/database/prisma';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { rabbitMQBroker } from '@/infrastructure/messaging/RabbitMQBroker';
import { queueManager } from '@/infrastructure/queue/QueueManager';

async function bootstrap(): Promise<void> {
  logger.info('Starting HRMS Enterprise API...', {
    env: config.app.env,
    port: config.app.port,
    apiPrefix: config.app.apiPrefix,
  });

  // Test database connection
  const isDbConnected = await testDatabaseConnection();
  if (!isDbConnected) {
    logger.error('Failed to connect to database. Exiting...');
    process.exit(1);
  }

  // Connect to Redis (non-blocking - log warning if fails)
  if (config.redis.enabled) {
    try {
      const redis = redisCache.getClient();
      await redis.ping();
      logger.info('Redis connection established');
    } catch (error) {
      logger.warn('Redis connection failed. Cache features will be degraded.', { error });
    }
  } else {
    logger.info('Redis connection skipped because Redis is disabled');
  }

  // Start server
  const server = app.listen(config.app.port, () => {
    logger.info(`Server running on port ${config.app.port}`, {
      url: `${config.app.url}${config.app.apiPrefix}`,
      env: config.app.env,
    });
  });

  void (async () => {
    if (config.rabbitmq.enabled) {
      try {
        await rabbitMQBroker.connect();
        logger.info('RabbitMQ connection established');
      } catch (error) {
        logger.warn('RabbitMQ connection failed. Cross-instance events will be degraded.', { error });
      }
    } else {
      logger.info('RabbitMQ connection skipped because RabbitMQ is disabled');
    }

    if (config.queue.enabled) {
      try {
        const queueHealthy = await queueManager.isHealthy();
        if (queueHealthy) {
          logger.info('BullMQ Redis connection established');
        } else {
          logger.warn('BullMQ Redis connection failed. Background jobs will be degraded.');
        }
      } catch (error) {
        logger.warn('BullMQ initialization failed. Background jobs will be degraded.', { error });
      }
    } else {
      logger.info('BullMQ initialization skipped because queue is disabled');
    }
  })();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      logger.info('HTTP server closed');

      try {
        const { disconnectDatabase } = require('@/shared/database/prisma');
        await disconnectDatabase();
      } catch (e) {
        // ignore
      }

      try {
        await redisCache.disconnect();
      } catch (e) {
        // ignore
      }

      try {
        await rabbitMQBroker.disconnect();
      } catch (e) {
        // ignore
      }

      try {
        await queueManager.disconnect();
      } catch (e) {
        // ignore
      }

      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Force shutdown after 30s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled rejection', { reason });
  });
}

bootstrap().catch((error) => {
  logger.error('Failed to bootstrap application', { error });
  process.exit(1);
});
