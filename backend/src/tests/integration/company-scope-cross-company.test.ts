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

import { leaveService } from '@/modules/leave/leave.service';
import { employeeLoanService } from '@/modules/employee-loan/employee-loan.service';
import { travelExpenseService } from '@/modules/travel-expense/travel-expense.service';
import { workCalendarService } from '@/modules/work-calendar/work-calendar.service';
import { attendanceService } from '@/modules/attendance/attendance.service';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import prisma from '@/shared/database/prisma';
import { NotFoundError, ForbiddenError } from '@/shared/exceptions/AppError';
import {
  runAs,
  userCompanyA,
  userCompanyB,
  userEmployeeA,
  userEmployeeB,
  userSuperAdmin,
  userGroupAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  EMPLOYEE_A_ID,
  EMPLOYEE_B_ID,
  USER_A_ID,
  USER_B_ID,
  USER_SUPERADMIN_ID,
  clearAllPrismaMocks,
  buildWorkflowInstance,
} from '../helpers/setupTestApp';

describe('CompanyScope Cross-Tenant Access Prevention (Fase A.6)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Leave Module (A.1 endpoints)', () => {
    it('findLeaveRequestById company B oleh user company A non-admin → NotFoundError', async () => {
      jest.spyOn(prisma.leaveRequest, 'findUnique').mockResolvedValue({
        id: 'leave-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
        status: 'PENDING',
      } as any);

      await expect(
        runAs(userCompanyA(), () => leaveService.findLeaveRequestById('leave-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findLeaveRequestById company A oleh user company A → sukses (tidak throw)', async () => {
      const mockData = {
        id: 'leave-A-001',
        companyId: COMPANY_A_ID,
        employeeId: EMPLOYEE_A_ID,
        status: 'PENDING',
      };
      jest.spyOn(prisma.leaveRequest, 'findFirst').mockResolvedValue(mockData as any);

      const result = await runAs(userCompanyA(), () =>
        leaveService.findLeaveRequestById('leave-A-001')
      );
      expect(result).toBeDefined();
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('applyWorkflowAction leave company B oleh user A → NotFound via findLeaveRequestById', async () => {
      jest.spyOn(prisma.leaveRequest, 'findUnique').mockResolvedValue({
        id: 'leave-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          leaveService.applyWorkflowAction(
            'leave-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('getLeaveWorkflow company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-leave-B',
        companyId: COMPANY_B_ID,
        referenceType: 'LEAVE_REQUEST',
        referenceId: 'leave-B-001',
      } as any);

      await expect(
        runAs(userCompanyA(), () => leaveService.getLeaveWorkflow('leave-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('getLeaveWorkflow company A oleh user A → tidak throw', async () => {
      const mockWf = {
        id: 'wf-leave-A',
        companyId: COMPANY_A_ID,
        referenceType: 'LEAVE_REQUEST',
        referenceId: 'leave-A-001',
        steps: [],
        logs: [],
        template: { id: 'tpl', name: 'tpl', approvalType: 'LEAVE_REQUEST' },
      };
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue(mockWf as any);

      const result = await runAs(userCompanyA(), () =>
        leaveService.getLeaveWorkflow('leave-A-001')
      );
      expect(result).toBeDefined();
    });
  });

  describe('Employee Loan Module (A.2)', () => {
    it('findById loan company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.loan, 'findUnique').mockResolvedValue({
        id: 'loan-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => employeeLoanService.findById('loan-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findById loan company A oleh user A → sukses', async () => {
      const mock = { id: 'loan-A-001', companyId: COMPANY_A_ID, employeeId: EMPLOYEE_A_ID };
      jest.spyOn(prisma.loan, 'findUnique').mockResolvedValue(mock as any);

      const result = await runAs(userCompanyA(), () =>
        employeeLoanService.findById('loan-A-001')
      );
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('getWorkflow loan company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-loan-B',
        companyId: COMPANY_B_ID,
        referenceType: 'LOAN_REQUEST',
        referenceId: 'loan-B-001',
      } as any);

      await expect(
        runAs(userCompanyA(), () => employeeLoanService.getWorkflow('loan-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('applyWorkflowAction loan B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.loan, 'findUnique').mockResolvedValue({
        id: 'loan-B-001',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          employeeLoanService.applyWorkflowAction(
            'loan-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Travel Expense Trip + Claim (A.2)', () => {
    it('findTripById company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.businessTrip, 'findUnique').mockResolvedValue({
        id: 'trip-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => travelExpenseService.findTripById('trip-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findTripById company A oleh user A → sukses', async () => {
      const mock = { id: 'trip-A-001', companyId: COMPANY_A_ID, employeeId: EMPLOYEE_A_ID };
      jest.spyOn(prisma.businessTrip, 'findUnique').mockResolvedValue(mock as any);

      const result = await runAs(userCompanyA(), () =>
        travelExpenseService.findTripById('trip-A-001')
      );
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('getTripWorkflow trip B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-trip-B',
        companyId: COMPANY_B_ID,
        referenceType: 'BUSINESS_TRIP',
        referenceId: 'trip-B-001',
      } as any);

      await expect(
        runAs(userCompanyA(), () => travelExpenseService.getTripWorkflow('trip-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('applyTripWorkflowAction trip B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.businessTrip, 'findUnique').mockResolvedValue({
        id: 'trip-B-001',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          travelExpenseService.applyTripWorkflowAction(
            'trip-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('findClaimById company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.expenseClaim, 'findUnique').mockResolvedValue({
        id: 'claim-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => travelExpenseService.findClaimById('claim-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findClaimById company A oleh user A → sukses', async () => {
      const mock = { id: 'claim-A-001', companyId: COMPANY_A_ID, employeeId: EMPLOYEE_A_ID };
      jest.spyOn(prisma.expenseClaim, 'findUnique').mockResolvedValue(mock as any);

      const result = await runAs(userCompanyA(), () =>
        travelExpenseService.findClaimById('claim-A-001')
      );
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('getClaimWorkflow claim B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-claim-B',
        companyId: COMPANY_B_ID,
        referenceType: 'EXPENSE_CLAIM',
        referenceId: 'claim-B-001',
      } as any);

      await expect(
        runAs(userCompanyA(), () => travelExpenseService.getClaimWorkflow('claim-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('applyClaimWorkflowAction claim B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.expenseClaim, 'findUnique').mockResolvedValue({
        id: 'claim-B-001',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          travelExpenseService.applyClaimWorkflowAction(
            'claim-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Shift Swap (A.3)', () => {
    it('findShiftSwapById company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.shiftSwapRequest, 'findUnique').mockResolvedValue({
        id: 'swap-B-001',
        companyId: COMPANY_B_ID,
        requesterEmployeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => workCalendarService.findShiftSwapById('swap-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findShiftSwapById company A oleh user A → sukses', async () => {
      const mock = {
        id: 'swap-A-001',
        companyId: COMPANY_A_ID,
        requesterEmployeeId: EMPLOYEE_A_ID,
      };
      jest.spyOn(prisma.shiftSwapRequest, 'findFirst').mockResolvedValue(mock as any);

      const result = await runAs(userCompanyA(), () =>
        workCalendarService.findShiftSwapById('swap-A-001')
      );
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('applyShiftSwapWorkflowAction swap B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.shiftSwapRequest, 'findUnique').mockResolvedValue({
        id: 'swap-B-001',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          workCalendarService.applyShiftSwapWorkflowAction(
            'swap-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            null,
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('getShiftSwapWorkflow swap B oleh user A → NotFoundError (via scope check)', async () => {
      jest.spyOn(prisma.shiftSwapRequest, 'findUnique').mockResolvedValue({
        id: 'swap-B-001',
        companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-swap-B',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => workCalendarService.getShiftSwapWorkflow('swap-B-001'))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Overtime Request (A.3)', () => {
    it('findOvertimeById company B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.overtimeRequest, 'findUnique').mockResolvedValue({
        id: 'ot-B-001',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => attendanceService.findOvertimeById('ot-B-001'))
      ).rejects.toThrow(NotFoundError);
    });

    it('findOvertimeById company A oleh user A → sukses', async () => {
      const mock = { id: 'ot-A-001', companyId: COMPANY_A_ID, employeeId: EMPLOYEE_A_ID };
      jest.spyOn(prisma.overtimeRequest, 'findFirst').mockResolvedValue(mock as any);

      const result = await runAs(userCompanyA(), () =>
        attendanceService.findOvertimeById('ot-A-001')
      );
      expect(result.companyId).toBe(COMPANY_A_ID);
    });

    it('applyOvertimeWorkflowAction ot B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.overtimeRequest, 'findUnique').mockResolvedValue({
        id: 'ot-B-001',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          attendanceService.applyOvertimeWorkflowAction(
            'ot-B-001',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'ok' }
          )
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('getOvertimeWorkflow ot B oleh user A → NotFoundError', async () => {
      jest.spyOn(prisma.overtimeRequest, 'findUnique').mockResolvedValue({
        id: 'ot-B-001',
        companyId: COMPANY_B_ID,
      } as any);
      jest.spyOn(prisma.workflowInstance, 'findFirst').mockResolvedValue({
        id: 'wf-ot-B',
        companyId: COMPANY_B_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () => attendanceService.getOvertimeWorkflow('ot-B-001'))
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('Workflow Engine Module', () => {
    it('findInstanceById instance company B oleh user A non-admin → NotFoundError', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-instance-B',
        companyId: COMPANY_B_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        template: { stages: [] },
        steps: [],
        logs: [],
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          workflowEngineRepository.findInstanceById('wf-instance-B')
        )
      ).rejects.toThrow(NotFoundError);
    });

    it('findInstanceById instance company A oleh user A → tidak throw', async () => {
      const wf = buildWorkflowInstance({ id: 'wf-instance-A', companyId: COMPANY_A_ID });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        template: { stages: [] },
        steps: [],
        logs: [],
      } as any);

      const result = await runAs(userCompanyA(), () =>
        workflowEngineRepository.findInstanceById('wf-instance-A')
      );
      expect(result).toBeDefined();
    });

    it('applyAction self approve (requesterId===userId non SUPER) → ForbiddenError', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-instance-B-2',
        companyId: COMPANY_B_ID,
        requesterId: USER_B_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        steps: [
          {
            id: 'step-1',
            level: 1,
            isCurrent: true,
            status: 'PENDING',
            approverRoleCode: 'HR_STAFF',
          },
        ],
      } as any);

      await expect(
        runAs(userCompanyB(), () =>
          workflowEngineRepository.applyAction(
            'wf-instance-B-2',
            USER_B_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'self-approve' }
          )
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('applyAction non-approver role → ForbiddenError "not allowed to act"', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-instance-A-2',
        companyId: COMPANY_A_ID,
        requesterId: USER_B_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        steps: [
          {
            id: 'step-1',
            level: 1,
            isCurrent: true,
            status: 'PENDING',
            approverRoleCode: 'MANAGER',
            approverId: 'some-other-user',
          },
        ],
      } as any);

      await expect(
        runAs(userCompanyA(['EMPLOYEE']), () =>
          workflowEngineRepository.applyAction(
            'wf-instance-A-2',
            USER_A_ID,
            ['EMPLOYEE'],
            { action: 'APPROVE', comment: 'x' }
          )
        )
      ).rejects.toThrow(ForbiddenError);
    });
  });

  describe('Super Admin Bypass (SUPER_ADMIN/GROUP_ADMIN)', () => {
    it('SUPER_ADMIN access findLeaveRequestById company B → TIDAK throw NotFound', async () => {
      const mock = {
        id: 'leave-B-002',
        companyId: COMPANY_B_ID,
        employeeId: EMPLOYEE_B_ID,
      };
      jest.spyOn(prisma.leaveRequest, 'findFirst').mockResolvedValue(mock as any);

      const result = await runAs(userSuperAdmin(), () =>
        leaveService.findLeaveRequestById('leave-B-002')
      );
      expect(result).toBeDefined();
      expect(result.companyId).toBe(COMPANY_B_ID);
    });

    it('GROUP_ADMIN access findLoanById company B → TIDAK throw', async () => {
      const mock = { id: 'loan-B-002', companyId: COMPANY_B_ID, employeeId: EMPLOYEE_B_ID };
      jest.spyOn(prisma.loan, 'findUnique').mockResolvedValue(mock as any);

      const result = await runAs(userGroupAdmin(), () =>
        employeeLoanService.findById('loan-B-002')
      );
      expect(result).toBeDefined();
    });

    it('SUPER_ADMIN access findInstanceById company B → TIDAK throw NotFound', async () => {
      const wf = buildWorkflowInstance({ id: 'wf-B-sa', companyId: COMPANY_B_ID });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        template: { stages: [] },
        steps: [],
        logs: [],
      } as any);

      const result = await runAs(userSuperAdmin(), () =>
        workflowEngineRepository.findInstanceById('wf-B-sa')
      );
      expect(result).toBeDefined();
    });

    it('GROUP_ADMIN access findTripById company B → TIDAK throw', async () => {
      const mock = { id: 'trip-B-002', companyId: COMPANY_B_ID, employeeId: EMPLOYEE_B_ID };
      jest.spyOn(prisma.businessTrip, 'findUnique').mockResolvedValue(mock as any);

      const result = await runAs(userGroupAdmin(), () =>
        travelExpenseService.findTripById('trip-B-002')
      );
      expect(result).toBeDefined();
    });
  });

  describe('Self-Service IDOR Guard (create untuk orang lain)', () => {
    it('createLeaveRequest EMPLOYEE non elevated dengan employeeId emp-B → Forbidden IDOR', async () => {
      jest.spyOn(prisma.leaveBalance, 'findMany').mockResolvedValue([
        { leaveTypeId: 'lt-1', remainingDays: 10 } as any,
      ]);
      jest.spyOn(prisma.leaveRequest, 'create').mockResolvedValue({ id: 'new-leave' } as any);

      await expect(
        runAs(userEmployeeA(), () =>
          leaveService.createLeaveRequest({
            companyId: COMPANY_A_ID,
            employeeId: EMPLOYEE_B_ID,
            leaveTypeId: 'lt-1',
            startDate: '2026-01-10',
            endDate: '2026-01-12',
            reason: 'test',
          })
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('createLeaveRequest EMPLOYEE dengan employeeId emp-A (diri) → bukan IDOR Forbidden', async () => {
      jest.spyOn(prisma.leaveBalance, 'findMany').mockResolvedValue([
        { leaveTypeId: 'lt-1', remainingDays: 10 } as any,
      ]);
      jest.spyOn(prisma.workflowTemplate, 'findFirst').mockResolvedValue(null);

      const result = await runAs(userEmployeeA(), () =>
        leaveService.createLeaveRequest({
          companyId: COMPANY_A_ID,
          employeeId: EMPLOYEE_A_ID,
          leaveTypeId: 'lt-1',
          startDate: '2026-01-10',
          endDate: '2026-01-12',
          reason: 'test',
        })
      );
      expect(result).toBeDefined();
    });

    it('createOvertime EMPLOYEE non elevated dengan employeeId emp-B → Forbidden IDOR', async () => {
      await expect(
        runAs(userEmployeeA(), () =>
          attendanceService.createOvertime({
            companyId: COMPANY_A_ID,
            employeeId: EMPLOYEE_B_ID,
            date: '2026-01-10',
            startTime: '18:00',
            endTime: '20:00',
            durationHours: 2,
            reason: 'lembur',
            multiplier: 1.5,
          })
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('createOvertime EMPLOYEE dengan employeeId emp-A (diri) → bukan IDOR Forbidden', async () => {
      jest.spyOn(prisma.overtimeRequest, 'create').mockResolvedValue({ id: 'ot-new' } as any);
      jest.spyOn(prisma.workflowTemplate, 'findFirst').mockResolvedValue(null);

      const result = await runAs(userEmployeeA(), () =>
        attendanceService.createOvertime({
          companyId: COMPANY_A_ID,
          employeeId: EMPLOYEE_A_ID,
          date: '2026-01-10',
          startTime: '18:00',
          endTime: '20:00',
          durationHours: 2,
          reason: 'lembur',
          multiplier: 1.5,
        })
      );
      expect(result).toBeDefined();
    });
  });

  describe('Self-Approval Guard (requester === approver)', () => {
    it('applyAction APPROVE dengan requesterId === userId non SUPER → ForbiddenError', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-self-1',
        companyId: COMPANY_A_ID,
        requesterId: USER_A_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        steps: [
          {
            id: 'step-1',
            level: 1,
            isCurrent: true,
            status: 'PENDING',
            approverRoleCode: 'HR_STAFF',
          },
        ],
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          workflowEngineRepository.applyAction(
            'wf-self-1',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'APPROVE', comment: 'approve sendiri' }
          )
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('applyAction REJECT dengan requesterId === userId non SUPER → ForbiddenError', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-self-2',
        companyId: COMPANY_A_ID,
        requesterId: USER_A_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        steps: [
          {
            id: 'step-1',
            level: 1,
            isCurrent: true,
            status: 'PENDING',
            approverRoleCode: 'HR_STAFF',
          },
        ],
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          workflowEngineRepository.applyAction(
            'wf-self-2',
            USER_A_ID,
            ['HR_STAFF'],
            { action: 'REJECT', comment: 'reject sendiri' }
          )
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('applyAction APPROVE dengan requesterId === userId TAPI SUPER_ADMIN → TIDAK throw (bypass self)', async () => {
      const wf = buildWorkflowInstance({
        id: 'wf-self-sa',
        companyId: COMPANY_A_ID,
        requesterId: USER_SUPERADMIN_ID,
      });
      jest.spyOn(prisma.workflowInstance, 'findUnique').mockResolvedValue({
        ...wf,
        steps: [
          {
            id: 'step-1',
            level: 1,
            isCurrent: true,
            status: 'PENDING',
            approverRoleCode: 'SUPER_ADMIN',
          },
        ],
      } as any);

      await expect(
        runAs(userSuperAdmin(), () =>
          workflowEngineRepository.applyAction(
            'wf-self-sa',
            USER_SUPERADMIN_ID,
            ['SUPER_ADMIN'],
            { action: 'APPROVE', comment: 'sa approve' }
          )
        )
      ).resolves.toBeDefined();
    });
  });
});
