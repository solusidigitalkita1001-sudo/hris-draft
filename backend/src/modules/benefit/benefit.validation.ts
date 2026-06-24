import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const listQuerySchema = z.object({
  companyId: z.string().uuid(),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
