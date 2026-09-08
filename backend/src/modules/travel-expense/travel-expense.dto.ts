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
