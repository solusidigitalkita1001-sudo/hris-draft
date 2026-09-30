import { z } from 'zod';

export const registerArrearsSchema = z.object({
  employeeId: z.string().uuid(),
  sourcePeriodId: z.string().uuid(),
  notes: z.string().max(1000).optional(),
});

/**
 * No amount field, deliberately. The figure is derived from the salary that was
 * effective in the missed period and prorated against the days the employee was
 * actually employed — typing money by hand is how a wrong month reaches a bank
 * file. A wrong derivation is cancelled and re-registered, not edited.
 */
export const arrearsQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
});

export type RegisterArrearsDTO = z.infer<typeof registerArrearsSchema>;
export type ArrearsQueryDTO = z.infer<typeof arrearsQuerySchema>;
