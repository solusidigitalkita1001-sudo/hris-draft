import api from './api';
import type { AttendancePolicyMethod, BranchAttendancePolicy } from './organization.service';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  companyId: string;
  branchId?: string | null;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  method?: 'FINGERPRINT' | 'MOBILE_GPS' | 'MANUAL';
  checkInLatitude?: number | null;
  checkInLongitude?: number | null;
  checkOutLatitude?: number | null;
  checkOutLongitude?: number | null;
  distanceMeters?: number | null;
  isWithinRadius?: boolean | null;
  workDuration?: number | null;
  lateMinutes?: number | null;
  earlyLeaveMinutes?: number | null;
  isException?: boolean;
  exceptionType?: string | null;
  exceptionReason?: string | null;
  requiresReview?: boolean;
  policySnapshot?: Record<string, unknown> | null;
  notes?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  branch?: { id: string; name: string; code: string };
  attendancePolicy?: { id: string; attendanceMethod: AttendancePolicyMethod };
  createdAt: string;
}

export interface AttendanceContext {
  employeeId: string;
  companyId: string;
  branchId: string | null;
  branch: {
    id: string;
    name: string;
    code: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  departmentId: string | null;
  calendarId: string | null;
  schedule: {
    calendarId: string | null;
    date: string;
    dayType: string;
    workStart: string | null;
    workEnd: string | null;
    isWorkingDay: boolean;
    scheduleSource: string;
    shiftFormulaId?: string | null;
    shiftFormulaCode?: string | null;
    shiftFormulaName?: string | null;
    crossesMidnight?: boolean;
  };
  policy: BranchAttendancePolicy;
  allowedMethods: Array<'FINGERPRINT' | 'MOBILE_GPS' | 'MANUAL'>;
  warnings: string[];
  policySnapshot: Record<string, unknown>;
}

export interface CreateAttendancePayload {
  employeeId: string;
  companyId: string;
  date: string;
  checkIn: string;
  method: 'FINGERPRINT' | 'MOBILE_GPS' | 'MANUAL';
  source?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  notes?: string;
}

export interface CheckoutAttendancePayload {
  checkOut: string;
  method?: 'FINGERPRINT' | 'MOBILE_GPS' | 'MANUAL';
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  notes?: string;
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
  approvedBy?: string;
  approvedAt?: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
}

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

class AttendanceService {
  async getRecords(companyId: string, params?: Record<string, string>): Promise<AttendanceRecord[]> {
    const r = await api.get('/attendance', { params: { companyId, ...params } });
    return r.data.data;
  }

  async getContext(params: { employeeId: string; date: string; companyId?: string }): Promise<AttendanceContext> {
    const r = await api.get('/attendance/context', { params });
    return r.data.data;
  }

  async createRecord(data: CreateAttendancePayload): Promise<AttendanceRecord> {
    const r = await api.post('/attendance', data);
    return r.data.data;
  }

  async checkout(id: string, data: CheckoutAttendancePayload): Promise<AttendanceRecord> {
    const r = await api.patch(`/attendance/${id}/checkout`, data);
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

  async approveOvertime(id: string): Promise<{ overtimeRequest: OvertimeRequest; workflowInstance: WorkflowInstance }> {
    const r = await api.patch(`/attendance/overtime/${id}/approve`);
    return r.data.data;
  }

  async rejectOvertime(id: string, reason?: string): Promise<{ overtimeRequest: OvertimeRequest; workflowInstance: WorkflowInstance }> {
    const r = await api.patch(`/attendance/overtime/${id}/reject`, { reason });
    return r.data.data;
  }

  async getOvertimeWorkflow(id: string): Promise<WorkflowInstance> {
    const r = await api.get(`/attendance/overtime/${id}/workflow`);
    return r.data.data;
  }

  async submitOvertimeWorkflowAction(
    id: string,
    action: WorkflowAction,
    comment?: string,
  ): Promise<{ overtimeRequest: OvertimeRequest; workflowInstance: WorkflowInstance }> {
    const r = await api.patch(`/attendance/overtime/${id}/workflow-action`, { action, comment });
    return r.data.data;
  }
}

export const attendanceService = new AttendanceService();
