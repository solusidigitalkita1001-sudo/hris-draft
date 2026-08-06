import { PrismaClient } from '@prisma/client';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

// Task 2.8 (OPS-003): pin connection pool sizing on the datasource URL so the
// pool doesn't exhaust under concurrent payroll/report load.
function buildDatabaseUrl(): string {
  try {
    const url = new URL(config.database.url);
    if (!url.searchParams.has('connection_limit')) {
      url.searchParams.set('connection_limit', String(config.database.connectionLimit));
    }
    if (!url.searchParams.has('pool_timeout')) {
      url.searchParams.set('pool_timeout', String(config.database.poolTimeout));
    }
    return url.toString();
  } catch {
    return config.database.url; // leave untouched if it isn't a parseable URL
  }
}

function createPrismaClient(): PrismaClient {
  const isDev = config.app.env === 'development';
  const client = new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
    // Emit query events in every env so slow queries can be surfaced.
    log: [
      { level: 'query', emit: 'event' },
      { level: 'error', emit: 'stdout' },
      { level: 'warn', emit: 'stdout' },
    ],
  });

  const slowMs = config.database.slowQueryMs;
  client.$on('query' as never, (e: any) => {
    if (e.duration >= slowMs) {
      logger.warn(`Slow query ${e.duration}ms`, { query: e.query, duration: `${e.duration}ms` });
    } else if (isDev) {
      logger.debug(`Query: ${e.query}`, { params: e.params, duration: `${e.duration}ms` });
    }
  });

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function testDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    return false;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}

export default prisma;
