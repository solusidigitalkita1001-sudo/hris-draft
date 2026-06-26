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

class UserService {
  async getAll(companyId: string): Promise<UserData[]> {
    const r = await api.get('/users', { params: { companyId } });
    return r.data.data;
  }

  async get(id: string): Promise<UserData> {
    const r = await api.get(`/users/${id}`);
    return r.data.data;
  }

  async create(data: any): Promise<UserData> {
    const r = await api.post('/users', data);
    return r.data.data;
  }

  async update(id: string, data: any): Promise<UserData> {
    const r = await api.put(`/users/${id}`, data);
    return r.data.data;
  }

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`);
  }

  async assignRoles(id: string, roleIds: string[]): Promise<void> {
    await api.put(`/users/${id}/roles`, { roleIds });
  }
}

export const userService = new UserService();
