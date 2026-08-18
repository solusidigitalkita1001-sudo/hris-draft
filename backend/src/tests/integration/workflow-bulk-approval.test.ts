jest.mock('@/shared/database/prisma', () => {
  const makeMockModel = () => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  });

  const internalStore = new Map<string | symbol, any>();

  const prismaMock: any = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '$use') return jest.fn();
        if (prop === '$on') return jest.fn();
        if (prop === '$connect') return jest.fn().mockResolvedValue(true);
        if (prop === '$disconnect') return jest.fn().mockResolvedValue(true);
        if (prop === '$transaction')
          return jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
        if (prop === '$queryRaw') return jest.fn().mockResolvedValue([]);
        if (prop === '$executeRaw') return jest.fn().mockResolvedValue(0);
        if (typeof prop === 'symbol') {
          if (prop === Symbol.iterator) return (undefined as any);
          if (prop === Symbol.toStringTag) return 'PrismaClient';
          return undefined as any;
        }
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined as any;
        }
        if (!internalStore.has(prop)) {
          internalStore.set(prop, makeMockModel());
        }
        return internalStore.get(prop);
      },
      set: (_target, prop, value) => {
        internalStore.set(prop, value);
        return true;
      },
      has: (_target, prop) => {
        return internalStore.has(prop);
      },
    }
  );

  return {
    __esModule: true,
    default: prismaMock,
    prisma: prismaMock,
    prismaRead: prismaMock,
    testDatabaseConnection: jest.fn().mockResolvedValue(true),
    disconnectDatabase: jest.fn().mockResolvedValue(true),
  };
});

import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import prisma from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/exceptions/AppError';
import {
  runAs,
  userCompanyA,
  userCompanyB,
  userSuperAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  USER_A_ID,
  USER_B_ID,
  USER_SUPERADMIN_ID,
  clearAllPrismaMocks,
  buildWorkflowInstance,
} from '../helpers/setupTestApp';

interface BulkApprovalResult {
  instanceId: string;
  success: boolean;
  error?: string;
  errorCode?: string;
}

async function simulateBulkApproval(
  instanceIds: string[],
  userId: string,
  roles: string[],
  comment: string = 'bulk approve'
): Promise<BulkApprovalResult[]> {
  const results: BulkApprovalResult[] = [];
  for (const instanceId of instanceIds) {
    try {
      const instance = await workflowEngineRepository.findInstanceById(instanceId);
      if (!instance) {
        throw new NotFoundError('Workflow instance not found');
      }
      await workflowEngineRepository.applyAction(instanceId, userId, roles, {
        action: 'APPROVE',
        comment,
      });
      results.push({ instanceId, success: true });
    } catch (err: any) {
      results.push({
        instanceId,
        success: false,
        error: err?.message ?? 'Unknown error',
        errorCode: err?.code ?? 'UNKNOWN',
      });
    }
  }
  return results;
}

async function simulateBulkAction(
  items: Array<{ instanceId: string; action: 'APPROVE' | 'REJECT'; comment?: string }>,
  userId: string,
  roles: string[]
): Promise<BulkApprovalResult[]> {
  const results: BulkApprovalResult[] = [];
  for (const item of items) {
    try {
      const instance = await workflowEngineRepository.findInstanceById(item.instanceId);
      if (!instance) {
        throw new NotFoundError('Workflow instance not found');
      }
      await workflowEngineRepository.applyAction(item.instanceId, userId, roles, {
        action: item.action,
        comment: item.comment ?? 'bulk action',
      });
      results.push({ instanceId: item.instanceId, success: true });
    } catch (err: any) {
      results.push({
        instanceId: item.instanceId,
        success: false,
        error: err?.message ?? 'Unknown error',
        errorCode: err?.code ?? 'UNKNOWN',
      });
    }
  }
  return results;
}

