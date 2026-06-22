import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          status: true,
          lastLoginAt: true,
          mustChangePassword: true,
          createdAt: true,
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeNumber: true,
              company: { select: { id: true, name: true } },
            },
          },
          _count: { select: { userRoles: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where: { deletedAt: null } }),
    ]);

    return { data, total, page, limit };
  }

  async findById(id: string) {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        status: true,
        mustChangePassword: true,
        lastLoginAt: true,
        createdAt: true,
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            company: { select: { id: true, name: true } },
          },
        },
        userRoles: {
          include: {
            role: {
              select: { id: true, name: true, code: true },
            },
          },
        },
      },
    });
  }

  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput) {
    return prisma.user.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const userRepository = new UserRepository();
