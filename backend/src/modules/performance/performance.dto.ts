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

const jsonValueSchema = z.record(z.string(), z.any()).optional();
const performanceWorkflowRuleSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS']),
  value: z.string().min(1),
});

const performanceWorkflowStageSchema = z.object({
  name: z.string().min(1).max(255),
  level: z.number().int().positive(),
  approverType: z.enum(['ROLE', 'USER', 'AUTO']),
  approverRoleCode: z.string().max(50).optional(),
  approverId: z.string().uuid().optional(),
  backupApproverRoleCode: z.string().max(50).optional(),
  backupApproverId: z.string().uuid().optional(),
  slaHours: z.number().int().positive().default(72),
  allowEscalation: z.boolean().default(true),
  conditionRules: z.array(performanceWorkflowRuleSchema).default([]),
});

export const createPerformanceMethodSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
});

export const updatePerformanceMethodSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

export const createPerformanceMethodVersionSchema = z.object({
  summary: z.string().optional(),
  scoreAggregation: z.enum(['WEIGHTED_AVERAGE', 'SUM', 'AVERAGE']).default('WEIGHTED_AVERAGE'),
  minimumScore: z.number().min(0).max(999).optional(),
  maximumScore: z.number().min(0).max(999).optional(),
  gradeRuleId: z.string().uuid().optional(),
  reviewWorkflowTemplateId: z.string().uuid().optional(),
  approvalWorkflowTemplateId: z.string().uuid().optional(),
  normalizationRule: jsonValueSchema,
});

export const updatePerformanceMethodVersionSchema = z.object({
  summary: z.string().optional(),
  scoreAggregation: z.enum(['WEIGHTED_AVERAGE', 'SUM', 'AVERAGE']).optional(),
  minimumScore: z.number().min(0).max(999).optional(),
  maximumScore: z.number().min(0).max(999).optional(),
  gradeRuleId: z.string().uuid().optional(),
  reviewWorkflowTemplateId: z.string().uuid().optional(),
  approvalWorkflowTemplateId: z.string().uuid().optional(),
  normalizationRule: jsonValueSchema,
});

export const createPerformanceComponentSchema = z.object({
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  type: z.enum(['KPI', 'GOAL', 'COMPETENCY', 'BEHAVIOR', 'CUSTOM']).default('CUSTOM'),
  description: z.string().optional(),
  weight: z.number().positive().max(100),
  sortOrder: z.number().int().min(0).default(0),
  isRequired: z.boolean().default(true),
  config: jsonValueSchema,
});

export const updatePerformanceComponentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  type: z.enum(['KPI', 'GOAL', 'COMPETENCY', 'BEHAVIOR', 'CUSTOM']).optional(),
  description: z.string().optional(),
  weight: z.number().positive().max(100).optional(),
  sortOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
  config: jsonValueSchema,
});

export const createPerformancePeriodSchema = z.object({
  companyId: z.string().uuid(),
  methodId: z.string().uuid(),
  methodVersionId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reviewDeadline: z.string().datetime().optional(),
  description: z.string().optional(),
});

export const updatePerformancePeriodSchema = z.object({
  methodVersionId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  reviewDeadline: z.string().datetime().optional(),
  description: z.string().optional(),
});

export const createPerformanceFormulaSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  strategy: z.enum(['ACHIEVEMENT_PERCENTAGE', 'LOWER_IS_BETTER', 'MANUAL_RATING', 'AVERAGE', 'WEIGHTED_AVERAGE', 'CUSTOM']),
  expression: z.string().optional(),
  roundingMode: z.enum(['ROUND', 'FLOOR', 'CEIL']).default('ROUND'),
  roundingPrecision: z.number().int().min(0).max(6).default(2),
  minimumScore: z.number().min(0).max(999).optional(),
  maximumScore: z.number().min(0).max(999).optional(),
  isActive: z.boolean().default(true),
});

export const updatePerformanceFormulaSchema = createPerformanceFormulaSchema.omit({ companyId: true }).partial();

