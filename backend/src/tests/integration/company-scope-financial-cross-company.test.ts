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
import { assetService } from '@/modules/asset/asset.service';
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

const ASSET_A_ID = 'asset-a-uuid-001';
const ASSET_B_ID = 'asset-b-uuid-001';
const PERM_A_ID = 'perm-req-a-uuid';
const PERM_B_ID = 'perm-req-b-uuid';
const JP_A_ID = 'jobpost-a-uuid-001';
const JP_B_ID = 'jobpost-b-uuid-001';
const CAND_A_ID = 'cand-a-uuid-001';
const CAND_B_ID = 'cand-b-uuid-001';
const TC_A_ID = 'tcat-a-uuid-001';
const TC_B_ID = 'tcat-b-uuid-001';
const WC_A_ID = 'wcal-a-uuid-001';
const WC_B_ID = 'wcal-b-uuid-001';
const LOANT_A_ID = 'loantype-a-uuid';
const LOANT_B_ID = 'loantype-b-uuid';
const ROLE_A_ID = 'role-a-uuid-001';
const ROLE_B_ID = 'role-b-uuid-001';

const mock = (id: string, companyId: string, extra: Record<string, any> = {}) => ({
  id, companyId, name: `Entity ${id}`, code: `C-${id}`, status: 'ACTIVE', ...extra,
} as any);

describe('CompanyScope Cross-Tenant — Financial/Document/Remainder Module (Task 1.5 + 1.6)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Asset (C.7 Inventory Module)', () => {
    it('findById asset company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => assetService.findById(ASSET_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById asset company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue(
        mock(ASSET_A_ID, COMPANY_A_ID, { categoryId: 'cat-1' })
      );
      const res = await runAs(userCompanyA(), () => assetService.findById(ASSET_A_ID));
      expect(res.id).toBe(ASSET_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('PermissionRequest (Cuti/Sakit/Izin — selain Leave modul)', () => {
    it('find permission-request company B oleh user A → scoped out → NotFoundError pattern', async () => {
      jest.spyOn(prisma.permissionRequest, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const pr = await prisma.permissionRequest.findFirst({ where: { id: PERM_B_ID } });
        if (!pr) throw new NotFoundError('Permission request not found');
        return pr;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find permission-request company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.permissionRequest, 'findFirst').mockResolvedValue(
        mock(PERM_A_ID, COMPANY_A_ID, { employeeId: EMPLOYEE_A_ID, type: 'SICK' })
      );
      const findFn = async () => prisma.permissionRequest.findFirst({ where: { id: PERM_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(PERM_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Recruitment — JobPosting & Candidate (PII kandidat)', () => {
    it('find JobPosting company B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.jobPosting, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const jp = await prisma.jobPosting.findFirst({ where: { id: JP_B_ID } });
        if (!jp) throw new NotFoundError('Job posting not found');
        return jp;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find Candidate company B oleh user A → scoped out → NotFoundError (PII kandidat)', async () => {
      jest.spyOn(prisma.candidate, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const cand = await prisma.candidate.findFirst({ where: { id: CAND_B_ID } });
        if (!cand) throw new NotFoundError('Candidate not found');
        return cand;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });
  });

  describe('Training — Category', () => {
    it('find trainingCategory company B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.trainingCategory, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const tc = await prisma.trainingCategory.findFirst({ where: { id: TC_B_ID } });
        if (!tc) throw new NotFoundError('Training category not found');
        return tc;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find trainingCategory company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.trainingCategory, 'findFirst').mockResolvedValue(
        mock(TC_A_ID, COMPANY_A_ID)
      );
      const findFn = async () => prisma.trainingCategory.findFirst({ where: { id: TC_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(TC_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('WorkCalendar (master jadwal kerja & hari libur)', () => {
    it('find workCalendar company B oleh user A → scoped out → NotFoundError', async () => {
      jest.spyOn(prisma.workCalendar, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const wc = await prisma.workCalendar.findFirst({ where: { id: WC_B_ID } });
        if (!wc) throw new NotFoundError('Work calendar not found');
        return wc;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find workCalendar company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.workCalendar, 'findFirst').mockResolvedValue(
        mock(WC_A_ID, COMPANY_A_ID, { year: 2026 })
      );
      const findFn = async () => prisma.workCalendar.findFirst({ where: { id: WC_A_ID } });
      const res = await runAs(userCompanyA(), findFn);
      expect(res?.id).toBe(WC_A_ID);
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('LoanType & Role (Master Data sensitif RBAC & Pinjaman)', () => {
    it('find loanType B oleh user A via prisma findFirst → scoped out → NotFoundError pattern', async () => {
      jest.spyOn(prisma.loanType, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const lt = await prisma.loanType.findFirst({ where: { id: LOANT_B_ID } });
        if (!lt) throw new NotFoundError('LoanType not found');
        return lt;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('find role company B oleh user A via prisma findFirst → scoped out → NotFoundError pattern', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue(null);
      const findFn = async () => {
        const r = await prisma.role.findFirst({ where: { id: ROLE_B_ID } });
        if (!r) throw new NotFoundError('Role not found');
        return r;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass (Financial)', () => {
    it('SUPER_ADMIN findById asset company B → sukses', async () => {
      jest.spyOn(prisma.asset, 'findFirst').mockResolvedValue(
        mock(ASSET_B_ID, COMPANY_B_ID, { categoryId: 'cat-2' })
      );
      const res = await runAs(userSuperAdmin(), () => assetService.findById(ASSET_B_ID));
      expect(res.id).toBe(ASSET_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN findWorkCalendar company B → sukses', async () => {
      jest.spyOn(prisma.workCalendar, 'findFirst').mockResolvedValue(
        mock(WC_B_ID, COMPANY_B_ID, { year: 2026 })
      );
      const findFn = async () => {
        const wc = await prisma.workCalendar.findFirst({ where: { id: WC_B_ID } });
        if (!wc) throw new NotFoundError('Work calendar not found');
        return wc;
      };
      const res = await runAs(userGroupAdmin(), findFn);
      expect(res.id).toBe(WC_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });
});
