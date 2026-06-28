import api from './api';

export type WorkflowApproverType = 'ROLE' | 'USER' | 'AUTO';
export type WorkflowOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'CONTAINS';
export type WorkflowInstanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'CANCELLED';
export type WorkflowStepStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'SKIPPED';
export type WorkflowActionType = 'APPROVE' | 'REJECT' | 'ESCALATE';

export interface WorkflowConditionRule {
  id?: string;
  field: string;
  operator: WorkflowOperator;
  value: string;
}

export interface WorkflowStage {
  id?: string;
  name: string;
  level: number;
  approverType: WorkflowApproverType;
  approverRoleCode?: string | null;
  approverId?: string | null;
  backupApproverRoleCode?: string | null;
  backupApproverId?: string | null;
  slaHours: number;
  allowEscalation: boolean;
  conditionRules: WorkflowConditionRule[];
}

export interface WorkflowTemplate {
  id: string;
  companyId: string;
  name: string;
  approvalType: string;
  resource?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stages: WorkflowStage[];
  _count?: { instances: number };
}

export interface WorkflowInstanceStep {
  id: string;
  instanceId: string;
  stageId?: string | null;
  name: string;
  level: number;
  approverType: WorkflowApproverType;
  approverRoleCode?: string | null;
  approverId?: string | null;
  backupApproverRoleCode?: string | null;
  backupApproverId?: string | null;
  status: WorkflowStepStatus;
  isCurrent: boolean;
  actedBy?: string | null;
  actedAt?: string | null;
  comment?: string | null;
  createdAt: string;
  updatedAt: string;
  instance?: WorkflowInstance;
}

export interface WorkflowInstanceLog {
  id: string;
  instanceId: string;
  stepId?: string | null;
  action: 'STARTED' | 'APPROVED' | 'REJECTED' | 'ESCALATED' | 'COMMENTED';
  actorId?: string | null;
  comment?: string | null;
  createdAt: string;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  companyId: string;
  approvalType: string;
  referenceType: string;
  referenceId: string;
  requesterId: string;
  payload?: Record<string, unknown> | null;
  status: WorkflowInstanceStatus;
  currentLevel?: number | null;
  createdAt: string;
  updatedAt: string;
  template?: { id: string; name: string; approvalType: string };
  steps: WorkflowInstanceStep[];
  logs?: WorkflowInstanceLog[];
}

class WorkflowEngineService {
  async findTemplates(companyId: string) {
    const response = await api.get('/workflow-engine/templates', { params: { companyId } });
    return response.data.data as WorkflowTemplate[];
  }

  async createTemplate(data: Partial<WorkflowTemplate>) {
    const response = await api.post('/workflow-engine/templates', data);
    return response.data.data as WorkflowTemplate;
  }

  async updateTemplate(id: string, data: Partial<WorkflowTemplate>) {
    const response = await api.put(`/workflow-engine/templates/${id}`, data);
    return response.data.data as WorkflowTemplate;
  }

  async deleteTemplate(id: string) {
    await api.delete(`/workflow-engine/templates/${id}`);
  }

  async findInstances(companyId: string, status?: string) {
    const params: Record<string, string> = { companyId };
    if (status) params.status = status;
    const response = await api.get('/workflow-engine/instances', { params });
    return response.data.data as WorkflowInstance[];
  }

  async findMyApprovals(companyId: string) {
    const response = await api.get('/workflow-engine/instances/my-approvals', { params: { companyId } });
    return response.data.data as WorkflowInstanceStep[];
  }

  async startInstance(data: {
    templateId: string;
    companyId: string;
    approvalType?: string;
    referenceType: string;
    referenceId: string;
    payload?: Record<string, unknown>;
  }) {
    const response = await api.post('/workflow-engine/instances/start', data);
    return response.data.data as WorkflowInstance;
  }

  async applyAction(id: string, action: WorkflowActionType, comment?: string) {
    const response = await api.post(`/workflow-engine/instances/${id}/actions`, { action, comment });
    return response.data.data as WorkflowInstance;
  }
}

export const workflowEngineService = new WorkflowEngineService();
