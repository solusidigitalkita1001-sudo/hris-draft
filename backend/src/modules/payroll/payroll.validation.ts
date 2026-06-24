import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const periodIdParamSchema = z.object({
  periodId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
