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
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        failedAttempts: true,
        lockedUntil: true,
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
    return prisma.user.update({
      where: { id: userId },
      data: {
        lastLoginAt: new Date(),
        failedAttempts: 0,
        lockedUntil: null,
      },
    });
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
        mustChangePassword: false,
      },
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
