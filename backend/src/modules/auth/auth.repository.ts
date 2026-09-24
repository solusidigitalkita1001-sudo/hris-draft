import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';

export class AuthRepository {
  async findUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        sessionVersion: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        failedAttempts: true,
        lockedUntil: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        employeeId: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            companyId: true,
            company: {
              select: {
                id: true,
                groupId: true,
                name: true,
              },
            },
          },
        },
        userRoles: {
          where: {
            role: {
              deletedAt: null,
              status: 'ACTIVE',
            },
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        companyAccesses: {
          include: {
            company: {
              select: {
                id: true,
                groupId: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async findUserById(id: string) {
    return prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        sessionVersion: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        employeeId: true,
        employee: {
          select: {
            fullName: true,
            companyId: true,
            company: {
              select: {
                id: true,
                groupId: true,
                name: true,
              },
            },
          },
        },
        userRoles: {
          where: {
            role: {
              deletedAt: null,
              status: 'ACTIVE',
            },
          },
          include: {
            role: {
              include: {
                rolePermissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
        companyAccesses: {
          include: {
            company: {
              select: {
                id: true,
                groupId: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  async createRefreshToken(data: Prisma.RefreshTokenCreateInput) {
    return prisma.refreshToken.create({ data });
  }

  async findRefreshToken(tokenHash: string) {
    return prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
  }

  async revokeRefreshToken(id: string) {
    return prisma.refreshToken.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  async revokeRefreshTokenFamily(family: string, excludeId?: string) {
    const where: Prisma.RefreshTokenWhereInput = { family };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    return prisma.refreshToken.updateMany({
      where,
      data: { isRevoked: true },
    });
  }

  async createLoginLog(data: Prisma.LoginLogCreateInput) {
    return prisma.loginLog.create({ data });
  }

  async createLoginAttempt(data: Prisma.LoginAttemptCreateInput) {
    return prisma.loginAttempt.create({ data });
  }

  async getRecentLoginAttempts(userId: string, minutes: number) {
    const since = new Date(Date.now() - minutes * 60 * 1000);
    return prisma.loginAttempt.count({
      where: {
        userId,
        attemptedAt: { gte: since },
      },
    });
  }

  async updateUserLoginSuccess(userId: string) {
    // An expired lockout must fully restore the account: reset the LOCKED
    // status (it never healed before) and clear the stale failure rows that
    // would otherwise re-trigger the lockout on the next single failure.
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          lastLoginAt: new Date(),
          failedAttempts: 0,
          lockedUntil: null,
          status: 'ACTIVE',
        },
      }),
      prisma.loginAttempt.deleteMany({ where: { userId } }),
    ]);
    return user;
  }

  async incrementFailedAttempts(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        failedAttempts: { increment: 1 },
      },
    });
  }

  async lockUser(userId: string, lockDurationMinutes: number) {
    const lockedUntil = new Date(Date.now() + lockDurationMinutes * 60 * 1000);
    return prisma.user.update({
      where: { id: userId },
      data: {
        status: 'LOCKED' as any,
        lockedUntil,
      },
    });
  }

  async updatePassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordVersion: 2,
        sessionVersion: { increment: 1 },
        mustChangePassword: false,
      },
    });
  }

  async findPasswordResetUserByEmail(email: string) {
    return prisma.user.findFirst({
      where: { email, deletedAt: null },
      select: { id: true, email: true, status: true },
    });
  }

  async findRecentPasswordResetToken(userId: string, since: Date) {
    return prisma.passwordResetToken.findFirst({
      // Count every recent request, including a grant disabled after an SMTP
      // failure. Otherwise a broken provider would bypass the per-account
      // throttle and allow an unbounded request loop.
      where: { userId, createdAt: { gte: since } },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPasswordResetToken(data: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
    requestedIp?: string;
  }) {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: data.userId, usedAt: null },
        data: { usedAt: now },
      });
      return tx.passwordResetToken.create({
        data: {
          userId: data.userId,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          requestedIp: data.requestedIp?.substring(0, 50),
        },
      });
    });
  }

  async markPasswordResetTokenUsed(id: string) {
    return prisma.passwordResetToken.updateMany({
      where: { id, usedAt: null },
      data: { usedAt: new Date() },
    });
  }

  async findValidPasswordResetToken(tokenHash: string) {
    return prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userId: true,
        user: { select: { passwordHash: true, status: true, deletedAt: true } },
      },
    });
  }

  async consumePasswordResetToken(tokenHash: string, passwordHash: string): Promise<string | null> {
    const now = new Date();
    return prisma.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findFirst({
        where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
        select: {
          id: true,
          userId: true,
          user: { select: { status: true, deletedAt: true } },
        },
      });
      if (!token) return null;

      const claimed = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (claimed.count !== 1) return null;

      if (token.user.deletedAt || ['INACTIVE', 'SUSPENDED'].includes(token.user.status)) {
        return null;
      }

      await tx.user.update({
        where: { id: token.userId },
        data: {
          passwordHash,
          passwordVersion: 2,
          sessionVersion: { increment: 1 },
          mustChangePassword: false,
          failedAttempts: 0,
          lockedUntil: null,
          status: 'ACTIVE',
        },
      });
      await Promise.all([
        tx.refreshToken.updateMany({
          where: { userId: token.userId, isRevoked: false },
          data: { isRevoked: true },
        }),
        tx.passwordResetToken.updateMany({
          where: { userId: token.userId, usedAt: null },
          data: { usedAt: now },
        }),
        tx.loginAttempt.deleteMany({ where: { userId: token.userId } }),
      ]);
      return token.userId;
    });
  }

  // Silent Argon2 upgrade on login — does NOT touch mustChangePassword.
  async rehashPassword(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordVersion: 2 },
    });
  }

  async getUserSessions(userId: string) {
    return prisma.refreshToken.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    return prisma.refreshToken.update({
      where: { id: sessionId, userId },
      data: { isRevoked: true },
    });
  }

  async getUserPasswordHash(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { passwordHash: true },
    });
    return user?.passwordHash || null;
  }
}

export const authRepository = new AuthRepository();
