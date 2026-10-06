import { z } from 'zod';
import { PROBATION_MAX_MONTHS } from '@/shared/employment/probation';

export const createJobPostingSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  employmentType: z.string().default('FULL_TIME'),
  location: z.string().optional(),
  minSalary: z.number().positive().optional(),
  maxSalary: z.number().positive().optional(),
  currency: z.string().default('IDR'),
  description: z.string().optional(),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  vacancies: z.number().int().positive().default(1),
  /**
   * Requisition this vacancy draws on (GAP-22). Optional in the schema because
   * whether it is mandatory is a per-company setting — a company without a
   * central headcount budget should not gain a required extra step for every
   * replacement hire.
   */
  requisitionId: z.string().uuid().optional(),
}).superRefine((value, ctx) => {
  if (value.minSalary !== undefined && value.maxSalary !== undefined && value.maxSalary < value.minSalary) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxSalary'],
      message: 'maxSalary must be greater than or equal to minSalary',
    });
  }
});

export const createCandidateSchema = z.object({
  companyId: z.string().uuid(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  currentCompany: z.string().optional(),
  currentPosition: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const createApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
  candidateId: z.string().uuid(),
  companyId: z.string().uuid(),
  coverLetter: z.string().optional(),
  expectedSalary: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']),
  notes: z.string().optional(),
});

export const createInterviewSchema = z.object({
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  interviewerId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  type: z.string().default('ONLINE'),
  title: z.string().min(1).max(255),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  notes: z.string().optional(),
});

export const createInterviewFeedbackSchema = z.object({
  rating: z.number().int().min(0).max(10).optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  decision: z.string().optional(),
  notes: z.string().optional(),
});

export const createOfferSchema = z.object({
  baseSalary: z.number().positive(),
  allowance: z.number().nonnegative().optional(),
  grade: z.string().max(50).optional(),
  positionId: z.string().uuid().optional(),
  employmentType: z.enum(['PROBATION', 'CONTRACT', 'PERMANENT', 'INTERNSHIP', 'FULL_TIME', 'PART_TIME']).optional(),
  // 24 months was eight times the statutory ceiling the contract layer
  // enforces, so an offer could promise a probation clause that is void by law
  // and that the contract would then refuse to record.
  probationMonths: z.number().int().min(0).max(PROBATION_MAX_MONTHS).optional(),
  joinDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const respondOfferSchema = z.object({
  decision: z.enum(['ACCEPTED', 'REJECTED']),
  notes: z.string().max(2000).optional(),
});

export type CreateOfferDTO = z.infer<typeof createOfferSchema>;
export type RespondOfferDTO = z.infer<typeof respondOfferSchema>;

export type CreateJobPostingDTO = z.infer<typeof createJobPostingSchema>;
export type CreateCandidateDTO = z.infer<typeof createCandidateSchema>;
export type CreateApplicationDTO = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusDTO = z.infer<typeof updateApplicationStatusSchema>;
export type CreateInterviewDTO = z.infer<typeof createInterviewSchema>;
export type CreateInterviewFeedbackDTO = z.infer<typeof createInterviewFeedbackSchema>;

/** Headcount request that a vacancy can be opened against (GAP-22). */
export const createJobRequisitionSchema = z.object({
  code: z.string().min(1).max(50),
  title: z.string().min(1).max(255),
  headcount: z.number().int().min(1).max(500),
  /// Why the head is needed: a replacement, growth, a new project. Required,
  /// because "we need someone" is not a headcount decision anyone can review.
  reason: z.string().min(10).max(2000),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  budgetPerHire: z.number().positive().optional(),
  targetStartDate: z.string().datetime().optional(),
  notes: z.string().max(2000).optional(),
});

export const requisitionQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED', 'FULFILLED', 'CANCELLED']).optional(),
});

export const rejectRequisitionSchema = z.object({
  reason: z.string().min(1).max(255),
});

export type CreateJobRequisitionDTO = z.infer<typeof createJobRequisitionSchema>;
export type RequisitionQueryDTO = z.infer<typeof requisitionQuerySchema>;
export type RejectRequisitionDTO = z.infer<typeof rejectRequisitionSchema>;
