import { z } from 'zod';

// ==================== Benefit Plans ====================
export const createBenefitPlanSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  type: z.string().min(1).max(50),
  description: z.string().optional(),
  provider: z.string().optional(),
  isTaxable: z.boolean().default(false),
  employeeContribution: z.number().min(0).max(100).default(0),
  employerContribution: z.number().min(0).max(100).default(0),
  maxAmount: z.number().positive().optional(),
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
});

export const updateBenefitPlanSchema = createBenefitPlanSchema.partial().omit({ companyId: true, code: true }).extend({
  isActive: z.boolean().optional(),
});

// ==================== Benefit Enrollments ====================
export const createBenefitEnrollmentSchema = z.object({
  benefitPlanId: z.string().uuid(),
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  effectiveDate: z.string().datetime(),
  expiryDate: z.string().datetime().optional(),
  coverageDetails: z.string().optional(),
});

export const updateBenefitEnrollmentSchema = z.object({
  effectiveDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'CANCELLED', 'EXPIRED']).optional(),
  coverageDetails: z.string().optional(),
});

// ==================== Type Inference ====================
export type CreateBenefitPlanDTO = z.infer<typeof createBenefitPlanSchema>;
export type UpdateBenefitPlanDTO = z.infer<typeof updateBenefitPlanSchema>;
export type CreateBenefitEnrollmentDTO = z.infer<typeof createBenefitEnrollmentSchema>;
export type UpdateBenefitEnrollmentDTO = z.infer<typeof updateBenefitEnrollmentSchema>;
