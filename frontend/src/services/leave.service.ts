import api from './api';

export interface LeaveType {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string;
  isPaid: boolean;
  isAnnual: boolean;
  maxDays: number;
  requiresAttachment: boolean;
  isActive: boolean;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  companyId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachment?: string;
  status: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  leaveType?: { id: string; name: string; code: string; isPaid: boolean };
  createdAt: string;
}

export interface LeaveBalance {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  remainingDays: number;
  leaveType?: { id: string; name: string; code: string; isPaid: boolean };
}

class LeaveService {
  async getTypes(companyId: string): Promise<LeaveType[]> {
    const r = await api.get('/leave/types', { params: { companyId } });
    return r.data.data;
  }

  async getRequests(companyId: string, params?: Record<string, string>): Promise<LeaveRequest[]> {
    const r = await api.get('/leave', { params: { companyId, ...params } });
    return r.data.data;
  }

  async getRequest(id: string): Promise<LeaveRequest> {
    const r = await api.get(`/leave/${id}`);
    return r.data.data;
  }

  async createRequest(data: Partial<LeaveRequest>): Promise<LeaveRequest> {
    const r = await api.post('/leave', data);
    return r.data.data;
  }

  async approveRequest(id: string): Promise<LeaveRequest> {
    const r = await api.patch(`/leave/${id}/approve`);
    return r.data.data;
  }

  async rejectRequest(id: string, reason?: string): Promise<LeaveRequest> {
    const r = await api.patch(`/leave/${id}/reject`, { reason });
    return r.data.data;
  }

  async getBalances(employeeId: string): Promise<LeaveBalance[]> {
    const r = await api.get('/leave/balances/employee', { params: { employeeId } });
    return r.data.data;
  }
}

export const leaveService = new LeaveService();
