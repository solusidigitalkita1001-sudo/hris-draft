import prisma from '@/shared/database/prisma';
import { UpdateSubDepartmentDTO, CreateSubDepartmentDTO } from '../organization.dto';

export class SubDepartmentRepository {
  async findAll(departmentId: string) {
    return prisma.subDepartment.findMany({
      where: { departmentId, deletedAt: null },
      include: {
        head: { select: { id: true, fullName: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(id: string) {
    return prisma.subDepartment.findFirst({
      where: { id, deletedAt: null },
      include: { department: true, head: true },
    });
  }

  async findByCode(code: string) {
    return prisma.subDepartment.findUnique({ where: { code } });
  }

  async create(data: CreateSubDepartmentDTO & { code: string }) {
    const department = await prisma.department.findFirst({
      where: { id: data.departmentId, deletedAt: null },
      select: { companyId: true },
    });
    if (!department) return null;
    return prisma.subDepartment.create({
      data: { ...data, companyId: department.companyId },
    });
  }

  async update(id: string, data: UpdateSubDepartmentDTO) {
    return prisma.subDepartment.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.subDepartment.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const subDepartmentRepository = new SubDepartmentRepository();
