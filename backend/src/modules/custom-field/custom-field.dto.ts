import { z } from 'zod';

/**
 * Custom field per perusahaan (GAP-39), V1 entitas EMPLOYEE.
 *
 * `key` snake_case dan tidak pernah berubah setelah dibuat (integrasi dan
 * ekspor memegangnya); `label` yang boleh berganti. Tipe nilai divalidasi di
 * service saat MENULIS nilai, bukan di sini — DTO ini hanya bentuk definisi.
 */
export const createCustomFieldSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,63}$/, 'key harus snake_case, diawali huruf'),
  label: z.string().trim().min(1).max(150),
  type: z.enum(['TEXT', 'NUMBER', 'DATE', 'SELECT']),
  options: z.array(z.string().trim().min(1).max(100)).min(1).max(100).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).refine((data) => data.type !== 'SELECT' || (data.options?.length ?? 0) > 0, 'Tipe SELECT butuh options')
  .refine((data) => data.type === 'SELECT' || !data.options, 'options hanya untuk tipe SELECT');

export const updateCustomFieldSchema = z.object({
  label: z.string().trim().min(1).max(150).optional(),
  options: z.array(z.string().trim().min(1).max(100)).min(1).max(100).optional(),
  required: z.boolean().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

/** { values: { key: nilai | null } } — null menghapus nilai (kecuali required). */
export const setCustomFieldValuesSchema = z.object({
  values: z.record(z.string(), z.union([z.string().max(2000), z.number().finite(), z.null()])),
}).refine((data) => Object.keys(data.values).length > 0, 'Tidak ada nilai yang dikirim');

export type CreateCustomFieldDTO = z.infer<typeof createCustomFieldSchema>;
export type UpdateCustomFieldDTO = z.infer<typeof updateCustomFieldSchema>;
export type SetCustomFieldValuesDTO = z.infer<typeof setCustomFieldValuesSchema>;
