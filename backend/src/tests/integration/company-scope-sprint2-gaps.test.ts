// Sprint 2 #8 — negative tests for the cross-tenant FK gaps closed in this branch.
// Each service now validates a client-supplied employeeId/delegateId against the
// caller's company (Employee is tenant-scoped, so a foreign id resolves to null).
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
        if (prop === '$transaction') return jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
        if (prop === '$queryRaw') return jest.fn().mockResolvedValue([]);
        if (prop === '$executeRaw') return jest.fn().mockResolvedValue(0);
        if (typeof prop === 'symbol') return undefined as any;
        if (prop === 'then' || prop === 'catch' || prop === 'finally') return undefined as any;
        if (!internalStore.has(prop)) internalStore.set(prop, makeMockModel());
        return internalStore.get(prop);
      },
      set: (_target, prop, value) => { internalStore.set(prop, value); return true; },
      has: (_target, prop) => internalStore.has(prop),
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

import prisma from '@/shared/database/prisma';
import { assetService } from '@/modules/asset/asset.service';
import { trainingService } from '@/modules/training/training.service';
import { dailyActivityService } from '@/modules/daily-activity/daily-activity.service';
import { attendanceService } from '@/modules/attendance/attendance.service';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { NotFoundError, ForbiddenError } from '@/shared/exceptions/AppError';
import { runAs, userCompanyA, makeUserContext, COMPANY_A_ID, EMPLOYEE_A_ID, EMPLOYEE_B_ID, USER_B_ID, clearAllPrismaMocks } from '../helpers/setupTestApp';

describe('CompanyScope Sprint 2 #8 — cross-tenant FK validation', () => {
  beforeEach(() => clearAllPrismaMocks());
  afterEach(() => clearAllPrismaMocks());

  it('asset.assign to an employee from another company → NotFoundError', async () => {
    // Asset itself is available/in-tenant; the foreign employee must be rejected.
    jest.spyOn(assetService, 'findById').mockResolvedValue({ id: 'asset-A', status: 'AVAILABLE', companyId: COMPANY_A_ID } as any);
    jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null); // foreign employee not visible under scope

    await expect(
      runAs(userCompanyA(['HR_MANAGER']), () =>
        assetService.assign('asset-A', { employeeId: EMPLOYEE_B_ID } as any, USER_B_ID))
    ).rejects.toThrow(NotFoundError);
  });

  it('training.createEnrollment for an employee from another company → NotFoundError', async () => {
    jest.spyOn(trainingService, 'findCourseById').mockResolvedValue({ id: 'course-A', companyId: COMPANY_A_ID } as any);
    jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);

    await expect(
      runAs(userCompanyA(['HR_MANAGER']), () =>
        trainingService.createEnrollment({ courseId: 'course-A', employeeId: EMPLOYEE_B_ID, companyId: COMPANY_A_ID } as any))
    ).rejects.toThrow(NotFoundError);
  });

  it('dailyActivity.createRequest for an employee from another company → NotFoundError', async () => {
    jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);

    await expect(
      runAs(userCompanyA(['HR_MANAGER']), () =>
        dailyActivityService.createRequest({
          employeeId: EMPLOYEE_B_ID,
          branchId: 'branch-A',
          startTime: new Date('2026-01-01T09:00:00Z'),
          endTime: new Date('2026-01-01T10:00:00Z'),
          latitude: 0,
          longitude: 0,
          description: 'x',
        } as any))
    ).rejects.toThrow(NotFoundError);
  });

  it('createDelegation to a delegate from another company → NotFoundError', async () => {
    // Delegate is an active user globally, but has no employee in this company.
    jest.spyOn(prisma.user, 'findFirst').mockResolvedValue({ id: USER_B_ID } as any);
    jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);

    await expect(
      runAs(userCompanyA(['HR_MANAGER']), () =>
        workflowEngineRepository.createDelegation({
          companyId: COMPANY_A_ID,
          delegatorId: 'user-A',
          delegateId: USER_B_ID,
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2026-02-01T00:00:00Z'),
        }))
    ).rejects.toThrow(NotFoundError);
  });

  it('createOvertime by a custom non-elevated role for another employee → ForbiddenError (T3.3)', async () => {
    // A role carrying neither EMPLOYEE nor an elevated role must be confined to
    // itself — the positive-capability gate no longer lets it through.
    const customUser = makeUserContext({ roles: ['CUSTOM_VIEWER'], employeeId: EMPLOYEE_A_ID, companyId: COMPANY_A_ID });
    await expect(
      runAs(customUser, () => attendanceService.createOvertime({
        employeeId: EMPLOYEE_B_ID,
        date: '2026-01-05',
        startTime: '18:00',
        endTime: '20:00',
        reason: 'x',
      } as any))
    ).rejects.toThrow(ForbiddenError);
  });
});
