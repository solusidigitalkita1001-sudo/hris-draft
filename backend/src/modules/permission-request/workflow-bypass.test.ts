type Row = Record<string, unknown>;

const state: {
  instance: Row | null;
  request: Row | null;
  updated: Array<{ where: Row; data: Row }>;
  updateCount: number;
} = { instance: null, request: null, updated: [], updateCount: 1 };

jest.mock('@/shared/database/prisma', () => {
  const client = {
    workflowInstance: { findFirst: jest.fn(async () => state.instance) },
    permissionRequest: {
      findFirst: jest.fn(async () => state.request),
      findUnique: jest.fn(async () => state.request),
      findFirstOrThrow: jest.fn(async () => state.request),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updated.push({ where, data });
        return { count: state.updateCount };
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/modules/workflow-engine/workflow-engine.repository', () => ({
  workflowEngineRepository: {
    findDefaultTemplate: jest.fn(async () => null),
    startInstance: jest.fn(),
    applyAction: jest.fn(async () => ({ id: 'instance-1', status: 'APPROVED' })),
  },
}));
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

import { permissionRequestRepository } from './permission-request.repository';

/**
 * `startWorkflow` states the intent — "no template → keep the direct-approve
 * path" — and nothing enforced the other half. With a chain configured,
 * `PATCH /:id/approve` wrote APPROVED straight to the row, so anybody holding
 * `permission-request:update` could finish a configured approval: the engine's
 * step order, its assigned approvers and its own self-approval rejection were
 * all skipped.
 */
beforeEach(() => {
  state.instance = null;
  state.request = { id: 'request-1', employeeId: 'employee-1', status: 'PENDING' };
  state.updated = [];
  state.updateCount = 1;
});

describe('direct approval while a workflow is running', () => {
  it.each(['PENDING', 'ESCALATED'])('is refused when the chain is %s', async (status) => {
    state.instance = { id: 'instance-1', status };
    await expect(permissionRequestRepository.approve('request-1', 'user-1'))
      .rejects.toThrow(/approval workflow/);
    await expect(permissionRequestRepository.reject('request-1', 'user-1'))
      .rejects.toThrow(/approval workflow/);
    // Nothing was written: the refusal comes before the status update.
    expect(state.updated).toEqual([]);
  });

  it('is allowed when no workflow was ever started', async () => {
    // A company with no template for permission requests has only this path.
    state.instance = null;
    await permissionRequestRepository.approve('request-1', 'user-1');
    expect(state.updated[0].data).toMatchObject({ status: 'APPROVED' });
  });

  it.each(['CANCELLED'])('is allowed again once the chain is %s', async (status) => {
    // An abandoned chain should not strand the request forever.
    state.instance = { id: 'instance-1', status };
    await permissionRequestRepository.approve('request-1', 'user-1');
    expect(state.updated[0].data).toMatchObject({ status: 'APPROVED' });
  });
});

describe('the workflow path itself', () => {
  it('still writes the status after the engine has decided', async () => {
    // The engine's own instance must not refuse the engine.
    state.instance = { id: 'instance-1', status: 'PENDING' };
    await permissionRequestRepository.applyWorkflowAction(
      'request-1', 'user-1', ['MANAGER'], { action: 'APPROVE' }, 'employee-2');
    expect(state.updated[0].data).toMatchObject({ status: 'APPROVED' });
  });

  it('keeps refusing an approver who owns the request', async () => {
    state.instance = { id: 'instance-1', status: 'PENDING' };
    await expect(permissionRequestRepository.applyWorkflowAction(
      'request-1', 'user-1', ['MANAGER'], { action: 'APPROVE' }, 'employee-1'))
      .rejects.toThrow(/Self approval/);
  });
});
