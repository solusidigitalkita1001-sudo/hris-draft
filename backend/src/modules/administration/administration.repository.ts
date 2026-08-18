import prisma from '@/shared/database/prisma';
import { Prisma, DataScopeType } from '@prisma/client';
import {
  UpsertRoleMenuAccessDTO,
  UpsertRoleDataScopeDTO,
} from './administration.dto';

const SCOPE_RESTRICTIVENESS: Record<DataScopeType, number> = {
  ALL: 0,
  COMPANY_ONLY: 1,
  BRANCH_ONLY: 2,
  DEPARTMENT_ONLY: 3,
  SUB_DEPARTMENT_ONLY: 4,
  MANAGER_TEAM: 5,
  EMPLOYEE_SELF: 6,
};

export class AdministrationRepository {
  async findRoleMenuAccessByRole(companyId: string, roleCode: string) {
    return prisma.roleMenuAccess.findMany({
      where: { companyId, roleCode },
      orderBy: { menuPath: 'asc' },
    });
  }

  async upsertRoleMenuAccess(data: UpsertRoleMenuAccessDTO) {
    const { companyId, roleCode, menuPath, accessType } = data;
    return prisma.roleMenuAccess.upsert({
      where: {
        companyId_roleCode_menuPath: { companyId, roleCode, menuPath },
      },
      update: { accessType },
      create: { companyId, roleCode, menuPath, accessType },
    });
  }

  async bulkUpsertRoleMenuAccess(
    companyId: string,
    roleCode: string,
    items: Array<{ menuPath: string; accessType: 'ALLOW' | 'DENY' }>
  ) {
    const results = [];
    for (const item of items) {
      const result = await prisma.roleMenuAccess.upsert({
        where: {
          companyId_roleCode_menuPath: {
            companyId,
            roleCode,
            menuPath: item.menuPath,
          },
        },
        update: { accessType: item.accessType },
        create: {
          companyId,
          roleCode,
          menuPath: item.menuPath,
          accessType: item.accessType,
        },
      });
      results.push(result);
    }
    return results;
  }

  async findRoleDataScopeByRole(
    companyId: string,
    roleCode: string,
    resource: string = 'ALL'
  ) {
    return prisma.roleDataScope.findFirst({
      where: { companyId, roleCode, resource },
    });
  }

  async listRoleDataScopesByRole(companyId: string, roleCode: string) {
    return prisma.roleDataScope.findMany({
      where: { companyId, roleCode },
      orderBy: { resource: 'asc' },
    });
  }

  async upsertRoleDataScope(data: UpsertRoleDataScopeDTO) {
    const { companyId, roleCode, resource, scopeType, scopeValue } = data;
    return prisma.roleDataScope.upsert({
      where: {
        companyId_roleCode_resource: { companyId, roleCode, resource },
      },
      update: { scopeType, scopeValue },
      create: { companyId, roleCode, resource, scopeType, scopeValue },
    });
  }

  async findMyDataScopeByUser(
    companyId: string,
    roles: string[],
    resource: string = 'ALL'
  ) {
    if (!roles || roles.length === 0) {
      return null;
    }

    const scopes = await prisma.roleDataScope.findMany({
      where: {
        companyId,
        roleCode: { in: roles },
        resource: { in: [resource, 'ALL'] },
      },
    });

    if (scopes.length === 0) {
      return null;
    }

    let mostRestrictive = scopes[0];
    for (const scope of scopes) {
      const currentRank = SCOPE_RESTRICTIVENESS[scope.scopeType] ?? 0;
      const bestRank = SCOPE_RESTRICTIVENESS[mostRestrictive.scopeType] ?? 0;
      if (currentRank > bestRank) {
        mostRestrictive = scope;
      } else if (currentRank === bestRank && scope.resource === resource && mostRestrictive.resource === 'ALL') {
        mostRestrictive = scope;
      }
    }

    return mostRestrictive;
  }

  async findMyMenuAccessByRoles(companyId: string, roles: string[]) {
    if (!roles || roles.length === 0) {
      return [];
    }

    const accesses = await prisma.roleMenuAccess.findMany({
      where: {
        companyId,
        roleCode: { in: roles },
        accessType: 'DENY',
      },
      select: { menuPath: true, roleCode: true },
    });

    return accesses;
  }
}

export const administrationRepository = new AdministrationRepository();
