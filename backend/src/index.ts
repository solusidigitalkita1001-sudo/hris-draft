import 'reflect-metadata';
import app from './app';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { testDatabaseConnection } from '@/shared/database/prisma';
import { redisCache } from '@/infrastructure/cache/RedisCache';

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
  try {
    const redis = redisCache.getClient();
    await redis.ping();
    logger.info('Redis connection established');
  } catch (error) {
    logger.warn('Redis connection failed. Cache features will be degraded.', { error });
  }

  // Start server
  const server = app.listen(config.app.port, () => {
    logger.info(`Server running on port ${config.app.port}`, {
      url: `${config.app.url}${config.app.apiPrefix}`,
      env: config.app.env,
    });
  });

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
