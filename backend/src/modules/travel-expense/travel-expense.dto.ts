import { z } from 'zod';

export const createBusinessTripSchema = z.object({
  companyId: z.string().uuid().optional(),
  destination: z.string().min(1).max(255),
  purpose: z.string().min(1).max(2000),
  startDate: z.string(),
  endDate: z.string(),
  estimatedCost: z.number().nonnegative(),
  notes: z.string().max(2000).optional(),
});

export const approveBusinessTripSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const createTravelAdvanceSchema = z.object({
  companyId: z.string().uuid().optional(),
  amount: z.number().positive(),
  disbursedAt: z.string().optional(),
  notes: z.string().max(1000).optional(),
});

export const createExpenseClaimSchema = z.object({
  companyId: z.string().uuid().optional(),
  tripId: z.string().uuid().optional(),
  category: z.enum(['TRANSPORTATION', 'HOTEL', 'MEAL', 'ENTERTAINMENT', 'OPERATIONAL']),
  amount: z.number().positive(),
  description: z.string().max(2000).optional(),
  expenseDate: z.string(),
  receiptFilePath: z.string().max(500).optional(),
  ocrExtractedAmount: z.number().nonnegative().optional(),
  notes: z.string().max(1000).optional(),
});

export const approveExpenseClaimSchema = z.object({
  notes: z.string().max(1000).optional(),
});

export const reimburseExpenseClaimSchema = z.object({
  companyId: z.string().uuid().optional(),
  method: z.enum(['TRANSFER', 'PAYROLL']),
  amount: z.number().positive().optional(),
  payrollDetailId: z.string().uuid().optional(),
  notes: z.string().max(1000).optional(),
});

export type CreateBusinessTripRequestDTO = z.infer<typeof createBusinessTripSchema>;
// Employee identity is added by the authenticated controller before service/repository calls.
export type CreateBusinessTripDTO = CreateBusinessTripRequestDTO & { employeeId: string };
export type ApproveBusinessTripDTO = z.infer<typeof approveBusinessTripSchema>;
export type CreateTravelAdvanceDTO = z.infer<typeof createTravelAdvanceSchema>;
export type CreateExpenseClaimRequestDTO = z.infer<typeof createExpenseClaimSchema>;
export type CreateExpenseClaimDTO = CreateExpenseClaimRequestDTO & { employeeId: string };
export type ApproveExpenseClaimDTO = z.infer<typeof approveExpenseClaimSchema>;
export type ReimburseExpenseClaimDTO = z.infer<typeof reimburseExpenseClaimSchema>;


/**
 * Plafon klaim per kategori (GAP-45). Beberapa periode boleh hidup bersama
 * untuk satu kategori — dua juta sebulan sekaligus dua puluh juta setahun
 * adalah kebijakan yang biasa — karena kuncinya `[companyId, category,
 * periodType]`.
 */
export const upsertClaimCategoryLimitSchema = z.object({
  category: z.enum(['TRANSPORTATION', 'HOTEL', 'MEAL', 'ENTERTAINMENT', 'OPERATIONAL']),
  periodType: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ONCE']),
  /// 0 berarti tanpa batas, sesuai pembacaan checker-nya.
  limitAmount: z.number().min(0),
  violationAction: z.enum(['WARN', 'BLOCK']).default('WARN'),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  validFrom: z.string().datetime().optional(),
  validUntil: z.string().datetime().optional(),
});
export type UpsertClaimCategoryLimitDTO = z.infer<typeof upsertClaimCategoryLimitSchema>;
