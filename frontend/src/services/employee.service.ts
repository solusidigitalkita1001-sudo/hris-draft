import api from './api';

export interface Employee {
  id: string;
  companyId: string;
  branchId?: string;
  departmentId?: string;
  subDepartmentId?: string;
  positionId?: string;
  employeeNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email?: string;
  phone?: string;
  idNumber?: string;
  gender?: string;
  religion?: string;
  maritalStatus?: string;
  address?: string;
  avatar?: string;
  joinDate?: string;
  employmentStatus: string;
  employmentType: string;
  bankName?: string;
  bankAccount?: string;
  bankAccountHolder?: string;
  taxId?: string;
  status: string;
  department?: { id: string; name: string };
  position?: { id: string; name: string };
  branch?: { id: string; name: string };
  bpjsKetenagakerjaan?: string;
  bpjsKesehatan?: string;
  createdAt: string;
}

export interface EmployeeQueryResult {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class EmployeeService {
  async getEmployees(params: {
    companyId: string;
    departmentId?: string;
    positionId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<EmployeeQueryResult> {
    const response = await api.get('/employees', { params });
    return {
      data: response.data.data,
      total: response.data.meta?.total || 0,
      page: response.data.meta?.page || 1,
      limit: response.data.meta?.limit || 20,
      totalPages: response.data.meta?.totalPages || 0,
    };
  }

  async getEmployee(id: string): Promise<Employee> {
    const response = await api.get(`/employees/${id}`);
    return response.data.data;
  }

  async createEmployee(data: Partial<Employee>): Promise<Employee> {
    const response = await api.post('/employees', data);
    return response.data.data;
  }

  async updateEmployee(id: string, data: Partial<Employee>): Promise<Employee> {
    const response = await api.put(`/employees/${id}`, data);
    return response.data.data;
  }

  async deleteEmployee(id: string): Promise<void> {
    await api.delete(`/employees/${id}`);
  }

  async updateEmployeeStatus(id: string, status: string): Promise<Employee> {
    const response = await api.patch(`/employees/${id}/status`, { status });
    return response.data.data;
  }
}

export const employeeService = new EmployeeService();
