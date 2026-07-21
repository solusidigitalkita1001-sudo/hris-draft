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
  weightMode: 'STRICT_100' | 'FLEXIBLE';
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
  planningSummary?: PerformancePlanningReadiness | null;
  publishedAt?: string | null;
  planningPublishedAt?: string | null;
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

export interface PerformanceMethodVersionReadiness {
  versionId: string;
  methodId: string;
  versionNumber: number;
  isReady: boolean;
  issues: string[];
  metrics: {
    componentCount: number;
    totalWeight: number;
    status: string;
    weightMode: 'STRICT_100' | 'FLEXIBLE';
  };
}

export interface PerformancePlanningReadiness {
  periodId: string;
  periodStatus: string;
  planningPublishedAt?: string | null;
  isReady: boolean;
  issues: string[];
  metrics: {
    assignmentCount: number;
    publishedAssignmentCount: number;
    targetCount: number;
    requiredComponentCount: number;
    configuredTotalWeight: number;
    weightMode: 'STRICT_100' | 'FLEXIBLE';
  };
}

export interface PerformancePlanningEmployeeSummary {
  id: string;
  fullName: string;
  employeeNumber: string;
  email?: string | null;
  branch?: { id: string; name: string } | null;
  department?: { id: string; name: string } | null;
  subDepartment?: { id: string; name: string } | null;
  position?: { id: string; name: string; reportsToId?: string | null } | null;
}

export interface PerformancePlanningTargetProgress {
  id: string;
  progressPercent: number;
  currentValue?: number | string | null;
  currentText?: string | null;
  note?: string | null;
  createdAt: string;
  actor?: PerformancePlanningEmployeeSummary | null;
}

export interface PerformancePlanningEvidence {
  id: string;
  fileName: string;
  originalName: string;
  fileUrl: string;
  mimeType: string;
  fileSize: number;
  notes?: string | null;
  createdAt: string;
  uploadedBy?: PerformancePlanningEmployeeSummary | null;
}

export interface PerformancePlanningTarget {
  id: string;
  companyId: string;
  assignmentId: string;
  componentId?: string | null;
  indicatorId?: string | null;
  formulaId?: string | null;
  reviewerId?: string | null;
  approverId?: string | null;
  name: string;
  description?: string | null;
  targetValue?: number | string | null;
  targetText?: string | null;
  currentValue?: number | string | null;
  currentText?: string | null;
  progressPercent: number;
  weight: number | string;
  frequency: 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
  evidenceRequired: boolean;
  status: 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | 'COMPLETED';
  config?: Record<string, unknown> | null;
  selfComment?: string | null;
  reviewerComment?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  component?: PerformanceComponent | null;
  indicator?: PerformanceIndicator | null;
  formula?: PerformanceFormula | null;
  reviewer?: PerformancePlanningEmployeeSummary | null;
  approver?: PerformancePlanningEmployeeSummary | null;
  progressLogs: PerformancePlanningTargetProgress[];
  evidences: PerformancePlanningEvidence[];
}

export interface PerformancePlanningAssignment {
  id: string;
  companyId: string;
  periodId: string;
  methodId: string;
  methodVersionId: string;
  employeeId: string;
  reviewerId?: string | null;
  approverId?: string | null;
  assignmentSource: 'MANUAL' | 'AUTO_FROM_ORG';
  status: 'DRAFT' | 'PUBLISHED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REVISION_REQUIRED' | 'COMPLETED' | 'REASSIGNED' | 'ARCHIVED';
  reassignmentReason?: string | null;
  submissionNotes?: string | null;
  decisionNotes?: string | null;
  employeeSnapshot?: Record<string, unknown> | null;
  orgSnapshot?: Record<string, unknown> | null;
  planningSnapshot?: Record<string, unknown> | null;
  executionSnapshot?: Record<string, unknown> | null;
  publishedAt?: string | null;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  period?: {
    id: string;
    name: string;
    code: string;
  } | null;
  employee: PerformancePlanningEmployeeSummary;
  reviewer?: PerformancePlanningEmployeeSummary | null;
  approver?: PerformancePlanningEmployeeSummary | null;
  targets: PerformancePlanningTarget[];
}

