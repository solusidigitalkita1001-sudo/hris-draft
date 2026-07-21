import api from './api';

export interface ReviewCycle {
  id: string; name: string; code: string; type: string; startDate: string; endDate: string; status: string; _count?: { reviews: number };
}

export interface ReviewCyclePayload {
  companyId: string;
  name: string;
  code: string;
  type: 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'MONTHLY';
  startDate: string;
  endDate: string;
  reviewDeadline?: string;
  description?: string;
}

export interface PerformanceReview {
  id: string; cycleId: string; employeeId: string; title: string; type: string; status: string; overallScore?: number;
  submittedAt?: string; createdAt: string;
  employee?: { id: string; fullName: string; employeeNumber: string };
  cycle?: { id: string; name: string };
}

export interface Goal {
  id: string; employeeId: string; title: string; type: string; progress: number; status: string; priority: string;
  startDate: string; endDate?: string; employee?: { id: string; fullName: string };
}

export interface PerformanceComponent {
  id: string;
  methodVersionId: string;
  companyId: string;
  name: string;
  code: string;
  type: 'KPI' | 'GOAL' | 'COMPETENCY' | 'BEHAVIOR' | 'CUSTOM';
  description?: string | null;
  weight: number | string;
  sortOrder: number;
  isRequired: boolean;
  config?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface PerformanceMethodVersion {
  id: string;
  methodId: string;
  companyId: string;
  gradeRuleId?: string | null;
  reviewWorkflowTemplateId?: string | null;
  approvalWorkflowTemplateId?: string | null;
  versionNumber: number;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  summary?: string | null;
  scoreAggregation: 'WEIGHTED_AVERAGE' | 'SUM' | 'AVERAGE';
  minimumScore?: number | string | null;
  maximumScore?: number | string | null;
  normalizationRule?: Record<string, unknown> | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  gradeRule?: PerformanceGradeRule | null;
  reviewWorkflowTemplate?: PerformanceWorkflowTemplate | null;
  approvalWorkflowTemplate?: PerformanceWorkflowTemplate | null;
  components?: PerformanceComponent[];
  _count?: {
    components?: number;
    periods?: number;
  };
}

export interface PerformanceMethod {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
  latestVersionNumber: number;
  createdAt: string;
  updatedAt: string;
  versions?: PerformanceMethodVersion[];
  _count?: {
    versions?: number;
    periods?: number;
  };
}

export interface PerformancePeriod {
  id: string;
  companyId: string;
  methodId: string;
  methodVersionId: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  reviewDeadline?: string | null;
  status: 'DRAFT' | 'READY' | 'PUBLISHED' | 'CLOSED' | 'ARCHIVED';
  description?: string | null;
  readinessSummary?: PerformanceReadinessSummary | null;
  configSnapshot?: PerformanceConfigSnapshot | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  method?: PerformanceMethod;
  methodVersion?: PerformanceMethodVersion;
}

export interface PerformanceReadinessSummary {
  periodId: string;
  methodId: string;
  methodVersionId: string;
  isReady: boolean;
  issues: string[];
  metrics: {
    componentCount: number;
    totalWeight: number;
    methodVersionStatus: string;
    periodStatus: string;
    startDate: string;
    endDate: string;
    reviewDeadline: string | null;
  };
}

export interface PerformanceConfigSnapshot {
  frozenAt: string;
  period: {
    id: string;
    name: string;
    code: string;
    startDate: string;
    endDate: string;
    reviewDeadline: string | null;
  };
  method: {
    id: string;
    name: string;
    code: string;
    status: string;
  };
  methodVersion: {
    id: string;
    versionNumber: number;
    status: string;
    summary?: string | null;
    scoreAggregation: string;
    minimumScore: number | null;
    maximumScore: number | null;
    normalizationRule?: Record<string, unknown> | null;
  };
  gradeRule: {
    id: string;
    name: string;
    code: string;
    description?: string | null;
    ranges: Array<{
      id: string;
      label: string;
      minimum: number;
      maximum: number;
      sortOrder: number;
      description?: string | null;
    }>;
  } | null;
  reviewWorkflowTemplate: {
    id: string;
    name: string;
    approvalType: string;
    description?: string | null;
    stages: Array<{
      id: string;
      name: string;
      level: number;
      approverType: string;
      approverRoleCode?: string | null;
      approverId?: string | null;
      backupApproverRoleCode?: string | null;
      backupApproverId?: string | null;
      slaHours: number;
      allowEscalation: boolean;
      conditionRules: Array<{
        id: string;
        field: string;
        operator: string;
        value: string;
      }>;
    }>;
  } | null;
  approvalWorkflowTemplate: {
    id: string;
    name: string;
    approvalType: string;
    description?: string | null;
    stages: Array<{
      id: string;
      name: string;
      level: number;
      approverType: string;
      approverRoleCode?: string | null;
      approverId?: string | null;
      backupApproverRoleCode?: string | null;
      backupApproverId?: string | null;
      slaHours: number;
      allowEscalation: boolean;
      conditionRules: Array<{
        id: string;
        field: string;
        operator: string;
        value: string;
      }>;
    }>;
  } | null;
  components: Array<{
    id: string;
    name: string;
    code: string;
    type: string;
    weight: number;
    sortOrder: number;
    isRequired: boolean;
    description?: string | null;
    config?: Record<string, unknown> | null;
  }>;
}

export interface PerformanceFormula {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  strategy: 'ACHIEVEMENT_PERCENTAGE' | 'LOWER_IS_BETTER' | 'MANUAL_RATING' | 'AVERAGE' | 'WEIGHTED_AVERAGE' | 'CUSTOM';
  expression?: string | null;
  roundingMode: 'ROUND' | 'FLOOR' | 'CEIL';
  roundingPrecision: number;
  minimumScore?: number | string | null;
  maximumScore?: number | string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    indicators?: number;
  };
}

