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
  careerTransactions?: CareerTransaction[];
}

export interface CareerTransaction {
  id: string;
  employeeId: string;
  companyId: string;
  transactionType: 'PROMOTION' | 'DEMOTION' | 'MUTATION' | 'TRANSFER' | 'ROTATION' | 'ACTING_ASSIGNMENT' | 'STATUS_CHANGE';
  effectiveDate: string;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  fromDepartmentId?: string | null;
  toDepartmentId?: string | null;
  fromPositionId?: string | null;
  toPositionId?: string | null;
  fromEmploymentType?: string | null;
  toEmploymentType?: string | null;
  referenceNumber?: string | null;
  reason?: string | null;
  notes?: string | null;
  createdBy?: string | null;
  createdAt: string;
  fromBranch?: { id: string; name: string } | null;
  toBranch?: { id: string; name: string } | null;
  fromDepartment?: { id: string; name: string } | null;
  toDepartment?: { id: string; name: string } | null;
  fromPosition?: { id: string; name: string } | null;
  toPosition?: { id: string; name: string } | null;
  creator?: { id: string; email: string } | null;
}

export interface EmployeeQueryResult {
  data: Employee[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ImportCsvResult {
  imported: number;
  skipped: number;
  errors: string[];
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

  async getCareerTransactions(id: string): Promise<CareerTransaction[]> {
    const response = await api.get(`/employees/${id}/career-transactions`);
    return response.data.data;
  }

  async createCareerTransaction(
    id: string,
    data: {
      effectiveDate: string;
      transactionType: CareerTransaction['transactionType'];
      toBranchId?: string | null;
      toDepartmentId?: string | null;
      toPositionId?: string | null;
      toEmploymentType?: string | null;
      referenceNumber?: string;
      reason?: string;
      notes?: string;
    }
  ): Promise<CareerTransaction> {
    const response = await api.post(`/employees/${id}/career-transactions`, data);
    return response.data.data;
  }

  /**
   * Import employees from a CSV file.
   * @param formData - FormData containing the CSV file under the key "file"
   * @param companyId - Company ID to associate the import with
   */
  async importCsv(formData: FormData, companyId: string): Promise<ImportCsvResult> {
    formData.append('companyId', companyId);
    const response = await api.post('/employees/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.data;
  }

  /**
   * Export employees to a CSV file (blob download).
   * @param params - Filter parameters to narrow the export
   */
  async exportCsv(params: {
    companyId: string;
    departmentId?: string;
    positionId?: string;
    status?: string;
  }): Promise<Blob> {
    const response = await api.get('/employees/export', {
      params,
      responseType: 'blob',
    });
    return response.data;
  }
}

export const employeeService = new EmployeeService();
