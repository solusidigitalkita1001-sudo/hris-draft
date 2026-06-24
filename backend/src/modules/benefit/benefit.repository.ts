import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateBenefitPlanDTO,
  UpdateBenefitPlanDTO,
  CreateBenefitEnrollmentDTO,
  UpdateBenefitEnrollmentDTO,
} from './benefit.dto';

export class BenefitRepository {
  // ==================== Benefit Plans ====================

  async findAllPlans(companyId: string) {
    return prisma.benefitPlan.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: { select: { enrollments: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findPlanById(id: string) {
    return prisma.benefitPlan.findFirst({
      where: { id, deletedAt: null },
      include: {
        enrollments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: { id: true, fullName: true, employeeNumber: true },
            },
          },
        },
        _count: { select: { enrollments: true } },
      },
    });
  }

  async findPlanByCode(companyId: string, code: string) {
    return prisma.benefitPlan.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createPlan(data: CreateBenefitPlanDTO) {
    return prisma.benefitPlan.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        type: data.type,
        description: data.description,
        provider: data.provider,
        isTaxable: data.isTaxable,
        employeeContribution: data.employeeContribution,
        employerContribution: data.employerContribution,
        maxAmount: data.maxAmount,
        effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : undefined,
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
      },
    });
  }

  async updatePlan(id: string, data: UpdateBenefitPlanDTO) {
    const updateData: Prisma.BenefitPlanUpdateInput = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.provider !== undefined) updateData.provider = data.provider;
    if (data.isTaxable !== undefined) updateData.isTaxable = data.isTaxable;
    if (data.employeeContribution !== undefined) updateData.employeeContribution = data.employeeContribution;
    if (data.employerContribution !== undefined) updateData.employerContribution = data.employerContribution;
    if (data.maxAmount !== undefined) updateData.maxAmount = data.maxAmount;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);

    return prisma.benefitPlan.update({
      where: { id },
      data: updateData,
    });
  }

  async softDeletePlan(id: string) {
    return prisma.benefitPlan.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ==================== Benefit Enrollments ====================

  async findAllEnrollments(companyId: string, employeeId?: string) {
    const where: Prisma.BenefitEnrollmentWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;

    return prisma.benefitEnrollment.findMany({
      where,
      include: {
        benefitPlan: {
          select: { id: true, name: true, type: true, code: true },
        },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
      orderBy: { enrollmentDate: 'desc' },
    });
  }

  async findEnrollmentById(id: string) {
    return prisma.benefitEnrollment.findFirst({
      where: { id, deletedAt: null },
      include: {
        benefitPlan: true,
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async findActiveEnrollment(employeeId: string, benefitPlanId: string) {
    return prisma.benefitEnrollment.findFirst({
      where: {
        employeeId,
        benefitPlanId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });
  }

  async createEnrollment(data: CreateBenefitEnrollmentDTO) {
    return prisma.benefitEnrollment.create({
      data: {
        benefitPlanId: data.benefitPlanId,
        employeeId: data.employeeId,
        companyId: data.companyId,
        effectiveDate: new Date(data.effectiveDate),
        expiryDate: data.expiryDate ? new Date(data.expiryDate) : undefined,
        coverageDetails: data.coverageDetails,
      },
      include: {
        benefitPlan: {
          select: { id: true, name: true, type: true, code: true },
        },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async updateEnrollment(id: string, data: UpdateBenefitEnrollmentDTO) {
    const updateData: Prisma.BenefitEnrollmentUpdateInput = {};

    if (data.effectiveDate !== undefined) updateData.effectiveDate = new Date(data.effectiveDate);
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate);
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.coverageDetails !== undefined) updateData.coverageDetails = data.coverageDetails;

    return prisma.benefitEnrollment.update({
      where: { id },
      data: updateData,
      include: {
        benefitPlan: {
          select: { id: true, name: true, type: true },
        },
        employee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async softDeleteEnrollment(id: string) {
    return prisma.benefitEnrollment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}

export const benefitRepository = new BenefitRepository();
