import type { Prisma } from '@prisma/client';
import { administrationService } from '@/modules/administration/administration.service';
import { getCurrentCompanyId, getCurrentUser, isSystemContext, isSuperAdmin, runInSystemContext } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';

/** Server-derived predicate, independent of request query/body fields. */
export async function employeeAccessWhere(resource = 'employee'): Promise<Prisma.EmployeeWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const companyId = getCurrentCompanyId();
  // SUPER_ADMIN platform account reads across tenants; with no company selected
  // it has no tenant filter (returns all), consistent with the Prisma tenant
  // middleware bypass. A selected company still scopes normally (companyId set).
  if (actor && !companyId && isSuperAdmin()) return {};
  if (!actor || !companyId) throw new ForbiddenError('Employee access requires an active company context');
  const user: {
    id: string; roles?: string[]; companyId: string; employeeId?: string; companyScope?: string[]; groupId?: string;
    branchId?: string | null; departmentId?: string | null; subDepartmentId?: string | null;
  } = { id: actor.id, roles: actor.roles, companyScope: actor.companyScope, companyId, employeeId: actor.employeeId ?? undefined, groupId: actor.groupId ?? undefined };
  const scope = await administrationService.findMyDataScopeByUser(companyId, user, resource);
  // For OWN_* dynamic scopes, resolve the requester's CURRENT org unit once
  // (only when such a scope is in effect, to avoid the lookup otherwise).
  if (actor.employeeId && typeof scope?.scopeType === 'string' && scope.scopeType.startsWith('OWN_')) {
    const self = await runInSystemContext('own-scope-org-lookup', () =>
      prisma.employee.findFirst({ where: { id: actor.employeeId!, companyId, deletedAt: null }, select: { branchId: true, departmentId: true, subDepartmentId: true } }));
    user.branchId = self?.branchId ?? null;
    user.departmentId = self?.departmentId ?? null;
    user.subDepartmentId = self?.subDepartmentId ?? null;
  }
  // The queried model remains Employee, including when a payroll permission
  // supplies the scope. Self must therefore resolve to id, not employeeId.
  return { ...administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee'), companyId };
}

/** Employee-profile access alone does not authorize the nested salary data. */
export async function profileSalaryAccessWhere(): Promise<Prisma.EmployeeSalaryWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const denied = { id: { in: [] as string[] } };
  if (!actor?.roles?.includes('SUPER_ADMIN') && !actor?.permissions?.some(permission => ['payroll:read', 'payroll:*'].includes(permission))) {
    return denied;
  }
  try {
    const scope = await employeeAccessWhere('payroll');
    return { companyId: getCurrentCompanyId(), employee: { deletedAt: null, AND: [scope] } };
  } catch (error) {
    // A forbidden payroll subresource does not prevent reading an otherwise
    // authorized employee profile. Other lookup failures still propagate.
    if (error instanceof ForbiddenError) return denied;
    throw error;
  }
}
