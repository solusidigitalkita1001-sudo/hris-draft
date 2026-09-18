import { z } from 'zod';

export const createAttendanceCorrectionSchema = z.object({
  attendanceId: z.string().uuid().optional(),
  date: z.string().datetime(),
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
