import { z } from 'zod';

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal harus YYYY-MM-DD');

export const createProjectSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9][A-Z0-9-]{1,49}$/i, 'Kode proyek alfanumerik/strip, 2-50 karakter'),
  name: z.string().trim().min(2).max(150),
});

export const updateProjectSchema = z.object({
  name: z.string().trim().min(2).max(150).optional(),
  isActive: z.boolean().optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const createEntrySchema = z.object({
  projectId: z.string().uuid(),
  date: dateOnly,
  /// Seperempat jam adalah satuan terkecil yang masuk akal untuk ditagih.
  hours: z.number().multipleOf(0.25).min(0.25).max(24),
  notes: z.string().trim().max(500).optional(),
});

export const updateEntrySchema = z.object({
  hours: z.number().multipleOf(0.25).min(0.25).max(24).optional(),
  notes: z.string().trim().max(500).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const myEntriesQuerySchema = z.object({
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const entriesQuerySchema = z.object({
  status: z.enum(['SUBMITTED', 'APPROVED', 'REJECTED']).optional(),
  employeeId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  from: dateOnly.optional(),
  to: dateOnly.optional(),
});

export const reportQuerySchema = z.object({
  projectId: z.string().uuid().optional(),
  from: dateOnly,
  to: dateOnly,
});

export type CreateProjectDTO = z.infer<typeof createProjectSchema>;
export type UpdateProjectDTO = z.infer<typeof updateProjectSchema>;
export type CreateEntryDTO = z.infer<typeof createEntrySchema>;
export type UpdateEntryDTO = z.infer<typeof updateEntrySchema>;
export type MyEntriesQueryDTO = z.infer<typeof myEntriesQuerySchema>;
export type EntriesQueryDTO = z.infer<typeof entriesQuerySchema>;
export type ReportQueryDTO = z.infer<typeof reportQuerySchema>;
