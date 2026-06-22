import { Request, Response, NextFunction } from 'express';
import { authService } from './auth.service';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { LoginDTO, RefreshTokenDTO, ChangePasswordDTO } from './auth.dto';

const logger = new WinstonLogger('AuthController');

/**
 * Auth Controller - handles HTTP request/response for authentication
 * No business logic here - purely delegation to AuthService
 */
export class AuthController {
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

      res.status(200).json(
        Result.success(result, 'Login successful')
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
      const { refreshToken } = req.body;
      await authService.logout(refreshToken);

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
      const dto: RefreshTokenDTO = req.body;
      const ipAddress = req.ip;
      const userAgent = req.headers['user-agent'];

      const result = await authService.refreshTokens(dto.refreshToken, ipAddress, userAgent);

      res.status(200).json(
        Result.success(result, 'Token refreshed successfully')
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
}

export const authController = new AuthController();
