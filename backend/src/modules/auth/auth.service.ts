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
  AppError,
  AuthError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  ConflictError,
} from '@/shared/exceptions/AppError';
import config from '@/config';
import { AuthResponse, LoginDTO, ChangePasswordDTO } from './auth.dto';
import {
  generateTotpSecret,
  totpAuthUrl,
  totpQrDataUrl,
  verifyTotp,
  generateRecoveryCodes,
} from '@/shared/security/mfa';

const logger = new WinstonLogger('AuthService');

export class AuthService {
  private async buildAuthContext(user: any) {
    const roles: string[] = user.userRoles.map((ur: any) => ur.role.code);
    const permissions = Array.from(
      new Set<string>(
        user.userRoles.flatMap((ur: any) =>
          ur.role.rolePermissions.map(
            (rp: any) => `${rp.permission.resource}:${rp.permission.action}` as string
          )
        )
      )
    );

    // Finding #1: Role hierarchy priority untuk guard privilege escalation.
    const hasGlobalRole: boolean = user.userRoles.some(
      (ur: any) => ur.scopeType === 'GLOBAL' || ur.role?.scope === 'GLOBAL',
    );
    const maxRolePriority: number = Math.max(
      0,
      ...user.userRoles.map((ur: any) => Number(ur.role?.priority ?? 0)),
    );

    const companyScope = new Set<string>();
    const primaryCompanyId =
      user.employee?.companyId || user.userRoles.find((ur: any) => ur.companyId)?.companyId;
    const groupId =
      user.employee?.company?.groupId ||
      user.companyAccesses?.find((access: any) => access.groupId)?.groupId ||
      user.companyAccesses?.find((access: any) => access.company?.groupId)?.company?.groupId ||
      user.userRoles.find((ur: any) => ur.groupId)?.groupId;

    if (primaryCompanyId) {
      companyScope.add(primaryCompanyId);
    }

    user.userRoles.forEach((ur: any) => {
      if (ur.companyId) {
        companyScope.add(ur.companyId);
      }
    });

    user.companyAccesses?.forEach((access: any) => {
      if (access.companyId) {
        companyScope.add(access.companyId);
      }
    });

    const hasGroupWideScope = user.userRoles.some(
      (ur: any) =>
        ur.scopeType === 'GROUP' ||
        ur.role?.scope === 'GROUP' ||
        (!!ur.groupId && !ur.companyId)
    ) || user.companyAccesses?.some((access: any) => access.accessScope === 'GROUP_WIDE');

    if (groupId && hasGroupWideScope) {
      const companies = await prisma.company.findMany({
        where: {
          groupId,
          deletedAt: null,
        },
        select: { id: true },
      });

      companies.forEach((company) => companyScope.add(company.id));
    }

    return {
      id: user.id,
      email: user.email,
      employeeId: user.employeeId || undefined,
      name: user.employee?.fullName,
      roles,
      permissions,
      companyId: primaryCompanyId || undefined,
      companyScope: Array.from(companyScope),
      groupId: groupId || undefined,
      hasGlobalRole,
      maxRolePriority,
      mustChangePassword: user.mustChangePassword,
    };
  }

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

    // Task 1.5: transparently upgrade legacy bcrypt hashes to Argon2id on login.
    if (passwordHandler.needsRehash(user.passwordHash)) {
      const upgraded = await passwordHandler.hash(password);
      await authRepository.rehashPassword(user.id, upgraded);
    }

