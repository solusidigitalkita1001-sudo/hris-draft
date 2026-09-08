jest.mock('@/shared/database/prisma', () => {
  const tx = {
    workflowInstance: { findUnique: jest.fn(), updateMany: jest.fn(), update: jest.fn() },
    workflowInstanceStep: { updateMany: jest.fn(), update: jest.fn() },
    workflowInstanceLog: { create: jest.fn() },
  };
  return { prisma: { ...tx, $transaction: jest.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)) } };
});
import { prisma } from '@/shared/database/prisma';
import { WorkflowEngineRepository } from './workflow-engine.repository';
import { ConflictError, ForbiddenError } from '@/shared/exceptions/AppError';
const repository = new WorkflowEngineRepository();
const now = new Date('2026-09-07T00:00:00Z');
function instance(overrides: Record<string, unknown> = {}) {
  return {
    id: 'instance', companyId: 'A', requesterId: 'requester', status: 'PENDING', currentLevel: 1, updatedAt: now,
    steps: [{ id: 'step', level: 1, instanceId: 'instance', isCurrent: true, status: 'PENDING',
      approverId: 'approver', approverRoleCode: null, backupApproverId: 'backup', backupApproverRoleCode: null, updatedAt: now }],
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof prisma.workflowInstance.findUnique>>;
}
describe('workflow conditional transitions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(prisma.workflowInstance.findUnique).mockResolvedValue(instance());
    jest.mocked(prisma.workflowInstance.updateMany).mockResolvedValue({ count: 1 });
    jest.mocked(prisma.workflowInstanceStep.updateMany).mockResolvedValue({ count: 1 });
  });
  it('allows only one winner for simultaneous approvals of the same snapshot', async () => {
    jest.mocked(prisma.workflowInstance.updateMany).mockResolvedValueOnce({ count: 1 }).mockResolvedValue({ count: 0 });
    const outcomes = await Promise.allSettled([
      repository.applyAction('instance', 'approver', [], { action: 'APPROVE' }),
      repository.applyAction('instance', 'approver', [], { action: 'APPROVE' }),
    ]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const loser = outcomes.find(result => result.status === 'rejected');
    expect(loser?.status === 'rejected' && loser.reason).toBeInstanceOf(ConflictError);
    expect(prisma.workflowInstanceLog.create).toHaveBeenCalledTimes(1);
  });
  it('checks the instance revision and current step before writing audit/state', async () => {
    jest.mocked(prisma.workflowInstanceStep.updateMany).mockResolvedValue({ count: 0 });
    await expect(repository.applyAction('instance', 'approver', [], { action: 'APPROVE' })).rejects.toThrow(ConflictError);
    expect(prisma.workflowInstance.updateMany).toHaveBeenCalledWith({ where: { id: 'instance', status: 'PENDING', currentLevel: 1, updatedAt: now }, data: { updatedAt: expect.any(Date) } });
    expect(prisma.workflowInstanceStep.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING', isCurrent: true, approverId: 'approver', updatedAt: now }) }));
    expect(prisma.workflowInstance.update).not.toHaveBeenCalled();
    expect(prisma.workflowInstanceLog.create).not.toHaveBeenCalled();
  });
  it.each(['APPROVE', 'REJECT', 'ESCALATE'] as const)('rejects self-%s including super admins', async action => {
    await expect(repository.applyAction('instance', 'requester', ['SUPER_ADMIN'], { action, comment: 'Reason' })).rejects.toThrow(ForbiddenError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('rejects a completed workflow before opening a transaction', async () => {
    jest.mocked(prisma.workflowInstance.findUnique).mockResolvedValue(instance({ status: 'APPROVED' }));
    await expect(repository.applyAction('instance', 'approver', [], { action: 'APPROVE' })).rejects.toThrow(ConflictError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it('requires a nonblank rejection reason', async () => {
    await expect(repository.applyAction('instance', 'approver', [], { action: 'REJECT', comment: '  ' })).rejects.toThrow('reason');
  });
  it('preserves rejection reason in state and audit log', async () => {
    await repository.applyAction('instance', 'approver', [], { action: 'REJECT', comment: 'Incorrect dates' });
    expect(prisma.workflowInstanceStep.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'REJECTED', comment: 'Incorrect dates' }) }));
    expect(prisma.workflowInstanceLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ action: 'REJECTED', actorId: 'approver', comment: 'Incorrect dates' }) });
  });
  it('keeps escalated workflows actionable by the assigned backup', async () => {
    jest.mocked(prisma.workflowInstance.findUnique).mockResolvedValue(instance({ status: 'ESCALATED' }));
    await expect(repository.applyAction('instance', 'approver', [], { action: 'APPROVE' })).resolves.toBeDefined();
  });
});
