import api from './api';

export interface SalaryComponent {
  id: string;
  companyId: string;
  name: string;
  code: string;
  type: 'ALLOWANCE' | 'DEDUCTION';
  calculationMethod: string;
  amount?: number;
  ratePercent?: number;
  isTaxable: boolean;
  isProrated: boolean;
  isActive: boolean;
  description?: string;
  sortOrder: number;
  createdAt: string;
}

export interface EmployeeSalaryComponent {
  id: string;
  employeeSalaryId: string;
  salaryComponentId: string;
  amount: number;
  isActive: boolean;
  salaryComponent: SalaryComponent;
}

export interface EmployeeSalary {
  id: string;
  employeeId: string;
  companyId: string;
  effectiveDate: string;
  baseSalary: number;
  currency: string;
  isActive: boolean;
  notes?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  components: EmployeeSalaryComponent[];
  createdAt: string;
}

export interface PayrollPeriod {
  id: string;
  companyId: string;
  name: string;
  code: string;
  frequency: string;
  startDate: string;
  endDate: string;
  payDate: string;
  status: string;
  notes?: string;
  createdAt: string;
}

export interface PayrollRun {
  id: string;
  periodId: string;
  companyId: string;
  name: string;
  runNumber: number;
  totalEmployees: number;
  totalEarnings: number;
  totalDeductions: number;
  totalNetPay: number;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  disbursedBy?: string;
  disbursedAt?: string;
  notes?: string;
  period?: { id: string; name: string; startDate: string; endDate: string };
  _count?: { payslips: number };
  payslips?: Payslip[];
  createdAt: string;
}

export interface PayslipComponent {
  id: string;
  payslipId: string;
  salaryComponentId: string;
  name: string;
  type: string;
  amount: number;
  isTaxable: boolean;
  salaryComponent?: SalaryComponent;
}

export interface Payslip {
  id: string;
  payrollRunId: string;
  employeeId: string;
  companyId: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  workDays: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  overtimeHours: number;
  status: string;
  notes?: string;
  employee?: { id: string; fullName: string; employeeNumber: string; departmentId?: string; positionId?: string };
  payrollRun?: { id: string; period?: PayrollPeriod };
  components: PayslipComponent[];
  createdAt: string;
}

class PayrollService {
  // Salary Components
  async getSalaryComponents(companyId: string): Promise<SalaryComponent[]> {
    const response = await api.get('/payroll/salary-components', { params: { companyId } });
    return response.data.data;
  }

  async getSalaryComponent(id: string): Promise<SalaryComponent> {
    const response = await api.get(`/payroll/salary-components/${id}`);
    return response.data.data;
  }

  async createSalaryComponent(data: Partial<SalaryComponent>): Promise<SalaryComponent> {
    const response = await api.post('/payroll/salary-components', data);
    return response.data.data;
  }

  async updateSalaryComponent(id: string, data: Partial<SalaryComponent>): Promise<SalaryComponent> {
    const response = await api.patch(`/payroll/salary-components/${id}`, data);
    return response.data.data;
  }

  async deleteSalaryComponent(id: string): Promise<void> {
    await api.delete(`/payroll/salary-components/${id}`);
  }

  // Employee Salaries
  async getEmployeeSalaries(companyId: string, employeeId?: string): Promise<EmployeeSalary[]> {
    const params: Record<string, string> = { companyId };
    if (employeeId) params.employeeId = employeeId;
    const response = await api.get('/payroll/employee-salaries', { params });
    return response.data.data;
  }

  async createEmployeeSalary(data: Partial<EmployeeSalary>): Promise<EmployeeSalary> {
    const response = await api.post('/payroll/employee-salaries', data);
    return response.data.data;
  }

  // Payroll Periods
  async getPayrollPeriods(companyId: string): Promise<PayrollPeriod[]> {
    const response = await api.get('/payroll/periods', { params: { companyId } });
    return response.data.data;
  }

  async createPayrollPeriod(data: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
    const response = await api.post('/payroll/periods', data);
    return response.data.data;
  }

  async updatePayrollPeriod(id: string, data: Partial<PayrollPeriod>): Promise<PayrollPeriod> {
    const response = await api.patch(`/payroll/periods/${id}`, data);
    return response.data.data;
  }

  async closePayrollPeriod(id: string): Promise<PayrollPeriod> {
    const response = await api.patch(`/payroll/periods/${id}/close`);
    return response.data.data;
  }

  // Payroll Runs
  async getPayrollRuns(companyId: string): Promise<PayrollRun[]> {
    const response = await api.get('/payroll/runs', { params: { companyId } });
    return response.data.data;
  }

  async getPayrollRun(id: string): Promise<PayrollRun> {
    const response = await api.get(`/payroll/runs/${id}`);
    return response.data.data;
  }

  async createPayrollRun(data: Partial<PayrollRun>): Promise<PayrollRun> {
    const response = await api.post('/payroll/runs', data);
    return response.data.data;
  }

  async approvePayrollRun(id: string): Promise<PayrollRun> {
    const response = await api.patch(`/payroll/runs/${id}/approve`);
    return response.data.data;
  }

  async disbursePayrollRun(id: string): Promise<PayrollRun> {
    const response = await api.patch(`/payroll/runs/${id}/disburse`);
    return response.data.data;
  }

  // Payslips
  async getPayslip(id: string): Promise<Payslip> {
    const response = await api.get(`/payroll/payslips/${id}`);
    return response.data.data;
  }

  async getMyPayslips(employeeId: string): Promise<Payslip[]> {
    const response = await api.get('/payroll/payslips', { params: { employeeId } });
    return response.data.data;
  }
}

export const payrollService = new PayrollService();
