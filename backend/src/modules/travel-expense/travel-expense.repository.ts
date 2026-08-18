import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import type {
  ApproveBusinessTripDTO,
  ApproveExpenseClaimDTO,
  CreateBusinessTripDTO,
  CreateExpenseClaimDTO,
  CreateTravelAdvanceDTO,
  ReimburseExpenseClaimDTO,
} from './travel-expense.dto';
import { BadRequestError } from '@/shared/exceptions/AppError';

const EXPENSE_CATEGORIES = [
  { value: 'TRANSPORTATION', label: 'Transportasi' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'MEAL', label: 'Makan' },
  { value: 'ENTERTAINMENT', label: 'Entertainment' },
  { value: 'OPERATIONAL', label: 'Operasional' },
] as const;

export class TravelExpenseRepository {
  getExpenseCategories() {
    return EXPENSE_CATEGORIES;
  }

  async findDefaultTemplateTrip(companyId: string) {
    return prisma.workflowTemplate.findFirst({
      where: { companyId, approvalType: 'BUSINESS_TRIP', resource: 'travel', isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findDefaultTemplateClaim(companyId: string) {
    return prisma.workflowTemplate.findFirst({
      where: { companyId, approvalType: 'EXPENSE_CLAIM', resource: 'travel', isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInstanceByTripId(tripId: string) {
    return prisma.workflowInstance.findFirst({
      where: { referenceType: 'BUSINESS_TRIP', referenceId: tripId },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: true,
      },
    });
  }

  async findInstanceByClaimId(claimId: string) {
    return prisma.workflowInstance.findFirst({
      where: { referenceType: 'EXPENSE_CLAIM', referenceId: claimId },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: true,
      },
    });
  }

  async findTrips(companyId: string, status?: string) {
    const where: Prisma.BusinessTripWhereInput = { companyId };
    if (status) where.status = status as any;

    return prisma.businessTrip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        travelAdvances: { orderBy: { createdAt: 'desc' } },
        _count: { select: { expenseClaims: true } },
      },
    });
  }

  async findMyTrips(employeeId: string, status?: string) {
    const where: Prisma.BusinessTripWhereInput = { employeeId };
    if (status) where.status = status as any;

    return prisma.businessTrip.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        travelAdvances: { orderBy: { createdAt: 'desc' } },
        _count: { select: { expenseClaims: true } },
      },
    });
  }

  async createTrip(data: CreateBusinessTripDTO & { companyId: string }) {
    return prisma.businessTrip.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        destination: data.destination,
        purpose: data.purpose,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        estimatedCost: data.estimatedCost as any,
        notes: data.notes,
      },
    });
  }

  async findTripById(id: string) {
    return prisma.businessTrip.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        travelAdvances: { orderBy: { createdAt: 'desc' } },
        expenseClaims: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findClaimById(id: string) {
    return prisma.expenseClaim.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        trip: { select: { id: true, destination: true, startDate: true, endDate: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        reimbursements: { orderBy: { processedAt: 'desc' } },
      },
    });
  }

  async applyApprovalTripEffects(tripId: string, approverId: string) {
    return prisma.businessTrip.update({
      where: { id: tripId },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
      },
    });
  }

  async finalizeRejectTripEffects(tripId: string, approverId: string, rejectionReason?: string) {
    return prisma.businessTrip.update({
      where: { id: tripId },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: rejectionReason,
      },
    });
  }

  async applyApprovalClaimEffects(claimId: string, approverId: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: 'APPROVED',
        },
      });

      await tx.expenseApproval.create({
        data: {
          claimId,
          approverId,
          level: 1,
          status: 'APPROVED',
          approvedAt: new Date(),
        },
      });

      return claim;
    });
  }

  async finalizeRejectClaimEffects(claimId: string, approverId: string, rejectionReason?: string) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.update({
        where: { id: claimId },
        data: {
          status: 'REJECTED',
          notes: rejectionReason,
        },
      });

      await tx.expenseApproval.create({
        data: {
          claimId,
          approverId,
          level: 1,
          status: 'REJECTED',
          notes: rejectionReason,
          approvedAt: new Date(),
        },
      });

      return claim;
    });
  }

  async approveTrip(id: string, _approverId: string, _data?: ApproveBusinessTripDTO) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy approve');
  }

  async rejectTrip(id: string, _approverId: string, _data?: ApproveBusinessTripDTO) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy reject');
  }

  async approveClaim(id: string, _approverId: string, _data?: ApproveExpenseClaimDTO) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy approve');
  }

  async rejectClaim(id: string, _approverId: string, _data?: ApproveExpenseClaimDTO) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy reject');
  }

  async createAdvance(tripId: string, data: CreateTravelAdvanceDTO & { companyId: string }) {
    return prisma.travelAdvance.create({
      data: {
        tripId,
        companyId: data.companyId,
        amount: data.amount as any,
        disbursedAt: data.disbursedAt ? new Date(data.disbursedAt) : new Date(),
        notes: data.notes,
      },
    });
  }

  async findClaims(companyId: string, status?: string) {
    const where: Prisma.ExpenseClaimWhereInput = { companyId };
    if (status) where.status = status as any;

    return prisma.expenseClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        trip: { select: { id: true, destination: true, startDate: true, endDate: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        reimbursements: { orderBy: { processedAt: 'desc' } },
      },
    });
  }

  async findMyClaims(employeeId: string, status?: string) {
    const where: Prisma.ExpenseClaimWhereInput = { employeeId };
    if (status) where.status = status as any;

    return prisma.expenseClaim.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        trip: { select: { id: true, destination: true, startDate: true, endDate: true } },
        approvals: { orderBy: { createdAt: 'desc' } },
        reimbursements: { orderBy: { processedAt: 'desc' } },
      },
    });
  }

  async createClaim(data: CreateExpenseClaimDTO & { companyId: string }) {
    return prisma.expenseClaim.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        tripId: data.tripId,
        category: data.category,
        amount: data.amount as any,
        description: data.description,
        expenseDate: new Date(data.expenseDate),
        receiptFilePath: data.receiptFilePath,
        ocrExtractedAmount: data.ocrExtractedAmount as any,
        notes: data.notes,
      },
    });
  }

  async reimburseClaim(id: string, processedBy: string, data: ReimburseExpenseClaimDTO & { companyId: string }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.expenseClaim.findUnique({
        where: { id },
        select: { amount: true },
      });

      const reimbursementAmount = data.amount ?? Number(existing?.amount ?? 0);

      const reimbursement = await tx.reimbursement.create({
        data: {
          claimId: id,
          companyId: data.companyId,
          method: data.method,
          amount: reimbursementAmount as any,
          processedBy,
          payrollDetailId: data.payrollDetailId,
          notes: data.notes,
        },
      });

      await tx.expenseClaim.update({
        where: { id },
        data: {
          status: 'REIMBURSED',
          notes: data.notes,
        },
      });

      return reimbursement;
    });
  }
}

export const travelExpenseRepository = new TravelExpenseRepository();
