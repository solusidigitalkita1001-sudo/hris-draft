import prisma from '@/shared/database/prisma';
import { CreateBranchDTO, UpdateBranchDTO, UpsertBranchAttendancePolicyDTO } from '../organization.dto';

export class BranchRepository {
  async findAll(companyId: string) {
    const branches = await prisma.branch.findMany({
      where: { companyId, deletedAt: null },
      include: {
        company: true,
        // Kartu daftar cabang menampilkan ringkasan policy; tanpa include ini
        // UI selalu menganggap policy "belum dikonfigurasi".
        attendancePolicies: { where: { deletedAt: null }, take: 1 },
      },
      orderBy: { name: 'asc' },
    });
    return branches.map(({ attendancePolicies, ...branch }) => ({
      ...branch,
      attendancePolicy: attendancePolicies[0] ?? null,
    }));
  }

  async findById(id: string) {
    return prisma.branch.findFirst({
      where: { id, deletedAt: null },
      include: { company: true },
    });
  }

  // A code belongs to one company's structure, so the lookup is scoped by
  // company. deletedAt is deliberately not filtered: the unique index keeps
  // counting a soft-deleted row's code, so a conflict check that ignored those
  // rows would pass here and then fail on the database.
  async findByCode(companyId: string, code: string) {
    return prisma.branch.findFirst({ where: { companyId, code } });
  }

  async create(data: CreateBranchDTO & { code: string }) {
    return prisma.branch.create({ data });
  }

  async update(id: string, data: UpdateBranchDTO) {
    return prisma.branch.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.branch.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async findAttendancePolicy(branchId: string, companyId: string) {
    return prisma.branchAttendancePolicy.findFirst({
      where: { branchId, companyId, deletedAt: null },
      include: {
        branch: true,
        company: true,
      },
    });
  }

  async upsertAttendancePolicy(branchId: string, companyId: string, data: UpsertBranchAttendancePolicyDTO) {
    return prisma.branchAttendancePolicy.upsert({
      where: { companyId_branchId: { companyId, branchId } },
      create: { branchId, companyId, ...data },
      update: { ...data, deletedAt: null },
      include: { branch: true, company: true },
    });
  }

  async softDeleteAttendancePolicy(branchId: string, companyId: string) {
    return prisma.branchAttendancePolicy.updateMany({
      where: { branchId, companyId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }

  // Company-level default policy (branchId = null)
  async findCompanyDefaultPolicy(companyId: string) {
    return prisma.branchAttendancePolicy.findFirst({
      where: { companyId, branchId: null, deletedAt: null },
      include: { company: true },
    });
  }

  async upsertCompanyDefaultPolicy(companyId: string, data: UpsertBranchAttendancePolicyDTO) {
    const existing = await this.findCompanyDefaultPolicy(companyId);
    if (existing) {
      return prisma.branchAttendancePolicy.update({
        where: { id: existing.id },
        data: { ...data, deletedAt: null },
        include: { company: true },
      });
    }
    return prisma.branchAttendancePolicy.create({
      data: { companyId, branchId: null, ...data },
      include: { company: true },
    });
  }

  async softDeleteCompanyDefaultPolicy(companyId: string) {
    return prisma.branchAttendancePolicy.updateMany({
      where: { companyId, branchId: null, deletedAt: null },
      data: { deletedAt: new Date() },
    });
  }
}

export const branchRepository = new BranchRepository();
