import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeQueryDTO, CreateCareerTransactionDTO,
  CreateEmployeeFamilyDTO, UpdateEmployeeFamilyDTO,
  CreateEmployeeEducationDTO, UpdateEmployeeEducationDTO,
  CreateEmployeeEmergencyContactDTO, UpdateEmployeeEmergencyContactDTO,
  CreateEmployeeTrainingDTO, UpdateEmployeeTrainingDTO,
  CreateEmployeeSkillDTO, UpdateEmployeeSkillDTO,
  CreateEmployeeExperienceDTO, UpdateEmployeeExperienceDTO,
  CreateEmployeeAttachmentDTO, UpdateEmployeeAttachmentDTO,
} from './employee.dto';

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
        companyAssignments: {
          include: {
            company: { select: { id: true, name: true, code: true, groupId: true } },
            approver: { select: { id: true, email: true } },
          },
          orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
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

  async findCompanyAssignments(employeeId: string) {
    return prisma.employeeCompanyAssignment.findMany({
      where: { employeeId },
      include: {
        company: { select: { id: true, name: true, code: true, groupId: true } },
        approver: { select: { id: true, email: true } },
      },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findCompanyAssignmentById(id: string) {
    return prisma.employeeCompanyAssignment.findUnique({
      where: { id },
      include: {
        company: { select: { id: true, name: true, code: true, groupId: true } },
        approver: { select: { id: true, email: true } },
      },
    });
  }

  async createCompanyAssignment(
    employeeId: string,
    data: {
      companyId: string;
      assignmentType: 'PRIMARY' | 'SECONDMENT' | 'TRANSFER';
      startDate: Date;
      endDate?: Date | null;
      reason?: string;
      approvedBy?: string | null;
    }
  ) {
    return prisma.employeeCompanyAssignment.create({
      data: {
        ...data,
        employeeId,
      },
      include: {
        company: { select: { id: true, name: true, code: true, groupId: true } },
        approver: { select: { id: true, email: true } },
      },
    });
  }

  async updateCompanyAssignment(
    id: string,
    data: {
      companyId?: string;
      assignmentType?: 'PRIMARY' | 'SECONDMENT' | 'TRANSFER';
      startDate?: Date;
      endDate?: Date | null;
      reason?: string;
      approvedBy?: string | null;
    }
  ) {
    return prisma.employeeCompanyAssignment.update({
      where: { id },
      data,
      include: {
        company: { select: { id: true, name: true, code: true, groupId: true } },
        approver: { select: { id: true, email: true } },
      },
    });
  }

  async deleteCompanyAssignment(id: string) {
    return prisma.employeeCompanyAssignment.delete({ where: { id } });
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

  // ============================================================
  // Employee Family
  // ============================================================
  async findFamilies(employeeId: string) {
    return prisma.employeeFamily.findMany({
      where: { employeeId },
      orderBy: [{ orderSequence: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createFamily(employeeId: string, data: CreateEmployeeFamilyDTO) {
    return prisma.employeeFamily.create({
      data: {
        ...data,
        employeeId,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
      },
    });
  }

  async updateFamily(id: string, data: UpdateEmployeeFamilyDTO) {
    const updateData: Prisma.EmployeeFamilyUpdateInput = {};
    const fields: (keyof UpdateEmployeeFamilyDTO)[] = [
      'fullName', 'relationship', 'idNumber', 'placeOfBirth', 'gender', 'religion',
      'occupation', 'phone', 'address', 'isEmergencyContact', 'isDependent',
      'maritalStatus', 'educationLevel', 'orderSequence',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    if (data.dateOfBirth !== undefined) updateData.dateOfBirth = new Date(data.dateOfBirth);
    return prisma.employeeFamily.update({ where: { id }, data: updateData });
  }

  async deleteFamily(id: string) {
    return prisma.employeeFamily.delete({ where: { id } });
  }

  // ============================================================
  // Employee Education
  // ============================================================
  async findEducations(employeeId: string) {
    return prisma.employeeEducation.findMany({
      where: { employeeId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createEducation(employeeId: string, data: CreateEmployeeEducationDTO) {
    return prisma.employeeEducation.create({
      data: {
        ...data,
        employeeId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async updateEducation(id: string, data: UpdateEmployeeEducationDTO) {
    const updateData: Prisma.EmployeeEducationUpdateInput = {};
    const fields: (keyof UpdateEmployeeEducationDTO)[] = [
      'level', 'institutionName', 'major', 'degree', 'isGraduated', 'gpa', 'city', 'notes',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    return prisma.employeeEducation.update({ where: { id }, data: updateData });
  }

  async deleteEducation(id: string) {
    return prisma.employeeEducation.delete({ where: { id } });
  }

  // ============================================================
  // Employee Emergency Contact
  // ============================================================
  async findEmergencyContacts(employeeId: string) {
    return prisma.employeeEmergencyContact.findMany({
      where: { employeeId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createEmergencyContact(employeeId: string, data: CreateEmployeeEmergencyContactDTO) {
    return prisma.employeeEmergencyContact.create({
      data: { ...data, employeeId },
    });
  }

  async updateEmergencyContact(id: string, data: UpdateEmployeeEmergencyContactDTO) {
    const updateData: Prisma.EmployeeEmergencyContactUpdateInput = {};
    const fields: (keyof UpdateEmployeeEmergencyContactDTO)[] = [
      'fullName', 'relationship', 'phone', 'alternativePhone', 'address', 'isPrimary', 'notes',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    return prisma.employeeEmergencyContact.update({ where: { id }, data: updateData });
  }

  async deleteEmergencyContact(id: string) {
    return prisma.employeeEmergencyContact.delete({ where: { id } });
  }

  // ============================================================
  // Employee Training
  // ============================================================
  async findTrainings(employeeId: string) {
    return prisma.employeeTraining.findMany({
      where: { employeeId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createTraining(employeeId: string, data: CreateEmployeeTrainingDTO) {
    return prisma.employeeTraining.create({
      data: {
        ...data,
        employeeId,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async updateTraining(id: string, data: UpdateEmployeeTrainingDTO) {
    const updateData: Prisma.EmployeeTrainingUpdateInput = {};
    const fields: (keyof UpdateEmployeeTrainingDTO)[] = [
      'trainingName', 'organizer', 'duration', 'trainingType', 'description', 'certificateUrl', 'notes',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    return prisma.employeeTraining.update({ where: { id }, data: updateData });
  }

  async deleteTraining(id: string) {
    return prisma.employeeTraining.delete({ where: { id } });
  }

  // ============================================================
  // Employee Skill
  // ============================================================
  async findSkills(employeeId: string) {
    return prisma.employeeSkill.findMany({
      where: { employeeId },
      orderBy: [{ yearsOfExperience: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createSkill(employeeId: string, data: CreateEmployeeSkillDTO) {
    return prisma.employeeSkill.create({
      data: {
        ...data,
        employeeId,
        lastUsedDate: data.lastUsedDate ? new Date(data.lastUsedDate) : undefined,
      },
    });
  }

  async updateSkill(id: string, data: UpdateEmployeeSkillDTO) {
    const updateData: Prisma.EmployeeSkillUpdateInput = {};
    const fields: (keyof UpdateEmployeeSkillDTO)[] = [
      'skillName', 'category', 'proficiencyLevel', 'yearsOfExperience', 'isCertified', 'notes',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    if (data.lastUsedDate !== undefined) updateData.lastUsedDate = new Date(data.lastUsedDate);
    return prisma.employeeSkill.update({ where: { id }, data: updateData });
  }

  async deleteSkill(id: string) {
    return prisma.employeeSkill.delete({ where: { id } });
  }

  // ============================================================
  // Employee Experience
  // ============================================================
  async findExperiences(employeeId: string) {
    return prisma.employeeExperience.findMany({
      where: { employeeId },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createExperience(employeeId: string, data: CreateEmployeeExperienceDTO) {
    return prisma.employeeExperience.create({
      data: {
        ...data,
        employeeId,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    });
  }

  async updateExperience(id: string, data: UpdateEmployeeExperienceDTO) {
    const updateData: Prisma.EmployeeExperienceUpdateInput = {};
    const fields: (keyof UpdateEmployeeExperienceDTO)[] = [
      'companyName', 'position', 'isCurrentPosition', 'jobDescription', 'achievements',
      'industry', 'city', 'reasonForLeaving', 'referenceName', 'referencePhone',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate);
    if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate);
    return prisma.employeeExperience.update({ where: { id }, data: updateData });
  }

  async deleteExperience(id: string) {
    return prisma.employeeExperience.delete({ where: { id } });
  }

  // ============================================================
  // Employee Attachment
  // ============================================================
  async findAttachments(employeeId: string, category?: string) {
    const where: Prisma.EmployeeAttachmentWhereInput = { employeeId };
    if (category) where.category = category;
    return prisma.employeeAttachment.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async createAttachment(employeeId: string, data: CreateEmployeeAttachmentDTO) {
    return prisma.employeeAttachment.create({
      data: { ...data, employeeId },
    });
  }

  async updateAttachment(id: string, data: UpdateEmployeeAttachmentDTO) {
    const updateData: Prisma.EmployeeAttachmentUpdateInput = {};
    const fields: (keyof UpdateEmployeeAttachmentDTO)[] = [
      'category', 'fileName', 'fileUrl', 'originalName', 'fileSize', 'mimeType', 'description',
    ];
    for (const field of fields) {
      if (data[field] !== undefined) (updateData as any)[field] = data[field];
    }
    return prisma.employeeAttachment.update({ where: { id }, data: updateData });
  }

  async deleteAttachment(id: string) {
    return prisma.employeeAttachment.delete({ where: { id } });
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
