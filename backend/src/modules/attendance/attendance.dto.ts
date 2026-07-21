import { z } from 'zod';

export const createAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  date: z.string().datetime(),
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL']).default('MANUAL'),
  source: z.string().max(50).optional(),
  checkInLatitude: z.number().optional(),
  checkInLongitude: z.number().optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).default('PRESENT'),
  notes: z.string().optional(),
});

export const checkoutAttendanceSchema = z.object({
  checkOut: z.string().datetime(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL']).optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  notes: z.string().optional(),
});

export const updateAttendanceSchema = z.object({
  checkIn: z.string().datetime().optional(),
  checkOut: z.string().datetime().optional(),
  method: z.enum(['FINGERPRINT', 'MOBILE_GPS', 'MANUAL']).optional(),
  checkOutLatitude: z.number().optional(),
  checkOutLongitude: z.number().optional(),
  workDuration: z.number().int().nonnegative().optional(),
  earlyLeaveMinutes: z.number().int().nonnegative().optional(),
  distanceMeters: z.number().int().nullable().optional(),
  isWithinRadius: z.boolean().nullable().optional(),
  isException: z.boolean().optional(),
  exceptionType: z
    .enum([
      'OUT_OF_RADIUS',
      'OFF_DAY_ATTENDANCE',
      'MISSING_POLICY',
      'MISSING_GPS',
      'METHOD_NOT_ALLOWED',
      'INVALID_BRANCH_CONTEXT',
    ])
    .nullable()
    .optional(),
  exceptionReason: z.string().nullable().optional(),
  requiresReview: z.boolean().optional(),
  policySnapshot: z.record(z.any()).optional(),
  status: z.enum(['PRESENT', 'ABSENT', 'LATE', 'EXCUSED']).optional(),
  notes: z.string().optional(),
});

export const attendanceQuerySchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid().optional(),
  date: z.string().optional(),
  month: z.string().optional(),
  status: z.string().optional(),
});

export const attendanceContextQuerySchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  date: z.string().min(1),
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
export type CheckoutAttendanceDTO = z.infer<typeof checkoutAttendanceSchema>;
export type UpdateAttendanceDTO = z.infer<typeof updateAttendanceSchema>;
export type CreateOvertimeDTO = z.infer<typeof createOvertimeSchema>;
