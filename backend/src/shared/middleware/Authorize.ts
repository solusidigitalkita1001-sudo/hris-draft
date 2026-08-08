import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import { ForbiddenError, AuthError } from '@/shared/exceptions/AppError';

export type PermissionCheck = {
  resource: string;
  action: 'create' | 'read' | 'update' | 'delete' | 'approve' | 'disburse' | 'export' | 'process';
};

function toLegacyPermissionCode(resource: string, action: string) {
  const resourceAliasMap: Record<string, string> = {
    organization: 'org',
    attendance: 'att',
    recruitment: 'rec',
    dashboard: 'dash',
    'travel-expense': 'travel',
  };

  return `${resourceAliasMap[resource] || resource}:${action}`;
}

/**
 * Authorization middleware factory - creates middleware that checks for specific permissions
 */
export function authorize(...permissions: PermissionCheck[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthError('Authentication required');
    }

    // Super admin bypasses all permission checks
    if (req.user.roles?.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const userPermissions = req.user.permissions || [];

    const hasAllPermissions = permissions.every((required) =>
      userPermissions.some(
        (up) =>
          up === `${required.resource}:${required.action}` ||
          up === `${required.resource}:*` ||
          up === toLegacyPermissionCode(required.resource, required.action) ||
          up === `${toLegacyPermissionCode(required.resource, '*')}`
      )
    );

    if (!hasAllPermissions) {
      const permissionStr = permissions
        .map((p) => `${p.resource}:${p.action}`)
        .join(', ');

      throw new ForbiddenError(`Insufficient permissions. Required: ${permissionStr}`);
    }

    next();
  };
}

/**
 * Role-based authorization middleware
 */
export function authorizeRole(...roles: string[]) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthError('Authentication required');
    }

    const userRoles = req.user.roles || [];

    // Super admin bypasses
    if (userRoles.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const hasRole = roles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenError(`Access denied. Required role: ${roles.join(' or ')}`);
    }

    next();
  };
}

/**
 * Ownership check - ensures user can only access their own data
 */
export function authorizeOwnership(userIdParam: string = 'userId') {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new AuthError('Authentication required');
    }

    // Super admin bypasses
    if (req.user.roles?.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const targetUserId = req.params[userIdParam];
    if (targetUserId && targetUserId !== req.user.id) {
      throw new ForbiddenError('You can only access your own data');
    }

    next();
  };
}
