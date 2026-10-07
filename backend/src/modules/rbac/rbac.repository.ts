import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateRoleDTO, UpdateRoleDTO } from './rbac.dto';
import { revokeSessionsForRole } from '@/shared/security/session-revocation';

export class RoleRepository {
  async findAll(companyId?: string, groupId?: string) {
    const where: Prisma.RoleWhereInput = { deletedAt: null };

    if (companyId || groupId) {
      const scopedFilters: Prisma.RoleWhereInput[] = [{ isSystem: true }];
      if (companyId) scopedFilters.push({ companyId });
      if (groupId) scopedFilters.push({ groupId });
      where.OR = scopedFilters;
    }

    return prisma.role.findMany({
      where,
      include: {
        _count: { select: { userRoles: true, rolePermissions: true } },
      },
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    return prisma.role.findFirst({
      where: { id, deletedAt: null },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { userRoles: true } },
      },
    });
  }

  async findByCode(code: string) {
    return prisma.role.findUnique({ where: { code } });
  }

  // `code` is absent from CreateRoleDTO on purpose -- the DTO refuses a
  // client-sent one (DECISIONS.md D-006) -- so it is Omit-ed before the server's
  // generated code is intersected in. A plain intersection would make the field
  // `undefined & string`, i.e. `never`.
  async create(data: Omit<CreateRoleDTO, 'code'> & { code: string }) {
    return prisma.role.create({ data });
  }

  async update(id: string, data: UpdateRoleDTO) {
    return prisma.role.update({ where: { id }, data });
  }

  async softDelete(id: string) {
    return prisma.role.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}

export const roleRepository = new RoleRepository();

export class PermissionRepository {
  async findAll(module?: string) {
    const where: Prisma.PermissionWhereInput = {};
    if (module) where.module = module;

    return prisma.permission.findMany({
      where,
      orderBy: [{ module: 'asc' }, { resource: 'asc' }],
    });
  }

  async findByIds(ids: string[]) {
    return prisma.permission.findMany({
      where: { id: { in: ids } },
    });
  }

  async assignToRole(roleId: string, permissionIds: string[]) {
    // Remove existing permissions
    await prisma.rolePermission.deleteMany({
      where: { roleId },
    });

    // Assign new permissions
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });

    // Everyone holding this role carries its old permission set in their access
    // token, so the edit only reached them when that token expired.
    await revokeSessionsForRole(roleId, 'role-permissions-changed');
  }

  async getRolePermissions(roleId: string) {
    return prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
    });
  }

  async getUserPermissions(userId: string) {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    const permissions = new Set<string>();
    for (const ur of userRoles) {
      for (const rp of ur.role.rolePermissions) {
        permissions.add(`${rp.permission.resource}:${rp.permission.action}`);
      }
    }

    return Array.from(permissions);
  }
}

export const permissionRepository = new PermissionRepository();
