import { Request, Response, NextFunction } from 'express';
import { jwtHandler } from '@/shared/security/JWTHandler';
import { AuthError, ForbiddenError } from '@/shared/exceptions/AppError';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId?: string;
    groupId?: string;
    permissions?: string[];
    roles?: string[];
  };
}

/**
 * Authentication middleware - verifies JWT access token
 * Extracts and verifies Bearer token from Authorization header
 */
export function authenticate(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AuthError('No authorization token provided');
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthError('Invalid authorization header format. Use: Bearer <token>');
  }

  const token = parts[1];

  try {
    const decoded = jwtHandler.verifyAccessToken(token);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      companyId: decoded.companyId,
      groupId: decoded.groupId,
      permissions: decoded.permissions,
      roles: decoded.roles,
    };
    next();
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
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    next();
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    next();
    return;
  }

  try {
    const decoded = jwtHandler.verifyAccessToken(parts[1]);
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      companyId: decoded.companyId,
      groupId: decoded.groupId,
      permissions: decoded.permissions,
      roles: decoded.roles,
    };
  } catch {
    // Silently fail for optional auth
  }

  next();
}
