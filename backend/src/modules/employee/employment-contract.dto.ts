import { z } from 'zod';

export const createContractSchema = z.object({
  employeeId: z.string().uuid(),
  type: z.enum(['PKWT', 'PKWTT', 'PROBATION']),
  startDate: z.string().datetime(),
  /// Required for PKWT and probation, refused for PKWTT — an indefinite
  /// contract with an end date is a contradiction.
  endDate: z.string().datetime().optional(),
  contractNumber: z.string().max(100).optional(),
  notes: z.string().max(2000).optional(),
});

export const contractQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'ENDED', 'TERMINATED', 'RENEWED']).optional(),
});

export const expiringContractQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export const updateContractStatusSchema = z.object({
  status: z.enum(['ENDED', 'TERMINATED', 'RENEWED']),
});

export type CreateContractDTO = z.infer<typeof createContractSchema>;
export type ContractQueryDTO = z.infer<typeof contractQuerySchema>;
export type ExpiringContractQueryDTO = z.infer<typeof expiringContractQuerySchema>;
export type UpdateContractStatusDTO = z.infer<typeof updateContractStatusSchema>;
