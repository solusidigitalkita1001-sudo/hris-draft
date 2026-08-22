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
import { branchService } from '@/modules/organization/services/branch.service';
import { divisionService } from '@/modules/organization/services/division.service';
import { departmentService } from '@/modules/organization/services/department.service';
import { positionService } from '@/modules/organization/services/position.service';
import { subDepartmentService } from '@/modules/organization/services/sub-department.service';
import {
  runAs,
  userCompanyA,
  userCompanyB,
  userSuperAdmin,
  userGroupAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  clearAllPrismaMocks,
} from '../helpers/setupTestApp';

const BR_A_ID = 'br-a-uuid-001';
const BR_B_ID = 'br-b-uuid-001';
const DIV_A_ID = 'div-a-uuid-001';
const DIV_B_ID = 'div-b-uuid-001';
const DEPT_A_ID = 'dept-a-uuid-001';
const DEPT_B_ID = 'dept-b-uuid-001';
const POS_A_ID = 'pos-a-uuid-001';
const POS_B_ID = 'pos-b-uuid-001';
const SUBDEPT_A_ID = 'subdept-a-uuid-001';
const SUBDEPT_B_ID = 'subdept-b-uuid-001';

const mock = (id: string, companyId: string, extra: Record<string, any> = {}) => ({
  id,
  companyId,
  name: `Entity ${id}`,
  code: `C-${id}`,
  status: 'ACTIVE',
  ...extra,
} as any);

describe('CompanyScope Cross-Tenant — Organization Module (Task 1.3)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Branch findById Cross-Company', () => {
    it('findById branch company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.branch, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => branchService.findById(BR_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById branch company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.branch, 'findFirst').mockResolvedValue(mock(BR_A_ID, COMPANY_A_ID, { timezone: 'Asia/Jakarta' }));
      const res = await runAs(userCompanyA(), () => branchService.findById(BR_A_ID));
      expect(res.id).toBe(BR_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Division findById Cross-Company', () => {
    it('findById division company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.division, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => divisionService.findById(DIV_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById division company B oleh user B → sukses', async () => {
      jest.spyOn(prisma.division, 'findFirst').mockResolvedValue(mock(DIV_B_ID, COMPANY_B_ID));
      const res = await runAs(userCompanyB(), () => divisionService.findById(DIV_B_ID));
      expect(res.id).toBe(DIV_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });

  describe('Department findById Cross-Company', () => {
    it('findById dept company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => departmentService.findById(DEPT_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById dept company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(mock(DEPT_A_ID, COMPANY_A_ID, { divisionId: DIV_A_ID }));
      const res = await runAs(userCompanyA(), () => departmentService.findById(DEPT_A_ID));
      expect(res.id).toBe(DEPT_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Position findById Cross-Company', () => {
    it('findById pos company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.position, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => positionService.findById(POS_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById pos company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.position, 'findFirst').mockResolvedValue(mock(POS_A_ID, COMPANY_A_ID, { departmentId: DEPT_A_ID }));
      const res = await runAs(userCompanyA(), () => positionService.findById(POS_A_ID));
      expect(res.id).toBe(POS_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('SubDepartment findById + create Cross-Company (denormalisasi baru)', () => {
    it('findById subdept company B oleh user A → NotFoundError (scoped out)', async () => {
      jest.spyOn(prisma.subDepartment, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => subDepartmentService.findById(SUBDEPT_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById subdept company A oleh user A → sukses (companyId match)', async () => {
      jest.spyOn(prisma.subDepartment, 'findFirst').mockResolvedValue(mock(SUBDEPT_A_ID, COMPANY_A_ID, { departmentId: DEPT_A_ID }));
      const res = await runAs(userCompanyA(), () => subDepartmentService.findById(SUBDEPT_A_ID));
      expect(res.id).toBe(SUBDEPT_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });

    it('create subdept A dengan parent departmentId milik company B oleh user A → NotFoundError (parent not found)', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(null); // Prisma middleware scoped companyId user A → dept B tidak ketemu
      await expect(
        runAs(userCompanyA(), () =>
          subDepartmentService.create({
            departmentId: DEPT_B_ID, // parent milik B
            name: 'Team X',
            code: 'SUB-X',
          } as any)
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass', () => {
    it('SUPER_ADMIN findById branch company B → sukses', async () => {
      jest.spyOn(prisma.branch, 'findFirst').mockResolvedValue(mock(BR_B_ID, COMPANY_B_ID, { timezone: 'Asia/Jakarta' }));
      const res = await runAs(userSuperAdmin(), () => branchService.findById(BR_B_ID));
      expect(res.id).toBe(BR_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN findById dept company B → sukses', async () => {
      jest.spyOn(prisma.department, 'findFirst').mockResolvedValue(mock(DEPT_B_ID, COMPANY_B_ID, { divisionId: DIV_B_ID }));
      const res = await runAs(userGroupAdmin(), () => departmentService.findById(DEPT_B_ID));
      expect(res.id).toBe(DEPT_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });
});
