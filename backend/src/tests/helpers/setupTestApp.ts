import { runInRequestContext, RequestUserContext } from '@/shared/context/RequestContext';
import prisma from '@/shared/database/prisma';
import { WorkflowInstance } from '@prisma/client';

export const COMPANY_A_ID = 'comp-A-uuid-0000-0000-0000-000000000001';
export const COMPANY_B_ID = 'comp-B-uuid-0000-0000-0000-000000000002';
export const EMPLOYEE_A_ID = 'emp-A-uuid-0000-0000-0000-000000000001';
export const EMPLOYEE_B_ID = 'emp-B-uuid-0000-0000-0000-000000000002';
export const USER_A_ID = 'user-A-uuid-0000-0000-0000-000000000001';
export const USER_B_ID = 'user-B-uuid-0000-0000-0000-000000000002';
export const USER_SUPERADMIN_ID = 'user-SUPER-uuid-0000-0000-000000000001';

export function makeUserContext(overrides: Partial<RequestUserContext> = {}): RequestUserContext {
  return {
    id: USER_A_ID,
    email: 'user.a@company-a.com',
    employeeId: EMPLOYEE_A_ID,
    companyId: COMPANY_A_ID,
    companyScope: [COMPANY_A_ID],
    groupId: null,
    permissions: [],
    roles: ['HR_STAFF'],
    ...overrides,
  };
}

export function userCompanyA(roles: string[] = ['HR_STAFF']): RequestUserContext {
  return makeUserContext({
    id: USER_A_ID,
    email: 'hr.staff@company-a.com',
    employeeId: EMPLOYEE_A_ID,
    companyId: COMPANY_A_ID,
    companyScope: [COMPANY_A_ID],
    roles,
  });
}

export function userCompanyB(roles: string[] = ['HR_STAFF']): RequestUserContext {
  return makeUserContext({
    id: USER_B_ID,
    email: 'hr.staff@company-b.com',
    employeeId: EMPLOYEE_B_ID,
    companyId: COMPANY_B_ID,
    companyScope: [COMPANY_B_ID],
    roles,
  });
}

export function userEmployeeA(): RequestUserContext {
  return makeUserContext({
    id: USER_A_ID,
    email: 'employee.a@company-a.com',
    employeeId: EMPLOYEE_A_ID,
    companyId: COMPANY_A_ID,
    companyScope: [COMPANY_A_ID],
    roles: ['EMPLOYEE'],
  });
}

export function userEmployeeB(): RequestUserContext {
  return makeUserContext({
    id: USER_B_ID,
    email: 'employee.b@company-b.com',
    employeeId: EMPLOYEE_B_ID,
    companyId: COMPANY_B_ID,
    companyScope: [COMPANY_B_ID],
    roles: ['EMPLOYEE'],
  });
}

export function userSuperAdmin(): RequestUserContext {
  return makeUserContext({
    id: USER_SUPERADMIN_ID,
    email: 'superadmin@system.com',
    employeeId: null,
    companyId: COMPANY_A_ID,
    companyScope: [COMPANY_A_ID, COMPANY_B_ID],
    roles: ['SUPER_ADMIN'],
  });
}

export function userGroupAdmin(): RequestUserContext {
  return makeUserContext({
    id: USER_SUPERADMIN_ID,
    email: 'groupadmin@system.com',
    employeeId: null,
    companyId: COMPANY_A_ID,
    companyScope: [COMPANY_A_ID, COMPANY_B_ID],
    roles: ['GROUP_ADMIN'],
  });
}

export function runAs<T>(user: RequestUserContext, fn: () => T): T {
  return runInRequestContext({ user }, fn);
}

export function mockPrismaSpy(model: string, method: string, returnValue: any): jest.SpyInstance {
  const spy = jest.spyOn((prisma as any)[model], method);
  if (returnValue instanceof Error) {
    spy.mockRejectedValue(returnValue);
  } else if (returnValue !== undefined) {
    spy.mockResolvedValue(returnValue);
  }
  return spy;
}

export function buildWorkflowInstance(overrides: Partial<WorkflowInstance> = {}): WorkflowInstance {
  return {
    id: 'wf-instance-uuid',
    templateId: 'wf-template-uuid',
    companyId: COMPANY_A_ID,
    approvalType: 'LEAVE_REQUEST',
    referenceType: 'LEAVE_REQUEST',
    referenceId: 'ref-uuid',
    requesterId: USER_A_ID,
    payload: {},
    status: 'PENDING',
    currentLevel: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WorkflowInstance;
}

export function clearAllPrismaMocks() {
  jest.restoreAllMocks();
}
