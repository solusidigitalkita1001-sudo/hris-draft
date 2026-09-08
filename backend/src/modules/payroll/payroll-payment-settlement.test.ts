import { Prisma } from '@prisma/client';
import { settlePayrollPaymentBatch } from './payroll-payment-settlement';

function setup() {
  const snapshot = { companyId: 'company', runId: 'run', payslipId: 'slip', loanId: 'loan',
    installmentId: 'frozen-installment', amount: new Prisma.Decimal('0.30') };
  const run = { id: 'run', status: 'APPROVED', createdBy: 'maker', approvedBy: 'checker',
    payslips: [{ id: 'slip', employeeId: 'employee', netPay: new Prisma.Decimal('10.20'),
      components: [{ amount: new Prisma.Decimal('0.30'), salaryComponent: { code: 'LOAN_DEDUCTION_AUTO' } }],
      loanDeductionSnapshots: [snapshot],
    }],
  };
  const tx = {
    payrollRun: { findFirst: jest.fn().mockResolvedValue(run), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    payrollPaymentTransaction: { findMany: jest.fn().mockResolvedValue([{ payslipId: 'slip', employeeId: 'employee', expectedAmount: new Prisma.Decimal('10.20') }]) },
    loanInstallment: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), count: jest.fn().mockResolvedValue(0) },
    loan: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), findFirstOrThrow: jest.fn().mockResolvedValue({ remainingBalance: new Prisma.Decimal(0) }) },
  };
  const settle = (actorId = 'recorder') => settlePayrollPaymentBatch(tx as unknown as Prisma.TransactionClient,
    { companyId: 'company', actorId }, { runId: 'run', id: 'batch' });
  return { run, snapshot, tx, settle };
}
describe('payroll reconciliation loan settlement', () => {
  it('settles only frozen installments with decimal decrement on the caller transaction', async () => {
    const fixture = setup(); await fixture.settle();
    expect(fixture.tx.loanInstallment.updateMany).toHaveBeenCalledTimes(1);
    expect(fixture.tx.loanInstallment.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      id: 'frozen-installment', loanId: 'loan', amount: new Prisma.Decimal('0.30'), status: { in: ['PENDING', 'OVERDUE'] },
      loan: { companyId: 'company', employeeId: 'employee', status: 'ACTIVE' },
    } }));
    expect(fixture.tx.loan.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { remainingBalance: { decrement: new Prisma.Decimal('0.30') } },
    }));
    expect(fixture.tx.payrollRun.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ companyId: 'company', status: 'APPROVED' }),
      data: { status: 'DISBURSED', disbursedBy: 'recorder', disbursedAt: expect.any(Date) },
    }));
  });
  it('rejects missing legacy loan snapshots instead of selecting live due installments', async () => {
    const fixture = setup(); fixture.run.payslips[0].loanDeductionSnapshots = [];
    await expect(fixture.settle()).rejects.toThrow('snapshot does not match');
    expect(fixture.tx.loanInstallment.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a changed or already settled installment so the enclosing transaction rolls back', async () => {
    const fixture = setup(); fixture.tx.loanInstallment.updateMany.mockResolvedValue({ count: 0 });
    await expect(fixture.settle()).rejects.toThrow('already paid');
    expect(fixture.tx.loan.updateMany).not.toHaveBeenCalled();
  });
  it('rejects altered net pay before modifying payroll or loans', async () => {
    const fixture = setup(); fixture.run.payslips[0].netPay = new Prisma.Decimal('10.21');
    await expect(fixture.settle()).rejects.toThrow('changed after');
    expect(fixture.tx.payrollRun.updateMany).not.toHaveBeenCalled();
  });
  it('rejects checker self-settlement before state changes', async () => {
    const fixture = setup(); await expect(fixture.settle('checker')).rejects.toThrow('not eligible');
    expect(fixture.tx.payrollRun.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a lost payroll state race before loan writes', async () => {
    const fixture = setup(); fixture.tx.payrollRun.updateMany.mockResolvedValue({ count: 0 });
    await expect(fixture.settle()).rejects.toThrow('changed during');
    expect(fixture.tx.loanInstallment.updateMany).not.toHaveBeenCalled();
  });
  it('refuses to clamp insufficient balance or mark inconsistent schedules paid', async () => {
    const fixture = setup(); fixture.tx.loan.updateMany.mockResolvedValue({ count: 0 });
    await expect(fixture.settle()).rejects.toThrow('does not cover');
    const second = setup(); second.tx.loanInstallment.count.mockResolvedValue(1);
    await expect(second.settle()).rejects.toThrow('do not agree');
  });
  it('fails closed on a snapshot with a different company', async () => {
    const fixture = setup(); fixture.snapshot.companyId = 'other-company';
    await expect(fixture.settle()).rejects.toThrow('Invalid loan');
    expect(fixture.tx.loanInstallment.updateMany).not.toHaveBeenCalled();
  });
});
