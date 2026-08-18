import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateLoanDTO, ApproveLoanDTO } from './employee-loan.dto';
import { generateAmortizationSchedule, AmortizationMethod } from '@/shared/payroll/amortization';
import { BadRequestError } from '@/shared/exceptions/AppError';

export class EmployeeLoanRepository {
  // ─── Loan Types ───────────────────────────────────────
  async findLoanTypes(companyId: string) {
    return prisma.loanType.findMany({
      where: { companyId, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
  }

  async findLoanTypeById(id: string) {
    return prisma.loanType.findFirst({ where: { id, deletedAt: null } });
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

  async findWorkflowTemplateDefault(companyId: string) {
    return prisma.workflowTemplate.findFirst({
      where: { companyId, approvalType: 'LOAN_REQUEST', resource: 'employee-loan', isActive: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInstanceByLoanId(loanId: string) {
    return prisma.workflowInstance.findFirst({
      where: { referenceType: 'LOAN_REQUEST', referenceId: loanId },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: true,
      },
    });
  }

  async applyApprovalEffects(id: string, approverId: string) {
    return prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id } });
      if (!loan) return null;

      const updatedLoan = await tx.loan.update({
        where: { id },
        data: {
          status: 'ACTIVE',
          approverId,
          approvedAt: new Date(),
        },
      });

      const existingInstallments = await tx.loanInstallment.count({
        where: { loanId: id },
      });

      if (existingInstallments === 0 && loan.totalInstallments > 0) {
        const amount = Number(loan.installmentAmount);
        const installments = Array.from({ length: loan.totalInstallments }, (_, i) => {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + i + 1);
          return {
            loanId: id,
            amount,
            dueDate,
            status: 'PENDING' as const,
          };
        });

        await tx.loanInstallment.createMany({ data: installments });
      }

      return updatedLoan;
    });
  }

  async finalizeRejectEffects(id: string, approverId: string, rejectionReason?: string) {
    return prisma.loan.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        notes: rejectionReason,
      },
    });
  }

  async approve(
    id: string,
    approverId: string,
    _loan: { totalInstallments: number; installmentAmount: Prisma.Decimal | number },
    _data?: ApproveLoanDTO
  ) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy approve');
  }

  async reject(id: string, approverId: string, data?: ApproveLoanDTO) {
    throw new BadRequestError('Use workflow action endpoint instead of legacy reject');
  }

  async cancel(id: string, employeeId: string) {
    return prisma.loan.updateMany({
      where: { id, employeeId, status: 'PENDING' },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Bangun tabel amortisasi (pokok + bunga per bulan) untuk sebuah pinjaman
   * berdasarkan pokok pinjaman, suku bunga LoanType, dan tenor. Read-only (tidak persist).
   */
  async buildAmortization(loanId: string, method: AmortizationMethod = 'FLAT') {
    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      include: { loanType: { select: { name: true, interestRate: true } } },
    });
    if (!loan) return null;

    const schedule = generateAmortizationSchedule({
      principal: Number(loan.amount),
      annualRatePercent: Number(loan.loanType.interestRate),
      tenorMonths: loan.totalInstallments,
      method,
    });

    return {
      loanId: loan.id,
      loanType: loan.loanType.name,
      principal: Number(loan.amount),
      annualRatePercent: Number(loan.loanType.interestRate),
      tenorMonths: loan.totalInstallments,
      ...schedule,
    };
  }

  // ─── Installments ─────────────────────────────────────
  async getInstallments(loanId: string) {
    return prisma.loanInstallment.findMany({
      where: { loanId },
      orderBy: { dueDate: 'asc' },
    });
  }

  async generateInstallments(loanId: string, total: number, amount: number, startDate: Date) {
    if (total <= 0) {
      return { count: 0 };
    }

    const installments = Array.from({ length: total }, (_, i) => {
      const dueDate = new Date(startDate);
      dueDate.setMonth(dueDate.getMonth() + i + 1);
      return { loanId, amount, dueDate, status: 'PENDING' as const };
    });

    return prisma.loanInstallment.createMany({ data: installments });
  }

  async findDueInstallmentsForPayroll(companyId: string, periodEndDate: Date) {
    return prisma.loanInstallment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: { lte: periodEndDate },
        loan: {
          companyId,
          status: 'ACTIVE',
        },
      },
      include: {
        loan: {
          select: {
            id: true,
            employeeId: true,
            remainingBalance: true,
          },
        },
      },
      orderBy: { dueDate: 'asc' },
    });
  }

  async applyPayrollDeductions(
    companyId: string,
    employeeIds: string[],
    periodEndDate: Date,
    paidDate: Date,
    payrollRunNumber: number
  ) {
    if (employeeIds.length === 0) {
      return { deductedInstallments: 0, affectedLoans: 0 };
    }

    return prisma.$transaction(async (tx) => {
      const installments = await tx.loanInstallment.findMany({
        where: {
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lte: periodEndDate },
          loan: {
            companyId,
            employeeId: { in: employeeIds },
            status: 'ACTIVE',
          },
        },
        include: {
          loan: {
            select: {
              id: true,
              remainingBalance: true,
            },
          },
        },
        orderBy: { dueDate: 'asc' },
      });

      if (installments.length === 0) {
        return { deductedInstallments: 0, affectedLoans: 0 };
      }

      const note = `Deducted via payroll run #${payrollRunNumber}`;
      const deductionByLoan = new Map<string, number>();

      for (const installment of installments) {
        deductionByLoan.set(
          installment.loanId,
          (deductionByLoan.get(installment.loanId) || 0) + Number(installment.amount)
        );

        await tx.loanInstallment.update({
          where: { id: installment.id },
          data: {
            status: 'PAID',
            paidDate,
            notes: note,
          },
        });
      }

      for (const [loanId, totalDeducted] of deductionByLoan.entries()) {
        const loan = await tx.loan.findUnique({
          where: { id: loanId },
          select: { remainingBalance: true },
        });

        const remainingBalance = Math.max(Number(loan?.remainingBalance || 0) - totalDeducted, 0);
        const unpaidInstallmentCount = await tx.loanInstallment.count({
          where: {
            loanId,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
        });

        await tx.loan.update({
          where: { id: loanId },
          data: {
            remainingBalance,
            status: remainingBalance <= 0 || unpaidInstallmentCount === 0 ? 'PAID' : 'ACTIVE',
          },
        });
      }

      return {
        deductedInstallments: installments.length,
        affectedLoans: deductionByLoan.size,
      };
    });
  }
}

export const employeeLoanRepository = new EmployeeLoanRepository();
