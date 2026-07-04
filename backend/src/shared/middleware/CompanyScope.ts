import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './Authenticate';
import { ForbiddenError } from '@/shared/exceptions/AppError';

/**
 * Company scope middleware - ensures user can only access data within their company
 * Extracts company context from request params, query, or body and validates
 */
export function requireCompanyAccess() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required for company access');
    }

    // Super admin and group admins can access any company
    if (req.user.roles?.some((r) => ['SUPER_ADMIN', 'GROUP_ADMIN'].includes(r))) {
      next();
      return;
    }

    const allowedCompanyIds = req.user.companyScope || (req.user.companyId ? [req.user.companyId] : []);

    // Get requested company from params, query, or body
    const requestedCompanyId =
      req.params.companyId ||
      req.query.companyId as string ||
      req.body.companyId;

    // If accessing a specific company, validate access
    if (requestedCompanyId && !allowedCompanyIds.includes(requestedCompanyId)) {
      throw new ForbiddenError('You do not have access to this company data');
    }

    // Attach company context to request for downstream use
    req.company = {
      id: requestedCompanyId || req.user.companyId || allowedCompanyIds[0],
      groupId: req.user.groupId,
    };

    if (!req.company.id) {
      throw new ForbiddenError('No accessible company scope found for this request');
    }

    next();
  };
}

/**
 * Group scope middleware - ensures user can only access data within their group
 */
export function requireGroupAccess() {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new ForbiddenError('Authentication required for group access');
    }

    // Super admin bypass
    if (req.user.roles?.includes('SUPER_ADMIN')) {
      next();
      return;
    }

    const requestedGroupId =
      req.params.groupId ||
      req.query.groupId as string ||
      req.body.groupId;

    if (requestedGroupId && req.user.groupId !== requestedGroupId) {
      throw new ForbiddenError('You do not have access to this group data');
    }

    req.group = {
      id: req.user.groupId!,
    };

    next();
  };
}

// Extend Express Request
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