export interface PerformanceIndicator {
  id: string;
  companyId: string;
  formulaId?: string | null;
  name: string;
  code: string;
  description?: string | null;
  category?: string | null;
  perspective?: string | null;
  measurementType: 'NUMBER' | 'PERCENTAGE' | 'CURRENCY' | 'DURATION' | 'BOOLEAN' | 'RATING' | 'TEXT' | 'CUSTOM_FORMULA';
  targetType: 'MONTHLY' | 'QUARTERLY' | 'SEMESTER' | 'YEARLY' | 'CUSTOM';
  direction: 'HIGHER_BETTER' | 'LOWER_BETTER' | 'RANGE' | 'EXACT' | 'MANUAL';
  unit?: string | null;
  defaultWeight?: number | string | null;
  minimumValue?: number | string | null;
  maximumValue?: number | string | null;
  evidenceRequired: boolean;
  reviewRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  formula?: PerformanceFormula | null;
}

export interface PerformanceGradeRange {
  id?: string;
  label: string;
  minimum: number;
  maximum: number;
  sortOrder: number;
  description?: string | null;
}

export interface PerformanceGradeRule {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  ranges?: PerformanceGradeRange[];
  _count?: {
    methodVersions?: number;
  };
}

export interface PerformanceWorkflowRule {
  id?: string;
  field: string;
  operator: 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE' | 'IN' | 'CONTAINS';
  value: string;
}

export interface PerformanceWorkflowStage {
  id?: string;
  name: string;
  level: number;
  approverType: 'ROLE' | 'USER' | 'AUTO';
  approverRoleCode?: string | null;
  approverId?: string | null;
  backupApproverRoleCode?: string | null;
  backupApproverId?: string | null;
  slaHours: number;
  allowEscalation: boolean;
  conditionRules: PerformanceWorkflowRule[];
}

export interface PerformanceWorkflowTemplate {
  id: string;
  companyId: string;
  name: string;
  approvalType: 'PERFORMANCE_REVIEW' | 'PERFORMANCE_APPROVAL';
  resource?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  stages: PerformanceWorkflowStage[];
  _count?: {
    instances?: number;
    reviewMethodVersions?: number;
    approvalMethodVersions?: number;
  };
}

export interface PerformanceMethodPayload {
  companyId: string;
  name: string;
  code: string;
  description?: string;
}

export interface PerformanceMethodVersionPayload {
  summary?: string;
  scoreAggregation?: 'WEIGHTED_AVERAGE' | 'SUM' | 'AVERAGE';
  minimumScore?: number;
  maximumScore?: number;
  gradeRuleId?: string;
  reviewWorkflowTemplateId?: string;
  approvalWorkflowTemplateId?: string;
  normalizationRule?: Record<string, unknown>;
}

export interface PerformanceComponentPayload {
  name: string;
  code: string;
  type?: 'KPI' | 'GOAL' | 'COMPETENCY' | 'BEHAVIOR' | 'CUSTOM';
  description?: string;
  weight: number;
  sortOrder?: number;
  isRequired?: boolean;
  config?: Record<string, unknown>;
}

export interface PerformancePeriodPayload {
  companyId: string;
  methodId: string;
  methodVersionId: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  reviewDeadline?: string;
  description?: string;
}