describe('Workflow Bulk Approval Partial Result Semantics (A.5 cross-verification)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Cross-company mixed bulk (company A + B oleh user company A)', () => {
    it('bulk approve 2 instance: 1 company A (sah) + 1 company B → hasil partial: A SUCCESS, B FAILED', async () => {
      (jest
        .spyOn(prisma.workflowInstance, 'findUnique') as any)
        .mockImplementation((opts: any) => {
          const id = opts?.where?.id;
          if (id === 'wf-A-bulk-1') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id: 'wf-A-bulk-1',
                companyId: COMPANY_A_ID,
                requesterId: USER_B_ID,
              }),
              steps: [
                {
                  id: 'step-A-1',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          if (id === 'wf-B-bulk-1') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id: 'wf-B-bulk-1',
                companyId: COMPANY_B_ID,
                requesterId: USER_B_ID,
              }),
              steps: [
                {
                  id: 'step-B-1',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          return Promise.resolve(null);
        });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkApproval(
          ['wf-A-bulk-1', 'wf-B-bulk-1'],
          USER_A_ID,
          ['HR_STAFF'],
          'bulk approve batch 1'
        )
      );

      expect(results).toHaveLength(2);
      const resultA = results.find((r) => r.instanceId === 'wf-A-bulk-1')!;
      expect(resultA.success).toBe(true);
      const resultB = results.find((r) => r.instanceId === 'wf-B-bulk-1')!;
      expect(resultB.success).toBe(false);
      expect(resultB.error).toBeDefined();
    });

    it('bulk approve semua company B oleh user A → SEMUA FAILED cross-company scope', async () => {
      (jest.spyOn(prisma.workflowInstance, 'findUnique') as any).mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        return Promise.resolve({
          ...buildWorkflowInstance({
            id,
            companyId: COMPANY_B_ID,
            requesterId: USER_B_ID,
          }),
          steps: [
            {
              id: 'step-x',
              level: 1,
              isCurrent: true,
              status: 'PENDING',
              approverRoleCode: 'HR_STAFF',
            },
          ],
        } as any);
      });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkApproval(['wf-B1', 'wf-B2', 'wf-B3'], USER_A_ID, ['HR_STAFF'])
      );

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.success).toBe(false));
    });

    it('bulk approve semua company A sah oleh user A → SEMUA SUCCESS', async () => {
      (jest.spyOn(prisma.workflowInstance, 'findUnique') as any).mockImplementation((opts: any) => {
        const id = opts?.where?.id;
        return Promise.resolve({
          ...buildWorkflowInstance({
            id,
            companyId: COMPANY_A_ID,
            requesterId: USER_B_ID,
          }),
          steps: [
            {
              id: 'step-' + id,
              level: 1,
              isCurrent: true,
              status: 'PENDING',
              approverRoleCode: 'HR_STAFF',
            },
          ],
        } as any);
      });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkApproval(['wf-A1', 'wf-A2', 'wf-A3'], USER_A_ID, ['HR_STAFF'])
      );

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.success).toBe(true));
    });
  });

  describe('Self-approval mixed dalam bulk', () => {
    it('bulk 2 instance: 1 self (requester=approver) + 1 non-self → self FAILED Forbidden, other SUCCESS', async () => {
      (jest
        .spyOn(prisma.workflowInstance, 'findUnique') as any)
        .mockImplementation((opts: any) => {
          const id = opts?.where?.id;
          if (id === 'wf-self-bulk') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id: 'wf-self-bulk',
                companyId: COMPANY_A_ID,
                requesterId: USER_A_ID,
              }),
              steps: [
                {
                  id: 'step-self',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          if (id === 'wf-other-bulk') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id: 'wf-other-bulk',
                companyId: COMPANY_A_ID,
                requesterId: USER_B_ID,
              }),
              steps: [
                {
                  id: 'step-other',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          return Promise.resolve(null);
        });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkApproval(
          ['wf-self-bulk', 'wf-other-bulk'],
          USER_A_ID,
          ['HR_STAFF']
        )
      );

      expect(results).toHaveLength(2);
      const selfResult = results.find((r) => r.instanceId === 'wf-self-bulk')!;
      expect(selfResult.success).toBe(false);
      expect(selfResult.error).toMatch(/own request/i);
      const otherResult = results.find((r) => r.instanceId === 'wf-other-bulk')!;
      expect(otherResult.success).toBe(true);
    });

    it('bulk 3: 2 self + 1 non-self → 2 FAILED self + 1 SUCCESS', async () => {
      (jest
        .spyOn(prisma.workflowInstance, 'findUnique') as any)
        .mockImplementation((opts: any) => {
          const id = opts?.where?.id;
          const isSelf = id.endsWith('-self');
          return Promise.resolve({
            ...buildWorkflowInstance({
              id,
              companyId: COMPANY_A_ID,
              requesterId: isSelf ? USER_A_ID : USER_B_ID,
            }),
            steps: [
              {
                id: 's-' + id,
                level: 1,
                isCurrent: true,
                status: 'PENDING',
                approverRoleCode: 'HR_STAFF',
              },
            ],
          } as any);
        });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkApproval(
          ['wf-1-self', 'wf-2-other', 'wf-3-self'],
          USER_A_ID,
          ['HR_STAFF']
        )
      );

      expect(results).toHaveLength(3);
      const successCount = results.filter((r) => r.success).length;
      const failCount = results.filter((r) => !r.success).length;
      expect(successCount).toBe(1);
      expect(failCount).toBe(2);
    });
  });

  describe('SUPER_ADMIN bulk cross company + self', () => {
    it('SUPER_ADMIN bulk campur A + B + self → SEMUA SUCCESS (bypass scope + self)', async () => {
      (jest
        .spyOn(prisma.workflowInstance, 'findUnique') as any)
        .mockImplementation((opts: any) => {
          const id = opts?.where?.id;
          let companyId = COMPANY_A_ID;
          let requesterId = USER_B_ID;
          if (id.includes('B')) companyId = COMPANY_B_ID;
          if (id.includes('self')) requesterId = USER_SUPERADMIN_ID;
          return Promise.resolve({
            ...buildWorkflowInstance({ id, companyId, requesterId }),
            steps: [
              {
                id: 'step-' + id,
                level: 1,
                isCurrent: true,
                status: 'PENDING',
                approverRoleCode: 'SUPER_ADMIN',
                approverId: USER_SUPERADMIN_ID,
              },
            ],
          } as any);
        });

      const results = await runAs(userSuperAdmin(), () =>
        simulateBulkApproval(
          ['wf-A', 'wf-B', 'wf-self'],
          USER_SUPERADMIN_ID,
          ['SUPER_ADMIN']
        )
      );

      expect(results).toHaveLength(3);
      results.forEach((r) => expect(r.success).toBe(true));
    });
  });

  describe('Mixed bulk: self + cross-company + sah → partial report detail', () => {
    it('simulateBulkAction campur APPROVE/REJECT dengan 3 kondisi berbeda → report per item', async () => {
      (jest
        .spyOn(prisma.workflowInstance, 'findUnique') as any)
        .mockImplementation((opts: any) => {
          const id = opts?.where?.id;
          if (id === 'wf-valid') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id,
                companyId: COMPANY_A_ID,
                requesterId: USER_B_ID,
              }),
              steps: [
                {
                  id: 'sv',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          if (id === 'wf-cross') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id,
                companyId: COMPANY_B_ID,
                requesterId: USER_B_ID,
              }),
              steps: [
                {
                  id: 'sc',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          if (id === 'wf-self') {
            return Promise.resolve({
              ...buildWorkflowInstance({
                id,
                companyId: COMPANY_A_ID,
                requesterId: USER_A_ID,
              }),
              steps: [
                {
                  id: 'ss',
                  level: 1,
                  isCurrent: true,
                  status: 'PENDING',
                  approverRoleCode: 'HR_STAFF',
                },
              ],
            } as any);
          }
          return Promise.resolve(null);
        });

      const results = await runAs(userCompanyA(), () =>
        simulateBulkAction(
          [
            { instanceId: 'wf-valid', action: 'APPROVE', comment: 'approve valid' },
            { instanceId: 'wf-cross', action: 'REJECT', comment: 'reject cross' },
            { instanceId: 'wf-self', action: 'APPROVE', comment: 'approve self' },
          ],
          USER_A_ID,
          ['HR_STAFF']
        )
      );

      expect(results).toHaveLength(3);
      expect(results.find((r) => r.instanceId === 'wf-valid')!.success).toBe(true);
      expect(results.find((r) => r.instanceId === 'wf-cross')!.success).toBe(false);
      const self = results.find((r) => r.instanceId === 'wf-self')!;
      expect(self.success).toBe(false);
      expect(self.error).toMatch(/own request/i);
    });
  });
});
