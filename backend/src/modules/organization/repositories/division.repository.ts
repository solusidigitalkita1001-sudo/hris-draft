import prisma from '@/shared/database/prisma';
import { CreateDivisionDTO, UpdateDivisionDTO } from '../organization.dto';

export class DivisionRepository {
  async findAll(companyId: string) {
    return prisma.division.findMany({
      where: { companyId, deletedAt: null },
      include: {
        head: { select: { id: true, fullName: true } },
        _count: { select: { departments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.division.findFirst({
      where: { id, deletedAt: null },
      include: {
        head: { select: { id: true, fullName: true } },
        departments: {
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
        },
      },
    });
  }

  // A code belongs to one company's structure, so the lookup is scoped by
  // company. deletedAt is deliberately not filtered: the unique index keeps
  // counting a soft-deleted row's code, so a conflict check that ignored those
  // rows would pass here and then fail on the database.
  async findByCode(companyId: string, code: string) {
    return prisma.division.findFirst({ where: { companyId, code } });
  }

  async create(data: CreateDivisionDTO & { code: string }) {
    return prisma.division.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        headId: data.headId,
        description: data.description,
      },
    });
  }

  async update(id: string, data: UpdateDivisionDTO) {
    return prisma.division.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.division.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const divisionRepository = new DivisionRepository();