export interface PerformanceFormulaPayload {
  companyId: string;
  name: string;
  code: string;
  description?: string;
  strategy: PerformanceFormula['strategy'];
  expression?: string;
  roundingMode?: PerformanceFormula['roundingMode'];
  roundingPrecision?: number;
  minimumScore?: number;
  maximumScore?: number;
  isActive?: boolean;
}

export interface PerformanceIndicatorPayload {
  companyId: string;
  formulaId?: string;
  name: string;
  code: string;
  description?: string;
  category?: string;
  perspective?: string;
  measurementType: PerformanceIndicator['measurementType'];
  targetType: PerformanceIndicator['targetType'];
  direction: PerformanceIndicator['direction'];
  unit?: string;
  defaultWeight?: number;
  minimumValue?: number;
  maximumValue?: number;
  evidenceRequired?: boolean;
  reviewRequired?: boolean;
  isActive?: boolean;
}

export interface PerformanceGradeRulePayload {
  companyId: string;
  name: string;
  code: string;
  description?: string;
  isActive?: boolean;
  ranges: PerformanceGradeRange[];
}

export interface PerformanceWorkflowTemplatePayload {
  companyId: string;
  name: string;
  description?: string;
  isActive?: boolean;
  stages: PerformanceWorkflowStage[];
}

class PerformanceService {
  async getReviewCycles(companyId: string): Promise<ReviewCycle[]> {
    const r = await api.get('/performance/review-cycles', { params: { companyId } }); return r.data.data;
  }
  async createReviewCycle(data: ReviewCyclePayload): Promise<ReviewCycle> {
    const r = await api.post('/performance/review-cycles', data); return r.data.data;
  }
  async getReviews(companyId: string, params?: Record<string, string>): Promise<PerformanceReview[]> {
    const r = await api.get('/performance/reviews', { params: { companyId, ...params } }); return r.data.data;
  }
  async getReview(id: string): Promise<PerformanceReview> {
    const r = await api.get(`/performance/reviews/${id}`); return r.data.data;
  }
  async createReview(data: any): Promise<PerformanceReview> {
    const r = await api.post('/performance/reviews', data); return r.data.data;
  }
  async submitReview(id: string): Promise<PerformanceReview> {
    const r = await api.patch(`/performance/reviews/${id}/submit`); return r.data.data;
  }
  async approveReview(id: string): Promise<PerformanceReview> {
    const r = await api.patch(`/performance/reviews/${id}/approve`); return r.data.data;
  }
  async getGoals(companyId: string, employeeId?: string): Promise<Goal[]> {
    const r = await api.get('/performance/goals', { params: { companyId, employeeId } }); return r.data.data;
  }
  async createGoal(data: any): Promise<Goal> {
    const r = await api.post('/performance/goals', data); return r.data.data;
  }
  async updateGoalProgress(id: string, data: { progress: number; note?: string }): Promise<any> {
    const r = await api.patch(`/performance/goals/${id}/progress`, data); return r.data.data;
  }

  async getMethods(companyId: string): Promise<PerformanceMethod[]> {
    const r = await api.get('/performance/methods', { params: { companyId } }); return r.data.data;
  }

  async getMethod(id: string): Promise<PerformanceMethod> {
    const r = await api.get(`/performance/methods/${id}`); return r.data.data;
  }

  async createMethod(data: PerformanceMethodPayload): Promise<PerformanceMethod> {
    const r = await api.post('/performance/methods', data); return r.data.data;
  }

  async updateMethod(id: string, data: Partial<PerformanceMethodPayload>): Promise<PerformanceMethod> {
    const r = await api.put(`/performance/methods/${id}`, data); return r.data.data;
  }

  async getMethodVersions(methodId: string): Promise<PerformanceMethodVersion[]> {
    const r = await api.get(`/performance/methods/${methodId}/versions`); return r.data.data;
  }

  async getMethodVersion(id: string): Promise<PerformanceMethodVersion> {
    const r = await api.get(`/performance/method-versions/${id}`); return r.data.data;
  }

  async createMethodVersion(methodId: string, data: PerformanceMethodVersionPayload): Promise<PerformanceMethodVersion> {
    const r = await api.post(`/performance/methods/${methodId}/version`, data); return r.data.data;
  }

  async updateMethodVersion(id: string, data: PerformanceMethodVersionPayload): Promise<PerformanceMethodVersion> {
    const r = await api.put(`/performance/method-versions/${id}`, data); return r.data.data;
  }

  async publishMethodVersion(id: string): Promise<PerformanceMethodVersion> {
    const r = await api.post(`/performance/method-versions/${id}/publish`); return r.data.data;
  }

  async getComponents(methodVersionId: string): Promise<PerformanceComponent[]> {
    const r = await api.get(`/performance/method-versions/${methodVersionId}/components`); return r.data.data;
  }

