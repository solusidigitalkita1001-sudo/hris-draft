jest.mock('@/shared/database/prisma', () => {
  const tx = { payrollRun: { updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), create: jest.fn() } };
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
    expect(prisma.payrollRun.create).toHaveBeenCalledWith({ data: { periodId: 'period', companyId: 'A', name: 'September', runNumber: 1, createdBy: 'maker' } });
  });
  it('conditions approval on completed status, known creator, and a different checker', async () => {
    jest.mocked(prisma.payrollRun.updateMany).mockResolvedValue({ count: 1 });
    await repository.approvePayrollRun('run', 'checker', 'A');
    expect(prisma.payrollRun.updateMany).toHaveBeenCalledWith({
      where: { id: 'run', companyId: 'A', period: { companyId: 'A', deletedAt: null }, status: 'COMPLETED', createdBy: { not: null }, AND: [{ createdBy: { not: 'checker' } }], deletedAt: null },
      data: { status: 'APPROVED', approvedBy: 'checker', approvedAt: expect.any(Date) },
    });
  });
  it('rejects a lost status race or maker violation without returning success', async () => {
    jest.mocked(prisma.payrollRun.updateMany).mockResolvedValue({ count: 0 });
    await expect(repository.approvePayrollRun('run', 'maker', 'A')).rejects.toThrow(ConflictError);
    expect(prisma.payrollRun.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
