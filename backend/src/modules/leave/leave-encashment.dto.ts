import { z } from 'zod';

export const requestEncashmentSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  days: z.number().int().min(1).max(60),
  /// Balance year being encashed; defaults to the current year.
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  notes: z.string().max(1000).optional(),
});

/**
 * No amount field. The daily rate comes from the company's own setting
 * (base salary, optionally plus fixed allowances, divided by 21 or 30) and the
 * figure is derived server-side — typing money by hand is how a wrong payout
 * reaches a bank file.
 */
export const encashmentQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'PAID', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
});

export const rejectEncashmentSchema = z.object({
  reason: z.string().min(1).max(255),
});

export type RequestEncashmentDTO = z.infer<typeof requestEncashmentSchema>;
export type EncashmentQueryDTO = z.infer<typeof encashmentQuerySchema>;
export type RejectEncashmentDTO = z.infer<typeof rejectEncashmentSchema>;
