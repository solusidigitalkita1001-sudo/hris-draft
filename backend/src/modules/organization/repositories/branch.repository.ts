import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateBranchDTO, UpdateBranchDTO } from '../organization.dto';

export class BranchRepository {
  async findAll(companyId: string) {
    return prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: { company: true },
    });
  }

  async findByCode(code: string) {
    return prisma.branch.findUnique({
      where: { code },
    });
  }

  async create(data: CreateBranchDTO) {
    return prisma.branch.create({ data });
  }

  async update(id: string, data: UpdateBranchDTO) {
    return prisma.branch.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const branchRepository = new BranchRepository();
