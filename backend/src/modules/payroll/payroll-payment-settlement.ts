import { Prisma } from '@prisma/client';
import { ConflictError } from '@/shared/exceptions/AppError';

/** Called only inside the payment ledger's reconciliation transaction. */
export async function settlePayrollPaymentBatch(
  tx: Prisma.TransactionClient,
  context: { companyId: string; actorId: string },
  batch: { runId: string; id: string }
): Promise<void> {
  const run = await tx.payrollRun.findFirst({
    where: { id: batch.runId, companyId: context.companyId, deletedAt: null },
    include: { payslips: { include: {
      components: { include: { salaryComponent: { select: { code: true } } } },
      loanDeductionSnapshots: true,
    } } },
  });
  if (!run || run.status !== 'APPROVED' || !run.createdBy || !run.approvedBy ||
      run.createdBy === run.approvedBy || run.approvedBy === context.actorId) {
    throw new ConflictError('Payroll is not eligible for reconciliation');
  }
  const payments = await tx.payrollPaymentTransaction.findMany({
    where: { batchId: batch.id, companyId: context.companyId },
    select: { payslipId: true, employeeId: true, expectedAmount: true },
  });
  if (payments.length !== run.payslips.length || run.payslips.some(payslip => {
    const payment = payments.find(item => item.payslipId === payslip.id);
    return !payment || payment.employeeId !== payslip.employeeId || !payment.expectedAmount.equals(payslip.netPay);
  })) throw new ConflictError('Payroll payslips changed after the payment snapshot');

  // Claim the run before touching installments; a second batch cannot settle it.
  const claimed = await tx.payrollRun.updateMany({
    where: { id: run.id, companyId: context.companyId, status: 'APPROVED',
      createdBy: run.createdBy, approvedBy: run.approvedBy, deletedAt: null },
    data: { status: 'DISBURSED', disbursedBy: context.actorId, disbursedAt: new Date() },
  });
  if (claimed.count !== 1) throw new ConflictError('Payroll changed during reconciliation');

  const byLoan = new Map<string, { amount: Prisma.Decimal; employeeId: string }>();
  for (const payslip of run.payslips) {
    const deducted = payslip.components
      .filter(component => component.salaryComponent?.code === 'LOAN_DEDUCTION_AUTO')
      .reduce((total, component) => total.plus(component.amount), new Prisma.Decimal(0));
    const frozen = payslip.loanDeductionSnapshots
      .reduce((total, snapshot) => total.plus(snapshot.amount), new Prisma.Decimal(0));
    if (!deducted.equals(frozen)) {
      throw new ConflictError('Loan deduction snapshot does not match the payslip; review is required');
    }
    for (const snapshot of payslip.loanDeductionSnapshots) {
      if (snapshot.companyId !== context.companyId || snapshot.runId !== run.id ||
          snapshot.payslipId !== payslip.id || !snapshot.amount.isPositive()) {
        throw new ConflictError('Invalid loan deduction snapshot');
      }
      const result = await tx.loanInstallment.updateMany({
        where: { id: snapshot.installmentId, loanId: snapshot.loanId, amount: snapshot.amount,
          status: { in: ['PENDING', 'OVERDUE'] },
          loan: { companyId: context.companyId, employeeId: payslip.employeeId, status: 'ACTIVE' } },
        data: { status: 'PAID', paidDate: new Date(), notes: `Payroll payment batch ${batch.id}` },
      });
      if (result.count !== 1) throw new ConflictError('A deducted loan installment changed or was already paid');
      const previous = byLoan.get(snapshot.loanId);
      if (previous && previous.employeeId !== payslip.employeeId) throw new ConflictError('Loan owner mismatch');
      byLoan.set(snapshot.loanId, { employeeId: payslip.employeeId,
        amount: (previous?.amount ?? new Prisma.Decimal(0)).plus(snapshot.amount) });
    }
  }

  // Decimal arithmetic and conditional decrement avoid lost updates or clamping away a mismatch.
  for (const [loanId, deduction] of [...byLoan.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const result = await tx.loan.updateMany({
      where: { id: loanId, companyId: context.companyId, employeeId: deduction.employeeId,
        status: 'ACTIVE', remainingBalance: { gte: deduction.amount } },
      data: { remainingBalance: { decrement: deduction.amount } },
    });
    if (result.count !== 1) throw new ConflictError('Loan balance does not cover the frozen payroll deduction');
    const loan = await tx.loan.findFirstOrThrow({
      where: { id: loanId, companyId: context.companyId }, select: { remainingBalance: true },
    });
    const unpaid = await tx.loanInstallment.count({ where: { loanId, status: { in: ['PENDING', 'OVERDUE'] } } });
    if (loan.remainingBalance.isZero() !== (unpaid === 0)) {
      throw new ConflictError('Loan balance and remaining installment schedule do not agree');
    }
    if (unpaid === 0) await tx.loan.updateMany({
      where: { id: loanId, companyId: context.companyId, status: 'ACTIVE', remainingBalance: 0 },
      data: { status: 'PAID' },
    });
  }
}
