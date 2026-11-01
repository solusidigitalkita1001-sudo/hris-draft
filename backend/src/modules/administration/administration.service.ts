import { administrationRepository } from './administration.repository';
import {
  UpsertRoleMenuAccessDTO,
  BulkUpsertRoleMenuAccessDTO,
  UpsertRoleDataScopeDTO,
} from './administration.dto';
import { ForbiddenError, ValidationError } from '@/shared/exceptions/AppError';
import { DataScopeType } from '@prisma/client';
import { resolveManagedEmployeeIds } from '@/shared/security/manager-team';

/**
 * Roles that keep company-wide reach when nobody has configured a
 * RoleDataScope row for them. Working across the whole company is what each
 * of them is for: narrowing HR, finance or company administration by default
 * would leave them unable to do the job the role exists to do.
 *
 * Everyone else — the seeded EMPLOYEE role, and any role a tenant invents —
 * is confined to their own record instead, because the absence of
 * configuration used to mean "no filter", which every caller read as "the
 * whole company" (S-H1: any employee could list every colleague's salary).
 *
 * Read against the requester's WHOLE role set, never one role at a time:
 * every privileged user also holds EMPLOYEE (see 05-test-data.seed.ts), so a
 * per-role reading would confine HR to its own records.
 */
export const COMPANY_WIDE_DEFAULT_ROLES = [
  'SUPER_ADMIN',
  'GROUP_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
  'HR_STAFF',
  'FINANCE',
] as const;

/** The role that heads a team, and therefore defaults to seeing it. */
const MANAGER_ROLE = 'MANAGER';

/**
 * A configured RoleDataScope row, or the fail-closed default that stands in
 * for one. `teamEmployeeIds` is pre-resolved for MANAGER_TEAM so that every
 * caller of the lookup gets the ids from the same single resolution.
 */
export interface EffectiveDataScope {
  scopeType: DataScopeType | string;
  scopeValue?: string | null;
  roleCode?: string;
  teamEmployeeIds?: string[];
}

interface UserContext {
  id: string;
  roles?: string[];
  companyId?: string;
  employeeId?: string;
  companyScope?: string[];
  /** Requester's current org unit — populated for OWN_* dynamic scopes. */
  branchId?: string | null;
  departmentId?: string | null;
  subDepartmentId?: string | null;
  /** Employee ids the requester manages — populated for the MANAGER_TEAM scope. */
  teamEmployeeIds?: string[];
}

export class AdministrationService {
  private ensureCompanyScope(
    user: UserContext,
    targetCompanyId: string
  ): void {
    if (this.isSuperAdmin(user)) {
      if (!user.companyId || user.companyId !== targetCompanyId) {
        throw new ForbiddenError('SUPER_ADMIN must select the target company before access');
      }
      return;
    }

    const allowed =
      user.companyScope && user.companyScope.length > 0
        ? user.companyScope
        : user.companyId
          ? [user.companyId]
          : [];

    if (!allowed.includes(targetCompanyId)) {
      throw new ForbiddenError('Cross-company access modification is not allowed');
    }
  }

  private isSuperAdmin(user: UserContext): boolean {
    return user.roles?.includes('SUPER_ADMIN') ?? false;
  }

  async findRoleMenuAccessByRole(
    companyId: string,
    roleCode: string,
    user: UserContext
  ) {
    this.ensureCompanyScope(user, companyId);
    return administrationRepository.findRoleMenuAccessByRole(companyId, roleCode);
  }

  async upsertRoleMenuAccess(data: UpsertRoleMenuAccessDTO, user: UserContext) {
    this.ensureCompanyScope(user, data.companyId);
    return administrationRepository.upsertRoleMenuAccess(data);
  }

  async bulkUpsertRoleMenuAccess(
    data: BulkUpsertRoleMenuAccessDTO,
    user: UserContext
  ) {
    this.ensureCompanyScope(user, data.companyId);
    return administrationRepository.bulkUpsertRoleMenuAccess(
      data.companyId,
      data.roleCode,
      data.items
    );
  }

  async findRoleDataScopeByRole(
    companyId: string,
    roleCode: string,
    resource: string | undefined,
    user: UserContext
  ) {
    this.ensureCompanyScope(user, companyId);
    if (resource) {
      return administrationRepository.findRoleDataScopeByRole(
        companyId,
        roleCode,
        resource
      );
    }
    return administrationRepository.listRoleDataScopesByRole(companyId, roleCode);
  }

  async upsertRoleDataScope(data: UpsertRoleDataScopeDTO, user: UserContext) {
    this.ensureCompanyScope(user, data.companyId);
    this.validateScopeValue(data.scopeType, data.scopeValue);
    return administrationRepository.upsertRoleDataScope(data);
  }

