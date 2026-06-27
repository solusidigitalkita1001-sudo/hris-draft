import api from './api';

// ─── Types ──────────────────────────────────────────────
export interface Role {
  id: string;
  companyId?: string | null;
  groupId?: string | null;
  name: string;
  code: string;
  description?: string | null;
  scope: 'GLOBAL' | 'GROUP' | 'COMPANY';
  isSystem: boolean;
  priority: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { rolePermissions: number; userRoles: number };
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  name: string;
  code: string;
  description?: string | null;
  module: string;
}

export interface RoleDetail extends Role {
  rolePermissions: { permissionId: string }[];
}

// ─── Service ────────────────────────────────────────────
class RbacService {
  // ─── Roles ────────────────────────────────────────────
  async findAll(companyId?: string, groupId?: string) {
    const params: Record<string, string> = {};
    if (companyId) params.companyId = companyId;
    if (groupId) params.groupId = groupId;
    const r = await api.get('/roles', { params });
    return r.data.data as Role[];
  }

  async findById(id: string) {
    const r = await api.get(`/roles/${id}`);
    return r.data.data as RoleDetail;
  }

  async create(data: Partial<Role>) {
    const r = await api.post('/roles', data);
    return r.data.data as Role;
  }

  async update(id: string, data: Partial<Role>) {
    const r = await api.put(`/roles/${id}`, data);
    return r.data.data as Role;
  }

  async delete(id: string) {
    const r = await api.delete(`/roles/${id}`);
    return r.data;
  }

  // ─── Role Permissions ─────────────────────────────────
  async getPermissions(roleId: string) {
    const r = await api.get(`/roles/${roleId}/permissions`);
    return r.data.data as Permission[];
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    const r = await api.put(`/roles/${roleId}/permissions`, { permissionIds });
    return r.data.data;
  }

  // ─── Permission Catalog ───────────────────────────────
  async getAllPermissions(module?: string) {
    const params: Record<string, string> = {};
    if (module) params.module = module;
    const r = await api.get('/roles/permissions/all', { params });
    return r.data.data as Permission[];
  }
}

export const rbacService = new RbacService();
