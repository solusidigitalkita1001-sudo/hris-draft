import api from './api';

export type WorkflowOperator = 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'CONTAINS';
export type WorkflowApproverType = 'ROLE' | 'USER' | 'AUTO';
export type WorkflowInstanceStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'IN_PROGRESS';

export interface WorkflowConditionRule {
  id?: string;
  field: string;
  operator: WorkflowOperator;
  value: string;
}

export interface WorkflowStageInput {
  id?: string;
  name: string;
  level: number;
  approverType: WorkflowApproverType;
  approverRoleCode?: string;
  approverId?: string;
  backupApproverRoleCode?: string;
  backupApproverId?: string;
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
  stages: WorkflowStageInput[];
  createdAt: string;
  updatedAt: string;
  _count?: { instances: number };
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  companyId: string;
  approvalType: string;
  referenceType: string;
  referenceId: string;
  requesterId: string;
  payload?: any;
  status: WorkflowInstanceStatus;
  currentLevel: number | null;
  steps: any[];
  logs: any[];
  template?: { id: string; name: string; approvalType: string };
}

export interface BulkApprovalRequest {
  instanceIds: string[];
  action: 'APPROVE' | 'REJECT' | 'ESCALATE';
  comment?: string;
}

export interface BulkApprovalResult {
  total: number;
  successful: number;
  failed: number;
  results: Array<{
    instanceId: string;
    success: boolean;
    status?: string;
    error?: string;
  }>;
}

class WorkflowService {
  async listTemplates(
    companyId: string,
    filters?: { approvalType?: string; resource?: string; isActive?: boolean }
  ): Promise<WorkflowTemplate[]> {
    const params: Record<string, string> = { companyId };
    if (filters?.approvalType) params.approvalType = filters.approvalType;
    if (filters?.resource) params.resource = filters.resource;
    if (filters?.isActive !== undefined) params.isActive = String(filters.isActive);
    const r = await api.get('/workflow-engine/templates', { params });
    return r.data.data;
  }

  async getTemplate(id: string): Promise<WorkflowTemplate> {
    const r = await api.get(`/workflow-engine/templates/${id}`);
    return r.data.data;
  }

  async createTemplate(
    payload: Omit<WorkflowTemplate, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WorkflowTemplate> {
    const r = await api.post('/workflow-engine/templates', payload);
    return r.data.data;
  }

  async updateTemplate(
    id: string,
    payload: Partial<WorkflowTemplate> & { stages?: WorkflowStageInput[] }
  ): Promise<WorkflowTemplate> {
    const r = await api.put(`/workflow-engine/templates/${id}`, payload);
    return r.data.data;
  }

  async deleteTemplate(id: string): Promise<void> {
    await api.delete(`/workflow-engine/templates/${id}`);
  }

  async listInstances(
    companyId: string,
    filters?: { status?: string; referenceType?: string; requesterId?: string }
  ): Promise<WorkflowInstance[]> {
    const params: Record<string, string> = { companyId };
    if (filters?.status) params.status = filters.status;
    if (filters?.referenceType) params.referenceType = filters.referenceType;
    if (filters?.requesterId) params.requesterId = filters.requesterId;
    const r = await api.get('/workflow-engine/instances', { params });
    return r.data.data;
  }

  async getMyApprovals(companyId: string): Promise<any[]> {
    const r = await api.get('/workflow-engine/instances/my-approvals', { params: { companyId } });
    return r.data.data;
  }

  async bulkApproval(body: BulkApprovalRequest): Promise<BulkApprovalResult> {
    const r = await api.post('/workflow-engine/instances/bulk-approve', body);
    return r.data.data;
  }
}

export const workflowService = new WorkflowService();
