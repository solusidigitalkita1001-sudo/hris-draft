import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateGroupDTO, UpdateGroupDTO } from '../organization.dto';

export class GroupRepository {
  async findAll(includeDeleted: boolean = false) {
    const where: Prisma.CompanyGroupWhereInput = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }

    return prisma.companyGroup.findMany({
      where,
      include: {
        _count: {
          select: { companies: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.companyGroup.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: { companies: true },
        },
        companies: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            code: true,
            status: true,
            _count: {
              select: {
                employees: true,
              },
            },
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.companyGroup.findUnique({
      where: { code },
    });
  }

  async create(data: CreateGroupDTO) {
    return prisma.companyGroup.create({
      data: {
        name: data.name,
        code: data.code,
        taxId: data.taxId,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
      },
    });
  }

  async update(id: string, data: UpdateGroupDTO) {
    return prisma.companyGroup.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return prisma.companyGroup.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const groupRepository = new GroupRepository();
