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

/**
 * Signer list for a document (GAP-27). `order` is optional: omit it everywhere
 * and the signers are equal, as documents behaved before ordering existed.
 * Equal values mean one step signed in parallel.
 */
export const setDocumentSignersSchema = z.object({
  signers: z
    .array(
      z.object({
        userId: z.string().uuid(),
        order: z.number().int().min(1).max(50).optional(),
        dueAt: z.string().datetime().optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const declineDocumentSchema = z.object({
  reason: z.string().min(1).max(255),
});

export type SetDocumentSignersDTO = z.infer<typeof setDocumentSignersSchema>;
export type DeclineDocumentDTO = z.infer<typeof declineDocumentSchema>;