    // Task 1.1: MFA second factor. Password was correct; now require TOTP/recovery.
    if (user.twoFactorEnabled) {
      if (!dto.totp) {
        throw new AppError('MFA code required', 401, 'MFA_REQUIRED', true);
      }
      const mfaOk = await this.verifyMfaCode(user.id, user.twoFactorSecret, dto.totp);
      if (!mfaOk) {
        await this.handleFailedAttempt(user.id, email, ipAddress);
        throw new AuthError('Invalid MFA code');
      }
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
    const authUser = await this.buildAuthContext(user);
    const tokens = await this.generateTokens(authUser, ipAddress, userAgent);

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
    return {
      user: authUser,
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

  // ==================== MFA (Task 1.1) ====================

  /** Verify a 6-digit TOTP, or consume a one-time recovery code. */
  private async verifyMfaCode(
    userId: string,
    secret: string | null,
    code: string
  ): Promise<boolean> {
    if (secret && verifyTotp(secret, code)) return true;

    // Fall back to recovery codes (hashed, single-use).
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { twoFactorRecoveryCodes: true },
    });
    const hashes: string[] = user?.twoFactorRecoveryCodes
      ? JSON.parse(user.twoFactorRecoveryCodes)
      : [];
    for (let i = 0; i < hashes.length; i++) {
      if (await passwordHandler.compare(code.trim().toUpperCase(), hashes[i])) {
        hashes.splice(i, 1); // consume
        await prisma.user.update({
          where: { id: userId },
          data: { twoFactorRecoveryCodes: JSON.stringify(hashes) },
        });
        return true;
      }
    }
    return false;
  }

  /** Step 1: generate a secret + QR. MFA not active until enableMfa() confirms a code. */
  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    if (user.twoFactorEnabled) throw new BadRequestError('MFA is already enabled');

    const secret = generateTotpSecret();
    const otpauthUrl = totpAuthUrl(user.email, secret);
    await prisma.user.update({ where: { id: userId }, data: { twoFactorSecret: secret } });

    return { secret, otpauthUrl, qrDataUrl: await totpQrDataUrl(otpauthUrl) };
  }

  /** Step 2: confirm a code, activate MFA, return one-time recovery codes (shown once). */
  async enableMfa(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    if (user.twoFactorEnabled) throw new BadRequestError('MFA is already enabled');
    if (!user.twoFactorSecret) throw new BadRequestError('Call MFA setup first');
    if (!verifyTotp(user.twoFactorSecret, code)) throw new BadRequestError('Invalid MFA code');

    const recoveryCodes = generateRecoveryCodes();
    const hashes = await Promise.all(recoveryCodes.map((c) => passwordHandler.hash(c)));
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true, twoFactorRecoveryCodes: JSON.stringify(hashes) },
    });
    logger.info('MFA enabled', { userId });
    return { recoveryCodes };
  }

  /** Disable MFA after verifying a current TOTP/recovery code. */
  async disableMfa(userId: string, code: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');
    if (!user.twoFactorEnabled) throw new BadRequestError('MFA is not enabled');
    if (!(await this.verifyMfaCode(userId, user.twoFactorSecret, code))) {
      throw new BadRequestError('Invalid MFA code');
    }
    await prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null, twoFactorRecoveryCodes: null },
    });
    logger.info('MFA disabled', { userId });
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
    const authUser = await this.buildAuthContext(user);
    const tokens = await this.generateTokens(authUser, ipAddress, userAgent, decoded.family);

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

    return {
      user: authUser,
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

    const authUser = await this.buildAuthContext(user);

    return {
      ...authUser,
      companyName: user.employee?.company?.name || undefined,
      lastLoginAt: user.lastLoginAt,
    };
  }

  // ==================== Private Methods ====================

  private async generateTokens(
    user: {
      id: string;
      email: string;
      employeeId?: string;
      companyId?: string;
      companyScope: string[];
      groupId?: string;
      permissions: string[];
      roles: string[];
      hasGlobalRole: boolean;
      maxRolePriority: number;
    },
    ipAddress?: string,
    userAgent?: string,
    existingFamily?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const family = existingFamily || jwtHandler.generateTokenFamily();
    const accessToken = jwtHandler.generateAccessToken({
      sub: user.id,
      email: user.email,
      employeeId: user.employeeId,
      companyId: user.companyId,
      companyScope: user.companyScope,
      groupId: user.groupId,
      permissions: user.permissions,
      roles: user.roles,
      hasGlobalRole: user.hasGlobalRole,
      maxRolePriority: user.maxRolePriority,
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
