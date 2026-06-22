import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import prisma from '@/shared/database/prisma';
import { authRepository } from './auth.repository';
import { jwtHandler } from '@/shared/security/JWTHandler';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import {
  AuthError,
  ForbiddenError,
  TooManyRequestsError,
  ConflictError,
} from '@/shared/exceptions/AppError';
import config from '@/config';
import { AuthResponse, LoginDTO, ChangePasswordDTO } from './auth.dto';

const logger = new WinstonLogger('AuthService');

export class AuthService {
  /**
   * Authenticate user with email and password
   * Implements rate limiting, account lockout, and token rotation
   */
  async login(dto: LoginDTO, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    const { email, password } = dto;

    // Log login attempt
    logger.logLoginAttempt(email, false, ipAddress, 'in progress');

    // Find user
    const user = await authRepository.findUserByEmail(email);

    if (!user) {
      await this.logFailedAttempt(null, email, ipAddress, 'User not found');
      throw new AuthError('Invalid email or password');
    }

    // Check account status
    this.validateUserStatus(user);

    // Check rate limiting (brute force protection)
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.logFailedAttempt(user.id, email, ipAddress, 'Account locked');
      throw new TooManyRequestsError(
        `Account is locked. Try again after ${user.lockedUntil.toLocaleTimeString()}`
      );
    }

