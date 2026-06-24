import { z } from 'zod';

export const createReviewCycleSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  type: z.enum(['QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'MONTHLY']).default('QUARTERLY'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reviewDeadline: z.string().datetime().optional(),
  description: z.string().optional(),
});

export const createReviewSchema = z.object({
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  reviewerId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  title: z.string().min(1).max(255),
  type: z.enum(['SELF', 'MANAGER', 'PEER', 'SUBORDINATE', 'FULL_360']).default('SELF'),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  notes: z.string().optional(),
});

export const updateReviewSchema = z.object({
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  notes: z.string().optional(),
});

export const createGoalSchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  type: z.enum(['PERSONAL', 'TEAM', 'COMPANY']).default('PERSONAL'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
});

export const updateGoalProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
  note: z.string().optional(),
});

export const createFeedbackRequestSchema = z.object({
  reviewId: z.string().uuid().optional(),
  requesterId: z.string().uuid(),
  recipientId: z.string().uuid(),
  companyId: z.string().uuid(),
  relationship: z.string().optional(),
  message: z.string().optional(),
});

export const createFeedbackResponseSchema = z.object({
  requestId: z.string().uuid(),
  rating: z.number().int().min(0).max(10).optional(),
  strengths: z.string().optional(),
  improvements: z.string().optional(),
  notes: z.string().optional(),
  isAnonymous: z.boolean().default(false),
});

export type CreateReviewCycleDTO = z.infer<typeof createReviewCycleSchema>;
export type CreateReviewDTO = z.infer<typeof createReviewSchema>;
export type UpdateReviewDTO = z.infer<typeof updateReviewSchema>;
export type CreateGoalDTO = z.infer<typeof createGoalSchema>;
export type UpdateGoalProgressDTO = z.infer<typeof updateGoalProgressSchema>;
export type CreateFeedbackRequestDTO = z.infer<typeof createFeedbackRequestSchema>;
export type CreateFeedbackResponseDTO = z.infer<typeof createFeedbackResponseSchema>;
