import { z } from 'zod';

export const getSettingByKeyParamsSchema = z.object({
  key: z.string().min(1).max(100),
});

export const setSettingByKeyBodySchema = z.object({
  value: z.string().min(0).max(65_000),
});

export const setSettingByKeyParamsSchema = z.object({
  key: z.string().min(1).max(100),
});

export const deleteSettingByKeyParamsSchema = z.object({
  key: z.string().min(1).max(100),
});

export const bulkUpsertSettingsSchema = z.record(
  z.string().min(1).max(100),
  z.string().min(0).max(65_000),
);

export type GetSettingByKeyParamsDTO = z.infer<typeof getSettingByKeyParamsSchema>;
export type SetSettingByKeyBodyDTO = z.infer<typeof setSettingByKeyBodySchema>;
export type SetSettingByKeyParamsDTO = z.infer<typeof setSettingByKeyParamsSchema>;
export type DeleteSettingByKeyParamsDTO = z.infer<typeof deleteSettingByKeyParamsSchema>;
export type BulkUpsertSettingsDTO = z.infer<typeof bulkUpsertSettingsSchema>;
