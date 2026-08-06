import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreatePositionDTO, UpdatePositionDTO } from '../organization.dto';

export class PositionRepository {
  async findAll(companyId: string, departmentId?: string) {
    const where: Prisma.PositionWhereInput = {
      companyId,
      deletedAt: null,
    };
    if (departmentId) where.departmentId = departmentId;

    return prisma.position.findMany({
      where,
      include: {
        department: { select: { id: true, name: true } },
        reportsTo: { select: { id: true, name: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.position.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: true,
        reportsTo: true,
        subordinates: {
          where: { deletedAt: null },
          select: { id: true, name: true },
        },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.position.findUnique({ where: { code } });
  }

  async create(data: CreatePositionDTO & { code: string }) {
    return prisma.position.create({ data });
  }

  async update(id: string, data: UpdatePositionDTO) {
    return prisma.position.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.position.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const positionRepository = new PositionRepository();