export interface PerformancePlanningWorkspace {
  id: string;
  companyId: string;
  methodId: string;
  methodVersionId: string;
  name: string;
  code: string;
  startDate: string;
  endDate: string;
  reviewDeadline?: string | null;
  status: string;
  planningSummary?: PerformancePlanningReadiness | null;
  planningPublishedAt?: string | null;
  method?: PerformanceMethod;
  methodVersion: PerformanceMethodVersion & { components: PerformanceComponent[] };
  planningAssignments: PerformancePlanningAssignment[];
  planningReadiness: PerformancePlanningReadiness;
}

export interface PerformanceResult {
  id: string;
  companyId: string;
  periodId: string;
  assignmentId: string;
  methodId: string;
  methodVersionId: string;
  employeeId: string;
  reviewerId?: string | null;
  approverId?: string | null;
  status: 'CALCULATED' | 'CALIBRATION_IN_PROGRESS' | 'CALIBRATED' | 'FINALIZED' | 'PUBLISHED';
  rawScore?: number | string | null;
  normalizedScore?: number | string | null;
  weightedScore?: number | string | null;
  finalScore?: number | string | null;
  gradeCode?: string | null;
  gradeLabel?: string | null;
  recommendationSummary?: string | null;
  recommendationRules?: Array<{ label: string; condition: string; action: string; notes?: string | null }> | null;
  visibilityPolicy?: {
    showCalculation: boolean;
    showRecommendations: boolean;
    showCalibrationHistory: boolean;
  } | null;
  publishNotes?: string | null;
  calculationVersion: number;
  calculationSnapshot?: Record<string, unknown> | null;
  calibrationSnapshot?: Record<string, unknown> | null;
  finalSnapshot?: Record<string, unknown> | null;
  overrideReason?: string | null;
  overriddenById?: string | null;
  publishedById?: string | null;
  finalApprovedById?: string | null;
  reopenedById?: string | null;
  disputeDeadline?: string | null;
  acknowledgedAt?: string | null;
  acknowledgementNote?: string | null;
  finalApprovedAt?: string | null;
  finalApprovalNote?: string | null;
  reopenedAt?: string | null;
  reopenReason?: string | null;
  reopenCount?: number;
  lastReminderAt?: string | null;
  reminderCount?: number;
  calculatedAt?: string | null;
  calibratedAt?: string | null;
  finalizedAt?: string | null;
  publishedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  period?: { id: string; name: string; code: string } | null;
  employee?: PerformancePlanningEmployeeSummary | null;
  reviewer?: PerformancePlanningEmployeeSummary | null;
  approver?: PerformancePlanningEmployeeSummary | null;
  publishedBy?: PerformancePlanningEmployeeSummary | null;
  finalApprovedBy?: PerformancePlanningEmployeeSummary | null;
  reopenedBy?: PerformancePlanningEmployeeSummary | null;
  assignment?: PerformancePlanningAssignment | null;
  disputes?: PerformanceResultDispute[];
  developmentRecommendations?: PerformanceDevelopmentRecommendation[];
  attachments?: PerformanceResultAttachment[];
  calibrationParticipants?: PerformanceCalibrationParticipant[];
}

export interface PerformanceResultDispute {
  id: string;
  companyId: string;
  resultId: string;
  employeeId: string;
  status: 'OPEN' | 'RESPONDED' | 'RESOLVED' | 'REJECTED' | 'CLOSED';
  title: string;
  message: string;
  responseMessage?: string | null;
  respondedById?: string | null;
  createdAt: string;
  respondedAt?: string | null;
  resolvedAt?: string | null;
  closedAt?: string | null;
  employee?: PerformancePlanningEmployeeSummary | null;
  respondedBy?: PerformancePlanningEmployeeSummary | null;
  attachments?: PerformanceResultAttachment[];
}

export interface PerformanceResultAttachment {
  id: string;
  companyId: string;
  resultId?: string | null;
  disputeId?: string | null;
  attachmentType: 'RESULT' | 'DISPUTE';
  createdAt: string;
  createdBy?: PerformancePlanningEmployeeSummary | null;
  document: {
    id: string;
    title: string;
    description?: string | null;
    fileName: string;
    mimeType: string;
    fileSize: number;
    visibility: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
    category?: { id: string; name: string; code: string } | null;
  };
}

