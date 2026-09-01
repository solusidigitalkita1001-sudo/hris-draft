import api from './api';

export type EWAStatus = 'PENDING' | 'APPROVED' | 'PAID' | 'DEDUCTED' | 'REJECTED' | 'CANCELLED';

export interface EWARequest {
  id: string;
  companyId: string;
  employeeId: string;
  requestCode: string;
  payrollPeriodId?: string | null;
  periodStart: string;
  periodEnd: string;
  earnedGrossAtRequest: number;
  maxAllowedAtRequest: number;
  totalApprovedSamePeriod: number;
  amountRequested: number;
  adminFee: number;
  reason?: string | null;
  status: EWAStatus;
  approverId?: string | null;
  approvedAt?: string | null;
  approverNotes?: string | null;
  financeDisburserId?: string | null;
  paidOutAt?: string | null;
  amountPaidOut?: number | null;
  disbursementReference?: string | null;
  payrollRunId?: string | null;
  deductedAt?: string | null;
  amountDeductedPayroll?: number | null;
  rejectReason?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
    branchId?: string | null;
    departmentId?: string | null;
  };
}

export interface EWALimitResponse {
  max: number;
  remaining: number;
  totalApproved: number;
  totalReserved?: number;
  earnedGrossToDate: number;
  isAllowed?: boolean;
  earnedGross?: number;
  maxAllowedPercent?: number;
  maxAllowedAmount?: number;
  existingApproved?: number;
  remainingAllowed?: number;
  reason?: string | null;
  breakdown?: {
    baseSalary: number;
    presentDays: number;
    workDaysInPeriod: number;
    dailyRate: number;
    overtimePay: number;
  } | null;
}

export const EWA_STATUS_LABELS: Record<EWAStatus, string> = {
  PENDING: 'Menunggu Approval',
  APPROVED: 'Disetujui',
  PAID: 'Sudah Dibayar',
  DEDUCTED: 'Terpotong di Gaji',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

export const EWA_STATUS_CLASSNAMES: Record<EWAStatus, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  APPROVED: 'bg-blue-100 text-blue-800 border-blue-200',
  PAID: 'bg-purple-100 text-purple-800 border-purple-200',
  DEDUCTED: 'bg-green-100 text-green-800 border-green-200',
  REJECTED: 'bg-red-100 text-red-800 border-red-200',
  CANCELLED: 'bg-gray-100 text-gray-800 border-gray-200',
};

class EWAService {
  async getMyLimit(percent?: number): Promise<EWALimitResponse> {
    const params: Record<string, string> = {};
    if (percent !== undefined) params.percent = String(percent);
    const r = await api.get('/ewa/my/limit', { params });
    return r.data.data as EWALimitResponse;
  }

  async getMyRequests(status?: EWAStatus): Promise<EWARequest[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const r = await api.get('/ewa/my', { params });
    return r.data.data as EWARequest[];
  }

  async findAll(companyId: string, filters?: { status?: EWAStatus; employeeId?: string }): Promise<EWARequest[]> {
    const params: Record<string, string> = { companyId };
    if (filters?.status) params.status = filters.status;
    if (filters?.employeeId) params.employeeId = filters.employeeId;
    const r = await api.get('/ewa', { params });
    return r.data.data as EWARequest[];
  }

  async findById(id: string): Promise<EWARequest> {
    const r = await api.get(`/ewa/${id}`);
    return r.data.data as EWARequest;
  }

  async createRequest(data: {
    amountRequested: number;
    adminFee?: number;
    reason?: string;
    payrollPeriodId?: string;
    employeeId?: string;
  }): Promise<EWARequest> {
    const r = await api.post('/ewa', data);
    return r.data.data as EWARequest;
  }

  async approve(id: string, approverNotes?: string): Promise<EWARequest> {
    const r = await api.post(`/ewa/${id}/approve`, { approverNotes });
    return r.data.data as EWARequest;
  }

  async reject(id: string, rejectReason: string): Promise<EWARequest> {
    const r = await api.post(`/ewa/${id}/reject`, { rejectReason });
    return r.data.data as EWARequest;
  }

  async cancel(id: string): Promise<EWARequest> {
    const r = await api.post(`/ewa/${id}/cancel`);
    return r.data.data as EWARequest;
  }

  async markPaid(id: string, amountPaidOut: number, disbursementReference: string): Promise<EWARequest> {
    const r = await api.post(`/ewa/${id}/mark-paid`, { amountPaidOut, disbursementReference });
    return r.data.data as EWARequest;
  }
}

export const ewaService = new EWAService();
