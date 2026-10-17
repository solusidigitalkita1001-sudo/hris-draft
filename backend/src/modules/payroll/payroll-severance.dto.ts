import { z } from 'zod';
import { finalPayrollSchema } from '@/modules/onboarding/onboarding.dto';

/**
 * The same knobs HR already uses on `POST /resignations/:id/final-payroll`
 * (reason, statutory factors, instalment fields) — registering a payment is
 * that same calculation, frozen. `companyId` never comes from the client.
 */
export const registerSeveranceSchema = finalPayrollSchema.extend({
  resignationId: z.string().uuid(),
});

export const severanceQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
});

export type RegisterSeveranceDTO = z.infer<typeof registerSeveranceSchema>;
export type SeveranceQueryDTO = z.infer<typeof severanceQuerySchema>;