export interface PerformanceDevelopmentRecommendation {
  id: string;
  companyId: string;
  periodId: string;
  resultId: string;
  employeeId: string;
  courseId?: string | null;
  enrollmentId?: string | null;
  type: 'TRAINING' | 'DEVELOPMENT_PLAN' | 'SUCCESSION' | 'COMPENSATION';
  priority: string;
  status: 'PENDING' | 'ASSIGNED' | 'ENROLLED' | 'COMPLETED' | 'DISMISSED';
  sourceRuleLabel?: string | null;
  title: string;
  description?: string | null;
  notes?: string | null;
  assignedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  course?: { id: string; title: string; code: string } | null;
  enrollment?: { id: string; status: string; progress: number; completedAt?: string | null } | null;
  assignedBy?: PerformancePlanningEmployeeSummary | null;
}

export interface PerformanceAutomationSchedule {
  id: string;
  companyId: string;
  periodId: string;
  name: string;
  reminderTarget: 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL';
  cadenceHours: number;
  queueJobId?: string | null;
  isActive: boolean;
  lastRunAt?: string | null;
  nextRunAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy?: PerformancePlanningEmployeeSummary | null;
}

export interface PerformanceCalibrationDecision {
  id: string;
  companyId: string;
  sessionId: string;
  participantId: string;
  resultId: string;
  beforeScore?: number | string | null;
  beforeGradeCode?: string | null;
  beforeGradeLabel?: string | null;
  afterScore?: number | string | null;
  afterGradeCode?: string | null;
  afterGradeLabel?: string | null;
  reason: string;
  changedById?: string | null;
  createdAt: string;
  changedBy?: PerformancePlanningEmployeeSummary | null;
}

export interface PerformanceCalibrationParticipant {
  id: string;
  companyId: string;
  sessionId: string;
  resultId: string;
  status: 'PENDING' | 'ADJUSTED' | 'CONFIRMED';
  beforeScore?: number | string | null;
  beforeGradeCode?: string | null;
  beforeGradeLabel?: string | null;
  afterScore?: number | string | null;
  afterGradeCode?: string | null;
  afterGradeLabel?: string | null;
  reason?: string | null;
  createdAt: string;
  updatedAt: string;
  result?: PerformanceResult | null;
  decisions?: PerformanceCalibrationDecision[];
  session?: {
    id: string;
    name: string;
    code: string;
    status: string;
  } | null;
}

