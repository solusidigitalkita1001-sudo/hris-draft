import { z } from 'zod';

export const createDocumentCategorySchema = z.object({
  companyId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  name: z.string().min(1).max(150),
  code: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
});

export const documentQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'REJECTED', 'SUPERSEDED', 'ARCHIVED']).optional(),
  search: z.string().max(255).optional(),
});

export const createDocumentSchema = z.object({
  companyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  ownerType: z.enum(['EMPLOYEE', 'COMPANY', 'GROUP']),
  employeeId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['INTERNAL', 'RESTRICTED', 'PUBLIC']).default('INTERNAL'),
  expiresAt: z.string().datetime().optional(),
});

export type CreateDocumentCategoryDTO = z.infer<typeof createDocumentCategorySchema>;
export type DocumentQueryDTO = z.infer<typeof documentQuerySchema>;
export type CreateDocumentDTO = z.infer<typeof createDocumentSchema>;
