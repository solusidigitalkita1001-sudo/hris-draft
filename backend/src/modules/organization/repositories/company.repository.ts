import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateCompanyDTO, UpdateCompanyDTO } from '../organization.dto';

export class CompanyRepository {
  async findAll(groupId?: string, includeDeleted: boolean = false) {
    const where: Prisma.CompanyWhereInput = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (groupId) {
      where.groupId = groupId;
    }

    return prisma.company.findMany({
      where,
      include: {
        _count: {
          select: {
            branches: true,
            divisions: true,
            departments: true,
            employees: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.company.findFirst({
      where: { id, deletedAt: null },
      include: {
        group: true,
        _count: {
          select: {
            branches: true,
            divisions: true,
            departments: true,
            employees: true,
          },
        },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.company.findUnique({
      where: { code },
      include: { group: true },
    });
  }

  async create(data: CreateCompanyDTO) {
    return prisma.company.create({
      data: {
        groupId: data.groupId,
        name: data.name,
        code: data.code,
        taxId: data.taxId,
        address: data.address,
        phone: data.phone,
        email: data.email,
        website: data.website,
        timezone: data.timezone,
        dateFormat: data.dateFormat,
        fiscalYearStart: data.fiscalYearStart,
        currency: data.currency,
      },
    });
  }

  async update(id: string, data: UpdateCompanyDTO) {
    return prisma.company.update({
      where: { id },
      data,
    });
  }

  async softDelete(id: string) {
    return prisma.company.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const companyRepository = new CompanyRepository();
