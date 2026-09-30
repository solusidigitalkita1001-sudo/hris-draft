import { z } from 'zod';

export const declareCollectiveLeaveSchema = z.object({
  date: z.string().datetime(),
  name: z.string().min(1).max(255),
  /// The paid type whose balance the day consumes — annual leave in practice.
  leaveTypeId: z.string().uuid(),
  /// Where employees without balance land. The decision is explicit: unpaid,
  /// never a negative balance, because a negative balance leaks into payroll
  /// and severance arithmetic.
  unpaidLeaveTypeId: z.string().uuid(),
  /// Branches that keep working that day.
  excludedBranchIds: z.array(z.string().uuid()).max(200).optional(),
  notes: z.string().max(1000).optional(),
});

export const collectiveLeaveQuerySchema = z.object({
  status: z.enum(['DECLARED', 'APPLIED', 'CANCELLED']).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type DeclareCollectiveLeaveDTO = z.infer<typeof declareCollectiveLeaveSchema>;
export type CollectiveLeaveQueryDTO = z.infer<typeof collectiveLeaveQuerySchema>;
