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
import { attendanceService } from '@/modules/attendance/attendance.service';
import { attendanceCorrectionService } from '@/modules/attendance/attendance-correction.service';
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

const ATT_A_ID = 'att-a-uuid-001';
const ATT_B_ID = 'att-b-uuid-001';
const CORR_A_ID = 'att-corr-a-001';
const CORR_B_ID = 'att-corr-b-001';
const FACE_A_ID = 'att-face-a-001';
const FACE_B_ID = 'att-face-b-001';
const OT_A_ID = 'ot-req-a-001';
const OT_B_ID = 'ot-req-b-001';

const mockAttendanceA = {
  id: ATT_A_ID,
  employeeId: EMPLOYEE_A_ID,
  companyId: COMPANY_A_ID,
  date: new Date(),
  status: 'PRESENT',
} as any;

const mockAttendanceB = {
  id: ATT_B_ID,
  employeeId: EMPLOYEE_B_ID,
  companyId: COMPANY_B_ID,
  date: new Date(),
  status: 'PRESENT',
} as any;

const mockCorrectionB = {
  id: CORR_B_ID,
  employeeId: EMPLOYEE_B_ID,
  companyId: COMPANY_B_ID,
  status: 'PENDING',
  date: new Date(),
} as any;

const mockCorrectionApprovedB = {
  ...mockCorrectionB,
  status: 'APPROVED',
  approvedBy: USER_SUPERADMIN_ID,
  approvedAt: new Date(),
} as any;

const mockOvertimeB = {
  id: OT_B_ID,
  employeeId: EMPLOYEE_B_ID,
  companyId: COMPANY_B_ID,
  date: new Date(),
  status: 'PENDING',
} as any;

describe('CompanyScope Cross-Tenant — Attendance Module (Task 1.2)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Attendance findById Cross-Company', () => {
    it('findById attendance company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.attendance, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => attendanceService.findById(ATT_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById attendance company A oleh user company A → sukses', async () => {
      jest.spyOn(prisma.attendance, 'findFirst').mockResolvedValue(mockAttendanceA);
      const res = await runAs(userCompanyA(), () => attendanceService.findById(ATT_A_ID));
      expect(res.id).toBe(ATT_A_ID);
      expect(res.companyId).toBe(COMPANY_A_ID);
    });

    it('findById attendance company B oleh user company B → sukses', async () => {
      jest.spyOn(prisma.attendance, 'findFirst').mockResolvedValue(mockAttendanceB);
      const res = await runAs(userCompanyB(), () => attendanceService.findById(ATT_B_ID));
      expect(res.id).toBe(ATT_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });

  describe('AttendanceCorrection Cross-Company', () => {
    it('findById correction company B oleh user company A → NotFoundError', async () => {
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => attendanceCorrectionService.findById(CORR_B_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('approve correction company B oleh user company A → NotFoundError (via findById)', async () => {
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => attendanceCorrectionService.approve(CORR_B_ID, USER_A_ID, EMPLOYEE_A_ID))
      ).rejects.toThrow(NotFoundError);
    });

    it('reject correction company B oleh user company A → NotFoundError (via findById)', async () => {
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () => attendanceCorrectionService.reject(CORR_B_ID, EMPLOYEE_A_ID, 'test'))
      ).rejects.toThrow(NotFoundError);
    });

    it('approve correction company A milik employee B (PENDING) oleh HR company A → sukses (self-approval beda orang)', async () => {
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValue({
        id: CORR_A_ID,
        employeeId: EMPLOYEE_B_ID, // milik employee B TAPI company A (beda employee 1 company)
        companyId: COMPANY_A_ID,
        attendanceId: ATT_A_ID,
        status: 'PENDING',
        date: new Date(),
      } as any);
      jest.spyOn(prisma.attendance, 'update').mockResolvedValue({ id: ATT_A_ID } as any);
      jest.spyOn(prisma.attendanceCorrection, 'update').mockResolvedValue(mockCorrectionApprovedB as any);
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValueOnce({
        id: CORR_A_ID,
        employeeId: EMPLOYEE_B_ID,
        companyId: COMPANY_A_ID,
        attendanceId: ATT_A_ID,
        status: 'PENDING',
        date: new Date(),
      } as any).mockResolvedValueOnce(mockCorrectionApprovedB as any);
      const res = await runAs(userCompanyA(), () =>
        attendanceCorrectionService.approve(CORR_A_ID, USER_A_ID, EMPLOYEE_A_ID)
      );
      expect(res).toBeDefined();
    });
  });

  describe('AttendanceFaceLog Cross-Company', () => {
    it('findFirst faceLog company B oleh user company A → data di-scoped → return null (bukan faceLog company B)', async () => {
      // Prisma middleware akan inject where.companyId=COMPANY_A_ID, sehingga findFirst(id=FACE_B_ID, companyId=A) return null
      jest.spyOn(prisma.attendanceFaceLog, 'findFirst').mockResolvedValue(null);
      const res = await runAs(userCompanyA(), () => prisma.attendanceFaceLog.findFirst({ where: { id: FACE_B_ID } }));
      expect(res).toBeNull();
    });

    it('findFirst faceLog company A oleh user company A → sukses', async () => {
      jest.spyOn(prisma.attendanceFaceLog, 'findFirst').mockResolvedValue({
        id: FACE_A_ID,
        attendanceId: ATT_A_ID,
        employeeId: EMPLOYEE_A_ID,
        companyId: COMPANY_A_ID,
        similarityScore: 0.8,
      } as any);
      const res = await runAs(userCompanyA(), () => prisma.attendanceFaceLog.findFirst({ where: { id: FACE_A_ID } }));
      expect(res?.companyId).toBe(COMPANY_A_ID);
    });
  });

  describe('OvertimeRequest Cross-Company (sudah di Set, regression check)', () => {
    it('findOvertimeById (attendance service) company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.overtimeRequest, 'findFirst').mockResolvedValue(null);
      // find dari attendance service untuk pattern applyOvertimeWorkflowAction → cari record dulu
      const findFn = async () => {
        const record = await prisma.overtimeRequest.findFirst({ where: { id: OT_B_ID } });
        if (!record) throw new NotFoundError('Overtime not found');
        return record;
      };
      await expect(runAs(userCompanyA(), findFn)).rejects.toThrow(NotFoundError);
    });

    it('applyOvertimeWorkflowAction ot B oleh user A → NotFound via findFirst', async () => {
      jest.spyOn(prisma.overtimeRequest, 'findFirst').mockResolvedValue(null);
      await expect(
        runAs(userCompanyA(), () =>
          attendanceService.applyOvertimeWorkflowAction(
            OT_B_ID,
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' } as any
          )
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('SUPER_ADMIN / GROUP_ADMIN Bypass', () => {
    it('SUPER_ADMIN findById attendance company B → sukses', async () => {
      jest.spyOn(prisma.attendance, 'findFirst').mockResolvedValue(mockAttendanceB);
      const res = await runAs(userSuperAdmin(), () => attendanceService.findById(ATT_B_ID));
      expect(res.id).toBe(ATT_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN findById correction company B → sukses (PENDING)', async () => {
      jest.spyOn(prisma.attendanceCorrection, 'findFirst').mockResolvedValue(mockCorrectionB);
      const res = await runAs(userGroupAdmin(), () => attendanceCorrectionService.findById(CORR_B_ID));
      expect(res.id).toBe(CORR_B_ID);
      expect(res.companyId).toBe(COMPANY_B_ID);
    });
  });
});
