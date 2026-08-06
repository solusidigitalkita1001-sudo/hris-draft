import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateDepartmentDTO, UpdateDepartmentDTO } from '../organization.dto';

export class DepartmentRepository {
  async findAll(companyId: string, divisionId?: string) {
    const where: Prisma.DepartmentWhereInput = {
      companyId,
      deletedAt: null,
      parentId: null, // Top-level departments only by default
    };
    if (divisionId) where.divisionId = divisionId;

    return prisma.department.findMany({
      where,
      include: {
        head: { select: { id: true, fullName: true } },
        _count: {
          select: {
            children: true,
            subDepartments: true,
            positions: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.department.findFirst({
      where: { id, deletedAt: null },
      include: {
        head: { select: { id: true, fullName: true } },
        division: true,
        parent: true,
        children: {
          where: { deletedAt: null },
          include: {
            _count: { select: { positions: true } },
          },
        },
        subDepartments: {
          where: { deletedAt: null },
        },
        positions: {
          where: { deletedAt: null },
          take: 10,
        },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.department.findUnique({ where: { code } });
  }

  async create(data: CreateDepartmentDTO & { code: string }) {
    return prisma.department.create({
      data: {
        divisionId: data.divisionId,
        companyId: data.companyId,
        parentId: data.parentId,
        name: data.name,
        code: data.code,
        headId: data.headId,
        description: data.description,
        costCenter: data.costCenter,
      },
    });
  }

  async update(id: string, data: UpdateDepartmentDTO) {
    return prisma.department.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.department.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async getHierarchy(companyId: string) {
    return prisma.department.findMany({
      where: { companyId, deletedAt: null, parentId: null },
      include: {
        head: { select: { id: true, fullName: true } },
        children: {
          where: { deletedAt: null },
          include: {
            head: { select: { id: true, fullName: true } },
            subDepartments: {
              where: { deletedAt: null },
              include: {
                head: { select: { id: true, fullName: true } },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }
}

export const departmentRepository = new DepartmentRepository();
