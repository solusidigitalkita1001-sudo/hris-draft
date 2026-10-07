import { z } from 'zod';

export const createChecklistSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  itemName: z.string().min(1).max(150),
  category: z.string().default('Equipment'),
  picId: z.string().uuid().optional(),
  dueDate: z.string().datetime().optional(),
});

export const updateChecklistSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'DONE', 'OVERDUE']).optional(),
  notes: z.string().optional(),
});

export const createResignationSchema = z.object({
  companyId: z.string().uuid(),
  employeeId: z.string().uuid(),
  resignDate: z.string().datetime(),
  lastWorkingDate: z.string().datetime(),
  reason: z.string().optional(),
  noticePeriodDays: z.number().int().default(30),
});

export const finalPayrollSchema = z.object({
  reason: z.enum(['RESIGN', 'TERMINATION', 'CONTRACT_END', 'RETIREMENT', 'DEATH']).optional(),
  severanceFactor: z.number().min(0).max(3).optional(),
  upmkFactor: z.number().min(0).max(3).optional(),
  compensationOfRights: z.number().min(0).optional(),
  monthlyWorkingDays: z.number().int().min(1).max(31).optional(),
  // PP 68/2009 pasal 2 ayat (2): severance paid across at most two calendar
  // years is still one payment, and its brackets climb across the instalments.
  // Without these two the second instalment would restart at 0%.
  previouslyPaidGross: z.number().min(0).optional(),
  calendarYearIndex: z.number().int().min(1).max(10).optional(),
});

export const createClearanceSchema = z.object({
  resignationId: z.string().uuid(),
  department: z.string().min(1).max(50),
  checklistItem: z.string().min(1).max(150),
  picId: z.string().uuid().optional(),
});

export type CreateChecklistDTO = z.infer<typeof createChecklistSchema>;
export type UpdateChecklistDTO = z.infer<typeof updateChecklistSchema>;
export type CreateResignationDTO = z.infer<typeof createResignationSchema>;
export type CreateClearanceDTO = z.infer<typeof createClearanceSchema>;
