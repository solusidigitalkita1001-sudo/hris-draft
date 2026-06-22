import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';

interface AuditLogOptions {
  action: string;
  entity: string;
  getEntityId?: (req: AuthenticatedRequest) => string | undefined;
  getDescription?: (req: AuthenticatedRequest) => string;
}

/**
 * Audit logging middleware - logs CRUD operations
 */
export function auditLog(options: AuditLogOptions) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // Store original send to capture response
    const originalJson = res.json.bind(res);
    let responseBody: any;

    res.json = function (body: any) {
      responseBody = body;
      return originalJson(body);
    };

    res.on('finish', async () => {
      // Only log successful operations (2xx)
      if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
        try {
          const entityId = options.getEntityId?.(req) || (req.params.id as string);

          await prisma.auditLog.create({
            data: {
              companyId: req.user.companyId,
              userId: req.user.id,
              action: options.action,
              entity: options.entity,
              entityId: entityId,
              ipAddress: req.ip,
              userAgent: req.headers['user-agent']?.substring(0, 500),
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
