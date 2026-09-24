import { z } from 'zod';

export const createAssetSchema = z.object({
  companyId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  assetCode: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().datetime().optional(),
  purchaseValue: z.number().positive().optional(),
  branchId: z.string().uuid().optional(),
  notes: z.string().optional(),
});

export const assignAssetSchema = z.object({
  employeeId: z.string().uuid(),
  conditionAtAssign: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).default('GOOD'),
  notes: z.string().optional(),
});

export const returnAssetSchema = z.object({
  conditionAtReturn: z.enum(['GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  notes: z.string().optional(),
});

export const myAssetsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'RETURNED', 'ALL']).default('ACTIVE'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAssetDTO = z.infer<typeof createAssetSchema>;
export type AssignAssetDTO = z.infer<typeof assignAssetSchema>;
export type ReturnAssetDTO = z.infer<typeof returnAssetSchema>;
export type MyAssetsQueryDTO = z.infer<typeof myAssetsQuerySchema>;
