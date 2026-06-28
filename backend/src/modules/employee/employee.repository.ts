import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryDTO, CreateCareerTransactionDTO } from './employee.dto';

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
        careerTransactions: {
          where: { deletedAt: null },
          include: {
            fromBranch: { select: { id: true, name: true } },
            toBranch: { select: { id: true, name: true } },
            fromDepartment: { select: { id: true, name: true } },
            toDepartment: { select: { id: true, name: true } },
            fromPosition: { select: { id: true, name: true } },
            toPosition: { select: { id: true, name: true } },
            creator: { select: { id: true, email: true } },
          },
          orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });
  }

  async findCareerTransactions(employeeId: string) {
    return prisma.employeeCareerTransaction.findMany({
      where: { employeeId, deletedAt: null },
      include: {
        fromBranch: { select: { id: true, name: true } },
        toBranch: { select: { id: true, name: true } },
        fromDepartment: { select: { id: true, name: true } },
        toDepartment: { select: { id: true, name: true } },
        fromPosition: { select: { id: true, name: true } },
        toPosition: { select: { id: true, name: true } },
        creator: { select: { id: true, email: true } },
      },
      orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
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

  async createCareerTransaction(
    employeeId: string,
    createdBy: string | undefined,
    data: CreateCareerTransactionDTO
  ) {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        positionId: true,
        employmentType: true,
      },
    });

    if (!employee) {
      return null;
    }

    return prisma.$transaction(async (tx) => {
      const transaction = await tx.employeeCareerTransaction.create({
        data: {
          employeeId,
          companyId: employee.companyId,
          transactionType: data.transactionType,
          effectiveDate: new Date(data.effectiveDate),
          fromBranchId: employee.branchId,
          toBranchId: data.toBranchId || null,
          fromDepartmentId: employee.departmentId,
          toDepartmentId: data.toDepartmentId || null,
          fromPositionId: employee.positionId,
          toPositionId: data.toPositionId || null,
          fromEmploymentType: employee.employmentType,
          toEmploymentType: data.toEmploymentType || null,
          referenceNumber: data.referenceNumber,
          reason: data.reason,
          notes: data.notes,
          createdBy,
        },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          fromDepartment: { select: { id: true, name: true } },
          toDepartment: { select: { id: true, name: true } },
          fromPosition: { select: { id: true, name: true } },
          toPosition: { select: { id: true, name: true } },
          creator: { select: { id: true, email: true } },
        },
      });

      const updateData: Prisma.EmployeeUpdateInput = {};

      if (data.toBranchId !== undefined) {
        updateData.branch = data.toBranchId ? { connect: { id: data.toBranchId } } : { disconnect: true };
      }
      if (data.toDepartmentId !== undefined) {
        updateData.department = data.toDepartmentId ? { connect: { id: data.toDepartmentId } } : { disconnect: true };
      }
      if (data.toPositionId !== undefined) {
        updateData.position = data.toPositionId ? { connect: { id: data.toPositionId } } : { disconnect: true };
      }
      if (data.toEmploymentType !== undefined && data.toEmploymentType !== null) {
        updateData.employmentType = data.toEmploymentType;
      }

      if (Object.keys(updateData).length > 0) {
        await tx.employee.update({
          where: { id: employeeId },
          data: updateData,
        });
      }

      return transaction;
    });
  }
}

export const employeeRepository = new EmployeeRepository();
