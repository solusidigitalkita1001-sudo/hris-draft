import api from './api';
import type { AttendancePolicyMethod, BranchAttendancePolicy } from './organization.service';

export type AttendanceCaptureMethod = 'FINGERPRINT' | 'MOBILE_GPS' | 'MANUAL' | 'FACE_RECOGNITION';

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  companyId: string;
  branchId?: string | null;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: string;
  method?: AttendanceCaptureMethod;
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
  allowedMethods: AttendanceCaptureMethod[];
  warnings: string[];
  policySnapshot: Record<string, unknown>;
}

export interface CreateAttendancePayload {
  employeeId: string;
  companyId: string;
  date: string;
  checkIn: string;
  method: AttendanceCaptureMethod;
  source?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  notes?: string;
  faceRecognition?: {
    selfieImage: string;
  };
}

export interface CheckoutAttendancePayload {
  checkOut: string;
  method?: AttendanceCaptureMethod;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  notes?: string;
}

/** Payload self check-in (POST /attendance/me/check-in). Identitas karyawan,
 * tanggal, dan jam diambil server dari sesi — jangan dikirim dari klien. */
export interface SelfCheckInPayload {
  method: AttendanceCaptureMethod;
  notes?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  faceRecognition?: {
    selfieImage: string;
  };
  liveness?: Record<string, unknown>;
  deviceGps?: Record<string, unknown>;
}

/** Payload self check-out (PATCH /attendance/me/check-out). checkOut time diisi server. */
export interface SelfCheckOutPayload {
  method?: AttendanceCaptureMethod;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  notes?: string;
}

export interface MyAttendanceToday {
  serverTime: string;
  serverDate: string;
  timezone: string;
  record: AttendanceRecord | null;
  context: AttendanceContext;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

export interface MyAttendanceQuery {
  month?: string; // YYYY-MM
  page?: number;
  limit?: number;
}

export interface MyAttendanceResult {
  items: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
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
  logs: Array<Record<string, unknown>>;
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

  // ===== Employee self-service (jalur /attendance/me) =====

  async getMyToday(): Promise<MyAttendanceToday> {
    const r = await api.get('/attendance/me/today');
    return r.data.data;
  }

  async getMyAttendance(params?: MyAttendanceQuery): Promise<MyAttendanceResult> {
    const r = await api.get('/attendance/me', { params });
    return {
      items: r.data.data ?? [],
      total: r.data.meta?.total ?? (r.data.data?.length || 0),
      page: r.data.meta?.page ?? params?.page ?? 1,
      limit: r.data.meta?.limit ?? params?.limit ?? 20,
    };
  }

  async selfCheckIn(payload: SelfCheckInPayload): Promise<AttendanceRecord> {
    const r = await api.post('/attendance/me/check-in', payload);
    return r.data.data;
  }

  async selfCheckOut(payload: SelfCheckOutPayload): Promise<AttendanceRecord> {
    const r = await api.patch('/attendance/me/check-out', payload);
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
