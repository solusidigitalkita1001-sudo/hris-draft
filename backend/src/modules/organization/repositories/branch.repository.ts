import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateBranchDTO, UpdateBranchDTO, UpsertBranchAttendancePolicyDTO } from '../organization.dto';

export class BranchRepository {
  async findAll(companyId: string) {
    return prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      include: {
        company: true,
        attendancePolicy: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: {
        company: true,
        attendancePolicy: true,
      },
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

  async findAttendancePolicy(branchId: string) {
    return prisma.branchAttendancePolicy.findFirst({
      where: { branchId, deletedAt: null },
      include: {
        branch: true,
        company: true,
      },
    });
  }

  async upsertAttendancePolicy(branchId: string, companyId: string, data: UpsertBranchAttendancePolicyDTO) {
    return prisma.branchAttendancePolicy.upsert({
      where: { branchId },
      create: {
        branchId,
        companyId,
        ...data,
      },
      update: {
        ...data,
        deletedAt: null,
      },
      include: {
        branch: true,
        company: true,
      },
    });
  }

  async softDeleteAttendancePolicy(branchId: string) {
    return prisma.branchAttendancePolicy.updateMany({
      where: { branchId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

export const branchRepository = new BranchRepository();
