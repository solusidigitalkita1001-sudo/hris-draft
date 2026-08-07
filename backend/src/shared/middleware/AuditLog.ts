import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { computeAuditHash } from '@/shared/security/audit-hash';

interface AuditLogOptions {
  action: string;
  entity: string;
  /** Prisma delegate name (e.g. 'employee') used to snapshot the record before a mutation. */
  model?: string;
  getEntityId?: (req: AuthenticatedRequest) => string | undefined;
  getDescription?: (req: AuthenticatedRequest) => string;
}

// Task 1.4 (SEC-017): PII that must never be logged in clear. Masked to last 4 chars.
const PII_FIELDS = new Set([
  'idNumber',
  'taxId',
  'bpjsKetenagakerjaan',
  'bpjsKesehatan',
  'bankAccount',
  'bankAccountHolder',
  'phone',
]);
// Fields that are noise for a diff or too large to keep.
const IGNORED_FIELDS = new Set(['id', 'createdAt', 'updatedAt', 'deletedAt', 'fullName']);

function maskValue(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (key === 'address') return '[redacted]';
  if (!PII_FIELDS.has(key)) return value;
  const s = String(value);
  return s.length <= 4 ? '****' : '*'.repeat(s.length - 4) + s.slice(-4);
}

/**
 * Build masked before/after payloads containing ONLY the fields that changed.
 * For deletes (after == null) the full before-snapshot is recorded.
 */
export function diffAuditFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null
): { oldValue?: string; newValue?: string } {
  if (before && !after) {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(before)) {
      if (!IGNORED_FIELDS.has(k)) masked[k] = maskValue(k, v);
    }
    return { oldValue: JSON.stringify(masked) };
  }

  const oldValue: Record<string, unknown> = {};
  const newValue: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue;
    const b = before?.[k];
    const a = after?.[k];
    if (JSON.stringify(b) === JSON.stringify(a)) continue;
    if (before && k in before) oldValue[k] = maskValue(k, b);
    if (after && k in after) newValue[k] = maskValue(k, a);
  }
  const result: { oldValue?: string; newValue?: string } = {};
  if (Object.keys(oldValue).length) result.oldValue = JSON.stringify(oldValue);
  if (Object.keys(newValue).length) result.newValue = JSON.stringify(newValue);
  return result;
}

/**
 * Audit logging middleware - logs CRUD operations with before/after diff.
 */
export function auditLog(options: AuditLogOptions) {
  const mutating = ['PUT', 'PATCH', 'DELETE'];

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const entityId = options.getEntityId?.(req) || (req.params.id as string);

    // Snapshot the record BEFORE the handler mutates it.
    let before: Record<string, unknown> | null = null;
    if (options.model && entityId && mutating.includes(req.method)) {
      try {
        const delegate = (prisma as unknown as Record<string, any>)[options.model];
        before = await delegate?.findUnique?.({ where: { id: entityId } });
      } catch (error) {
        logger.warn('Audit before-snapshot failed', { entity: options.entity, error });
      }
    }

    const originalJson = res.json.bind(res);
    let responseBody: any;
    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const after = req.method === 'DELETE' ? null : (responseBody?.data ?? null);
          const { oldValue, newValue } =
            before || after ? diffAuditFields(before, after) : {};

          const createdAt = new Date();
          // Hash-chain: kaitkan dengan hash entry terakhir pada company yang sama.
          const previous = await prisma.auditLog.findFirst({
            where: { companyId: req.user.companyId ?? null },
            orderBy: { createdAt: 'desc' },
            select: { hash: true },
          });
          const prevHash = previous?.hash ?? '';
          const hash = computeAuditHash(
            {
              companyId: req.user.companyId,
              userId: req.user.id,
              action: options.action,
              entity: options.entity,
              entityId,
              oldValue: oldValue ?? null,
              newValue: newValue ?? null,
              createdAt,
            },
            prevHash
          );

          await prisma.auditLog.create({
            data: {
              companyId: req.user.companyId,
              userId: req.user.id,
              action: options.action,
              entity: options.entity,
              entityId,
              oldValue,
              newValue,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']?.substring(0, 500),
              hash,
              prevHash: prevHash || null,
              createdAt,
            },
          });
        } catch (error) {
          logger.error('Failed to create audit log', { error });
        }
      }
    });

    next();
  };
}

/**
 * Create an audit log entry programmatically
 */
export async function createAuditLog(params: {
  companyId?: string;
  userId: string;
  action: string;
  entity: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId,
        userId: params.userId,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId,
        oldValue: params.oldValue,
        newValue: params.newValue,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent?.substring(0, 500),
      },
    });
  } catch (error) {
    logger.error('Failed to create audit log', { error });
  }
}
