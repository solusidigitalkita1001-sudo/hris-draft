import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateLoanDTO, ApproveLoanDTO } from './employee-loan.dto';

export class EmployeeLoanRepository {
  // ─── Loan Types ───────────────────────────────────────
  async findLoanTypes(companyId: string) {
    return prisma.loanType.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  // ─── Loans ────────────────────────────────────────────
  async findAll(companyId: string, status?: string) {
    const where: Prisma.LoanWhereInput = { companyId };
    if (status) where.status = status as any;

    return prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        loanType: { select: { name: true } },
        _count: { select: { installments: true } },
      },
    });
  }

  async findMyLoans(employeeId: string, status?: string) {
    const where: Prisma.LoanWhereInput = { employeeId };
    if (status) where.status = status as any;

    return prisma.loan.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        loanType: { select: { name: true } },
        _count: { select: { installments: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.loan.findUnique({
      where: { id },
      include: {
        employee: { select: { fullName: true, employeeNumber: true } },
        loanType: { select: { name: true, maxAmount: true } },
        installments: { orderBy: { dueDate: 'asc' } },
      },
    });
  }

  async create(data: CreateLoanDTO & { companyId: string; employeeId: string; remainingBalance: number }) {
    return prisma.loan.create({ data: data as any });
  }

  async approve(id: string, approverId: string, data?: ApproveLoanDTO) {
    return prisma.loan.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
  }

  async reject(id: string, approverId: string, data?: ApproveLoanDTO) {
    return prisma.loan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        notes: data?.notes,
      },
    });
  }

  async cancel(id: string, employeeId: string) {
    return prisma.loan.updateMany({
      where: { id, employeeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  // ─── Installments ─────────────────────────────────────
  async getInstallments(loanId: string) {
    return prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async generateInstallments(loanId: string, total: number, amount: number, startDate: Date) {
    const installments = Array.from({ length: total }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return { loanId, amount, dueDate, status: 'PENDING' as const };
    });

    return prisma.loanInstallment.createMany({ data: installments });
  }
}

export const employeeLoanRepository = new EmployeeLoanRepository();
