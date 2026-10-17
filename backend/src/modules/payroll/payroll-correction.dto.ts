import { z } from 'zod';

/**
 * The amount is typed by a human ON PURPOSE — the opposite decision from
 * arrears. Re-deriving a closed period would surface every reference-data
 * change since then (BPJS rates, components, policies) as a phantom
 * "difference"; the correct figure for "we paid the wrong amount" is the one
 * HR establishes and signs with a reason. See the design decision table in
 * docs/superpowers/specs/2026-10-08-payroll-correction-run-design.md.
 */
export const registerCorrectionSchema = z.object({
  sourcePayslipId: z.string().uuid(),
  /// Positif = kurang bayar, negatif = kelebihan bayar. Dibanding terhadap
  /// NOL SETELAH pembulatan dua desimal: 0.004 lolos cek !==0 tapi tersimpan
  /// 0.00 — baris PENDING yang tidak pernah bisa diklaim run mana pun.
  amount: z.number().finite().refine((v) => Math.round(v * 100) !== 0, 'amount tidak boleh nol (termasuk yang membulat ke nol)'),
  // A reason the length of "typo" explains nothing to the auditor.
  reason: z.string().trim().min(10),
});

export const correctionQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPLIED', 'CANCELLED']).optional(),
  employeeId: z.string().uuid().optional(),
});

export type RegisterCorrectionDTO = z.infer<typeof registerCorrectionSchema>;
export type CorrectionQueryDTO = z.infer<typeof correctionQuerySchema>;
