import api from './api';

export interface LoanType {
  id: string;
  companyId: string;
  name: string;
  maxAmount: number;
  maxInstallments: number;
  interestRate: number;
  description?: string | null;
  status: string;
}

export interface Loan {
  id: string;
  companyId: string;
  employeeId: string;
  loanTypeId: string;
  amount: number;
  totalInstallments: number;
  installmentAmount: number;
  remainingBalance: number;
  reason: string;
  status: LoanStatus;
  notes?: string | null;
  approverId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { fullName: string; employeeNumber: string };
  loanType?: { name: string; maxAmount?: number };
  installments?: LoanInstallment[];
  _count?: { installments: number };
}

export interface LoanInstallment {
  id: string;
  loanId: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: InstallmentStatus;
  notes?: string | null;
}

export type LoanStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ACTIVE' | 'PAID' | 'CANCELLED';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'SKIPPED';

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  ACTIVE: 'Aktif',
  PAID: 'Lunas',
  CANCELLED: 'Dibatalkan',
};

export const INSTALLMENT_STATUS_LABELS: Record<InstallmentStatus, string> = {
  PENDING: 'Belum Dibayar',
  PAID: 'Lunas',
  OVERDUE: 'Terlambat',
  SKIPPED: 'Dilewati',
};

class EmployeeLoanService {
  async findLoanTypes(companyId: string) {
    const r = await api.get('/employee-loans/types', { params: { companyId } });
    return r.data.data as LoanType[];
  }

  async findAll(companyId: string, status?: string) {
    const params: Record<string, string> = { companyId };
    if (status) params.status = status;
    const r = await api.get('/employee-loans', { params });
    return r.data.data as Loan[];
  }

  async findMyLoans(employeeId: string, status?: string) {
    const params: Record<string, string> = { employeeId };
    if (status) params.status = status;
    const r = await api.get('/employee-loans/my', { params });
    return r.data.data as Loan[];
  }

  async findById(id: string) {
    const r = await api.get(`/employee-loans/${id}`);
    return r.data.data as Loan;
  }

  async create(data: Partial<Loan>) {
    const r = await api.post('/employee-loans', data);
    return r.data.data as Loan;
  }

  async approve(id: string, notes?: string) {
    const r = await api.patch(`/employee-loans/${id}/approve`, { notes });
    return r.data.data;
  }

  async reject(id: string, notes?: string) {
    const r = await api.patch(`/employee-loans/${id}/reject`, { notes });
    return r.data.data;
  }

  async getInstallments(loanId: string) {
    const r = await api.get(`/employee-loans/${loanId}/installments`);
    return r.data.data as LoanInstallment[];
  }
}

export const employeeLoanService = new EmployeeLoanService();
