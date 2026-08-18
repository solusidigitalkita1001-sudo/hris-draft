import { z } from 'zod';

const workflowRuleSchema = z.object({
  field: z.string().min(1).max(100),
  operator: z.enum(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS']),
  value: z.string().min(1),
});

const workflowStageSchema = z.object({
  name: z.string().min(1).max(255),
  level: z.number().int().positive(),
  approverType: z.enum(['ROLE', 'USER', 'AUTO']),
  approverRoleCode: z.string().max(50).optional(),
  approverId: z.string().uuid().optional(),
  backupApproverRoleCode: z.string().max(50).optional(),
  backupApproverId: z.string().uuid().optional(),
  slaHours: z.number().int().positive().default(72),
  allowEscalation: z.boolean().default(true),
  conditionRules: z.array(workflowRuleSchema).default([]),
});

export const createWorkflowTemplateSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  approvalType: z.string().min(1).max(100),
  resource: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  isActive: z.boolean().optional(),
  stages: z.array(workflowStageSchema).min(1),
});

export const updateWorkflowTemplateSchema = createWorkflowTemplateSchema.partial().extend({
  companyId: z.string().uuid().optional(),
  stages: z.array(workflowStageSchema).min(1).optional(),
});

export const startWorkflowInstanceSchema = z.object({
  templateId: z.string().uuid(),
  companyId: z.string().uuid(),
  approvalType: z.string().min(1).max(100).optional(),
  referenceType: z.string().min(1).max(100),
  referenceId: z.string().uuid(),
  payload: z.record(z.any()).optional(),
});

export const workflowActionSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT', 'ESCALATE']),
  comment: z.string().max(2000).optional(),
});

export const bulkApprovalSchema = z.object({
  instanceIds: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['APPROVE', 'REJECT', 'ESCALATE']),
  comment: z.string().max(2000).optional(),
});

export type WorkflowStageInput = z.infer<typeof workflowStageSchema>;
export type WorkflowRuleInput = z.infer<typeof workflowRuleSchema>;
export type CreateWorkflowTemplateDTO = z.infer<typeof createWorkflowTemplateSchema>;
export type UpdateWorkflowTemplateDTO = z.infer<typeof updateWorkflowTemplateSchema>;
export type StartWorkflowInstanceDTO = z.infer<typeof startWorkflowInstanceSchema>;
export type WorkflowActionDTO = z.infer<typeof workflowActionSchema>;
export type BulkApprovalDTO = z.infer<typeof bulkApprovalSchema>;
