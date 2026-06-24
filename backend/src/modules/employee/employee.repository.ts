import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryDTO } from './employee.dto';

export class EmployeeRepository {
  async findAll(query: EmployeeQueryDTO) {
    const { companyId, departmentId, positionId, status, search, page, limit } = query;
    const where: Prisma.EmployeeWhereInput = { companyId, deletedAt: null };

    if (departmentId) where.departmentId = departmentId;
    if (positionId) where.positionId = positionId;
    if (status) where.employmentStatus = status as any;
    if (search) {
      where.OR = [
        { fullName: { contains: search } },
        { employeeNumber: { contains: search } },
        { email: { contains: search } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        include: {
          department: { select: { id: true, name: true } },
          position: { select: { id: true, name: true } },
          branch: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.employee.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    return prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        department: true,
        position: true,
        branch: true,
        subDepartment: true,
        user: { select: { id: true, email: true, status: true } },
        employeeSalaries: {
          where: { isActive: true },
          include: {
            components: { include: { salaryComponent: true } },
          },
          take: 1,
        },
        benefitEnrollments: {
          where: { status: 'ACTIVE' },
          include: { benefitPlan: { select: { id: true, name: true, type: true } } },
        },
      },
    });
  }

  async findByEmail(email: string) {
    return prisma.employee.findFirst({ where: { email, deletedAt: null } });
  }

  async findByEmployeeNumber(companyId: string, employeeNumber: string) {
    return prisma.employee.findFirst({ where: { companyId, employeeNumber, deletedAt: null } });
  }

  async create(data: CreateEmployeeDTO) {
    return prisma.employee.create({
      data: {
        ...data,
        fullName: `${data.firstName} ${data.lastName}`,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
      },
      include: {
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
        branch: { select: { id: true, name: true } },
      },
    });
  }

  async update(id: string, data: UpdateEmployeeDTO) {
    const updateData: Prisma.EmployeeUpdateInput = {};
    const fields: (keyof UpdateEmployeeDTO)[] = [
      'branchId', 'departmentId', 'subDepartmentId', 'positionId',
      'firstName', 'lastName', 'email', 'phone', 'idNumber',
      'placeOfBirth', 'gender', 'religion', 'maritalStatus', 'bloodType',
      'nationality', 'address', 'avatar', 'employmentType',
      'bankName', 'bankAccount', 'bankAccountHolder', 'taxId',
      'bpjsKetenagakerjaan', 'bpjsKesehatan',
    ];

    for (const field of fields) {
      if (data[field] !== undefined) {
        (updateData as any)[field] = data[field];
      }
    }
    if (data.firstName !== undefined || data.lastName !== undefined) {
      updateData.fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    if (data.joinDate !== undefined) updateData.joinDate = new Date(data.joinDate);

    return prisma.employee.update({ where: { id }, data: updateData });
  }

  async softDelete(id: string) {
    return prisma.employee.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async updateStatus(id: string, status: string) {
    return prisma.employee.update({
      where: { id },
      data: { employmentStatus: status as any },
    });
  }
}

export const employeeRepository = new EmployeeRepository();
