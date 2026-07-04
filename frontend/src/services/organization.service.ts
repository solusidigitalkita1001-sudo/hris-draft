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
  attendancePolicy?: BranchAttendancePolicy | null;
}

export type AttendancePolicyMethod = 'FINGERPRINT' | 'MOBILE_GPS' | 'BOTH' | 'MANUAL';
export type OutsideRadiusAction = 'REJECT' | 'FLAG' | 'REVIEW';

export interface BranchAttendancePolicy {
  id: string;
  companyId: string;
  branchId: string;
  attendanceMethod: AttendancePolicyMethod;
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsRadiusMeters?: number | null;
  allowOutsideRadius: boolean;
  outsideRadiusAction: OutsideRadiusAction;
  lateToleranceMinutes: number;
  earlyCheckoutToleranceMinutes: number;
  allowHolidayAttendance: boolean;
  allowWeekendAttendance: boolean;
  autoAbsentEnabled: boolean;
  autoCheckoutEnabled: boolean;
  requiresSelfie: boolean;
  requiresLocation: boolean;
  isActive: boolean;
  notes?: string | null;
}

export interface Division {
  id: string;
  companyId: string;
  name: string;
  code: string;
  headId?: string;
  status: string;
  head?: { id: string; fullName: string } | null;
  _count?: { departments: number };
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
  head?: { id: string; fullName: string } | null;
  _count?: { children: number; positions: number };
  children?: Department[];
  subDepartments?: Department[];
}

export interface Position {
  id: string;
  departmentId?: string;
  companyId: string;
  name: string;
  code: string;
  gradeLevel?: number;
  status: string;
  department?: { id: string; name: string } | null;
  reportsTo?: { id: string; name: string } | null;
  _count?: { employees: number };
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

  async findBranches(companyId?: string): Promise<Branch[]> {
    const params = companyId ? { companyId } : {};
    const response = await api.get('/organization/branches', { params });
    return response.data.data;
  }

  async createBranch(data: Partial<Branch>): Promise<Branch> {
    const response = await api.post('/organization/branches', data);
    return response.data.data;
  }

  async updateBranch(id: string, data: Partial<Branch>): Promise<Branch> {
    const response = await api.put(`/organization/branches/${id}`, data);
    return response.data.data;
  }

  async deleteBranch(id: string): Promise<void> {
    await api.delete(`/organization/branches/${id}`);
  }

  async getBranchAttendancePolicy(branchId: string): Promise<BranchAttendancePolicy | null> {
    const response = await api.get(`/organization/branches/${branchId}/attendance-policy`);
    return response.data.data;
  }

  async upsertBranchAttendancePolicy(
    branchId: string,
    data: Partial<BranchAttendancePolicy> & { attendanceMethod: AttendancePolicyMethod },
  ): Promise<BranchAttendancePolicy> {
    const response = await api.put(`/organization/branches/${branchId}/attendance-policy`, data);
    return response.data.data;
  }

  async deleteBranchAttendancePolicy(branchId: string): Promise<void> {
    await api.delete(`/organization/branches/${branchId}/attendance-policy`);
  }

  // Divisions
  async getDivisions(companyId: string): Promise<Division[]> {
    const response = await api.get('/organization/divisions', { params: { companyId } });
    return response.data.data;
  }

  // Departments
  async getDepartments(companyId: string, divisionId?: string): Promise<Department[]> {
    const params: Record<string, string> = { companyId };
    if (divisionId) params.divisionId = divisionId;
    const response = await api.get('/organization/departments', { params });
    return response.data.data;
  }

  async getDepartment(id: string): Promise<Department> {
    const response = await api.get(`/organization/departments/${id}`);
    return response.data.data;
  }

  async createDepartment(data: Partial<Department>): Promise<Department> {
    const response = await api.post('/organization/departments', data);
    return response.data.data;
  }

  async updateDepartment(id: string, data: Partial<Department>): Promise<Department> {
    const response = await api.put(`/organization/departments/${id}`, data);
    return response.data.data;
  }

  async deleteDepartment(id: string): Promise<void> {
    await api.delete(`/organization/departments/${id}`);
  }

  // Departments with hierarchy
  async getDepartmentHierarchy(companyId: string): Promise<Department[]> {
    const response = await api.get(`/organization/departments/hierarchy/${companyId}`);
    return response.data.data;
  }

  // Positions
  async getPositions(companyId: string, departmentId?: string): Promise<Position[]> {
    const params: Record<string, string> = { companyId };
    if (departmentId) params.departmentId = departmentId;
    const response = await api.get('/organization/positions', { params });
    return response.data.data;
  }

  async getPosition(id: string): Promise<Position> {
    const response = await api.get(`/organization/positions/${id}`);
    return response.data.data;
  }

  async createPosition(data: Partial<Position>): Promise<Position> {
    const response = await api.post('/organization/positions', data);
    return response.data.data;
  }

  async updatePosition(id: string, data: Partial<Position>): Promise<Position> {
    const response = await api.put(`/organization/positions/${id}`, data);
    return response.data.data;
  }

  async deletePosition(id: string): Promise<void> {
    await api.delete(`/organization/positions/${id}`);
  }
}

export const organizationService = new OrganizationService();
