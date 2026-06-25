import { z } from 'zod';

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z.string().datetime(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).default('PRESENT'),
  notes: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  notes: z.string().optional(),
});

export const createOvertimeSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z.string().datetime(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  durationHours: z.number().positive(),
  reason: z.string().min(1),
  multiplier: z.number().default(1.5),
});

export const overtimeQuerySchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  status: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export type CreateAttendanceDTO = z.infer<typeof createAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof updateAttendanceSchema>;
export type CreateOvertimeDTO = z.infer<typeof createOvertimeSchema>;
