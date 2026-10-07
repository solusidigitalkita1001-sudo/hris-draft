import { getCurrentCompanyId, getCurrentUser } from '@/shared/context/RequestContext';
import { employeeAccessWhere } from '@/shared/security/employee-data-scope';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import type { Prisma } from '@prisma/client';

export const EWA_HR_ROLES = ['HR_STAFF', 'HR_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN'];
// FINANCE is the seeded role that releases money (03-role-permissions.seed.ts);
// it was missing here, so the one role defined for disbursement could not mark
// an EWA payout paid while the payroll approver could. FINANCE_STAFF and
// FINANCE_MANAGER are not seeded by this product and stay only because a
// tenant may have defined them.
export const EWA_FINANCE_ROLES = ['FINANCE', 'FINANCE_STAFF', 'FINANCE_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN'];

export async function ewaAccess(options: { companyId?: string; actorId?: string; self?: boolean } = {}) {
  const actor = getCurrentUser(), companyId = getCurrentCompanyId();
  if (!actor?.id || !companyId) throw new ForbiddenError('EWA requires an authenticated company context');
  if (options.companyId !== undefined && options.companyId !== companyId) throw new ForbiddenError('EWA company must match the active company');
  if ('actorId' in options && options.actorId !== actor.id) throw new ForbiddenError('EWA actor must match the authenticated user');
  const staff = actor.roles?.some(role => EWA_HR_ROLES.includes(role) || EWA_FINANCE_ROLES.includes(role));
  const self = options.self || !staff;
  const ownership: Prisma.EmployeeWhereInput[] = [];
  if (self) {
    if (!actor.employeeId) throw new ForbiddenError('EWA self-service requires an employee identity');
    ownership.push({ id: actor.employeeId });
  }
  // EWA responses include salary-derived amounts. Both resource scopes apply;
  // EWA permissions authorize this purpose without requiring payroll:read.
  const scopes = await Promise.all([employeeAccessWhere('ewa'), employeeAccessWhere('payroll')]);
  const employeeWhere: Prisma.EmployeeWhereInput = {
    companyId, deletedAt: null, AND: [...scopes, ...ownership],
  };
  return { actor, companyId, employeeWhere };
}

export function ewaRecordWhere(companyId: string, employeeWhere: Prisma.EmployeeWhereInput): Prisma.EarnedWageAccessWhereInput {
  return {
    companyId, employee: employeeWhere,
    AND: [
      { OR: [{ payrollPeriodId: null }, { payrollPeriod: { companyId, deletedAt: null } }] },
      { OR: [{ payrollRunId: null }, { payrollRun: { companyId, deletedAt: null, period: { companyId, deletedAt: null } } }] },
    ],
  };
}

export const EWA_AUDIT_REDACTIONS = [
  'earnedGrossReference', 'earnedGrossAtRequest', 'maxAllowedAtRequest', 'totalApprovedSamePeriod',
  'amountRequested', 'adminFee', 'amountPaidOut', 'amountDeductedPayroll', 'reason', 'approverNotes',
  'rejectReason', 'disbursementReference', 'notes', 'employee',
] as const;
