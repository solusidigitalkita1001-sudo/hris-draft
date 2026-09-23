import { getRequestContext, runInRequestContext, runInSystemContext } from '@/shared/context/RequestContext';
import prisma from '@/shared/database/prisma';
import { Response, NextFunction } from 'express';
import config from '@/config';
import { AuthenticatedRequest } from './Authenticate';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { createAuditLog } from './AuditLog';

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
    url = url.split('?')[0];
    if (url.startsWith(`${config.app.apiPrefix}/`)) {
      url = `/api${url.slice(config.app.apiPrefix.length)}`;
    }
    for (const { prefix, resource } of PATH_TO_RESOURCE_MAP) {
      if (url === prefix || url.startsWith(`${prefix}/`)) {
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

      // Elevated roles bypass employee data-scope injection. GROUP_ADMIN is
      // still limited to its JWT companyScope; SUPER_ADMIN may select any
      // company, but must do so explicitly (checklist #9, option 1).
      const isSuperOrGroupAdmin = req.user.roles?.some((r) =>
        ['SUPER_ADMIN', 'GROUP_ADMIN'].includes(r)
      );
      const isSuperAdminRole = req.user.roles?.includes('SUPER_ADMIN') ?? false;

      const allowedCompanyIds =
        req.user.companyScope && req.user.companyScope.length > 0
          ? req.user.companyScope
          : req.user.companyId
            ? [req.user.companyId]
            : [];

      const requestedCompanyValue =
        req.params.companyId ||
        req.query.companyId ||
        req.body?.companyId;
      if (
        requestedCompanyValue !== undefined &&
        (typeof requestedCompanyValue !== 'string' || !requestedCompanyValue.trim())
      ) {
        throw new ForbiddenError('Active company must be a non-empty string');
      }
      const requestedCompanyId = typeof requestedCompanyValue === 'string'
        ? requestedCompanyValue.trim()
        : undefined;

      if (isSuperAdminRole && !requestedCompanyId) {
        throw new ForbiddenError('SUPER_ADMIN must select an active company for tenant access');
      }

      if (requestedCompanyId && !allowedCompanyIds.includes(requestedCompanyId) && !isSuperAdminRole) {
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
      const scopedUser = { ...req.user, companyId: effectiveCompanyId };

      if (effectiveCompanyId && req.query && typeof req.query === 'object') {
        (req.query as Record<string, unknown>).companyId = effectiveCompanyId;
      }
      if (
        effectiveCompanyId &&
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
              id: scopedUser.id,
              roles: scopedUser.roles,
              companyId: scopedUser.companyId,
              employeeId: scopedUser.employeeId,
              companyScope: scopedUser.companyScope,
            },
            targetResource
          );

          if (
            scope &&
            scope.scopeType !== 'ALL' &&
            scope.scopeType !== 'COMPANY_ONLY'
          ) {
            const scopeUser: {
              id: string; roles?: string[]; companyId?: string; employeeId?: string; companyScope?: string[];
              branchId?: string | null; departmentId?: string | null; subDepartmentId?: string | null;
            } = {
              id: scopedUser.id,
              roles: scopedUser.roles,
              companyId: scopedUser.companyId,
              employeeId: scopedUser.employeeId,
              companyScope: scopedUser.companyScope,
            };
            // OWN_* dynamic scopes need the requester's current org unit.
            if (scopedUser.employeeId && typeof scope.scopeType === 'string' && scope.scopeType.startsWith('OWN_')) {
              const self = await runInSystemContext('own-scope-org-lookup', () =>
                prisma.employee.findFirst({ where: { id: scopedUser.employeeId!, companyId: effectiveCompanyId, deletedAt: null }, select: { branchId: true, departmentId: true, subDepartmentId: true } }));
              scopeUser.branchId = self?.branchId ?? null;
              scopeUser.departmentId = self?.departmentId ?? null;
              scopeUser.subDepartmentId = self?.subDepartmentId ?? null;
            }
            const parsedFilter =
              administrationService.resolveEmployeeFilterForCurrentUser(scope, scopeUser, targetResource);

            if (Object.keys(parsedFilter).length > 0 && req.query) {
              applyParsedFilterToQuery(
                req.query as Record<string, unknown>,
                parsedFilter,
                scopedUser.employeeId
              );
            }
          }
        } catch (scopeErr) {
          logger.warn(
            `Data scope resolve failed for resource=${targetResource}, denying access`,
            { error: (scopeErr as Error).message }
          );
          throw new ForbiddenError('Unable to resolve data access scope');
        }
      }

      // Carry the validated active company into all downstream database operations.
      req.user = scopedUser;

      // A selected-company SUPER_ADMIN request is privileged cross-tenant
      // access. Record every successful request without storing body/query
      // values (which may contain salary, identity, or bank data).
      if (isSuperAdminRole && typeof _res.on === 'function') {
        _res.on('finish', () => {
          if (_res.statusCode >= 200 && _res.statusCode < 400) {
            void createAuditLog({
              companyId: effectiveCompanyId,
              userId: scopedUser.id,
              action: 'SUPER_ADMIN_TENANT_ACCESS',
              entity: 'API',
              newValue: JSON.stringify({ method: req.method, path: req.baseUrl + req.path }),
              ipAddress: req.ip,
              userAgent: req.headers['user-agent'],
            });
          }
        });
      }

      runInRequestContext({ ...getRequestContext(), user: scopedUser }, () => next());
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
  // eslint-disable-next-line @typescript-eslint/no-namespace -- Express extends its global Request interface through namespace declaration merging.
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
