import api from './api';

export interface SalaryComponent {
  formulaVersions?: { id: string; version: number; effectiveFrom: string; status: 'DRAFT' | 'PUBLISHED' }[];
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
  createdBy?: string | null;
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
  formulaCalculations?: { id: string; componentId: string; versionId: string; expression: string; amount: string;
    inputs: Record<string, string>; dependencies: Record<string, string>; engineVersion: number }[];
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

/** Ringkasan payslip self-service: tanpa angka finansial (backend hanya
 * mengirim id, status, createdAt, payrollRun.period + flag locked). */
export interface MyPayslipSummary {
  id: string;
  status: string;
  createdAt: string;
  locked?: boolean;
  payrollRun?: {
    id: string;
    name: string;
    runNumber: number;
    status: string;
    period?: {
      id: string;
      name: string;
      code: string;
      frequency: string;
      startDate: string;
      endDate: string;
      payDate: string;
    };
  };
}

// ==================== Slip gaji self-service (dilindungi PIN) ====================

export interface PayslipPinStatus {
  pinSet: boolean;
  /** ISO datetime saat lock percobaan PIN berakhir (hanya ada saat terkunci). */
  lockedUntil?: string;
}

export interface PayslipUnlockGrant {
  unlockToken: string;
  expiresAt: string;
}

export interface PayslipBreakdownRow {
  id?: string;
  name: string;
  amount: number;
  type: 'ALLOWANCE' | 'DEDUCTION';
  code?: string;
  description?: string;
  isTaxable?: boolean;
}

export interface PayslipBreakdown {
  baseSalary: number;
  earnings: PayslipBreakdownRow[];
  totalEarnings: number;
  deductions: PayslipBreakdownRow[];
  totalDeductions: number;
  takeHomePay: number;
  statutorySummary: { bpjsTK: number; bpjsKesehatan: number; pph21: number; otherStatutory: number };
}

/** Detail payslip milik sendiri — hanya tersedia setelah unlock PIN (server-side). */
export interface MyPayslipDetail {
  id: string;
  employeeId: string;
  companyId: string;
  baseSalary: number;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  status: string;
  createdAt: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  payrollRun?: MyPayslipSummary['payrollRun'];
  components: { id: string; name: string; type: string; amount: number; isTaxable: boolean }[];
  breakdown: PayslipBreakdown;
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

  /**
   * Daftar payslip milik sendiri (GET /payroll/payslips).
   * Identitas karyawan diambil backend dari sesi; response hanya berisi
   * ringkasan periode tanpa angka finansial (locked: true) — detail finansial
   * butuh payroll unlock token terpisah.
   */
  async getMyPayslips(): Promise<MyPayslipSummary[]> {
    const response = await api.get('/payroll/payslips');
    return response.data.data;
  }

  /** Unduh PDF slip gaji (GET /payroll/payslips/:id/pdf). */
  async downloadPayslipPdf(id: string): Promise<Blob> {
    const response = await api.get(`/payroll/payslips/${id}/pdf`, { responseType: 'blob' });
    return response.data;
  }

  // ==================== Slip gaji self-service (dilindungi PIN) ====================

  /** Set/ubah PIN slip gaji — password akun diverifikasi server-side. */
  async setPayslipPin(currentPassword: string, pin: string): Promise<void> {
    await api.put('/payroll/payslips/pin', { currentPassword, pin });
  }

  async getPayslipPinStatus(): Promise<PayslipPinStatus> {
    const response = await api.get('/payroll/payslips/pin/status');
    return response.data.data;
  }

  /** Verifikasi PIN → token unlock 15 menit. Simpan HANYA di memory, bukan storage. */
  async unlockMyPayslips(pin: string): Promise<PayslipUnlockGrant> {
    const response = await api.post('/payroll/payslips/my/unlock', { pin });
    return response.data.data;
  }

  /** Detail lengkap payslip milik sendiri; butuh unlock token di header X-Payslip-Unlock. */
  async getMyPayslipDetail(id: string, unlockToken: string): Promise<MyPayslipDetail> {
    const response = await api.get(`/payroll/payslips/my/${id}`, {
      headers: { 'X-Payslip-Unlock': unlockToken },
    });
    return response.data.data;
  }

  /** PDF slip gaji milik sendiri; butuh unlock token di header X-Payslip-Unlock. */
  async downloadMyPayslipPdf(id: string, unlockToken: string): Promise<Blob> {
    const response = await api.get(`/payroll/payslips/my/${id}/pdf`, {
      responseType: 'blob',
      headers: { 'X-Payslip-Unlock': unlockToken },
    });
    return response.data;
  }
}

export const payrollService = new PayrollService();
