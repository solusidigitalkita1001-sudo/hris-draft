import { PrismaClient } from '@prisma/client';
import config from '@/config';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentCompanyId, isSuperAdmin, isGroupAdmin } from '@/shared/context/RequestContext';

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

const COMPANY_SCOPED_MODELS = new Set([
  'WorkflowTemplate',
  'WorkflowInstance',
  'WorkflowInstanceStep',
  'WorkflowInstanceLog',
  'LeaveRequest',
  'LeaveBalance',
  'Loan',
  'BusinessTrip',
  'ExpenseClaim',
  'ExpenseApproval',
  'ShiftSwapRequest',
  'OvertimeRequest',
]);

const WORKFLOW_MODELS = new Set([
  'WorkflowTemplate',
  'WorkflowInstance',
  'WorkflowInstanceStep',
  'WorkflowInstanceLog',
]);

function hasCompanyIdFilter(params: any): boolean {
  const where = params.args?.where;
  if (!where) return false;
  if (typeof where.companyId === 'string') return true;
  if (where.companyId && typeof where.companyId === 'object') {
    if ('equals' in where.companyId) return true;
    if ('in' in where.companyId) return true;
  }
  if (Array.isArray(where.AND)) {
    return where.AND.some((clause: any) => clause && typeof clause.companyId !== 'undefined');
  }
  return false;
}

function attachCompanyScopeMiddleware(client: PrismaClient): PrismaClient {
  // Middleware company scope hanya untuk model A.1-A.3 (workflow + leave/loan/travel/expense/shift/overtime).
  // Tidak semua model di-scoped karena modul employee/master organization punya access pattern berbeda
  // (GROUP_ADMIN perlu akses cross-company untuk master data).
  client.$use(async (params, next) => {
    const model = params.model;
    if (!model || !COMPANY_SCOPED_MODELS.has(model)) {
      return next(params);
    }

    const currentCompanyId = getCurrentCompanyId();
    if (!currentCompanyId) {
      return next(params);
    }

    if (WORKFLOW_MODELS.has(model) && (isSuperAdmin() || isGroupAdmin())) {
      return next(params);
    }

    if (params.action === 'create') {
      if (!params.args?.data?.companyId) {
        if (params.args?.data) {
          params.args.data.companyId = currentCompanyId;
        }
      }
      return next(params);
    }

    if (
      params.action === 'findUnique' ||
      params.action === 'findFirst' ||
      params.action === 'findMany' ||
      params.action === 'count' ||
      params.action === 'aggregate' ||
      params.action === 'groupBy' ||
      params.action === 'update' ||
      params.action === 'updateMany' ||
      params.action === 'delete' ||
      params.action === 'deleteMany' ||
      params.action === 'upsert'
    ) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      if (!hasCompanyIdFilter(params)) {
        params.args.where.companyId = currentCompanyId;
      }
    }

    return next(params);
  });

  return client;
}

function createPrismaClient(): PrismaClient {
  const isDev = config.app.env === 'development';
  const client = new PrismaClient({
    datasources: { db: { url: buildDatabaseUrl() } },
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

  attachCompanyScopeMiddleware(client);

  return client;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Task 2.9 (OPS-004): route heavy read-only queries to a replica when one is
// configured; otherwise this is just the primary. Read-heavy repositories can
// opt in by using `prismaRead` for findMany/aggregate; writes/transactions must
// stay on `prisma`. No hard dependency — absent env => single primary.
const globalForReplica = globalThis as unknown as { prismaRead?: PrismaClient };

function createReadClient(): PrismaClient {
  if (!config.database.readReplicaUrl) return prisma;
  const replica = new PrismaClient({
    datasources: { db: { url: config.database.readReplicaUrl } },
    log: [{ level: 'error', emit: 'stdout' }],
  });
  attachCompanyScopeMiddleware(replica);
  logger.info('Read replica configured — routing reads to replica');
  return replica;
}

export const prismaRead: PrismaClient = globalForReplica.prismaRead ?? createReadClient();

if (process.env.NODE_ENV !== 'production') {
  globalForReplica.prismaRead = prismaRead;
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