    // Verify password
    const isPasswordValid = await passwordHandler.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      await this.handleFailedAttempt(user.id, email, ipAddress);
      throw new AuthError('Invalid email or password');
    }

    // Check recent failed attempts
    const recentAttempts = await authRepository.getRecentLoginAttempts(
      user.id,
      config.password.lockoutDurationMinutes
    );

    if (recentAttempts >= config.password.maxLoginAttempts) {
      await authRepository.lockUser(user.id, config.password.lockoutDurationMinutes);
      await this.logFailedAttempt(user.id, email, ipAddress, 'Max attempts reached');
      throw new TooManyRequestsError(
        `Too many failed attempts. Account locked for ${config.password.lockoutDurationMinutes} minutes.`
      );
    }

    // Success - reset failed attempts and update last login
    await authRepository.updateUserLoginSuccess(user.id);

    // Generate tokens
    const tokens = await this.generateTokens(user, ipAddress, userAgent);

    // Create login log
    await authRepository.createLoginLog({
      user: { connect: { id: user.id } },
      email: user.email,
      status: 'SUCCESS',
      ipAddress,
      userAgent: userAgent?.substring(0, 500),
    });

    // Log success
    logger.logLoginAttempt(email, true, ipAddress);

    // Publish event
    await eventBus.publish({
      name: DomainEvents.USER_LOGGED_IN,
      aggregateId: user.id,
      aggregateType: 'User',
      data: { email, ipAddress },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
        correlationId: ipAddress,
      },
    });

    // Build response
    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
        )
      ),
    ];

    return {
      user: {
        id: user.id,
        email: user.email,
        employeeId: user.employeeId || undefined,
        name: user.employee?.fullName,
        roles,
        permissions,
        companyId: user.employee?.companyId || undefined,
        groupId: user.employee?.company?.groupId || undefined,
        mustChangePassword: user.mustChangePassword,
      },
      tokens,
    };
  }

  /**
   * Logout user - revoke refresh token
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await authRepository.findRefreshToken(tokenHash);

    if (storedToken) {
      await authRepository.revokeRefreshToken(storedToken.id);

      await eventBus.publish({
        name: DomainEvents.USER_LOGGED_OUT,
        aggregateId: storedToken.userId,
        aggregateType: 'User',
        data: {},
        metadata: {
          eventId: uuidv4(),
          occurredAt: new Date(),
        },
      });
    }
  }

  /**
   * Refresh access token using refresh token with rotation
   */
  async refreshTokens(refreshToken: string, ipAddress?: string, userAgent?: string): Promise<AuthResponse> {
    // Verify JWT
    const decoded = jwtHandler.verifyRefreshToken(refreshToken);
    const tokenHash = this.hashToken(refreshToken);
    const storedToken = await authRepository.findRefreshToken(tokenHash);

    if (!storedToken || storedToken.isRevoked) {
      // Token reuse detected - revoke entire family
      if (storedToken?.family) {
        await authRepository.revokeRefreshTokenFamily(storedToken.family);
      }
      throw new AuthError('Invalid refresh token');
    }

    if (storedToken.expiresAt < new Date()) {
      await authRepository.revokeRefreshToken(storedToken.id);
      throw new AuthError('Refresh token has expired');
    }

    // Revoke old token (rotation)
    await authRepository.revokeRefreshToken(storedToken.id);

    // Find user
    const user = await authRepository.findUserById(decoded.sub);
    if (!user) {
      throw new AuthError('User not found');
    }

    this.validateUserStatus(user);

    // Generate new tokens
    const tokens = await this.generateTokens(
      { ...user, id: decoded.sub, email: decoded.email },
      ipAddress,
      userAgent,
      decoded.family
    );

    // Create login log
    await authRepository.createLoginLog({
      user: { connect: { id: decoded.sub } },
      email: decoded.email,
      status: 'SUCCESS',
      ipAddress,
      userAgent: userAgent?.substring(0, 500),
    });

    // Publish event
    await eventBus.publish({
      name: DomainEvents.TOKEN_REFRESHED,
      aggregateId: decoded.sub,
      aggregateType: 'User',
      data: { family: decoded.family },
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
        )
      ),
    ];

    return {
      user: {
        id: user.id,
        email: user.email,
        employeeId: user.employeeId || undefined,
        name: user.employee?.fullName,
        roles,
        permissions,
        companyId: user.employee?.companyId || undefined,
        groupId: user.employee?.company?.groupId || undefined,
        mustChangePassword: user.mustChangePassword,
      },
      tokens,
    };
  }

  /**
   * Change password for authenticated user
   */
  async changePassword(userId: string, dto: ChangePasswordDTO): Promise<void> {
    const { currentPassword, newPassword } = dto;

    // Validate password policy
    passwordHandler.validate(newPassword);

    // Verify current password
    const currentHash = await authRepository.getUserPasswordHash(userId);
    if (!currentHash) {
      throw new AuthError('User not found');
    }

    const isCurrentValid = await passwordHandler.compare(currentPassword, currentHash);
    if (!isCurrentValid) {
      throw new AuthError('Current password is incorrect');
    }

    // Check new password != current password
    const isSame = await passwordHandler.compare(newPassword, currentHash);
    if (isSame) {
      throw new ConflictError('New password must be different from current password');
    }

    // Hash and save new password
    const newHash = await passwordHandler.hash(newPassword);
    await authRepository.updatePassword(userId, newHash);

    // Revoke all refresh tokens for this user (force re-login)
    await prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });

    logger.security(`Password changed for user ${userId}`);

    await eventBus.publish({
      name: DomainEvents.PASSWORD_CHANGED,
      aggregateId: userId,
      aggregateType: 'User',
      data: {},
      metadata: {
        eventId: uuidv4(),
        occurredAt: new Date(),
      },
    });
  }

  /**
   * Get active sessions for a user
   */
  async getSessions(userId: string) {
    return authRepository.getUserSessions(userId);
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string, userId: string) {
    await authRepository.revokeSession(sessionId, userId);
  }

  /**
   * Get current user profile with permissions
   */
  async getProfile(userId: string) {
    const user = await authRepository.findUserById(userId);
    if (!user) {
      throw new AuthError('User not found');
    }

    const roles = user.userRoles.map((ur) => ur.role.code);
    const permissions = [
      ...new Set(
        user.userRoles.flatMap((ur) =>
          ur.role.rolePermissions.map((rp) => `${rp.permission.resource}:${rp.permission.action}`)
        )
      ),
    ];

    return {
      id: user.id,
      email: user.email,
      employeeId: user.employeeId || undefined,
      name: user.employee?.fullName,
      companyId: user.employee?.companyId || undefined,
      companyName: user.employee?.company?.name || undefined,
      groupId: user.employee?.company?.groupId || undefined,
      roles,
      permissions,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ==================== Private Methods ====================

  private async generateTokens(
    user: { id: string; email: string },
    ipAddress?: string,
    userAgent?: string,
    existingFamily?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const family = existingFamily || jwtHandler.generateTokenFamily();
    const accessToken = jwtHandler.generateAccessToken({
      sub: user.id,
      email: user.email,
    });

    const refreshToken = jwtHandler.generateRefreshToken({
      sub: user.id,
      email: user.email,
      family,
    });

    // Store refresh token
    const tokenHash = this.hashToken(refreshToken);
    const decodedRefresh = jwtHandler.decodeToken(refreshToken);

    // Parse JWT expiration
    const expiresInMs = config.jwt.refreshExpiresIn;
    const expiresInSeconds = this.parseExpiryToSeconds(expiresInMs);
    const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);

    await authRepository.createRefreshToken({
      user: { connect: { id: user.id } },
      tokenHash,
      family,
      expiresAt,
      userAgent: userAgent?.substring(0, 500),
      ipAddress,
    });

    const accessExpiresInSeconds = this.parseExpiryToSeconds(config.jwt.accessExpiresIn);

    return {
      accessToken,
      refreshToken,
      expiresIn: accessExpiresInSeconds,
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private validateUserStatus(user: any): void {
    if (user.status === 'INACTIVE') {
      throw new ForbiddenError('Account is inactive. Contact your administrator.');
    }
    if (user.status === 'SUSPENDED') {
      throw new ForbiddenError('Account has been suspended. Contact your administrator.');
    }
    if (user.status === 'LOCKED') {
      if (user.lockedUntil && user.lockedUntil > new Date()) {
        throw new TooManyRequestsError(
          `Account is locked until ${user.lockedUntil.toLocaleTimeString()}`
        );
      }
    }
  }

  private async handleFailedAttempt(userId: string, email: string, ipAddress?: string): Promise<void> {
    await authRepository.incrementFailedAttempts(userId);

    const recentAttempts = await authRepository.getRecentLoginAttempts(
      userId,
      config.password.lockoutDurationMinutes
    );

    if (recentAttempts >= config.password.maxLoginAttempts) {
      await authRepository.lockUser(userId, config.password.lockoutDurationMinutes);
      await this.logFailedAttempt(userId, email, ipAddress, 'Account locked due to max attempts');
    } else {
      await this.logFailedAttempt(userId, email, ipAddress, 'Invalid password');
    }
  }

  private async logFailedAttempt(
    userId: string | null,
    email: string,
    ipAddress?: string,
    reason?: string
  ): Promise<void> {
    const loginLogData: any = {
      email,
      status: 'FAILED',
      ipAddress,
      failReason: reason,
    };
    if (userId) {
      loginLogData.user = { connect: { id: userId } };
    }
    await authRepository.createLoginLog(loginLogData);

    if (userId) {
      await authRepository.createLoginAttempt({
        user: { connect: { id: userId } },
        ipAddress,
      });
    }

    logger.logLoginAttempt(email, false, ipAddress, reason);
  }

  private parseExpiryToSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) return 900; // default 15 min

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's': return value;
      case 'm': return value * 60;
      case 'h': return value * 3600;
      case 'd': return value * 86400;
      default: return 900;
    }
  }
}

export const authService = new AuthService();
