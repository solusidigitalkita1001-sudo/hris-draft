import { administrationRepository } from './administration.repository';
import {
  UpsertRoleMenuAccessDTO,
  BulkUpsertRoleMenuAccessDTO,
  UpsertRoleDataScopeDTO,
} from './administration.dto';
import { ForbiddenError, ValidationError } from '@/shared/exceptions/AppError';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import { DataScopeType } from '@prisma/client';

const logger = new WinstonLogger('AdministrationService');

const ADMIN_ROLES = ['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN'];

interface UserContext {
  id: string;
  roles?: string[];
  companyId?: string;
  employeeId?: string;
  companyScope?: string[];
}

export class AdministrationService {
  private ensureCompanyScope(
    user: UserContext,
    targetCompanyId: string
  ): void {
    if (!user.roles?.some((r) => ADMIN_ROLES.includes(r))) {
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

  async findMyDataScopeByUser(
    companyId: string,
    user: UserContext,
    resource: string = 'ALL'
  ) {
    const roles = user.roles ?? [];
    return administrationRepository.findMyDataScopeByUser(
      companyId,
      roles,
      resource
    );
  }

  resolveEmployeeFilterForCurrentUser(
    scope: {
      scopeType: DataScopeType | string;
      scopeValue?: string | null;
      roleCode?: string;
    } | null,
    user: UserContext,
    resource: string = 'employee'
  ): Record<string, unknown> {
    const filter: Record<string, unknown> = {};

    if (!scope) {
      return filter;
    }

    const { scopeType, scopeValue } = scope;

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
        if (resource === 'employee') {
          filter.id = user.employeeId;
        } else {
          filter.employeeId = user.employeeId;
        }
        break;

      case 'MANAGER_TEAM':
        logger.warn(
          `MANAGER_TEAM scope for resource=${resource} is placeholder — not applying filter yet`
        );
        break;

      default:
        break;
    }

    return filter;
  }
}

export const administrationService = new AdministrationService();
