import { z } from 'zod';

export const createEWARequestSchema = z.object({
  employeeId: z.string().min(1).optional(),
  payrollPeriodId: z.string().min(1).optional(),
  amountRequested: z.coerce.number().positive({ message: 'Amount harus lebih besar dari 0' }),
  adminFee: z.coerce.number().min(0).default(0).optional(),
  reason: z.string().min(3, { message: 'Alasan minimal 3 karakter' }).optional(),
});
export const approveEWARequestSchema = z.object({
  approverNotes: z.string().optional(),
});

export const rejectEWARequestSchema = z.object({
  rejectReason: z.string().min(3, { message: 'Alasan penolakan minimal 3 karakter' }),
});

export const markPaidEWARequestSchema = z.object({
  amountPaidOut: z.coerce.number().positive({ message: 'Actual amount harus > 0' }),
  disbursementReference: z.string().min(1, { message: 'No bukti transfer / referensi disbursement wajib' }),
});

export const listEWARequestsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'PAID', 'DEDUCTED', 'REJECTED', 'CANCELLED']).optional(),
  employeeId: z.string().optional(),
});

export type CreateEWARequestDTO = z.infer<typeof createEWARequestSchema>;
export type ApproveEWARequestDTO = z.infer<typeof approveEWARequestSchema>;
export type RejectEWARequestDTO = z.infer<typeof rejectEWARequestSchema>;
export type MarkPaidEWARequestDTO = z.infer<typeof markPaidEWARequestSchema>;
export type ListEWARequestsDTO = z.infer<typeof listEWARequestsSchema>;
