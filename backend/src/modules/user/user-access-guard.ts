import prisma from '@/shared/database/prisma';
import { ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import {
  getCurrentUser,
  isGroupAdmin,
  isSuperAdmin,
  runInSystemContext,
} from '@/shared/context/RequestContext';

/**
 * Company ids the requester administers. `null` means unrestricted
 * (SUPER_ADMIN). User/RBAC admin models are not company-scoped in Prisma,
 * so this guard is the authority boundary for the user module.
 */
export function requesterCompanyIds(): string[] | null {
  if (isSuperAdmin()) return null;
  const user = getCurrentUser();
  const scope = new Set(user?.companyScope ?? []);
  if (user?.companyId) scope.add(user.companyId);
  return [...scope];
}

/**
 * A company-access grant may only target a company the requester
 * administers, and GROUP_WIDE grants require an admin of that same group.
 */
export function assertCompanyAccessAuthority(
  targetCompanyId: string,
  opts: { groupId?: string | null; accessScope?: string } = {},
): void {
  const allowed = requesterCompanyIds();
  if (allowed === null) return;
  if (!allowed.includes(targetCompanyId)) {
    throw new ForbiddenError('Cannot manage company access outside your company scope');
  }
  if (opts.accessScope === 'GROUP_WIDE' || opts.groupId) {
    const requester = getCurrentUser();
    if (!isGroupAdmin() || !requester?.groupId || (opts.groupId && opts.groupId !== requester.groupId)) {
      throw new ForbiddenError('Group-wide access can only be granted by an admin of that group');
    }
  }
}

interface ScopeCheckableUser {
  employee?: { company?: { id: string } | null } | null;
  companyAccesses?: { companyId: string }[];
}

/**
 * Target user must be visible to the requester: linked to, or granted access
 * to, at least one company the requester administers. Fails as 404 so user
 * existence is not leaked across tenants.
 */
export function assertUserWithinScope(user: ScopeCheckableUser): void {
  const allowed = requesterCompanyIds();
  if (allowed === null) return;
  const companyIds = [
    user.employee?.company?.id,
    ...(user.companyAccesses ?? []).map((access) => access.companyId),
  ].filter((id): id is string => Boolean(id));
  if (!companyIds.some((id) => allowed.includes(id))) {
    throw new NotFoundError('User not found');
  }
}

/**
 * The employee being linked to a user account must belong to a company the
 * requester administers. Runs in system context because the requester may be
 * a multi-company admin with no single tenant context.
 */
export async function assertEmployeeWithinScope(employeeId: string): Promise<void> {
  const employee = await runInSystemContext('user-employee-link-scope-check', () =>
    prisma.employee.findFirst({ where: { id: employeeId, deletedAt: null }, select: { companyId: true } }));
  if (!employee) throw new NotFoundError('Employee not found');
  const allowed = requesterCompanyIds();
  if (allowed !== null && !allowed.includes(employee.companyId)) {
    throw new ForbiddenError('Employee belongs to a company outside your scope');
  }
}
