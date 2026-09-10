import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateLoanDTO, ApproveLoanDTO } from './employee-loan.dto';
import { generateAmortizationSchedule, AmortizationMethod } from '@/shared/payroll/amortization';
import { BadRequestError, ConflictError } from '@/shared/exceptions/AppError';

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
      const loan = await tx.loan.findUnique({ where: { id }, include: { loanType: { select: { interestRate: true } } } });
      if (!loan) return null;

      // The schedule is DERIVED from the amortization engine — never from the
      // client-supplied installmentAmount. A mismatched client value both
      // skipped interest entirely and broke the payroll settlement invariant
      // (sum of installments must equal remainingBalance), which hard-failed
      // whole disbursement batches.
      const schedule = generateAmortizationSchedule({
        principal: Number(loan.amount),
        annualRatePercent: Number(loan.loanType.interestRate),
        tenorMonths: loan.totalInstallments,
        method: 'FLAT',
      });

      // Status-guarded claim: only a PENDING loan can activate. This both
      // blocks resurrecting a REJECTED/CANCELLED loan and makes the claim
      // exclusive — of two concurrent approvals only one wins, so the
      // installment schedule below can never be generated twice.
      const claimed = await tx.loan.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: 'ACTIVE',
          approverId,
          approvedAt: new Date(),
          // Keep the loan aggregate consistent with the derived schedule:
          // remainingBalance = principal + interest, matching Σ installments.
          installmentAmount: schedule.rows[0]?.total ?? loan.installmentAmount,
          remainingBalance: schedule.totalPayment,
        },
      });
      if (claimed.count !== 1) {
        throw new ConflictError('Loan is no longer pending approval');
      }
      const updatedLoan = await tx.loan.findUniqueOrThrow({ where: { id } });

      const existingInstallments = await tx.loanInstallment.count({
        where: { loanId: id },
      });

      if (existingInstallments === 0 && schedule.rows.length > 0) {
        const installments = schedule.rows.map((row) => {
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + row.month);
          return {
            loanId: id,
            amount: row.total,
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
    // Only a PENDING loan can be rejected; an ACTIVE loan already has an
    // installment schedule and must go through cancellation/settlement.
    const rejected = await prisma.loan.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'REJECTED',
        approverId,
        approvedAt: new Date(),
        notes: rejectionReason,
      },
    });
    if (rejected.count !== 1) {
      throw new ConflictError('Loan is no longer pending approval');
    }
    return prisma.loan.findUniqueOrThrow({ where: { id } });
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

  async findDueInstallmentsForPayroll(companyId: string, periodEndDate: Date, database: Prisma.TransactionClient = prisma) {
    return database.loanInstallment.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        loanDeductionSnapshots: { none: {} },
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
}

export const employeeLoanRepository = new EmployeeLoanRepository();
