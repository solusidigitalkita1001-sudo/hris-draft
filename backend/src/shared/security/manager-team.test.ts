jest.mock('@/shared/database/prisma', () => ({
  __esModule: true,
  default: {
    division: { findMany: jest.fn() },
    department: { findMany: jest.fn() },
    subDepartment: { findMany: jest.fn() },
    employee: { findMany: jest.fn() },
  },
}));
jest.mock('@/shared/context/RequestContext', () => ({
  runInSystemContext: (_reason: string, fn: () => unknown) => fn(),
}));

import prisma from '@/shared/database/prisma';
import { resolveManagedEmployeeIds } from './manager-team';

const p = prisma as unknown as {
  division: { findMany: jest.Mock };
  department: { findMany: jest.Mock };
  subDepartment: { findMany: jest.Mock };
  employee: { findMany: jest.Mock };
};

describe('resolveManagedEmployeeIds (MANAGER_TEAM #7)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('collects direct + nested department employees and stays tenant-scoped', async () => {
    p.division.findMany.mockResolvedValue([]);
    p.department.findMany.mockImplementation(({ where }: { where: Record<string, any> }) => {
      if (where.headId) return Promise.resolve([{ id: 'dept-A' }]);           // headed department
      if (where.parentId?.in?.includes('dept-A')) return Promise.resolve([{ id: 'dept-A-child' }]); // one level down
      return Promise.resolve([]);                                             // subtree exhausted
    });
    p.subDepartment.findMany.mockImplementation(({ where }: { where: Record<string, any> }) => {
      if (where.headId) return Promise.resolve([]);
      if (where.departmentId) return Promise.resolve([{ id: 'sub-1' }]);
      return Promise.resolve([]);
    });
    p.employee.findMany.mockResolvedValue([{ id: 'emp-1' }, { id: 'emp-2' }]);

    const ids = await resolveManagedEmployeeIds('comp-A', 'mgr-1');

    expect(new Set(ids)).toEqual(new Set(['emp-1', 'emp-2'])); // team only, no self
    // Every query is pinned to the caller's company (cross-tenant walk impossible).
    for (const call of p.department.findMany.mock.calls) {
      expect(call[0].where.companyId).toBe('comp-A');
    }
    expect(p.employee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ companyId: 'comp-A', deletedAt: null }) }),
    );
    // The department subtree walk reached the child unit.
    expect(p.subDepartment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ departmentId: { in: expect.arrayContaining(['dept-A', 'dept-A-child']) } }) }),
    );
  });

  it('returns an empty team when the requester heads no unit (fail closed upstream)', async () => {
    p.division.findMany.mockResolvedValue([]);
    p.department.findMany.mockResolvedValue([]);
    p.subDepartment.findMany.mockResolvedValue([]);

    const ids = await resolveManagedEmployeeIds('comp-A', 'nobody');

    expect(ids).toEqual([]);
    expect(p.employee.findMany).not.toHaveBeenCalled(); // no units ⇒ never widen to employees
  });
});
