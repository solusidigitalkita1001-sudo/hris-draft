import api from './api';

export interface PermissionRequest {
  id: string;
  companyId: string;
  employeeId: string;
  type: PermissionType;
  startDate: string;
  endDate: string;
  duration: number;
  reason: string;
  status: RequestStatus;
  notes?: string | null;
  approverId?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { fullName: string; employeeNumber: string };
}

export type PermissionType =
  | 'SICK'
  | 'PERSONAL'
  | 'LATE'
  | 'EARLY_LEAVE'
  | 'LEAVE_OFFICE'
  | 'BUSINESS_TRIP'
  | 'WORK_FROM_HOME'
  | 'OTHER';

export type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const PERMISSION_TYPE_LABELS: Record<PermissionType, string> = {
  SICK: 'Sakit',
  PERSONAL: 'Keperluan Pribadi',
  LATE: 'Datang Terlambat',
  EARLY_LEAVE: 'Pulang Cepat',
  LEAVE_OFFICE: 'Izin Keluar Kantor',
  BUSINESS_TRIP: 'Perjalanan Dinas',
  WORK_FROM_HOME: 'Kerja Dari Rumah',
  OTHER: 'Lainnya',
};

export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = {
  PENDING: 'Pending',
  APPROVED: 'Disetujui',
  REJECTED: 'Ditolak',
  CANCELLED: 'Dibatalkan',
};

class PermissionRequestService {
  async findAll(companyId: string, status?: string) {
    const params: Record<string, string> = { companyId };
    if (status) params.status = status;
    const r = await api.get('/permission-requests', { params });
    return r.data.data as PermissionRequest[];
  }

  async findMyRequests(employeeId: string, status?: string) {
    const params: Record<string, string> = { employeeId };
    if (status) params.status = status;
    const r = await api.get('/permission-requests/my', { params });
    return r.data.data as PermissionRequest[];
  }

  async findById(id: string) {
    const r = await api.get(`/permission-requests/${id}`);
    return r.data.data as PermissionRequest;
  }

  async create(data: Partial<PermissionRequest>) {
    const r = await api.post('/permission-requests', data);
    return r.data.data as PermissionRequest;
  }

  async cancel(id: string, employeeId: string) {
    const r = await api.patch(`/permission-requests/${id}/cancel`, { employeeId });
    return r.data;
  }

  async approve(id: string, notes?: string) {
    const r = await api.patch(`/permission-requests/${id}/approve`, { notes });
    return r.data.data;
  }

  async reject(id: string, notes?: string) {
    const r = await api.patch(`/permission-requests/${id}/reject`, { notes });
    return r.data.data;
  }
}

export const permissionRequestService = new PermissionRequestService();
