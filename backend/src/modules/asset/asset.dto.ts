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

/**
 * assetCode sengaja TIDAK bisa diubah: kode itu identitas stiker fisik yang
 * sudah tertempel di barangnya. Status ASSIGNED juga tidak diatur dari sini —
 * perpindahan ke/dari tangan karyawan hanya lewat assign/return/transfer.
 */
export const updateAssetSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  categoryId: z.string().uuid().nullable().optional(),
  serialNumber: z.string().max(100).nullable().optional(),
  purchaseDate: z.string().datetime().nullable().optional(),
  purchaseValue: z.number().positive().nullable().optional(),
  branchId: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  /// AVAILABLE ⇄ MAINTENANCE ⇄ RETIRED; jalan keluar dari MAINTENANCE setelah
  /// aset selesai diperbaiki, dan RETIRED untuk aset yang dipensiunkan.
  status: z.enum(['AVAILABLE', 'MAINTENANCE', 'RETIRED']).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const assignAssetSchema = z.object({
  employeeId: z.string().uuid(),
  conditionAtAssign: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).default('GOOD'),
  notes: z.string().optional(),
});

export const returnAssetSchema = z.object({
  // The controller reads this from the body and hands it to the repository as
  // the assignment to close. It was never declared here, so nothing checked it
  // was even a UUID.
  assignmentId: z.string().uuid(),
  conditionAtReturn: z.enum(['GOOD', 'FAIR', 'DAMAGED', 'LOST']),
  notes: z.string().max(2000).optional(),
});

/** Serah terima langsung antar karyawan: tutup pegangan lama + buka yang baru, atomik. */
export const transferAssetSchema = z.object({
  toEmployeeId: z.string().uuid(),
  condition: z.enum(['NEW', 'GOOD', 'FAIR', 'POOR']).default('GOOD'),
  notes: z.string().max(2000).optional(),
});

export const assetCategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(100),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS_DIGITS', 'UNITS_OF_PRODUCTION'])
    .default('STRAIGHT_LINE'),
  usefulLifeMonths: z.number().int().min(1).max(600).optional(),
});

export const assetCategoryUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  depreciationMethod: z.enum(['STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS_DIGITS', 'UNITS_OF_PRODUCTION']).optional(),
  usefulLifeMonths: z.number().int().min(1).max(600).nullable().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const assetIdParamSchema = z.object({ id: z.string().uuid() });
export const employeeIdParamSchema = z.object({ employeeId: z.string().uuid() });

export const myAssetsQuerySchema = z.object({
  status: z.enum(['ACTIVE', 'RETURNED', 'ALL']).default('ACTIVE'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateAssetDTO = z.infer<typeof createAssetSchema>;
export type UpdateAssetDTO = z.infer<typeof updateAssetSchema>;
export type AssignAssetDTO = z.infer<typeof assignAssetSchema>;
export type ReturnAssetDTO = z.infer<typeof returnAssetSchema>;
export type TransferAssetDTO = z.infer<typeof transferAssetSchema>;
export type AssetCategoryCreateDTO = z.infer<typeof assetCategoryCreateSchema>;
export type AssetCategoryUpdateDTO = z.infer<typeof assetCategoryUpdateSchema>;
export type MyAssetsQueryDTO = z.infer<typeof myAssetsQuerySchema>;
