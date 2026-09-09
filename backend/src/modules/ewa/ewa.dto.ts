import { z } from 'zod';
import { Prisma } from '@prisma/client';

const money = z.coerce.number().finite().min(0).max(9999999999999.99)
  .refine(value => new Prisma.Decimal(value).decimalPlaces() <= 2, 'Amount must have at most two decimal places');
const positiveMoney = money.refine(value => value > 0, 'Amount must be greater than zero');
export const ewaIdParamSchema = z.object({ id: z.string().uuid() });
export const ewaLimitQuerySchema = z.object({
  percent: z.coerce.number().finite().min(1).max(100).optional(),
  earnedGross: z.never().optional(),
});

export const createEWARequestSchema = z.object({
  employeeId: z.string().uuid().optional(),
  payrollPeriodId: z.string().uuid().optional(),
  amountRequested: positiveMoney,
  adminFee: money.optional(),
  reason: z.string().trim().min(3, { message: 'Alasan minimal 3 karakter' }).max(4000).optional(),
  earnedGross: z.never().optional(),
  periodStart: z.never().optional(),
  periodEnd: z.never().optional(),
});
export const approveEWARequestSchema = z.object({
  approverNotes: z.string().trim().max(4000).optional(),
});

export const rejectEWARequestSchema = z.object({
  rejectReason: z.string().trim().min(3, { message: 'Alasan penolakan minimal 3 karakter' }).max(4000),
});

export const markPaidEWARequestSchema = z.object({
  amountPaidOut: positiveMoney,
  disbursementReference: z.string().trim().min(1, { message: 'No bukti transfer / referensi disbursement wajib' }).max(100),
});

export const listEWARequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'DEDUCTED', 'REJECTED', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
});

export type CreateEWARequestDTO = z.infer<typeof createEWARequestSchema>;
export type ApproveEWARequestDTO = z.infer<typeof approveEWARequestSchema>;
export type RejectEWARequestDTO = z.infer<typeof rejectEWARequestSchema>;
export type MarkPaidEWARequestDTO = z.infer<typeof markPaidEWARequestSchema>;
export type ListEWARequestsDTO = z.infer<typeof listEWARequestsSchema>;
