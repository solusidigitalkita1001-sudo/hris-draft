import prisma from '@/shared/database/prisma';
import type { CreateEWARequestDTO } from './ewa.dto';
import type { EWATransactionStatus, Prisma } from '@prisma/client';

type CreateWithMeta = CreateEWARequestDTO & {
  companyId: string;
  employeeId: string;
  requestCode: string;
  periodStart: Date;
  periodEnd: Date;
  earnedGrossReference: number;
  earnedGrossAtRequest: number;
  maxAllowedPercent: number;
  maxAllowedAtRequest: number;
  totalApprovedSamePeriod: number;
};

export class EWARepository {
  async create(data: CreateWithMeta, client: Prisma.TransactionClient | typeof prisma = prisma) {
    return client.earnedWageAccess.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        requestCode: data.requestCode,
        payrollPeriodId: data.payrollPeriodId ?? null,
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        earnedGrossReference: data.earnedGrossReference,
        earnedGrossAtRequest: data.earnedGrossAtRequest,
        maxAllowedPercent: data.maxAllowedPercent,
        maxAllowedAtRequest: data.maxAllowedAtRequest,
        totalApprovedSamePeriod: data.totalApprovedSamePeriod,
        amountRequested: data.amountRequested,
        adminFee: data.adminFee ?? 0,
        reason: data.reason ?? null,
      },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
    });
  }

  async findByEmployeePeriodStatus(
    companyId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
    statuses: EWATransactionStatus[],
    client: Prisma.TransactionClient | typeof prisma = prisma,
  ) {
    return client.earnedWageAccess.findMany({
      where: {
        companyId,
        employeeId,
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        status: { in: statuses },
      },
    });
  }

  async findById(id: string) {
    return prisma.earnedWageAccess.findFirst({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
          },
        },
      },
    });
  }

  async findByRequestCode(requestCode: string, client: Prisma.TransactionClient | typeof prisma = prisma) {
    return client.earnedWageAccess.findFirst({
      where: { requestCode },
      select: { id: true },
    });
  }

  async findAll(companyId: string, filters: { status?: EWATransactionStatus; employeeId?: string }) {
    return prisma.earnedWageAccess.findMany({
      where: {
        companyId,
        status: filters.status ?? undefined,
        employeeId: filters.employeeId ?? undefined,
      },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true, branchId: true, departmentId: true } } },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async findMyRequests(employeeId: string, status?: EWATransactionStatus) {
    return prisma.earnedWageAccess.findMany({
      where: {
        employeeId,
        status: status ?? undefined,
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async updateStatus(
    id: string,
    data: {
      status: EWATransactionStatus;
      approverId?: string;
      approvedAt?: Date;
      approverNotes?: string;
      rejectReason?: string;
      financeDisburserId?: string;
      paidOutAt?: Date;
      amountPaidOut?: number;
      disbursementReference?: string;
      payrollRunId?: string;
      deductedAt?: Date;
      amountDeductedPayroll?: number;
      cancelledBy?: string;
      cancelledAt?: Date;
    },
  ) {
    return prisma.earnedWageAccess.update({
      where: { id },
      data,
    });
  }

  async findByPayrollRunId(runId: string) {
    return prisma.earnedWageAccess.findMany({
      where: { payrollRunId: runId },
    });
  }

  async findPAIDByEmployeeAndPeriod(companyId: string, employeeId: string | 'all', periodStart: Date, periodEnd: Date) {
    return prisma.earnedWageAccess.findMany({
      where: {
        companyId,
        employeeId: employeeId !== 'all' ? employeeId : undefined,
        status: 'PAID',
        periodStart: { lte: periodEnd },
        periodEnd: { gte: periodStart },
        payrollRunId: null,
      },
      select: {
        id: true,
        employeeId: true,
        amountRequested: true,
        amountPaidOut: true,
        adminFee: true,
        status: true,
      },
    });
  }

  async bulkMarkDeducted(ids: string[], payrollRunId: string, deductedAt: Date, amountMap: Record<string, number>) {
    const transactions = ids.map((id) =>
      prisma.earnedWageAccess.update({
        where: { id },
        data: {
          status: 'DEDUCTED',
          payrollRunId,
          deductedAt,
          amountDeductedPayroll: amountMap[id] ?? undefined,
        },
      }),
    );
    return prisma.$transaction(transactions);
  }
}

export const ewaRepository = new EWARepository();
