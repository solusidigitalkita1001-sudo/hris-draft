jest.mock('@/shared/database/prisma', () => {
  const tx = { payrollRun: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() }, payslip: { updateMany: jest.fn() } };
  return { prisma: { ...tx, $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) } };
});
import { prisma } from '@/shared/database/prisma';
import { PayrollRepository } from './payroll.repository';
import { ConflictError } from '@/shared/exceptions/AppError';
const repository = new PayrollRepository();
describe('payroll maker-checker persistence', () => {
  beforeEach(() => jest.clearAllMocks());
  it('persists creator from the service actor argument', async () => {
    await repository.createPayrollRun({ periodId: 'period', companyId: 'A', name: 'September' }, 1, 'maker');
    // runType defaults to REGULAR here rather than being omitted: a run row
    // with no type would be invisible to the one-run-per-type guard.
    expect(prisma.payrollRun.create).toHaveBeenCalledWith({ data: { periodId: 'period', companyId: 'A', name: 'September', runNumber: 1, runType: 'REGULAR', createdBy: 'maker' } });
  });
  it('carries an explicit run type through to the row', async () => {
    await repository.createPayrollRun({ periodId: 'period', companyId: 'A', name: 'THR 2026', runType: 'THR' }, 2, 'maker');
    expect(prisma.payrollRun.create).toHaveBeenCalledWith({
      data: { periodId: 'period', companyId: 'A', name: 'THR 2026', runNumber: 2, runType: 'THR', createdBy: 'maker' },
    });
  });
  it('conditions approval on completed status, known creator, and a different checker', async () => {
    jest.mocked(prisma.payrollRun.updateMany).mockResolvedValue({ count: 1 });
    await repository.approvePayrollRun('run', 'checker', 'A');
    expect(prisma.payrollRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run', companyId: 'A', period: { companyId: 'A', deletedAt: null }, status: 'COMPLETED', createdBy: { not: null }, AND: [{ createdBy: { not: 'checker' } }], deletedAt: null },
      data: { status: 'APPROVED', approvedBy: 'checker', approvedAt: expect.any(Date) },
    });
    // Approval is also what finalises the payslips, inside the same
    // transaction and scoped to this run and company.
    expect(prisma.payslip.updateMany).toHaveBeenCalledWith({
      where: { payrollRunId: 'run', companyId: 'A' }, data: { status: 'FINAL' },
    });
  });
  it('rejects a lost status race or maker violation without returning success', async () => {
    jest.mocked(prisma.payrollRun.updateMany).mockResolvedValue({ count: 0 });
    await expect(repository.approvePayrollRun('run', 'maker', 'A')).rejects.toThrow(ConflictError);
    expect(prisma.payrollRun.findUniqueOrThrow).not.toHaveBeenCalled();
    // A refused approval must not finalise anything either.
    expect(prisma.payslip.updateMany).not.toHaveBeenCalled();
  });
});
