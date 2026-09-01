import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { LoginDTO, ChangePasswordDTO, MfaCodeDTO } from './auth.dto';
import config from '@/config';
import { clearCsrfToken, issueCsrfToken } from '@/shared/middleware/CsrfProtection';

const logger = new WinstonLogger('AuthController');

const ACCESS_COOKIE = 'at';
const REFRESH_COOKIE = 'rt';

const ACCESS_COOKIE_OPTS = {
  httpOnly: true,
  secure: config.app.env === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 15 * 60 * 1000,
};

const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: config.app.env === 'production',
  sameSite: 'lax' as const,
  path: '/api/v1/auth',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function setAccessCookie(res: Response, token: string) {
  res.cookie(ACCESS_COOKIE, token, ACCESS_COOKIE_OPTS);
}

function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, REFRESH_COOKIE_OPTS);
}

function clearAccessCookie(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { ...ACCESS_COOKIE_OPTS, maxAge: 0 });
}

function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, { ...REFRESH_COOKIE_OPTS, maxAge: 0 });
}

function getRefreshToken(req: Request): string | undefined {
  return req.cookies?.[REFRESH_COOKIE] ?? req.body?.refreshToken;
}

function extractAccessToken(req: Request): string | undefined {
  if (req.cookies?.[ACCESS_COOKIE]) {
    return req.cookies[ACCESS_COOKIE];
  }
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  return undefined;
}

/**
 * Auth Controller - handles HTTP request/response for authentication
 * No business logic here - purely delegation to AuthService
 */
export class AuthController {
  /** GET /api/v1/auth/csrf — bootstrap signed double-submit cookie. */
  csrfToken(_req: Request, res: Response): void {
    issueCsrfToken(res);
    res.status(200).json(Result.success(null, 'CSRF token issued'));
  }

  /**
   * POST /api/v1/auth/login
   * Authenticate user with email and password
   */
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: LoginDTO = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await authService.login(dto, ipAddress, userAgent);

      setAccessCookie(res, result.tokens.accessToken);
      setRefreshCookie(res, result.tokens.refreshToken);
      issueCsrfToken(res);

      res.status(200).json(
        Result.success(
          {
            user: result.user,
            tokens: { expiresIn: result.tokens.expiresIn },
          },
          'Login successful'
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/logout
   * Logout user and revoke refresh token
   */
  async logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = getRefreshToken(req) ?? '';
      await authService.logout(refreshToken);
      clearAccessCookie(res);
      clearRefreshCookie(res);
      clearCsrfToken(res);

      res.status(200).json(Result.success(null, 'Logout successful'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   */
  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = getRefreshToken(req);
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      if (!refreshToken) throw new Error('No refresh token');
      const result = await authService.refreshTokens(refreshToken, ipAddress, userAgent);

      setAccessCookie(res, result.tokens.accessToken);
      setRefreshCookie(res, result.tokens.refreshToken);
      issueCsrfToken(res);

      res.status(200).json(
        Result.success(
          {
            user: result.user,
            tokens: { expiresIn: result.tokens.expiresIn },
          },
          'Token refreshed successfully'
        )
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v1/auth/change-password
   * Change password for authenticated user
   */
  async changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: ChangePasswordDTO = req.body;
      await authService.changePassword(req.user!.id, dto);

      res.status(200).json(Result.success(null, 'Password changed successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Get current user profile with permissions
   */
  async getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const profile = await authService.getProfile(req.user!.id);

      res.status(200).json(Result.success(profile, 'Profile retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/v1/auth/sessions
   * Get all active sessions
   */
  async getSessions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const sessions = await authService.getSessions(req.user!.id);

      res.status(200).json(Result.success(sessions, 'Sessions retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/v1/auth/sessions/:id
   * Revoke a specific session
   */
  async revokeSession(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await authService.revokeSession(req.params.id as string, req.user!.id);

      res.status(200).json(Result.success(null, 'Session revoked successfully'));
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/mfa/setup */
  async setupMfa(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.setupMfa(req.user!.id);
      res.status(200).json(Result.success(result, 'Scan the QR with your authenticator app'));
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/mfa/enable */
  async enableMfa(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: MfaCodeDTO = req.body;
      const result = await authService.enableMfa(req.user!.id, dto.code);
      res.status(200).json(Result.success(result, 'MFA enabled. Store your recovery codes safely.'));
    } catch (error) {
      next(error);
    }
  }

  /** POST /api/v1/auth/mfa/disable */
  async disableMfa(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto: MfaCodeDTO = req.body;
      await authService.disableMfa(req.user!.id, dto.code);
      res.status(200).json(Result.success(null, 'MFA disabled'));
    } catch (error) {
      next(error);
    }
  }
}

export const authController = new AuthController();
