import { z } from 'zod';

export const createLoanSchema = z.object({
  loanTypeId: z.string().uuid(),
  amount: z.number().positive(),
  totalInstallments: z.number().int().positive().max(60),
  installmentAmount: z.number().positive(),
  reason: z.string().min(1).max(1000),
});

export const approveLoanSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreateLoanDTO = z.infer<typeof createLoanSchema>;
export type ApproveLoanDTO = z.infer<typeof approveLoanSchema>;
