import api from './api';

/**
 * Koreksi absensi (GAP-30). Kontrak backend:
 * `backend/src/modules/attendance/attendance-correction.routes.ts`
 * dipasang di `app.ts` pada `${apiPrefix}/attendance-corrections`.
 *
 * Jalur self-service memakai `/my` — server mengambil employeeId & companyId
 * dari sesi, jadi klien tidak boleh mengirimkannya.
 */

export type AttendanceCorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  companyId: string;
  attendanceId?: string | null;
  date: string;
  requestedCheckIn?: string | null;
  requestedCheckOut?: string | null;
  reason: string;
  /** Snapshot sebelum koreksi, diisi server saat disetujui. */
  beforeCheckIn?: string | null;
  beforeCheckOut?: string | null;
  beforeStatus?: string | null;
  status: AttendanceCorrectionStatus;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  employee?: { id: string; fullName: string; employeeNumber: string };
  createdAt: string;
  updatedAt: string;
}

/**
 * Payload POST /attendance-corrections. `date` wajib ISO-8601 (zod `.datetime()`),
 * dan minimal satu dari `requestedCheckIn`/`requestedCheckOut` harus terisi.
 * `reason` wajib (3–2000 karakter).
 */
export interface CreateAttendanceCorrectionPayload {
  attendanceId?: string;
  date: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
}

class AttendanceCorrectionService {
  /** GET /attendance-corrections/my — daftar pengajuan milik penanda tangan sesi. */
  async getMine(status?: AttendanceCorrectionStatus): Promise<AttendanceCorrection[]> {
    const r = await api.get('/attendance-corrections/my', {
      params: status ? { status } : undefined,
    });
    return r.data.data ?? [];
  }

  /** GET /attendance-corrections/my/:id */
  async getMineById(id: string): Promise<AttendanceCorrection> {
    const r = await api.get(`/attendance-corrections/my/${id}`);
    return r.data.data;
  }

  /** POST /attendance-corrections */
  async create(payload: CreateAttendanceCorrectionPayload): Promise<AttendanceCorrection> {
    const r = await api.post('/attendance-corrections', payload);
    return r.data.data;
  }
}

export const attendanceCorrectionService = new AttendanceCorrectionService();
