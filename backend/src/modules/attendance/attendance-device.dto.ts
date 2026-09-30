import { z } from 'zod';

export const registerAttendanceDeviceSchema = z.object({
  name: z.string().min(1).max(150),
  serialNumber: z.string().min(1).max(100),
  branchId: z.string().uuid().optional(),
});

export const updateAttendanceDeviceSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    branchId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const attendanceDeviceQuerySchema = z.object({
  isActive: z.enum(['true', 'false']).optional(),
});

/**
 * A punch as a terminal reports it. Deliberately small: a fingerprint machine
 * knows who punched, when, and its own record id — nothing else. Anything the
 * server can decide for itself (branch policy, lateness, which attendance row
 * this belongs to) is not accepted from the device.
 */
const punchSchema = z.object({
  /// The employee identifier enrolled on the machine, matched against
  /// Employee.employeeNumber within the device's own company. Kept under the
  /// vendor-neutral name a terminal uses, because the value is whatever was
  /// typed into the machine — it may match no employee at all.
  employeeCode: z.string().min(1).max(50),
  /// The machine's own id for this punch. Re-sending a batch with the same ids
  /// is safe and expected — terminals re-sync after losing connectivity.
  externalId: z.string().min(1).max(100),
  punchedAt: z.string().datetime(),
  direction: z.enum(['AUTO', 'IN', 'OUT']).default('AUTO'),
});

export const attendanceDevicePunchBatchSchema = z.object({
  // Bounded so one call cannot be turned into an unbounded write. A terminal
  // with a longer backlog sends several batches.
  punches: z.array(punchSchema).min(1).max(500),
});

export const attendanceDevicePunchQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'DUPLICATE', 'UNMATCHED_EMPLOYEE', 'REJECTED']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type RegisterAttendanceDeviceDTO = z.infer<typeof registerAttendanceDeviceSchema>;
export type UpdateAttendanceDeviceDTO = z.infer<typeof updateAttendanceDeviceSchema>;
export type AttendanceDevicePunchBatchDTO = z.infer<typeof attendanceDevicePunchBatchSchema>;
export type AttendanceDevicePunchDTO = z.infer<typeof punchSchema>;
export type AttendanceDevicePunchQueryDTO = z.infer<typeof attendanceDevicePunchQuerySchema>;
