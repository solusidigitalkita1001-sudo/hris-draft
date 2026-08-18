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

export interface WorkflowStep {
  id: string;
  level: number;
  name: string;
  status: string;
  approverId?: string | null;
  approverRoleCode?: string | null;
  actedBy?: string | null;
  actedAt?: string | null;
  comment?: string | null;
  isCurrent?: boolean;
}

export interface WorkflowInstance {
  id: string;
  status: string;
  steps: WorkflowStep[];
  logs: any[];
  template?: { id: string; name: string; approvalType: string };
}

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'ESCALATE';

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

export interface UploadedReceipt {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  filePath: string;
  url: string;
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

  async findTripById(id: string) {
    const response = await api.get(`/travel-expenses/trips/${id}`);
    return response.data.data as BusinessTrip;
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

  async getTripWorkflow(id: string): Promise<WorkflowInstance> {
    const response = await api.get(`/travel-expenses/trips/${id}/workflow`);
    return response.data.data;
  }

  async submitTripWorkflowAction(
    id: string,
    action: WorkflowAction,
    comment?: string
  ): Promise<{ trip: BusinessTrip; workflowInstance: WorkflowInstance }> {
    const response = await api.patch(`/travel-expenses/trips/${id}/workflow-action`, { action, comment });
    return response.data.data;
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

  async findClaimById(id: string) {
    const response = await api.get(`/travel-expenses/claims/${id}`);
    return response.data.data as ExpenseClaim;
  }

  async createClaim(data: Partial<ExpenseClaim>) {
    const response = await api.post('/travel-expenses/claims', data);
    return response.data.data as ExpenseClaim;
  }

  async uploadReceipt(file: File) {
    const formData = new FormData();
    formData.append('receipt', file);

    const response = await api.post('/travel-expenses/claims/receipt-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data.data as UploadedReceipt;
  }

  async approveClaim(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/claims/${id}/approve`, { notes });
    return response.data.data as ExpenseClaim;
  }

  async rejectClaim(id: string, notes?: string) {
    const response = await api.patch(`/travel-expenses/claims/${id}/reject`, { notes });
    return response.data.data as ExpenseClaim;
  }

  async getClaimWorkflow(id: string): Promise<WorkflowInstance> {
    const response = await api.get(`/travel-expenses/claims/${id}/workflow`);
    return response.data.data;
  }

  async submitClaimWorkflowAction(
    id: string,
    action: WorkflowAction,
    comment?: string
  ): Promise<{ claim: ExpenseClaim; workflowInstance: WorkflowInstance }> {
    const response = await api.patch(`/travel-expenses/claims/${id}/workflow-action`, { action, comment });
    return response.data.data;
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
