import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';

const logger = new WinstonLogger('CompanyScope');

const PATH_TO_RESOURCE_MAP: Array<{ prefix: string; resource: string }> = [
  { prefix: '/api/employees', resource: 'employee' },
  { prefix: '/api/employee', resource: 'employee' },
  { prefix: '/api/leave', resource: 'leave' },
  { prefix: '/api/attendance', resource: 'attendance' },
  { prefix: '/api/payroll', resource: 'payroll' },
  { prefix: '/api/travel-expenses', resource: 'travel' },
  { prefix: '/api/employee-loans', resource: 'loan' },
  { prefix: '/api/work-calendars', resource: 'work-calendar' },
  { prefix: '/api/work-calendar', resource: 'work-calendar' },
  { prefix: '/api/assets', resource: 'asset' },
  { prefix: '/api/benefits', resource: 'benefit' },
  { prefix: '/api/performance', resource: 'performance' },
  { prefix: '/api/recruitment', resource: 'recruitment' },
  { prefix: '/api/training', resource: 'training' },
  { prefix: '/api/onboarding', resource: 'employee' },
  { prefix: '/api/offboarding', resource: 'employee' },
  { prefix: '/api/documents', resource: 'document' },
  { prefix: '/api/reports', resource: 'report' },
];

function guessResourceFromPath(url: string): string {
  try {
    for (const { prefix, resource } of PATH_TO_RESOURCE_MAP) {
      if (url.startsWith(prefix)) {
        return resource;
      }
    }
    const parts = url.split('/');
    if (parts.length >= 3 && parts[1] === 'api') {
      const segment = parts[2];
      return segment.replace(/-/g, '') || 'ALL';
    }
    return 'ALL';
  } catch {
    return 'ALL';
  }
}

function applyParsedFilterToQuery(
  query: Record<string, unknown>,
  filter: Record<string, unknown>,
  userEmployeeId?: string
): void {
  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;

    if (key === 'id' && userEmployeeId) {
      query.employeeId = userEmployeeId;
      continue;
    }

    if (key === 'employeeId' && userEmployeeId) {
      query.employeeId = userEmployeeId;
      continue;
    }

    query[key] = value;
  }
}

/**
 * Company scope middleware - ensures user can only access data within their company
 * Extracts company context from request params, query, or body and validates
 * Also injects data scope filters into req.query based on user roles (A.8 DataAccessScope)
 */
export function requireCompanyAccess() {
  return async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError('Authentication required for company access');
      }

      // Super admin and group admins can access any company
      const isSuperOrGroupAdmin = req.user.roles?.some((r) =>
        ['SUPER_ADMIN', 'GROUP_ADMIN'].includes(r)
      );

      const allowedCompanyIds =
        req.user.companyScope && req.user.companyScope.length > 0
          ? req.user.companyScope
          : req.user.companyId
            ? [req.user.companyId]
            : [];

      const requestedCompanyId =
        req.params.companyId ||
        (req.query.companyId as string) ||
        req.body?.companyId;

      if (requestedCompanyId && !allowedCompanyIds.includes(requestedCompanyId)) {
        throw new ForbiddenError('You do not have access to this company data');
      }

      const effectiveCompanyId =
        requestedCompanyId || req.user.companyId || allowedCompanyIds[0];
      if (!effectiveCompanyId) {
        throw new ForbiddenError(
          'No accessible company scope found for this request'
        );
      }
      req.company = { id: effectiveCompanyId, groupId: req.user.groupId };

      if (req.query && typeof req.query === 'object') {
        (req.query as Record<string, unknown>).companyId = effectiveCompanyId;
      }
      if (
        req.body &&
        typeof req.body === 'object' &&
        'companyId' in req.body
      ) {
        (req.body as Record<string, unknown>).companyId = effectiveCompanyId;
      }

      // ── A.8 Data scope filter injection ──────────────────────────
      if (!isSuperOrGroupAdmin && req.originalUrl) {
        const targetResource = guessResourceFromPath(req.originalUrl);
        try {
          const { administrationService } = await import(
            '@/modules/administration/administration.service'
          );

          const scope = await administrationService.findMyDataScopeByUser(
            effectiveCompanyId,
            {
              id: req.user.id,
              roles: req.user.roles,
              companyId: req.user.companyId,
              employeeId: req.user.employeeId,
              companyScope: req.user.companyScope,
            },
            targetResource
          );

          if (
            scope &&
            scope.scopeType !== 'ALL' &&
            scope.scopeType !== 'COMPANY_ONLY'
          ) {
            const parsedFilter =
              administrationService.resolveEmployeeFilterForCurrentUser(
                scope,
                {
                  id: req.user.id,
                  roles: req.user.roles,
                  companyId: req.user.companyId,
                  employeeId: req.user.employeeId,
                  companyScope: req.user.companyScope,
                },
                targetResource
              );

            if (Object.keys(parsedFilter).length > 0 && req.query) {
              applyParsedFilterToQuery(
                req.query as Record<string, unknown>,
                parsedFilter,
                req.user.employeeId
              );
            }
          }
        } catch (scopeErr) {
          logger.warn(
            `Data scope resolve failed for resource=${targetResource}, skipping filter injection`,
            { error: (scopeErr as Error).message }
          );
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * Group scope middleware - ensures user can only access data within their group
 */
export function requireGroupAccess() {
  return (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
  ): void => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required for group access');
    }

    if (req.user.roles?.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const requestedGroupId =
      req.params.groupId ||
      (req.query.groupId as string) ||
      req.body?.groupId;

    if (requestedGroupId && req.user.groupId !== requestedGroupId) {
      throw new ForbiddenError('You do not have access to this group data');
    }

    req.group = {
      id: req.user.groupId!,
    };

    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      company?: {
        id: string;
        groupId?: string;
      };
      group?: {
        id: string;
      };
    }
  }
}
