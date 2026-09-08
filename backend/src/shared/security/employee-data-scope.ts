import type { Prisma } from '@prisma/client';
import { administrationService } from '@/modules/administration/administration.service';
import { getCurrentCompanyId, getCurrentUser, isSystemContext } from '@/shared/context/RequestContext';
import { ForbiddenError } from '@/shared/exceptions/AppError';

/** Server-derived predicate, independent of request query/body fields. */
export async function employeeAccessWhere(): Promise<Prisma.EmployeeWhereInput> {
  const actor = getCurrentUser();
  if (!actor && isSystemContext()) return {};
  const companyId = getCurrentCompanyId();
  if (!actor || !companyId) throw new ForbiddenError('Employee access requires an active company context');
  const user = { ...actor, companyId, employeeId: actor.employeeId ?? undefined, groupId: actor.groupId ?? undefined };
  const scope = await administrationService.findMyDataScopeByUser(companyId, user, 'employee');
  return { ...administrationService.resolveEmployeeFilterForCurrentUser(scope, user, 'employee'), companyId };
}
