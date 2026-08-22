import { Request, Response, NextFunction } from 'express';
import { jwtHandler } from '@/shared/security/JWTHandler';
import { AuthError, ForbiddenError } from '@/shared/exceptions/AppError';
import { runInRequestContext } from '@/shared/context/RequestContext';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    employeeId?: string;
    companyId?: string;
    companyScope?: string[];
    groupId?: string;
    permissions?: string[];
    roles?: string[];
  };
}

function extractToken(req: Request): string | undefined {
  if (req.cookies?.at) {
    return req.cookies.at;
  }
  const authHeader = req.headers.authorization;
  if (!authHeader) return undefined;
  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0] === 'Bearer') {
    return parts[1];
  }
  return undefined;
}

/**
 * Authentication middleware - verifies JWT access token
 * Extracts token from httpOnly cookie (at) first, then falls back to
 * Authorization Bearer header for backward compatibility (mobile clients / dev tools).
 * Mounts the authenticated user into AsyncLocalStorage via RequestContext
 * so Prisma middleware / services can access company scope safely.
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    throw new AuthError('No authorization token provided');
  }

  try {
    const decoded = jwtHandler.verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      employeeId: decoded.employeeId,
      companyId: decoded.companyId,
      companyScope: decoded.companyScope,
      groupId: decoded.groupId,
      permissions: decoded.permissions,
      roles: decoded.roles,
    };
    runInRequestContext({ user: req.user }, () => {
      next();
    });
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      throw error;
    }
    throw new AuthError('Invalid or expired access token');
  }
}

/**
 * Optional authentication - doesn't fail if no token, but populates user if present
 */
export function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const token = extractToken(req);

  if (!token) {
    runInRequestContext({}, () => {
      next();
    });
    return;
  }

  try {
    const decoded = jwtHandler.verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      employeeId: decoded.employeeId,
      companyId: decoded.companyId,
      companyScope: decoded.companyScope,
      groupId: decoded.groupId,
      permissions: decoded.permissions,
      roles: decoded.roles,
    };
    runInRequestContext({ user: req.user }, () => {
      next();
    });
  } catch {
    runInRequestContext({}, () => {
      next();
    });
  }
}
