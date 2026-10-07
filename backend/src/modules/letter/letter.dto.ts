import { z } from 'zod';

/**
 * Template surat (GAP-46). `body` tidak divalidasi di sini melainkan di
 * service lewat `validateTemplateBody`, karena aturannya bukan soal bentuk
 * string tapi soal placeholder mana yang dikenal sistem — dan pesan
 * kesalahannya harus menyebut kata mana yang salah, bukan "isi tidak valid".
 */
export const upsertLetterTemplateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/, 'Kode hanya huruf kapital, angka, - dan _'),
  name: z.string().min(1).max(255),
  body: z.string().min(1),
  description: z.string().max(1000).optional(),
  isActive: z.boolean().optional(),
});

export const renderLetterSchema = z.object({
  employeeId: z.string().uuid(),
  letterNumber: z.string().max(100).optional(),
});

export type UpsertLetterTemplateDTO = z.infer<typeof upsertLetterTemplateSchema>;
export type RenderLetterDTO = z.infer<typeof renderLetterSchema>;
