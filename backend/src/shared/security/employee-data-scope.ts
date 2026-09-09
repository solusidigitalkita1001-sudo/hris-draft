import type { Prisma } from '@prisma/client';
import { administrationService } from '@/modules/administration/administration.service';
import { getCurrentCompanyId, getCurrentUser, isSystemContext } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';

/** Server-derived predicate, independent of request query/body fields. */
export async function employeeAccessWhere(resource = 'employee'): Promise<Prisma.EmployeeWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const companyId = getCurrentCompanyId();
  if (!actor || !companyId) throw new ForbiddenError('Employee access requires an active company context');
  const user = { ...actor, companyId, employeeId: actor.employeeId ?? undefined, groupId: actor.groupId ?? undefined };
  const scope = await administrationService.findMyDataScopeByUser(companyId, user, resource);
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
