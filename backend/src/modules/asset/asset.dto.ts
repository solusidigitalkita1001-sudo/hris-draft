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

export type CreateAssetDTO = z.infer<typeof createAssetSchema>;
export type AssignAssetDTO = z.infer<typeof assignAssetSchema>;
export type ReturnAssetDTO = z.infer<typeof returnAssetSchema>;
