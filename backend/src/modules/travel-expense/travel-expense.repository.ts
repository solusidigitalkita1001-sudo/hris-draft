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

  async approveTrip(id: string, approverId: string, data?: ApproveBusinessTripDTO) {
    return prisma.businessTrip.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
  }

  async rejectTrip(id: string, approverId: string, data?: ApproveBusinessTripDTO) {
    return prisma.businessTrip.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approvedBy: approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
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

  async approveClaim(id: string, approverId: string, data?: ApproveExpenseClaimDTO) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: 'APPROVED',
          notes: data?.notes,
        },
      });

      await tx.expenseApproval.create({
        data: {
          claimId: id,
          approverId,
          level: 1,
          status: 'APPROVED',
          notes: data?.notes,
          approvedAt: new Date(),
        },
      });

      return claim;
    });
  }

  async rejectClaim(id: string, approverId: string, data?: ApproveExpenseClaimDTO) {
    return prisma.$transaction(async (tx) => {
      const claim = await tx.expenseClaim.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: data?.notes,
        },
      });

      await tx.expenseApproval.create({
        data: {
          claimId: id,
          approverId,
          level: 1,
          status: 'REJECTED',
          notes: data?.notes,
          approvedAt: new Date(),
        },
      });

      return claim;
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