  async createComponent(methodVersionId: string, data: PerformanceComponentPayload): Promise<PerformanceComponent> {
    const r = await api.post(`/performance/method-versions/${methodVersionId}/components`, data); return r.data.data;
  }

  async updateComponent(id: string, data: Partial<PerformanceComponentPayload>): Promise<PerformanceComponent> {
    const r = await api.put(`/performance/components/${id}`, data); return r.data.data;
  }

  async getPeriods(companyId: string, params?: { methodId?: string; status?: string }): Promise<PerformancePeriod[]> {
    const r = await api.get('/performance/periods', { params: { companyId, ...params } }); return r.data.data;
  }

  async getPeriod(id: string): Promise<PerformancePeriod> {
    const r = await api.get(`/performance/periods/${id}`); return r.data.data;
  }

  async createPeriod(data: PerformancePeriodPayload): Promise<PerformancePeriod> {
    const r = await api.post('/performance/periods', data); return r.data.data;
  }

  async updatePeriod(id: string, data: Partial<PerformancePeriodPayload>): Promise<PerformancePeriod> {
    const r = await api.put(`/performance/periods/${id}`, data); return r.data.data;
  }

  async getPeriodReadiness(id: string): Promise<PerformanceReadinessSummary> {
    const r = await api.get(`/performance/periods/${id}/readiness`); return r.data.data;
  }

  async publishPeriod(id: string): Promise<PerformancePeriod> {
    const r = await api.post(`/performance/periods/${id}/publish`); return r.data.data;
  }

  async getFormulas(companyId: string): Promise<PerformanceFormula[]> {
    const r = await api.get('/performance/formulas', { params: { companyId } }); return r.data.data;
  }

  async createFormula(data: PerformanceFormulaPayload): Promise<PerformanceFormula> {
    const r = await api.post('/performance/formulas', data); return r.data.data;
  }

  async updateFormula(id: string, data: Partial<PerformanceFormulaPayload>): Promise<PerformanceFormula> {
    const r = await api.put(`/performance/formulas/${id}`, data); return r.data.data;
  }

  async getIndicators(companyId: string): Promise<PerformanceIndicator[]> {
    const r = await api.get('/performance/indicators', { params: { companyId } }); return r.data.data;
  }

  async createIndicator(data: PerformanceIndicatorPayload): Promise<PerformanceIndicator> {
    const r = await api.post('/performance/indicators', data); return r.data.data;
  }

  async updateIndicator(id: string, data: Partial<PerformanceIndicatorPayload>): Promise<PerformanceIndicator> {
    const r = await api.put(`/performance/indicators/${id}`, data); return r.data.data;
  }

  async getGradeRules(companyId: string): Promise<PerformanceGradeRule[]> {
    const r = await api.get('/performance/grades', { params: { companyId } }); return r.data.data;
  }

  async createGradeRule(data: PerformanceGradeRulePayload): Promise<PerformanceGradeRule> {
    const r = await api.post('/performance/grades', data); return r.data.data;
  }

  async updateGradeRule(id: string, data: Partial<PerformanceGradeRulePayload>): Promise<PerformanceGradeRule> {
    const r = await api.put(`/performance/grades/${id}`, data); return r.data.data;
  }

  async getReviewWorkflows(companyId: string): Promise<PerformanceWorkflowTemplate[]> {
    const r = await api.get('/performance/review-workflows', { params: { companyId } }); return r.data.data;
  }

  async createReviewWorkflow(data: PerformanceWorkflowTemplatePayload): Promise<PerformanceWorkflowTemplate> {
    const r = await api.post('/performance/review-workflows', data); return r.data.data;
  }

  async updateReviewWorkflow(id: string, data: Partial<PerformanceWorkflowTemplatePayload>): Promise<PerformanceWorkflowTemplate> {
    const r = await api.put(`/performance/review-workflows/${id}`, data); return r.data.data;
  }

  async getApprovalWorkflows(companyId: string): Promise<PerformanceWorkflowTemplate[]> {
    const r = await api.get('/performance/approval-workflows', { params: { companyId } }); return r.data.data;
  }

  async createApprovalWorkflow(data: PerformanceWorkflowTemplatePayload): Promise<PerformanceWorkflowTemplate> {
    const r = await api.post('/performance/approval-workflows', data); return r.data.data;
  }

  async updateApprovalWorkflow(id: string, data: Partial<PerformanceWorkflowTemplatePayload>): Promise<PerformanceWorkflowTemplate> {
    const r = await api.put(`/performance/approval-workflows/${id}`, data); return r.data.data;
  }
}

export const performanceService = new PerformanceService();
