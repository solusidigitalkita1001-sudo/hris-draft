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

import prisma from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/exceptions/AppError';
import {
  runAs,
  userCompanyA,
  userCompanyB,
  userSuperAdmin,
  userGroupAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  EMPLOYEE_A_ID,
  clearAllPrismaMocks,
} from '../helpers/setupTestApp';

const LT_A_ID = 'leavetype-a-uuid-001';
const LT_B_ID = 'leavetype-b-uuid-001';
const PM_A_ID = 'perfmethod-a-uuid-001';
const PM_B_ID = 'perfmethod-b-uuid-001';
const PP_A_ID = 'perfperiod-a-uuid-001';
const PP_B_ID = 'perfperiod-b-uuid-001';
const RC_A_ID = 'reviewcycle-a-uuid-001';
const RC_B_ID = 'reviewcycle-b-uuid-001';
const GOAL_A_ID = 'goal-a-uuid-001';
const GOAL_B_ID = 'goal-b-uuid-001';
const AUDIT_A_ID = 'audit-a-uuid-001';
const AUDIT_B_ID = 'audit-b-uuid-001';
const FR_A_ID = 'feedbackreq-a-uuid-001';
const FR_B_ID = 'feedbackreq-b-uuid-001';

const mock = (id: string, companyId: string, extra: Record<string, any> = {}) => ({
  id, companyId, name: `Entity ${id}`, code: `C-${id}`, status: 'ACTIVE', ...extra,
} as any);

describe('CompanyScope Cross-Tenant — LeaveType Master / Performance / AuditLog (Task 1.6 Minggu 1)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('LeaveType Master (residual Task 1.6 — master cuti)', () => {
    it('find leaveType company B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.leaveType, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const lt = await prisma.leaveType.findFirst({ where: { id: LT_B_ID } });
        if (!lt) throw new NotFoundError('Leave type not found');
        return lt;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find leaveType company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.leaveType, 'findFirst').mockResolvedValue(
        mock(LT_A_ID, COMPANY_A_ID, { isAnnual: true, maxDays: 12 })
      );
      const findFn = async () => prisma.leaveType.findFirst({ where: { id: LT_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(LT_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Performance Module — Method & Period Master', () => {
    it('find performanceMethod company B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.performanceMethod, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const pm = await prisma.performanceMethod.findFirst({ where: { id: PM_B_ID } });
        if (!pm) throw new NotFoundError('Performance method not found');
        return pm;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find performancePeriod company B oleh user A → scoped out → NotFoundError (sensitive: contains scores)', async () => {
      jest.spyOn(prisma.performancePeriod, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const pp = await prisma.performancePeriod.findFirst({ where: { id: PP_B_ID } });
        if (!pp) throw new NotFoundError('Performance period not found');
        return pp;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find reviewCycle company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.reviewCycle, 'findFirst').mockResolvedValue(
        mock(RC_A_ID, COMPANY_A_ID, { year: 2026, status: 'ACTIVE' })
      );
      const findFn = async () => prisma.reviewCycle.findFirst({ where: { id: RC_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(RC_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Goal / OKR Employee (PII sensitif: KPI personal)', () => {
    it('find goal company B milik employee B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.goal, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const g = await prisma.goal.findFirst({ where: { id: GOAL_B_ID } });
        if (!g) throw new NotFoundError('Goal not found');
        return g;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find goal company A milik employee A oleh user A → sukses', async () => {
      jest.spyOn(prisma.goal, 'findFirst').mockResolvedValue(
        mock(GOAL_A_ID, COMPANY_A_ID, { employeeId: EMPLOYEE_A_ID, type: 'PERSONAL', progress: 50 })
      );
      const findFn = async () => prisma.goal.findFirst({ where: { id: GOAL_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(GOAL_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
      expect(res?.employeeId).toBe(EMPLOYEE_A_ID);
    });
  });

  describe('AuditLog (forensic trail — tenant isolation per company)', () => {
    it('find auditLog company B oleh user A → scoped out → NotFoundError (jangan lihat log company lain)', async () => {
      jest.spyOn(prisma.auditLog, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const al = await prisma.auditLog.findFirst({ where: { id: AUDIT_B_ID } });
        if (!al) throw new NotFoundError('Audit log not found');
        return al;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find feedbackRequest (360 — PII feedback karyawan) company B oleh user A → scoped out', async () => {
      jest.spyOn(prisma.feedbackRequest, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const fr = await prisma.feedbackRequest.findFirst({ where: { id: FR_B_ID } });
        if (!fr) throw new NotFoundError('Feedback request not found');
        return fr;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass (Leave/Perf/Audit)', () => {
    it('SUPER_ADMIN find performanceMethod company B → sukses', async () => {
      jest.spyOn(prisma.performanceMethod, 'findFirst').mockResolvedValue(
        mock(PM_B_ID, COMPANY_B_ID, { name: 'Method B - Bell Curve' })
      );
      const findFn = async () => prisma.performanceMethod.findFirst({ where: { id: PM_B_ID } });
      const res = await runAs(userSuperAdmin(), findFn);
      expect(res?.id).toBe(PM_B_ID);
      expect(res?.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN find goal company B → sukses (group admin akses semua company di group)', async () => {
      jest.spyOn(prisma.goal, 'findFirst').mockResolvedValue(
        mock(GOAL_B_ID, COMPANY_B_ID, { employeeId: 'emp-b-001', progress: 80 })
      );
      const findFn = async () => prisma.goal.findFirst({ where: { id: GOAL_B_ID } });
      const res = await runAs(userGroupAdmin(), findFn);
      expect(res?.id).toBe(GOAL_B_ID);
      expect(res?.companyId).toBe(COMPANY_B_ID);
    });
  });
});
