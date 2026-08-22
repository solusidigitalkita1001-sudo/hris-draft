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
import { employeeService } from '@/modules/employee/employee.service';
import {
  runAs,
  userCompanyA,
  userCompanyB,
  userSuperAdmin,
  userGroupAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  EMPLOYEE_A_ID,
  EMPLOYEE_B_ID,
  USER_A_ID,
  USER_SUPERADMIN_ID,
  clearAllPrismaMocks,
} from '../helpers/setupTestApp';

const mockEmployeeA: any = {
  id: EMPLOYEE_A_ID,
  companyId: COMPANY_A_ID,
  employeeNumber: 'EMP-A-001',
  fullName: 'Karyawan Perusahaan A',
  status: 'ACTIVE',
  joinDate: new Date(),
  deletedAt: null,
};

const mockEmployeeB: any = {
  id: EMPLOYEE_B_ID,
  companyId: COMPANY_B_ID,
  employeeNumber: 'EMP-B-002',
  fullName: 'Karyawan Perusahaan B',
  status: 'ACTIVE',
  joinDate: new Date(),
  deletedAt: null,
};

const FAM_A_ID = 'emp-fam-a-001';
const FAM_B_ID = 'emp-fam-b-001';
const EDU_A_ID = 'emp-edu-a-001';
const EDU_B_ID = 'emp-edu-b-001';
const EMC_A_ID = 'emp-emc-a-001';
const EMC_B_ID = 'emp-emc-b-001';
const TRN_A_ID = 'emp-trn-a-001';
const TRN_B_ID = 'emp-trn-b-001';
const SKL_A_ID = 'emp-skl-a-001';
const SKL_B_ID = 'emp-skl-b-001';
const EXP_A_ID = 'emp-exp-a-001';
const EXP_B_ID = 'emp-exp-b-001';
const ATT_A_ID = 'emp-att-a-001';
const ATT_B_ID = 'emp-att-b-001';
const BANK_A_ID = 'emp-bank-a-001';
const BANK_B_ID = 'emp-bank-b-001';
const ASG_A_ID = 'emp-asg-a-001';
const ASG_B_ID = 'emp-asg-b-001';

describe('CompanyScope Cross-Tenant — Employee Module (Task 1.1)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Employee findById Cross-Company', () => {
    it('findById employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.findById(EMPLOYEE_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById employee company A oleh user company A → sukses (tidak throw)', async () => {
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(mockEmployeeA);
      const res = await runAs(userCompanyA(), () => employeeService.findById(EMPLOYEE_A_ID));
      expect(res.id).toBe(EMPLOYEE_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });

    it('findById employee company B oleh user company B → sukses', async () => {
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(mockEmployeeB);
      const res = await runAs(userCompanyB(), () => employeeService.findById(EMPLOYEE_B_ID));
      expect(res.id).toBe(EMPLOYEE_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });

  describe('Employee Sub-Entity Family Cross-Company', () => {
    it('updateFamily milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeFamily, 'findUnique').mockResolvedValue({
        id: FAM_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateFamily(EMPLOYEE_B_ID, FAM_B_ID, { fullName: 'X' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteFamily milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeFamily, 'findUnique').mockResolvedValue({
        id: FAM_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteFamily(EMPLOYEE_B_ID, FAM_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity Education Cross-Company', () => {
    it('updateEducation milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeEducation, 'findUnique').mockResolvedValue({
        id: EDU_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateEducation(EMPLOYEE_B_ID, EDU_B_ID, { level: 'MASTER' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteEducation milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeEducation, 'findUnique').mockResolvedValue({
        id: EDU_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteEducation(EMPLOYEE_B_ID, EDU_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity EmergencyContact Cross-Company', () => {
    it('updateEmergencyContact milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeEmergencyContact, 'findUnique').mockResolvedValue({
        id: EMC_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateEmergencyContact(EMPLOYEE_B_ID, EMC_B_ID, { fullName: 'Y' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteEmergencyContact milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeEmergencyContact, 'findUnique').mockResolvedValue({
        id: EMC_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteEmergencyContact(EMPLOYEE_B_ID, EMC_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity Training Cross-Company', () => {
    it('updateTraining milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeTraining, 'findUnique').mockResolvedValue({
        id: TRN_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateTraining(EMPLOYEE_B_ID, TRN_B_ID, { trainingName: 'T' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteTraining milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeTraining, 'findUnique').mockResolvedValue({
        id: TRN_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteTraining(EMPLOYEE_B_ID, TRN_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity Skill Cross-Company', () => {
    it('updateSkill milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeSkill, 'findUnique').mockResolvedValue({
        id: SKL_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateSkill(EMPLOYEE_B_ID, SKL_B_ID, { skillName: 'Go' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteSkill milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeSkill, 'findUnique').mockResolvedValue({
        id: SKL_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteSkill(EMPLOYEE_B_ID, SKL_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity Experience Cross-Company', () => {
    it('updateExperience milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeExperience, 'findUnique').mockResolvedValue({
        id: EXP_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateExperience(EMPLOYEE_B_ID, EXP_B_ID, { companyName: 'PT Z' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteExperience milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeExperience, 'findUnique').mockResolvedValue({
        id: EXP_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteExperience(EMPLOYEE_B_ID, EXP_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Employee Sub-Entity Attachment Cross-Company', () => {
    it('updateAttachment milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeAttachment, 'findUnique').mockResolvedValue({
        id: ATT_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.updateAttachment(EMPLOYEE_B_ID, ATT_B_ID, { description: 'Z' } as any))
      ).rejects.toThrow(NotFoundError);
    });

    it('deleteAttachment milik employee company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeAttachment, 'findUnique').mockResolvedValue({
        id: ATT_B_ID, employeeId: EMPLOYEE_B_ID, companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => employeeService.deleteAttachment(EMPLOYEE_B_ID, ATT_B_ID))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass Company Scope', () => {
    it('SUPER_ADMIN findById employee company B → sukses', async () => {
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(mockEmployeeB);
      const res = await runAs(userSuperAdmin(), () => employeeService.findById(EMPLOYEE_B_ID));
      expect(res.id).toBe(EMPLOYEE_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN findById employee company B → sukses', async () => {
      jest.spyOn(prisma.employee, 'findFirst').mockResolvedValue(mockEmployeeB);
      const res = await runAs(userGroupAdmin(), () => employeeService.findById(EMPLOYEE_B_ID));
      expect(res.id).toBe(EMPLOYEE_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });
});
