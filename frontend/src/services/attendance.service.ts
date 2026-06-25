import api from './api';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  companyId: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  notes?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
}

export interface OvertimeRequest {
  id: string;
  employeeId: string;
  companyId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationHours: number;
  reason: string;
  multiplier: number;
  status: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
}

class AttendanceService {
  async getRecords(companyId: string, params?: Record<string, string>): Promise<AttendanceRecord[]> {
    const r = await api.get('/attendance', { params: { companyId, ...params } });
    return r.data.data;
  }

  async createRecord(data: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const r = await api.post('/attendance', data);
    return r.data.data;
  }

  async checkout(id: string, checkOut: string): Promise<AttendanceRecord> {
    const r = await api.patch(`/attendance/${id}/checkout`, { checkOut });
    return r.data.data;
  }

  async getOvertime(companyId: string, params?: Record<string, string>): Promise<OvertimeRequest[]> {
    const r = await api.get('/attendance/overtime', { params: { companyId, ...params } });
    return r.data.data;
  }

  async createOvertime(data: Partial<OvertimeRequest>): Promise<OvertimeRequest> {
    const r = await api.post('/attendance/overtime', data);
    return r.data.data;
  }

  async approveOvertime(id: string): Promise<OvertimeRequest> {
    const r = await api.patch(`/attendance/overtime/${id}/approve`);
    return r.data.data;
  }

  async rejectOvertime(id: string): Promise<OvertimeRequest> {
    const r = await api.patch(`/attendance/overtime/${id}/reject`);
    return r.data.data;
  }
}

export const attendanceService = new AttendanceService();
