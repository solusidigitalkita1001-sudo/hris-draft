import { z } from 'zod';

export const createLeaveTypeSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  isPaid: z.boolean().default(true),
  isAnnual: z.boolean().default(false),
  maxDays: z.number().int().positive().default(12),
  requiresAttachment: z.boolean().default(false),
});

export const createLeaveRequestSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().min(1),
  attachment: z.string().optional(),
});

export const createLeaveBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  leaveTypeId: z.string().uuid(),
  year: z.number().int().default(new Date().getFullYear()),
  totalDays: z.number().int().positive().default(12),
});

export type CreateLeaveTypeDTO = z.infer<typeof createLeaveTypeSchema>;
export type CreateLeaveRequestDTO = z.infer<typeof createLeaveRequestSchema>;
export type CreateLeaveBalanceDTO = z.infer<typeof createLeaveBalanceSchema>;

/**
 * The year a yearly accrual sweep runs for.
 *
 * `runYearlyLeaveAccrual(year: number)` is typed, but `req.body.year` is not:
 * the route had no validator, so a string reached it and `year - 1` produced
 * NaN. The sweep then ran — against every active employee — querying and
 * writing leave balances for a NaN year. Bounded here rather than trusted.
 */
export const triggerYearlyAccrualSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type TriggerYearlyAccrualDTO = z.infer<typeof triggerYearlyAccrualSchema>;