export interface PerformanceCalibrationSession {
  id: string;
  companyId: string;
  periodId: string;
  name: string;
  code: string;
  status: 'DRAFT' | 'OPEN' | 'CLOSED' | 'FINALIZED';
  scope?: Record<string, unknown> | null;
  forcedDistribution?: Record<string, unknown> | null;
  notes?: string | null;
  createdById?: string | null;
  openedAt?: string | null;
  closedAt?: string | null;
  finalizedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  period?: { id: string; name: string; code: string } | null;
  createdBy?: PerformancePlanningEmployeeSummary | null;
  participants: PerformanceCalibrationParticipant[];
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
    weightMode: 'STRICT_100' | 'FLEXIBLE';
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
    recommendationRules?: PerformanceRecommendationRule[];
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

export interface PerformanceRecommendationRule {
  label: string;
  condition: string;
  action: string;
  notes?: string | null;
}

export interface PerformanceGradeRule {
  id: string;
  companyId: string;
  name: string;
  code: string;
  description?: string | null;
  recommendationRules?: PerformanceRecommendationRule[];
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
  weightMode?: 'STRICT_100' | 'FLEXIBLE';
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

export interface PerformancePlanningAssignmentPayload {
  employeeId: string;
  reviewerId?: string;
  approverId?: string;
  assignmentSource?: 'MANUAL' | 'AUTO_FROM_ORG';
}

export interface PerformancePlanningReassignPayload {
  reviewerId?: string;
  approverId?: string;
  reason: string;
}

export interface PerformancePlanningTargetPayload {
  componentId: string;
  indicatorId: string;
  formulaId?: string;
  reviewerId?: string;
  approverId?: string;
  name?: string;
  description?: string;
  targetValue?: number;
  targetText?: string;
  weight: number;
  frequency?: 'ONCE' | 'MONTHLY' | 'QUARTERLY' | 'SEMI_ANNUAL' | 'ANNUAL' | 'CUSTOM';
  evidenceRequired?: boolean;
  config?: Record<string, unknown>;
}

export interface PerformancePlanningTargetProgressPayload {
  progressPercent: number;
  currentValue?: number;
  currentText?: string;
  note?: string;
}

export interface PerformanceExecutionActionPayload {
  notes?: string;
}

export interface PerformanceCalibrationSessionPayload {
  name: string;
  code: string;
  scope?: Record<string, unknown>;
  forcedDistribution?: Record<string, unknown>;
  notes?: string;
}

export interface PerformanceCalibrationDecisionPayload {
  finalScore: number;
  reason: string;
}

export interface PublishPerformanceResultsPayload {
  visibilityPolicy?: {
    showCalculation: boolean;
    showRecommendations: boolean;
    showCalibrationHistory: boolean;
  };
  disputeWindowDays?: number;
  notes?: string;
}

export interface AcknowledgePerformanceResultPayload {
  notes?: string;
}

export interface PerformanceResultDisputePayload {
  title: string;
  message: string;
}

export interface RespondPerformanceResultDisputePayload {
  response: string;
  status: 'RESPONDED' | 'RESOLVED' | 'REJECTED' | 'CLOSED';
}

export interface ApprovePerformanceResultsPayload {
  notes?: string;
}

export interface ReopenPerformanceResultPayload {
  reason: string;
}

export interface SendPerformanceResultRemindersPayload {
  target: 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL';
  notes?: string;
}

export interface SyncPerformanceDevelopmentRecommendationsPayload {
  strategy?: 'REGENERATE' | 'UPSERT_MISSING';
}

export interface AssignPerformanceDevelopmentRecommendationPayload {
  courseId: string;
  notes?: string;
}

export interface UploadPerformanceAttachmentPayload {
  file: File;
  title?: string;
  description?: string;
  visibility?: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
}

export interface CreatePerformanceAutomationSchedulePayload {
  name: string;
  reminderTarget?: 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL';
  cadenceHours: number;
  notes?: string;
}

export interface PerformanceResultDashboard {
  period: {
    id: string;
    name: string;
    code: string;
  };
  widgets: {
    completionRate: number;
    averageScore: number;
    scoreDistribution: Record<string, number>;
    resultCount: number;
    publishedResultCount: number;
    openDisputeCount: number;
    pendingFinalApprovalCount: number;
    pendingAcknowledgmentCount: number;
    reminderPendingCount: number;
  };
  departmentComparison: Array<{
    departmentName: string;
    averageScore: number;
    employeeCount: number;
  }>;
  topPerformers: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    departmentName: string;
    finalScore: number;
    gradeLabel: string;
  }>;
  bottomPerformers: Array<{
    id: string;
    employeeId: string;
    employeeName: string;
    employeeNumber: string;
    departmentName: string;
    finalScore: number;
    gradeLabel: string;
  }>;
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
  recommendationRules?: PerformanceRecommendationRule[];
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

  async getMethodVersionReadiness(id: string): Promise<PerformanceMethodVersionReadiness> {
    const r = await api.get(`/performance/method-versions/${id}/readiness`); return r.data.data;
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

  async getPlanningWorkspace(periodId: string): Promise<PerformancePlanningWorkspace> {
    const r = await api.get(`/performance/periods/${periodId}/planning`); return r.data.data;
  }

  async createPlanningAssignment(periodId: string, payload: PerformancePlanningAssignmentPayload): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/periods/${periodId}/planning/assignments`, payload); return r.data.data;
  }

  async updatePlanningAssignment(id: string, payload: Partial<PerformancePlanningAssignmentPayload>): Promise<PerformancePlanningAssignment> {
    const r = await api.put(`/performance/planning-assignments/${id}`, payload); return r.data.data;
  }

  async reassignPlanningAssignment(id: string, payload: PerformancePlanningReassignPayload): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/reassign`, payload); return r.data.data;
  }

  async deletePlanningAssignment(id: string): Promise<void> {
    await api.delete(`/performance/planning-assignments/${id}`);
  }

