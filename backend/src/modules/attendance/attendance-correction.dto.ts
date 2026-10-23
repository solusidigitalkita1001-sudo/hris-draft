import { z } from 'zod';
import { calendarDateSchema } from '@/shared/validators/calendar-date';

export const createAttendanceCorrectionSchema = z.object({
  attendanceId: z.string().uuid().optional(),
  // Koreksi menyasar satu hari kerja, bukan satu titik waktu: samakan dengan
  // izin, cuti, dan tukar shift supaya klien tidak perlu menghafal format
  // berbeda per modul. Jam yang diminta di bawah tetap timestamp penuh.
  date: calendarDateSchema,
  requestedCheckIn: z.string().datetime().optional(),
  requestedCheckOut: z.string().datetime().optional(),
  reason: z.string().trim().min(3).max(2000),
}).refine((value) => value.requestedCheckIn || value.requestedCheckOut, {
  message: 'Minimal satu dari requestedCheckIn atau requestedCheckOut harus diisi',
  path: ['requestedCheckIn'],
});

export const attendanceCorrectionListQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED']).optional(),
});

export const rejectAttendanceCorrectionSchema = z.object({
  rejectionReason: z.string().trim().min(3).max(2000),
});

export interface CreateAttendanceCorrectionDTO {
  employeeId: string;
  companyId: string;
  attendanceId?: string;
  date: string;
  requestedCheckIn?: string;
  requestedCheckOut?: string;
  reason: string;
}

export interface RejectAttendanceCorrectionDTO {
  rejectionReason?: string;
}
