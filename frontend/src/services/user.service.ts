import api from './api';

export interface UserData {
  id: string;
  email: string;
  status: string;
  lastLoginAt?: string;
  mustChangePassword: boolean;
  createdAt: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  userRoles?: { role: { id: string; name: string; code: string } }[];
}

export interface CreateUserPayload {
  email: string;
  password: string;
  employeeId?: string;
}

export interface UpdateUserPayload {
  email?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  employeeId?: string | null;
}

export interface AssignUserRolesPayload {
  roleIds: string[];
  companyId?: string;
  groupId?: string;
  scopeType?: 'GLOBAL' | 'GROUP' | 'COMPANY';
}

class UserService {
  async getAll(companyId: string, search?: string): Promise<UserData[]> {
    const r = await api.get('/users', { params: { companyId, search, limit: 100 } });
    return r.data.data;
  }

  async get(id: string): Promise<UserData> {
    const r = await api.get(`/users/${id}`);
    return r.data.data;
  }

  async create(data: CreateUserPayload): Promise<UserData> {
    const r = await api.post('/users', data);
    return r.data.data;
  }

  async update(id: string, data: UpdateUserPayload): Promise<UserData> {
    const r = await api.put(`/users/${id}`, data);
    return r.data.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }

  async assignRoles(id: string, payload: AssignUserRolesPayload): Promise<void> {
    await api.put(`/users/${id}/roles`, payload);
  }
}

export const userService = new UserService();