  async createPlanningTarget(assignmentId: string, payload: PerformancePlanningTargetPayload): Promise<PerformancePlanningTarget> {
    const r = await api.post(`/performance/planning-assignments/${assignmentId}/targets`, payload); return r.data.data;
  }

  async updatePlanningTarget(id: string, payload: Partial<PerformancePlanningTargetPayload>): Promise<PerformancePlanningTarget> {
    const r = await api.put(`/performance/planning-targets/${id}`, payload); return r.data.data;
  }

  async deletePlanningTarget(id: string): Promise<void> {
    await api.delete(`/performance/planning-targets/${id}`);
  }

  async publishPlanning(periodId: string): Promise<PerformancePlanningWorkspace> {
    const r = await api.post(`/performance/periods/${periodId}/planning/publish`); return r.data.data;
  }

  async createPlanningTargetProgress(id: string, payload: PerformancePlanningTargetProgressPayload): Promise<PerformancePlanningTarget> {
    const r = await api.post(`/performance/planning-targets/${id}/progress`, payload); return r.data.data;
  }

  async uploadPlanningEvidence(id: string, file: File, notes?: string): Promise<PerformancePlanningEvidence> {
    const formData = new FormData();
    formData.append('file', file);
    if (notes) {
      formData.append('notes', notes);
    }

    const r = await api.post(`/performance/planning-targets/${id}/evidences`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return r.data.data;
  }

  async submitPlanningAssignment(id: string, payload: PerformanceExecutionActionPayload = {}): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/submit`, payload); return r.data.data;
  }

  async approvePlanningAssignment(id: string, payload: PerformanceExecutionActionPayload = {}): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/approve`, payload); return r.data.data;
  }

  async rejectPlanningAssignment(id: string, payload: PerformanceExecutionActionPayload = {}): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/reject`, payload); return r.data.data;
  }

  async requestPlanningAssignmentRevision(id: string, payload: PerformanceExecutionActionPayload = {}): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/revision`, payload); return r.data.data;
  }

  async completePlanningAssignment(id: string, payload: PerformanceExecutionActionPayload = {}): Promise<PerformancePlanningAssignment> {
    const r = await api.post(`/performance/planning-assignments/${id}/complete`, payload); return r.data.data;
  }

  async getExecutionApprovalQueue(companyId: string): Promise<PerformancePlanningAssignment[]> {
    const r = await api.get('/performance/execution/approval-queue', { params: { companyId } }); return r.data.data;
  }

  async getPerformanceResults(periodId: string): Promise<PerformanceResult[]> {
    const r = await api.get(`/performance/periods/${periodId}/results`); return r.data.data;
  }

  async getDevelopmentRecommendations(periodId: string): Promise<PerformanceDevelopmentRecommendation[]> {
    const r = await api.get(`/performance/periods/${periodId}/development-recommendations`); return r.data.data;
  }

  async syncDevelopmentRecommendations(
    periodId: string,
    payload: SyncPerformanceDevelopmentRecommendationsPayload = {}
  ): Promise<PerformanceDevelopmentRecommendation[]> {
    const r = await api.post(`/performance/periods/${periodId}/development-recommendations/sync`, payload);
    return r.data.data;
  }

  async assignDevelopmentRecommendation(
    id: string,
    payload: AssignPerformanceDevelopmentRecommendationPayload
  ): Promise<PerformanceDevelopmentRecommendation> {
    const r = await api.post(`/performance/development-recommendations/${id}/assign`, payload);
    return r.data.data;
  }

  async calculatePerformanceResults(periodId: string): Promise<PerformanceResult[]> {
    const r = await api.post(`/performance/periods/${periodId}/results/calculate`); return r.data.data;
  }

  async getPerformanceResultDashboard(periodId: string): Promise<PerformanceResultDashboard> {
    const r = await api.get(`/performance/periods/${periodId}/results/dashboard`); return r.data.data;
  }

  async approvePerformanceResults(periodId: string, payload: ApprovePerformanceResultsPayload = {}): Promise<PerformanceResult[]> {
    const r = await api.post(`/performance/periods/${periodId}/results/final-approve`, payload); return r.data.data;
  }

  async publishPerformanceResults(periodId: string, payload: PublishPerformanceResultsPayload): Promise<PerformanceResult[]> {
    const r = await api.post(`/performance/periods/${periodId}/results/publish`, payload); return r.data.data;
  }

  async sendPerformanceResultReminders(periodId: string, payload: SendPerformanceResultRemindersPayload): Promise<{
    periodId: string;
    target: 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL';
    remindedResultCount: number;
    notificationCount: number;
  }> {
    const r = await api.post(`/performance/periods/${periodId}/results/reminders`, payload); return r.data.data;
  }

  async getMyPublishedResults(companyId: string): Promise<PerformanceResult[]> {
    const r = await api.get('/performance/results/me', { params: { companyId } }); return r.data.data;
  }

  async acknowledgePerformanceResult(id: string, payload: AcknowledgePerformanceResultPayload = {}): Promise<PerformanceResult> {
    const r = await api.post(`/performance/results/${id}/acknowledge`, payload); return r.data.data;
  }

  async uploadPerformanceResultAttachment(
    id: string,
    payload: UploadPerformanceAttachmentPayload
  ): Promise<PerformanceResultAttachment> {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.title) formData.append('title', payload.title);
    if (payload.description) formData.append('description', payload.description);
    if (payload.visibility) formData.append('visibility', payload.visibility);

    const r = await api.post(`/performance/results/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return r.data.data;
  }

  async createPerformanceResultDispute(id: string, payload: PerformanceResultDisputePayload): Promise<PerformanceResultDispute> {
    const r = await api.post(`/performance/results/${id}/disputes`, payload); return r.data.data;
  }

  async uploadPerformanceDisputeAttachment(
    id: string,
    payload: UploadPerformanceAttachmentPayload
  ): Promise<PerformanceResultAttachment> {
    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.title) formData.append('title', payload.title);
    if (payload.description) formData.append('description', payload.description);
    if (payload.visibility) formData.append('visibility', payload.visibility);

    const r = await api.post(`/performance/result-disputes/${id}/attachments`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return r.data.data;
  }

  async respondPerformanceResultDispute(id: string, payload: RespondPerformanceResultDisputePayload): Promise<PerformanceResultDispute> {
    const r = await api.post(`/performance/result-disputes/${id}/respond`, payload); return r.data.data;
  }

  async reopenPerformanceResult(id: string, payload: ReopenPerformanceResultPayload): Promise<PerformanceResult> {
    const r = await api.post(`/performance/results/${id}/reopen`, payload); return r.data.data;
  }

  async getAutomationSchedules(periodId: string): Promise<PerformanceAutomationSchedule[]> {
    const r = await api.get(`/performance/periods/${periodId}/automation-schedules`); return r.data.data;
  }

  async createAutomationSchedule(
    periodId: string,
    payload: CreatePerformanceAutomationSchedulePayload
  ): Promise<PerformanceAutomationSchedule> {
    const r = await api.post(`/performance/periods/${periodId}/automation-schedules`, payload);
    return r.data.data;
  }

  async getCalibrationSessions(periodId: string): Promise<PerformanceCalibrationSession[]> {
    const r = await api.get(`/performance/periods/${periodId}/calibrations`); return r.data.data;
  }

  async createCalibrationSession(periodId: string, payload: PerformanceCalibrationSessionPayload): Promise<PerformanceCalibrationSession> {
    const r = await api.post(`/performance/periods/${periodId}/calibrations`, payload); return r.data.data;
  }

  async openCalibrationSession(id: string): Promise<PerformanceCalibrationSession> {
    const r = await api.post(`/performance/calibration-sessions/${id}/open`); return r.data.data;
  }

  async closeCalibrationSession(id: string): Promise<PerformanceCalibrationSession> {
    const r = await api.post(`/performance/calibration-sessions/${id}/close`); return r.data.data;
  }

  async finalizeCalibrationSession(id: string): Promise<PerformanceCalibrationSession> {
    const r = await api.post(`/performance/calibration-sessions/${id}/finalize`); return r.data.data;
  }

  async applyCalibrationDecision(id: string, payload: PerformanceCalibrationDecisionPayload): Promise<PerformanceCalibrationParticipant> {
    const r = await api.post(`/performance/calibration-participants/${id}/decision`, payload); return r.data.data;
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
