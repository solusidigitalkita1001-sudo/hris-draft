import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';

export class UserRepository {
  async findAll(
    page: number = 1,
    limit: number = 20,
    filters?: { companyId?: string; search?: string }
  ) {
    const skip = (page - 1) * limit;
    const where: Prisma.UserWhereInput = { deletedAt: null };

    if (filters?.companyId) {
      where.OR = [
        { employee: { companyId: filters.companyId } },
        { userRoles: { some: { companyId: filters.companyId } } },
        { companyAccesses: { some: { companyId: filters.companyId } } },
      ];
    }

    if (filters?.search) {
      const existingAnd = Array.isArray(where.AND)
        ? where.AND
        : where.AND
          ? [where.AND]
          : [];

      where.AND = [
        ...existingAnd,
        {
          OR: [
            { email: { contains: filters.search } },
            { employee: { fullName: { contains: filters.search } } },
            { employee: { employeeNumber: { contains: filters.search } } },
          ],
        },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
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
          userRoles: {
            include: {
              role: {
                select: { id: true, name: true, code: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.user.count({ where }),
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
        companyAccesses: {
          include: {
            company: {
              select: { id: true, name: true, code: true, groupId: true },
            },
            group: {
              select: { id: true, name: true, code: true },
            },
          },
          orderBy: [{ accessScope: 'desc' }, { createdAt: 'desc' }],
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

  async findCompanyAccesses(userId: string) {
    return prisma.userCompanyAccess.findMany({
      where: { userId },
      include: {
        company: {
          select: { id: true, name: true, code: true, groupId: true },
        },
        group: {
          select: { id: true, name: true, code: true },
        },
      },
      orderBy: [{ accessScope: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findCompanyAccessById(id: string) {
    return prisma.userCompanyAccess.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, code: true, groupId: true },
        },
        group: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async findCompanyAccessByUserAndCompany(userId: string, companyId: string) {
    return prisma.userCompanyAccess.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
  }

  async createCompanyAccess(data: Prisma.UserCompanyAccessUncheckedCreateInput) {
    return prisma.userCompanyAccess.create({
      data,
      include: {
        company: {
          select: { id: true, name: true, code: true, groupId: true },
        },
        group: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async updateCompanyAccess(id: string, data: Prisma.UserCompanyAccessUncheckedUpdateInput) {
    return prisma.userCompanyAccess.update({
      where: { id },
      data,
      include: {
        company: {
          select: { id: true, name: true, code: true, groupId: true },
        },
        group: {
          select: { id: true, name: true, code: true },
        },
      },
    });
  }

  async deleteCompanyAccess(id: string) {
    return prisma.userCompanyAccess.delete({ where: { id } });
  }
}

export const userRepository = new UserRepository();