  private validateScopeValue(
    scopeType: DataScopeType | string,
    scopeValue?: string | null
  ): void {
    const needValue = [
      'BRANCH_ONLY',
      'DEPARTMENT_ONLY',
      'SUB_DEPARTMENT_ONLY',
    ].includes(scopeType);

    if (needValue && !scopeValue) {
      throw new ValidationError(
        `scopeValue is required for scopeType ${scopeType}`
      );
    }

    if (scopeValue && needValue) {
      const ids = scopeValue.split(',').map((s) => s.trim()).filter(Boolean);
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of ids) {
        if (!uuidRegex.test(id)) {
          throw new ValidationError(
            `Invalid UUID in scopeValue: ${id}`
          );
        }
      }
    }
  }

  async findMyMenuAccessByRoles(
    companyId: string,
    user: UserContext
  ): Promise<{ deniedMenuPaths: string[]; details: Array<{ menuPath: string; roleCode: string }> }> {
    this.ensureCompanyScope(user, companyId);
    const roles = user.roles ?? [];
    if (this.isSuperAdmin(user)) {
      return { deniedMenuPaths: [], details: [] };
    }
    const raw = await administrationRepository.findMyMenuAccessByRoles(
      companyId,
      roles
    );
    const deniedSet = new Set<string>();
    for (const r of raw) deniedSet.add(r.menuPath);
    return {
      deniedMenuPaths: Array.from(deniedSet),
      details: raw,
    };
  }

  /**
   * The scope that is in force for this requester: the configured row when one
   * exists, otherwise the fail-closed default for their role set. `null` means
   * company-wide — the only unrestricted answer, and now reserved for the
   * roles in COMPANY_WIDE_DEFAULT_ROLES.
   */
  async findMyDataScopeByUser(
    companyId: string,
    user: UserContext,
    resource: string = 'ALL'
  ): Promise<EffectiveDataScope | null> {
    this.ensureCompanyScope(user, companyId);
    const roles = user.roles ?? [];
    const configured = await administrationRepository.findMyDataScopeByUser(
      companyId,
      roles,
      resource
    );
    // A configured row keeps the existing merge semantics untouched: between
    // the requester's roles, the most restrictive row still wins.
    const scope = configured ?? this.defaultDataScopeFor(roles);
    if (!scope) return null;
    if (scope.scopeType === 'MANAGER_TEAM' && user.employeeId) {
      // Resolved here, once, so the middleware, the payroll predicate and the
      // private-file downloads all filter on the same team.
      return { ...scope, teamEmployeeIds: await resolveManagedEmployeeIds(companyId, user.employeeId) };
    }
    return scope;
  }

  /** `null` = company-wide. See COMPANY_WIDE_DEFAULT_ROLES. */
  private defaultDataScopeFor(roles: string[]): EffectiveDataScope | null {
    if (roles.some((role) => (COMPANY_WIDE_DEFAULT_ROLES as readonly string[]).includes(role))) {
      return null;
    }
    if (roles.includes(MANAGER_ROLE)) return { roleCode: MANAGER_ROLE, scopeType: 'MANAGER_TEAM' };
    return { scopeType: 'EMPLOYEE_SELF' };
  }

  resolveEmployeeFilterForCurrentUser(
    scope: EffectiveDataScope | null,
    user: UserContext,
    resource: string = 'employee'
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (!scope) {
      return filter;
    }

    const { scopeType, scopeValue } = scope;
    this.validateScopeValue(scopeType, scopeValue);
    if (['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY'].includes(scopeType)
      && !scopeValue?.split(',').some((id) => id.trim())) {
      throw new ForbiddenError('Data scope has no permitted identifiers');
    }

    // OWN_* dynamic scopes: resolve from the requester's current org unit so
    // access follows them on a transfer. Fail closed (empty set) when the
    // requester has no such unit, rather than leaking company-wide.
    const ownField = (
      field: 'branchId' | 'departmentId' | 'subDepartmentId',
      value: string | null | undefined,
    ): Record<string, unknown> => {
      if (!value) return { [resource === 'employee' ? 'id' : 'employeeId']: { in: [] as string[] } };
      return { [field]: value };
    };
    switch (scopeType) {
      case 'OWN_BRANCH':
        return ownField('branchId', user.branchId);
      case 'OWN_DEPARTMENT':
        return ownField('departmentId', user.departmentId);
      case 'OWN_SUB_DEPARTMENT':
        return ownField('subDepartmentId', user.subDepartmentId);
      case 'MANAGER_TEAM': {
        // Team ids are pre-resolved from the manager's headed units (like OWN_*
        // resolves the current org unit), and the manager is always part of
        // their own scope: an empty team used to throw, which took the
        // manager's own records with it and denied every request they made.
        const ids = new Set(scope.teamEmployeeIds ?? user.teamEmployeeIds ?? []);
        if (user.employeeId) ids.add(user.employeeId);
        // Fail closed: without an employee identity there is nothing to scope to.
        if (ids.size === 0) throw new ForbiddenError('Employee identity is required for manager scope');
        return { [resource === 'employee' ? 'id' : 'employeeId']: { in: [...ids] } };
      }
    }

    switch (scopeType) {
      case 'ALL':
      case 'COMPANY_ONLY':
        break;

      case 'BRANCH_ONLY':
        if (scopeValue) {
          const ids = scopeValue.split(',').map((s) => s.trim()).filter(Boolean);
          filter.branchId = { in: ids };
        }
        break;

      case 'DEPARTMENT_ONLY':
        if (scopeValue) {
          const ids = scopeValue.split(',').map((s) => s.trim()).filter(Boolean);
          filter.departmentId = { in: ids };
        }
        break;

      case 'SUB_DEPARTMENT_ONLY':
        if (scopeValue) {
          const ids = scopeValue.split(',').map((s) => s.trim()).filter(Boolean);
          filter.subDepartmentId = { in: ids };
        }
        break;

      case 'EMPLOYEE_SELF':
        if (!user.employeeId) {
          throw new ForbiddenError('Employee identity is required for self scope');
        }
        if (resource === 'employee') {
          filter.id = user.employeeId;
        } else {
          filter.employeeId = user.employeeId;
        }
        break;

      default:
        throw new ForbiddenError('Unsupported data scope');
    }

    return filter;
  }
}

export const administrationService = new AdministrationService();
