import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateCompanyDTO, UpdateCompanyDTO } from '../organization.dto';

export class CompanyRepository {
  async findAll(groupId?: string, includeDeleted: boolean = false, allowedCompanyIds?: string[]) {
    if (allowedCompanyIds && allowedCompanyIds.length === 0) {
      return [];
    }

    const where: Prisma.CompanyWhereInput = {};
    if (!includeDeleted) {
      where.deletedAt = null;
    }
    if (groupId) {
      where.groupId = groupId;
    }
    if (allowedCompanyIds && allowedCompanyIds.length > 0) {
      where.id = { in: allowedCompanyIds };
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

  async findById(id: string, allowedCompanyIds?: string[]) {
    if (allowedCompanyIds && allowedCompanyIds.length === 0) {
      return null;
    }

    const where: Prisma.CompanyWhereInput = {
      id,
      deletedAt: null,
    };

    if (allowedCompanyIds && allowedCompanyIds.length > 0) {
      where.id = { in: allowedCompanyIds.filter((companyId) => companyId === id) };
    }

    return prisma.company.findFirst({
      where,
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

  async create(data: CreateCompanyDTO & { code: string }) {
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
