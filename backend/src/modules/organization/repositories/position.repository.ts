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

  // A code belongs to one company's structure, so the lookup is scoped by
  // company. deletedAt is deliberately not filtered: the unique index keeps
  // counting a soft-deleted row's code, so a conflict check that ignored those
  // rows would pass here and then fail on the database.
  async findByCode(companyId: string, code: string) {
    return prisma.position.findFirst({ where: { companyId, code } });
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
