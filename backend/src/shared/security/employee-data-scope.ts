import type { Prisma } from '@prisma/client';
import { administrationService } from '@/modules/administration/administration.service';
import { getCurrentCompanyId, getCurrentUser, isSystemContext, runInSystemContext } from '@/shared/context/RequestContext';
import { ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';

/** Server-derived predicate, independent of request query/body fields. */
export async function employeeAccessWhere(resource = 'employee'): Promise<Prisma.EmployeeWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const companyId = getCurrentCompanyId();
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
  // MANAGER_TEAM needs no work here: the scope lookup pre-resolves the ids the
  // manager heads, so every caller filters on the same team.
  // The queried model remains Employee, including when a payroll permission
  // supplies the scope. Self must therefore resolve to id, not employeeId.
  return { ...administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee'), companyId };
}

/**
 * Enforce the caller's data scope on a fetch-by-path/by-id endpoint that takes a
 * target employeeId directly (which the middleware's req.query rewrite cannot
 * reach). Out-of-scope → NotFound, mirroring the cross-tenant IDOR contract.
 * No-op for SUPER_ADMIN/system and for ALL/COMPANY_ONLY scopes (whose predicate
 * only constrains companyId), so only already-restricted users are tightened.
 */
export async function assertEmployeeInScope(employeeId: string, resource = 'employee'): Promise<void> {
  const scope = await employeeAccessWhere(resource);
  const allowed = await prisma.employee.findFirst({
    where: { id: employeeId, deletedAt: null, AND: [scope] },
    select: { id: true },
  });
  if (!allowed) throw new NotFoundError('Employee not found');
}

/**
 * Employee-profile access alone does not authorize the nested salary data of
 * OTHER people: that still takes a payroll permission and the data scope it
 * resolves to. One's own salary is not other people's data, though, and it is
 * reachable without `payroll:read` — which the EMPLOYEE role no longer holds,
 * precisely because it is a company-wide permission.
 */
export async function profileSalaryAccessWhere(): Promise<Prisma.EmployeeSalaryWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const companyId = getCurrentCompanyId();
  // Only within a resolved company: an undefined companyId would filter nothing.
  const own: Prisma.EmployeeSalaryWhereInput | null = actor?.employeeId && companyId
    ? { companyId, employeeId: actor.employeeId, employee: { deletedAt: null } }
    : null;
  /** Without a payroll permission there is exactly one salary to show: one's own. */
  const ownOnly: Prisma.EmployeeSalaryWhereInput = own ?? { id: { in: [] as string[] } };
  if (!actor?.roles?.includes('SUPER_ADMIN') && !actor?.permissions?.some(permission => ['payroll:read', 'payroll:*'].includes(permission))) {
    return ownOnly;
  }
  try {
    const scope = await employeeAccessWhere('payroll');
    const permitted: Prisma.EmployeeSalaryWhereInput = { companyId, employee: { deletedAt: null, AND: [scope] } };
    return own ? { OR: [own, permitted] } : permitted;
  } catch (error) {
    // A forbidden payroll subresource does not prevent reading an otherwise
    // authorized employee profile. Other lookup failures still propagate.
    if (error instanceof ForbiddenError) return ownOnly;
    throw error;
  }
}
