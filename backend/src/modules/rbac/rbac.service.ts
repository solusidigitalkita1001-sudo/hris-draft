import { roleRepository, permissionRepository } from './rbac.repository';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';
import {
  NotFoundError,
  ConflictError,
  ValidationError,
} from '@/shared/exceptions/AppError';
import {
  CreateRoleDTO,
  UpdateRoleDTO,
  AssignPermissionsDTO,
  AssignUserRolesDTO,
} from './rbac.dto';
import prisma from '@/shared/database/prisma';
import { v4 as uuidv4 } from 'uuid';

const logger = new WinstonLogger('RBACService');

export class RoleService {
  async findAll(companyId?: string, groupId?: string) {
    return roleRepository.findAll(companyId, groupId);
  }

  async findById(id: string) {
    const role = await roleRepository.findById(id);
    if (!role) throw new NotFoundError('Role not found');
    return role;
  }

  async create(dto: CreateRoleDTO) {
    const existing = await roleRepository.findByCode(dto.code);
    if (existing) throw new ConflictError(`Role code "${dto.code}" already exists`);

    this.validateScope(dto);

    const role = await roleRepository.create(dto);

    await eventBus.publish({
      name: DomainEvents.ROLE_CREATED,
      aggregateId: role.id,
      aggregateType: 'Role',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return role;
  }

  async update(id: string, dto: UpdateRoleDTO) {
    const role = await this.findById(id);

    if (role.isSystem) {
      throw new ValidationError('System roles cannot be modified');
    }

    if (dto.code && dto.code !== role.code) {
      const existing = await roleRepository.findByCode(dto.code);
      if (existing) throw new ConflictError(`Role code "${dto.code}" already exists`);
    }

    this.validateScope(dto);

    const updated = await roleRepository.update(id, dto);

    await eventBus.publish({
      name: DomainEvents.ROLE_UPDATED,
      aggregateId: id,
      aggregateType: 'Role',
      data: dto,
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return updated;
  }

  async delete(id: string) {
    const role = await this.findById(id);
    if (role.isSystem) {
      throw new ValidationError('System roles cannot be deleted');
    }
    await roleRepository.softDelete(id);

    await eventBus.publish({
      name: DomainEvents.ROLE_DELETED,
      aggregateId: id,
      aggregateType: 'Role',
      data: {},
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });
  }

  async getPermissions(roleId: string) {
    await this.findById(roleId);
    return permissionRepository.getRolePermissions(roleId);
  }

  async assignPermissions(roleId: string, dto: AssignPermissionsDTO) {
    const role = await this.findById(roleId);

    // Verify all permissions exist
    const permissions = await permissionRepository.findByIds(dto.permissionIds);
    if (permissions.length !== dto.permissionIds.length) {
      throw new NotFoundError('One or more permissions not found');
    }

    await permissionRepository.assignToRole(roleId, dto.permissionIds);

    await eventBus.publish({
      name: DomainEvents.PERMISSION_ASSIGNED,
      aggregateId: roleId,
      aggregateType: 'Role',
      data: { permissionIds: dto.permissionIds },
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    logger.info(`Permissions assigned to role ${role.name}: ${dto.permissionIds.length} permissions`);
    return permissionRepository.getRolePermissions(roleId);
  }

  async assignToUser(userId: string, dto: AssignUserRolesDTO) {
    // Verify roles exist
    for (const roleId of dto.roleIds) {
      const role = await roleRepository.findById(roleId);
      if (!role) throw new NotFoundError(`Role ${roleId} not found`);
    }

    // Remove existing roles
    await prisma.userRole.deleteMany({ where: { userId } });

    // Assign new roles
    const userRoles = await prisma.userRole.createMany({
      data: dto.roleIds.map((roleId) => ({
        userId,
        roleId,
        companyId: dto.companyId,
        groupId: dto.groupId,
        scopeType: dto.scopeType as any,
      })),
    });

    await eventBus.publish({
      name: DomainEvents.ROLE_ASSIGNED,
      aggregateId: userId,
      aggregateType: 'User',
      data: { roleIds: dto.roleIds },
      metadata: { eventId: uuidv4(), occurredAt: new Date() },
    });

    return userRoles;
  }

  async getUserRoles(userId: string) {
    return prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            _count: { select: { rolePermissions: true } },
          },
        },
      },
    });
  }

  private validateScope(dto: Partial<CreateRoleDTO>): void {
    if (dto.scope === 'GLOBAL' && dto.companyId) {
      throw new ValidationError('Global roles cannot be scoped to a company');
    }
    if (dto.scope === 'COMPANY' && !dto.companyId) {
      throw new ValidationError('Company-scoped roles must have a companyId');
    }
    if (dto.scope === 'GROUP' && !dto.groupId) {
      throw new ValidationError('Group-scoped roles must have a groupId');
    }
  }
}

export const roleService = new RoleService();

export class PermissionService {
  async findAll(module?: string) {
    return permissionRepository.findAll(module);
  }

  async getUserPermissions(userId: string) {
    return permissionRepository.getUserPermissions(userId);
  }
}

export const permissionService = new PermissionService();
