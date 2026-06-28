import api from './api';

export type BusinessTripStatus = 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'COMPLETED' | 'CANCELLED';
export type ExpenseClaimStatus = 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED' | 'CANCELLED';
export type ExpenseCategory =
  | 'TRANSPORTATION'
  | 'HOTEL'
  | 'MEAL'
  | 'ENTERTAINMENT'
  | 'OPERATIONAL';
export type ReimbursementMethod = 'TRANSFER' | 'PAYROLL';

export interface TravelAdvance {
  id: string;
  tripId: string;
  companyId: string;
  amount: number;
  disbursedAt?: string | null;
  reconciled: boolean;
  notes?: string | null;
  createdAt: string;
}

export interface BusinessTrip {
  id: string;
  companyId: string;
  employeeId: string;
  destination: string;
  purpose: string;
  startDate: string;
  endDate: string;
  estimatedCost: number;
  notes?: string | null;
  status: BusinessTripStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { fullName: string; employeeNumber: string };
  travelAdvances?: TravelAdvance[];
  _count?: { expenseClaims: number };
}

export interface ExpenseApproval {
  id: string;
  claimId: string;
  approverId: string;
  level: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  notes?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface Reimbursement {
  id: string;
  claimId: string;
  companyId: string;
  method: ReimbursementMethod;
  amount: number;
  processedBy?: string | null;
  processedAt: string;
  payrollDetailId?: string | null;
  notes?: string | null;
  createdAt: string;
}

export interface ExpenseClaim {
  id: string;
  companyId: string;
  employeeId: string;
  tripId?: string | null;
  category: ExpenseCategory;
  amount: number;
  description?: string | null;
  expenseDate: string;
  receiptFilePath?: string | null;
  ocrExtractedAmount?: number | null;
  status: ExpenseClaimStatus;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { fullName: string; employeeNumber: string };
  trip?: { id: string; destination: string; startDate: string; endDate: string } | null;
  approvals?: ExpenseApproval[];
  reimbursements?: Reimbursement[];
}

export interface ExpenseCategoryOption {
  value: ExpenseCategory;
  label: string;
}

export const BUSINESS_TRIP_STATUS_LABELS: Record<BusinessTripStatus, string> = {
  REQUESTED: 'Diajukan',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  COMPLETED: 'Selesai',
  CANCELLED: 'Dibatalkan',
};

export const EXPENSE_CLAIM_STATUS_LABELS: Record<ExpenseClaimStatus, string> = {
  SUBMITTED: 'Dikirim',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  REIMBURSED: 'Direimburse',
  CANCELLED: 'Dibatalkan',
};

class TravelExpenseService {
  async getCategories() {
    const response = await api.get('/travel-expenses/categories');
    return response.data.data as ExpenseCategoryOption[];
  }

  async findTrips(companyId: string, status?: string) {
    const params: Record<string, string> = { companyId };
    if (status) params.status = status;
    const response = await api.get('/travel-expenses/trips', { params });
    return response.data.data as BusinessTrip[];
  }

  async findMyTrips(employeeId: string, status?: string) {
    const params: Record<string, string> = { employeeId };
    if (status) params.status = status;
    const response = await api.get('/travel-expenses/trips/my', { params });
    return response.data.data as BusinessTrip[];
  }

  async createTrip(data: Partial<BusinessTrip>) {
    const response = await api.post('/travel-expenses/trips', data);
    return response.data.data as BusinessTrip;
  }

  async approveTrip(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/trips/${id}/approve`, { notes });
    return response.data.data as BusinessTrip;
  }

  async rejectTrip(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/trips/${id}/reject`, { notes });
    return response.data.data as BusinessTrip;
  }

  async createAdvance(id: string, payload: { companyId?: string; amount: number; disbursedAt?: string; notes?: string }) {
    const response = await api.post(`/travel-expenses/trips/${id}/advance`, payload);
    return response.data.data as TravelAdvance;
  }

  async findClaims(companyId: string, status?: string) {
    const params: Record<string, string> = { companyId };
    if (status) params.status = status;
    const response = await api.get('/travel-expenses/claims', { params });
    return response.data.data as ExpenseClaim[];
  }

  async findMyClaims(employeeId: string, status?: string) {
    const params: Record<string, string> = { employeeId };
    if (status) params.status = status;
    const response = await api.get('/travel-expenses/claims/my', { params });
    return response.data.data as ExpenseClaim[];
  }

  async createClaim(data: Partial<ExpenseClaim>) {
    const response = await api.post('/travel-expenses/claims', data);
    return response.data.data as ExpenseClaim;
  }

  async approveClaim(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/claims/${id}/approve`, { notes });
    return response.data.data as ExpenseClaim;
  }

  async rejectClaim(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/claims/${id}/reject`, { notes });
    return response.data.data as ExpenseClaim;
  }

  async reimburseClaim(
    id: string,
    payload: { companyId?: string; method: ReimbursementMethod; amount?: number; payrollDetailId?: string; notes?: string }
  ) {
    const response = await api.post(`/travel-expenses/claims/${id}/reimburse`, payload);
    return response.data.data as Reimbursement;
  }
}

export const travelExpenseService = new TravelExpenseService();
