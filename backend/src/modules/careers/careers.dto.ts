import { z } from 'zod';

/**
 * Halaman karier publik (GAP-48): pelamar luar tidak punya akun, jadi semua
 * input di sini adalah data tak terpercaya dari internet — divalidasi ketat,
 * di-rate-limit di route, dan tidak pernah menerima companyId (perusahaan
 * ditentukan dari kode di URL dan HARUS menyalakan halamannya lewat setting).
 */
export const applySchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().regex(/^[0-9+\-\s()]{6,25}$/).optional(),
  resumeUrl: z.string().trim().url().max(500).optional(),
  portfolioUrl: z.string().trim().url().max(500).optional(),
  coverLetter: z.string().trim().max(5000).optional(),
  expectedSalary: z.number().positive().max(9999999999999.99).optional(),
});

export const companyCodeParamSchema = z.object({
  companyCode: z.string().trim().min(2).max(50),
  postingCode: z.string().trim().min(2).max(50).optional(),
});

export type ApplyDTO = z.infer<typeof applySchema>;
