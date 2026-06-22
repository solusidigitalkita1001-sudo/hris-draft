import prisma from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateRoleDTO, UpdateRoleDTO } from './rbac.dto';

export class RoleRepository {
  async findAll(companyId?: string, groupId?: string) {
    const where: Prisma.RoleWhereInput = { deletedAt: null };

    if (companyId) where.companyId = companyId;
    if (groupId) where.groupId = groupId;

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

  async create(data: CreateRoleDTO) {
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
