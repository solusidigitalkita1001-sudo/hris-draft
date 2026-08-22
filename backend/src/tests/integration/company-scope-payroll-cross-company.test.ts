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
import { payrollService } from '@/modules/payroll/payroll.service';
import { benefitService } from '@/modules/benefit/benefit.service';
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

const SC_A_ID = 'sc-a-uuid-001';
const SC_B_ID = 'sc-b-uuid-001';
const ESAL_A_ID = 'esal-a-uuid-001';
const ESAL_B_ID = 'esal-b-uuid-001';
const PP_A_ID = 'pp-a-uuid-001';
const PP_B_ID = 'pp-b-uuid-001';
const PR_A_ID = 'pr-a-uuid-001';
const PR_B_ID = 'pr-b-uuid-001';
const PS_A_ID = 'ps-a-uuid-001';
const PS_B_ID = 'ps-b-uuid-001';
const BP_A_ID = 'bp-a-uuid-001';
const BP_B_ID = 'bp-b-uuid-001';
const BE_A_ID = 'be-a-uuid-001';
const BE_B_ID = 'be-b-uuid-001';

const mock = (id: string, companyId: string, extra: Record<string, any> = {}) => ({
  id, companyId, name: `Entity ${id}`, code: `C-${id}`, status: 'ACTIVE', ...extra,
} as any);

describe('CompanyScope Cross-Tenant — Payroll & Benefit Module (Task 1.4)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('SalaryComponent findById Cross-Company', () => {
    it('findSalaryComponentById component company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.salaryComponent, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => payrollService.findSalaryComponentById(SC_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findSalaryComponentById company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.salaryComponent, 'findFirst').mockResolvedValue(
        mock(SC_A_ID, COMPANY_A_ID, { type: 'ALLOWANCE' })
      );
      const res = await runAs(userCompanyA(), () => payrollService.findSalaryComponentById(SC_A_ID));
      expect(res.id).toBe(SC_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('EmployeeSalary findById Cross-Company', () => {
    it('findEmployeeSalaryById salary company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.employeeSalary, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => payrollService.findEmployeeSalaryById(ESAL_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findEmployeeSalaryById company B oleh user B → sukses', async () => {
      jest.spyOn(prisma.employeeSalary, 'findFirst').mockResolvedValue(
        mock(ESAL_B_ID, COMPANY_B_ID, { employeeId: EMPLOYEE_A_ID, effectiveDate: new Date(), baseSalary: 5000000 })
      );
      const res = await runAs(userCompanyB(), () => payrollService.findEmployeeSalaryById(ESAL_B_ID));
      expect(res.id).toBe(ESAL_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });

  describe('PayrollPeriod findById Cross-Company', () => {
    it('findPayrollPeriodById period company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.payrollPeriod, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => payrollService.findPayrollPeriodById(PP_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findPayrollPeriodById company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.payrollPeriod, 'findFirst').mockResolvedValue(
        mock(PP_A_ID, COMPANY_A_ID, { frequency: 'MONTHLY', startDate: new Date(), endDate: new Date() })
      );
      const res = await runAs(userCompanyA(), () => payrollService.findPayrollPeriodById(PP_A_ID));
      expect(res.id).toBe(PP_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('PayrollRun findById Cross-Company', () => {
    it('findPayrollRunById run company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.payrollRun, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => payrollService.findPayrollRunById(PR_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findPayrollRunById company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.payrollRun, 'findFirst').mockResolvedValue(
        mock(PR_A_ID, COMPANY_A_ID, { periodId: PP_A_ID, runNumber: 1, totalNetPay: 100000000 })
      );
      const res = await runAs(userCompanyA(), () => payrollService.findPayrollRunById(PR_A_ID));
      expect(res.id).toBe(PR_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('Payslip findById Cross-Company (paling sensitif PII + gaji)', () => {
    it('findPayslipById payslip company B oleh user A → NotFoundError (harus gagal)', async () => {
      jest.spyOn(prisma.payslip, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => payrollService.findPayslipById(PS_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findPayslipById company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.payslip, 'findFirst').mockResolvedValue({
        id: PS_A_ID,
        payrollRunId: PR_A_ID,
        employeeId: EMPLOYEE_A_ID,
        companyId: COMPANY_A_ID,
        baseSalary: 5000000,
        totalEarnings: 5500000,
        totalDeductions: 500000,
        netPay: 5000000,
        status: 'DRAFT',
      } as any);
      // buildPayslipBreakdown pure function, components = [] aman
      jest.spyOn(prisma.payslipComponent, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.benefitDeduction, 'findMany').mockResolvedValue([]);
      const res = await runAs(userCompanyA(), () => payrollService.findPayslipById(PS_A_ID));
      expect(res.id).toBe(PS_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('BenefitPlan & BenefitEnrollment Cross-Company', () => {
    it('findPlanById plan company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.benefitPlan, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => benefitService.findPlanById(BP_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findPlanById plan company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.benefitPlan, 'findFirst').mockResolvedValue(
        mock(BP_A_ID, COMPANY_A_ID, { type: 'HEALTH_INSURANCE' })
      );
      const res = await runAs(userCompanyA(), () => benefitService.findPlanById(BP_A_ID));
      expect(res.id).toBe(BP_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });

    it('findEnrollmentById enrollment company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.benefitEnrollment, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => benefitService.findEnrollmentById(BE_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findEnrollmentById company A oleh user A → sukses', async () => {
      jest.spyOn(prisma.benefitEnrollment, 'findFirst').mockResolvedValue(
        mock(BE_A_ID, COMPANY_A_ID, { benefitPlanId: BP_A_ID, employeeId: EMPLOYEE_A_ID, status: 'ACTIVE' })
      );
      const res = await runAs(userCompanyA(), () => benefitService.findEnrollmentById(BE_A_ID));
      expect(res.id).toBe(BE_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass Payroll (payslip sensitive)', () => {
    it('SUPER_ADMIN findPayslipById company B → sukses (bypass scope lintas company)', async () => {
      jest.spyOn(prisma.payslip, 'findFirst').mockResolvedValue({
        id: PS_B_ID, payrollRunId: PR_B_ID, employeeId: EMPLOYEE_A_ID,
        companyId: COMPANY_B_ID, baseSalary: 8000000, totalEarnings: 9000000,
        totalDeductions: 1000000, netPay: 8000000, status: 'FINALIZED',
      } as any);
      jest.spyOn(prisma.payslipComponent, 'findMany').mockResolvedValue([]);
      jest.spyOn(prisma.benefitDeduction, 'findMany').mockResolvedValue([]);
      const res = await runAs(userSuperAdmin(), () => payrollService.findPayslipById(PS_B_ID));
      expect(res.id).toBe(PS_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN findSalaryComponentById company B → sukses', async () => {
      jest.spyOn(prisma.salaryComponent, 'findFirst').mockResolvedValue(
        mock(SC_B_ID, COMPANY_B_ID, { type: 'ALLOWANCE' })
      );
      const res = await runAs(userGroupAdmin(), () => payrollService.findSalaryComponentById(SC_B_ID));
      expect(res.id).toBe(SC_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });
});
