import jwt from 'jsonwebtoken';
import config from '@/config';
import { AuthError, TokenExpiredError } from '@/shared/exceptions/AppError';
import { v4 as uuidv4 } from 'uuid';
import { randomBytes } from 'crypto';

export interface TokenPayload {
  sub: string;
  email: string;
  companyId?: string;
  companyScope?: string[];
  groupId?: string;
  type: 'access' | 'refresh';
  jti: string;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  employeeId?: string;
  companyId?: string;
  companyScope?: string[];
  groupId?: string;
  permissions?: string[];
  roles?: string[];
}

export interface RefreshTokenPayload {
  sub: string;
  email: string;
  family: string;
}

export class JWTHandler {
  private static instance: JWTHandler;

  private constructor() {}

  static getInstance(): JWTHandler {
    if (!JWTHandler.instance) {
      JWTHandler.instance = new JWTHandler();
    }
    return JWTHandler.instance;
  }

  generateAccessToken(
    payload: Omit<AccessTokenPayload, 'permissions' | 'roles'> & {
      permissions?: string[];
      roles?: string[];
    }
  ): string {
    const jti = uuidv4();
    return jwt.sign(
      {
        ...payload,
        type: 'access',
        jti,
      },
      config.jwt.accessSecret,
      {
        expiresIn: config.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'],
        issuer: config.jwt.issuer,
        audience: 'hrms-api',
      }
    );
  }

  generateRefreshToken(payload: { sub: string; email: string; family: string }): string {
    const jti = uuidv4();
    return jwt.sign(
      {
        ...payload,
        type: 'refresh',
        jti,
      },
      config.jwt.refreshSecret,
      {
        expiresIn: config.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'],
        issuer: config.jwt.issuer,
        audience: 'hrms-api',
      }
    );
  }

  generateTokenFamily(): string {
    return randomBytes(32).toString('hex');
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.accessSecret, {
        issuer: config.jwt.issuer,
        audience: 'hrms-api',
      }) as jwt.JwtPayload & AccessTokenPayload;

      if (decoded.type !== 'access') {
        throw new AuthError('Invalid token type');
      }

      return {
        sub: decoded.sub,
        email: decoded.email,
        employeeId: decoded.employeeId,
        companyId: decoded.companyId,
        companyScope: decoded.companyScope,
        groupId: decoded.groupId,
        permissions: decoded.permissions,
        roles: decoded.roles,
      };
    } catch (error) {
      if (error instanceof AuthError) throw error;
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new AuthError('Invalid access token');
    }
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, config.jwt.refreshSecret, {
        issuer: config.jwt.issuer,
        audience: 'hrms-api',
      }) as jwt.JwtPayload & RefreshTokenPayload;

      if (decoded.type !== 'refresh') {
        throw new AuthError('Invalid token type');
      }

      return {
        sub: decoded.sub,
        email: decoded.email,
        family: decoded.family,
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new TokenExpiredError();
      }
      throw new AuthError('Invalid refresh token');
    }
  }

  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }
}

export const jwtHandler = JWTHandler.getInstance();
