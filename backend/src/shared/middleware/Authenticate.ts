import { Request, Response, NextFunction } from 'express';
import { jwtHandler } from '@/shared/security/JWTHandler';
import { AuthError, ForbiddenError } from '@/shared/exceptions/AppError';
import { runInRequestContext } from '@/shared/context/RequestContext';
import prisma from '@/shared/database/prisma';
import type { AccessTokenPayload } from '@/shared/security/JWTHandler';

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
    hasGlobalRole?: boolean;
    maxRolePriority?: number;
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
async function isCurrentSession(decoded: AccessTokenPayload): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: decoded.sub },
    select: { sessionVersion: true, status: true, deletedAt: true },
  });
  return Boolean(
    user &&
    !user.deletedAt &&
    !['INACTIVE', 'SUSPENDED'].includes(user.status) &&
    user.sessionVersion === decoded.sessionVersion,
  );
}

function attachUser(req: AuthenticatedRequest, decoded: AccessTokenPayload, next: NextFunction): void {
  req.user = {
    id: decoded.sub,
    email: decoded.email,
    employeeId: decoded.employeeId,
    companyId: decoded.companyId,
    companyScope: decoded.companyScope,
    groupId: decoded.groupId,
    permissions: decoded.permissions,
    roles: decoded.roles,
    hasGlobalRole: decoded.hasGlobalRole,
    maxRolePriority: decoded.maxRolePriority,
  };
  runInRequestContext({ user: req.user }, () => {
    next();
  });
}

function attachAnonymous(next: NextFunction): void {
  runInRequestContext({}, () => {
    next();
  });
}

export async function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    next(new AuthError('No authorization token provided'));
    return;
  }

  try {
    const decoded = jwtHandler.verifyAccessToken(token);
    if (!(await isCurrentSession(decoded))) {
      throw new AuthError('Access token session is no longer valid');
    }
    attachUser(req, decoded, next);
  } catch (error) {
    if (error instanceof AuthError || error instanceof ForbiddenError) {
      next(error);
      return;
    }
    // JWT failures are normalized by JWTHandler. Unknown failures here are
    // infrastructure errors (for example the session-version DB lookup) and
    // must not be disguised as bad credentials.
    next(error);
  }
}

/**
 * Optional authentication - doesn't fail if no token, but populates user if present
 */
export async function optionalAuthenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> {
  const token = extractToken(req);

  if (!token) {
    attachAnonymous(next);
    return;
  }

  let decoded: AccessTokenPayload;
  try {
    decoded = jwtHandler.verifyAccessToken(token);
  } catch {
    attachAnonymous(next);
    return;
  }

  try {
    if (!(await isCurrentSession(decoded))) {
      attachAnonymous(next);
      return;
    }
    attachUser(req, decoded, next);
  } catch (error) {
    next(error);
  }
}
