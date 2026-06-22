import api from './api';

export interface CompanyGroup {
  id: string;
  name: string;
  code: string;
  status: string;
  createdAt: string;
  _count: { companies: number };
}

export interface Company {
  id: string;
  groupId: string;
  name: string;
  code: string;
  taxId?: string;
  timezone: string;
  currency: string;
  status: string;
  group?: CompanyGroup;
  _count?: { branches: number; divisions: number; departments: number; employees: number };
}

export interface Branch {
  id: string;
  companyId: string;
  name: string;
  code: string;
  timezone: string;
  status: string;
}

export interface Division {
  id: string;
  companyId: string;
  name: string;
  code: string;
  headId?: string;
  status: string;
  _count: { departments: number };
}

export interface Department {
  id: string;
  companyId: string;
  divisionId?: string;
  parentId?: string;
  name: string;
  code: string;
  headId?: string;
  costCenter?: string;
  status: string;
  _count?: { children: number; positions: number };
}

export interface Position {
  id: string;
  departmentId?: string;
  companyId: string;
  name: string;
  code: string;
  gradeLevel?: number;
  status: string;
}

class OrganizationService {
  // Groups
  async getGroups(): Promise<CompanyGroup[]> {
    const response = await api.get('/organization/groups');
    return response.data.data;
  }

  async getGroup(id: string): Promise<CompanyGroup> {
    const response = await api.get(`/organization/groups/${id}`);
    return response.data.data;
  }

  async createGroup(data: Partial<CompanyGroup>): Promise<CompanyGroup> {
    const response = await api.post('/organization/groups', data);
    return response.data.data;
  }

  async updateGroup(id: string, data: Partial<CompanyGroup>): Promise<CompanyGroup> {
    const response = await api.put(`/organization/groups/${id}`, data);
    return response.data.data;
  }

  async deleteGroup(id: string): Promise<void> {
    await api.delete(`/organization/groups/${id}`);
  }

  // Companies
  async getCompanies(groupId?: string): Promise<Company[]> {
    const params = groupId ? { groupId } : {};
    const response = await api.get('/organization/companies', { params });
    return response.data.data;
  }

  async getCompany(id: string): Promise<Company> {
    const response = await api.get(`/organization/companies/${id}`);
    return response.data.data;
  }

  async createCompany(data: Partial<Company>): Promise<Company> {
    const response = await api.post('/organization/companies', data);
    return response.data.data;
  }

  async updateCompany(id: string, data: Partial<Company>): Promise<Company> {
    const response = await api.put(`/organization/companies/${id}`, data);
    return response.data.data;
  }

  async deleteCompany(id: string): Promise<void> {
    await api.delete(`/organization/companies/${id}`);
  }

  // Branches
  async getBranches(companyId: string): Promise<Branch[]> {
    const response = await api.get('/organization/branches', { params: { companyId } });
    return response.data.data;
  }

  // Departments with hierarchy
  async getDepartmentHierarchy(companyId: string): Promise<Department[]> {
    const response = await api.get(`/organization/departments/hierarchy/${companyId}`);
    return response.data.data;
  }
}

export const organizationService = new OrganizationService();