export const createPerformanceIndicatorSchema = z.object({
  companyId: z.string().uuid(),
  formulaId: z.string().uuid().optional(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  perspective: z.string().max(100).optional(),
  measurementType: z.enum(['NUMBER', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'BOOLEAN', 'RATING', 'TEXT', 'CUSTOM_FORMULA']),
  targetType: z.enum(['MONTHLY', 'QUARTERLY', 'SEMESTER', 'YEARLY', 'CUSTOM']),
  direction: z.enum(['HIGHER_BETTER', 'LOWER_BETTER', 'RANGE', 'EXACT', 'MANUAL']),
  unit: z.string().max(50).optional(),
  defaultWeight: z.number().min(0).max(100).optional(),
  minimumValue: z.number().optional(),
  maximumValue: z.number().optional(),
  evidenceRequired: z.boolean().default(false),
  reviewRequired: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updatePerformanceIndicatorSchema = createPerformanceIndicatorSchema.omit({ companyId: true }).partial();

export const performanceGradeRangeSchema = z.object({
  label: z.string().min(1).max(50),
  minimum: z.number().min(0).max(999),
  maximum: z.number().min(0).max(999),
  sortOrder: z.number().int().min(0),
  description: z.string().optional(),
});

export const createPerformanceGradeRuleSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
  ranges: z.array(performanceGradeRangeSchema).min(1),
});

export const updatePerformanceGradeRuleSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  ranges: z.array(performanceGradeRangeSchema).min(1).optional(),
});

export const createPerformanceWorkflowTemplateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  stages: z.array(performanceWorkflowStageSchema).min(1),
});

export const updatePerformanceWorkflowTemplateSchema = z.object({
  companyId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  stages: z.array(performanceWorkflowStageSchema).min(1).optional(),
});

export type CreateReviewCycleDTO = z.infer<typeof createReviewCycleSchema>;
export type CreateReviewDTO = z.infer<typeof createReviewSchema>;
export type UpdateReviewDTO = z.infer<typeof updateReviewSchema>;
export type CreateGoalDTO = z.infer<typeof createGoalSchema>;
export type UpdateGoalProgressDTO = z.infer<typeof updateGoalProgressSchema>;
export type CreateFeedbackRequestDTO = z.infer<typeof createFeedbackRequestSchema>;
export type CreateFeedbackResponseDTO = z.infer<typeof createFeedbackResponseSchema>;
export type CreatePerformanceMethodDTO = z.infer<typeof createPerformanceMethodSchema>;
export type UpdatePerformanceMethodDTO = z.infer<typeof updatePerformanceMethodSchema>;
export type CreatePerformanceMethodVersionDTO = z.infer<typeof createPerformanceMethodVersionSchema>;
export type UpdatePerformanceMethodVersionDTO = z.infer<typeof updatePerformanceMethodVersionSchema>;
export type CreatePerformanceComponentDTO = z.infer<typeof createPerformanceComponentSchema>;
export type UpdatePerformanceComponentDTO = z.infer<typeof updatePerformanceComponentSchema>;
export type CreatePerformancePeriodDTO = z.infer<typeof createPerformancePeriodSchema>;
export type UpdatePerformancePeriodDTO = z.infer<typeof updatePerformancePeriodSchema>;
export type CreatePerformanceFormulaDTO = z.infer<typeof createPerformanceFormulaSchema>;
export type UpdatePerformanceFormulaDTO = z.infer<typeof updatePerformanceFormulaSchema>;
export type CreatePerformanceIndicatorDTO = z.infer<typeof createPerformanceIndicatorSchema>;
export type UpdatePerformanceIndicatorDTO = z.infer<typeof updatePerformanceIndicatorSchema>;
export type PerformanceGradeRangeDTO = z.infer<typeof performanceGradeRangeSchema>;
export type CreatePerformanceGradeRuleDTO = z.infer<typeof createPerformanceGradeRuleSchema>;
export type UpdatePerformanceGradeRuleDTO = z.infer<typeof updatePerformanceGradeRuleSchema>;
export type PerformanceWorkflowRuleDTO = z.infer<typeof performanceWorkflowRuleSchema>;
export type PerformanceWorkflowStageDTO = z.infer<typeof performanceWorkflowStageSchema>;
export type CreatePerformanceWorkflowTemplateDTO = z.infer<typeof createPerformanceWorkflowTemplateSchema>;
export type UpdatePerformanceWorkflowTemplateDTO = z.infer<typeof updatePerformanceWorkflowTemplateSchema>;
