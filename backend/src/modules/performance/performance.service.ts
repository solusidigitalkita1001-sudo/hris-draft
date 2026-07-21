import { performanceRepository } from './performance.repository';
import {
  CreateReviewCycleDTO,
  CreateReviewDTO,
  CreateGoalDTO,
  UpdateGoalProgressDTO,
  CreateFeedbackRequestDTO,
  CreateFeedbackResponseDTO,
  CreatePerformanceMethodDTO,
  UpdatePerformanceMethodDTO,
  CreatePerformanceMethodVersionDTO,
  UpdatePerformanceMethodVersionDTO,
  CreatePerformanceComponentDTO,
  UpdatePerformanceComponentDTO,
  CreatePerformancePeriodDTO,
  UpdatePerformancePeriodDTO,
  CreatePerformancePlanningAssignmentDTO,
  UpdatePerformancePlanningAssignmentDTO,
  ReassignPerformancePlanningAssignmentDTO,
  CreatePerformancePlanningTargetDTO,
  UpdatePerformancePlanningTargetDTO,
  CreatePerformanceTargetProgressDTO,
  PerformanceExecutionActionDTO,
  CreatePerformanceCalibrationSessionDTO,
  PerformanceCalibrationDecisionDTO,
  PublishPerformanceResultsDTO,
  AcknowledgePerformanceResultDTO,
  CreatePerformanceResultDisputeDTO,
  RespondPerformanceResultDisputeDTO,
  ApprovePerformanceResultsDTO,
  ReopenPerformanceResultDTO,
  SendPerformanceResultRemindersDTO,
  SyncPerformanceDevelopmentRecommendationsDTO,
  AssignPerformanceDevelopmentRecommendationDTO,
  CreatePerformanceAutomationScheduleDTO,
  CreatePerformanceFormulaDTO,
  UpdatePerformanceFormulaDTO,
  CreatePerformanceIndicatorDTO,
  UpdatePerformanceIndicatorDTO,
  CreatePerformanceGradeRuleDTO,
  UpdatePerformanceGradeRuleDTO,
  PerformanceGradeRangeDTO,
  PerformanceRecommendationRuleDTO,
  CreatePerformanceWorkflowTemplateDTO,
  UpdatePerformanceWorkflowTemplateDTO,
  PerformanceWorkflowStageDTO,
} from './performance.dto';
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { createAuditLog } from '@/shared/middleware/AuditLog';
import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';

interface PerformanceAuditContext {
  userId: string;
  employeeId?: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface MethodVersionReadinessSource {
  status: string;
  weightMode?: string;
  gradeRuleId?: string | null;
  reviewWorkflowTemplateId?: string | null;
  approvalWorkflowTemplateId?: string | null;
  minimumScore: unknown;
  maximumScore: unknown;
  components: Array<{ weight: unknown }>;
}

interface PerformanceAttachmentUploadInput {
  title?: string;
  description?: string;
  visibility?: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
}

const PERFORMANCE_ATTACHMENT_CATEGORY_PREFIX = 'PERFORMANCE_RESULT_ATTACHMENT';
const PERFORMANCE_AUTOMATION_JOB_NAME = 'performance-automation-reminder';

export class PerformanceService {
  private normalizeCode(code: string) {
    return code.trim().toUpperCase();
  }

  private stringifyAuditValue(value: unknown) {
    return JSON.stringify(value ?? null);
  }

  private async logAudit(context: PerformanceAuditContext, action: string, entity: string, entityId: string, oldValue?: unknown, newValue?: unknown) {
    await createAuditLog({
      companyId: context.companyId,
      userId: context.userId,
      action,
      entity,
      entityId,
      oldValue: oldValue === undefined ? undefined : this.stringifyAuditValue(oldValue),
      newValue: newValue === undefined ? undefined : this.stringifyAuditValue(newValue),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });
  }

  private ensureValidScoreRange(minimumScore?: number, maximumScore?: number) {
    if (
      minimumScore !== undefined &&
      maximumScore !== undefined &&
      minimumScore > maximumScore
    ) {
      throw new BadRequestError('Minimum score cannot be greater than maximum score');
    }
  }

  private ensureEditableMethodVersion(status: string) {
    if (status !== 'DRAFT') {
      throw new BadRequestError('Only draft method versions can be modified');
    }
  }

  private ensureEditablePeriod(status: string) {
    if (status === 'PUBLISHED' || status === 'CLOSED' || status === 'ARCHIVED') {
      throw new BadRequestError('Published or closed periods can no longer be modified');
    }
  }

  private ensureValidNumericRange(minimum?: number, maximum?: number, label: string = 'Value') {
    if (minimum !== undefined && maximum !== undefined && minimum > maximum) {
      throw new BadRequestError(`${label} minimum cannot be greater than maximum`);
    }
  }

  private validateGradeRanges(ranges: PerformanceGradeRangeDTO[]) {
    const normalized = [...ranges].sort((a, b) => a.sortOrder - b.sortOrder);
    const seenOrders = new Set<number>();

    for (const range of normalized) {
      if (range.minimum > range.maximum) {
        throw new BadRequestError(`Grade range ${range.label} minimum cannot be greater than maximum`);
      }

      if (seenOrders.has(range.sortOrder)) {
        throw new BadRequestError('Grade range sort order must be unique');
      }

      seenOrders.add(range.sortOrder);
    }

    for (let index = 0; index < normalized.length; index += 1) {
      const current = normalized[index];
      const next = normalized[index + 1];
      if (!next) continue;

      if (current.maximum > next.minimum) {
        throw new BadRequestError('Grade ranges must not overlap');
      }
    }
  }

  private validateRecommendationRules(rules: PerformanceRecommendationRuleDTO[] = []) {
    const seenLabels = new Set<string>();

    for (const rule of rules) {
      const normalizedLabel = rule.label.trim().toLowerCase();
      if (seenLabels.has(normalizedLabel)) {
        throw new BadRequestError('Recommendation rule label must be unique');
      }
      seenLabels.add(normalizedLabel);
    }
  }

  private validateWorkflowStages(stages: PerformanceWorkflowStageDTO[]) {
    const seenLevels = new Set<number>();

    for (const stage of stages) {
      if (seenLevels.has(stage.level)) {
        throw new BadRequestError('Workflow stage level must be unique');
      }

      seenLevels.add(stage.level);

      if (stage.approverType === 'ROLE' && !stage.approverRoleCode) {
        throw new BadRequestError(`Workflow stage ${stage.name} requires approverRoleCode`);
      }

      if (stage.approverType === 'USER' && !stage.approverId) {
        throw new BadRequestError(`Workflow stage ${stage.name} requires approverId`);
      }
    }
  }

  private ensurePlanningPeriodAvailable(period: { status: string } | null) {
    if (!period) {
      throw new NotFoundError('Performance period not found');
    }

    if (period.status !== 'PUBLISHED') {
      throw new BadRequestError('Planning workspace is only available for published performance periods');
    }
  }

  private ensurePlanningTargetValue(data: { targetValue?: number | null; targetText?: string | null }) {
    const hasNumericTarget = data.targetValue !== undefined && data.targetValue !== null;
    const hasTextTarget = Boolean(data.targetText?.trim());

    if (!hasNumericTarget && !hasTextTarget) {
      throw new BadRequestError('Planning target requires target value or target text');
    }
  }

  private buildEmployeePlanningSnapshot(employee: {
    id: string;
    employeeNumber?: string | null;
    fullName?: string | null;
    email?: string | null;
    branch?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    subDepartment?: { id: string; name: string } | null;
    position?: { id: string; name: string; reportsToId?: string | null } | null;
  }) {
    return {
      id: employee.id,
      employeeNumber: employee.employeeNumber ?? null,
      fullName: employee.fullName ?? null,
      email: employee.email ?? null,
      branch: employee.branch ?? null,
      department: employee.department ?? null,
      subDepartment: employee.subDepartment ?? null,
      position: employee.position ?? null,
    };
  }

  private buildPlanningOrgSnapshot(assignment: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningAssignmentById>>>) {
    return {
      periodId: assignment.periodId,
      methodId: assignment.methodId,
      methodVersionId: assignment.methodVersionId,
      employeeOrg: {
        branch: assignment.employee.branch ?? null,
        department: assignment.employee.department ?? null,
        subDepartment: assignment.employee.subDepartment ?? null,
        position: assignment.employee.position ?? null,
      },
      reviewer: assignment.reviewer
        ? {
            id: assignment.reviewer.id,
            fullName: assignment.reviewer.fullName,
            employeeNumber: assignment.reviewer.employeeNumber,
            email: assignment.reviewer.email ?? null,
          }
        : null,
      approver: assignment.approver
        ? {
            id: assignment.approver.id,
            fullName: assignment.approver.fullName,
            employeeNumber: assignment.approver.employeeNumber,
            email: assignment.approver.email ?? null,
          }
        : null,
    };
  }

  private buildPlanningAssignmentSnapshot(assignment: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningAssignmentById>>>) {
    return {
      frozenAt: new Date().toISOString(),
      assignment: {
        id: assignment.id,
        status: assignment.status,
        assignmentSource: assignment.assignmentSource,
        periodId: assignment.periodId,
        methodId: assignment.methodId,
        methodVersionId: assignment.methodVersionId,
      },
      employee: this.buildEmployeePlanningSnapshot(assignment.employee),
      reviewer: assignment.reviewer
        ? {
            id: assignment.reviewer.id,
            fullName: assignment.reviewer.fullName,
            employeeNumber: assignment.reviewer.employeeNumber,
            email: assignment.reviewer.email ?? null,
          }
        : null,
      approver: assignment.approver
        ? {
            id: assignment.approver.id,
            fullName: assignment.approver.fullName,
            employeeNumber: assignment.approver.employeeNumber,
            email: assignment.approver.email ?? null,
          }
        : null,
      targets: assignment.targets.map((target) => ({
        id: target.id,
        component: target.component
          ? {
              id: target.component.id,
              name: target.component.name,
              code: target.component.code,
              type: target.component.type,
              weight: Number(target.component.weight),
              sortOrder: target.component.sortOrder,
            }
          : null,
        indicator: target.indicator
          ? {
              id: target.indicator.id,
              name: target.indicator.name,
              code: target.indicator.code,
              measurementType: target.indicator.measurementType,
              targetType: target.indicator.targetType,
              direction: target.indicator.direction,
              unit: target.indicator.unit,
            }
          : null,
        formula: target.formula
          ? {
              id: target.formula.id,
              name: target.formula.name,
              code: target.formula.code,
              strategy: target.formula.strategy,
            }
          : null,
        name: target.name,
        description: target.description ?? null,
        targetValue: target.targetValue === null ? null : Number(target.targetValue),
        targetText: target.targetText ?? null,
        weight: Number(target.weight),
        frequency: target.frequency,
        evidenceRequired: target.evidenceRequired,
        reviewer: target.reviewer
          ? {
              id: target.reviewer.id,
              fullName: target.reviewer.fullName,
              employeeNumber: target.reviewer.employeeNumber,
            }
          : null,
        approver: target.approver
          ? {
              id: target.approver.id,
              fullName: target.approver.fullName,
              employeeNumber: target.approver.employeeNumber,
            }
          : null,
        config: target.config ?? null,
      })),
    };
  }

  private ensureExecutionWorkspaceAvailable(period: { status: string; planningPublishedAt?: Date | string | null } | null) {
    if (!period) {
      throw new NotFoundError('Performance period not found');
    }

    if (period.status !== 'PUBLISHED') {
      throw new BadRequestError('Performance execution is only available for published periods');
    }

    if (!period.planningPublishedAt) {
      throw new BadRequestError('Performance planning must be published before execution can start');
    }
  }

  private ensureExecutionActor(context: PerformanceAuditContext) {
    if (!context.employeeId) {
      throw new ForbiddenError('Employee identity is required');
    }

    return context.employeeId;
  }

  private ensureExecutionOwner(
    assignment: { employeeId: string },
    context: PerformanceAuditContext
  ) {
    const actorId = this.ensureExecutionActor(context);
    if (assignment.employeeId !== actorId) {
      throw new ForbiddenError('Only the assigned employee can perform this action');
    }
    return actorId;
  }

  private ensureExecutionApprover(
    assignment: {
      approverId?: string | null;
      targets: Array<{ approverId?: string | null }>;
    },
    context: PerformanceAuditContext
  ) {
    const actorId = this.ensureExecutionActor(context);
    const canApprove =
      assignment.approverId === actorId ||
      assignment.targets.some((target) => (target.approverId ?? assignment.approverId ?? null) === actorId);

    if (!canApprove) {
      throw new ForbiddenError('Only the configured approver can perform this action');
    }

    return actorId;
  }

  private resolveExecutionTargetActorRole(
    target: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningTargetById>>>,
    context: PerformanceAuditContext
  ) {
    const actorId = this.ensureExecutionActor(context);
    const reviewerId = target.reviewerId ?? target.assignment.reviewerId ?? null;
    const approverId = target.approverId ?? target.assignment.approverId ?? null;

    if (target.assignment.employeeId === actorId) {
      return 'EMPLOYEE' as const;
    }

    if (reviewerId === actorId) {
      return 'REVIEWER' as const;
    }

    if (approverId === actorId) {
      return 'APPROVER' as const;
    }

    throw new ForbiddenError('You are not allowed to update this execution target');
  }

  private ensureAssignmentExecutionMutable(status: string) {
    if (!['PUBLISHED', 'IN_PROGRESS', 'REVISION_REQUIRED'].includes(status)) {
      throw new BadRequestError('Assignment is not editable in the current execution state');
    }
  }

  private nextExecutionAssignmentStatus(status: string) {
    if (status === 'PUBLISHED' || status === 'REVISION_REQUIRED') {
      return 'IN_PROGRESS';
    }

    return status;
  }

  private nextExecutionTargetStatus(status: string) {
    if (status === 'PUBLISHED' || status === 'REVISION_REQUIRED') {
      return 'IN_PROGRESS';
    }

    return status;
  }

  private sanitizeExecutionNotes(value?: string | null) {
    const sanitized = value?.trim();
    return sanitized ? sanitized : undefined;
  }

  private buildExecutionAssignmentSnapshot(assignment: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningAssignmentById>>>) {
    return {
      frozenAt: new Date().toISOString(),
      assignment: {
        id: assignment.id,
        status: assignment.status,
        assignmentSource: assignment.assignmentSource,
        submissionNotes: assignment.submissionNotes ?? null,
        decisionNotes: assignment.decisionNotes ?? null,
        publishedAt: assignment.publishedAt?.toISOString?.() ?? assignment.publishedAt ?? null,
        submittedAt: assignment.submittedAt?.toISOString?.() ?? assignment.submittedAt ?? null,
        reviewedAt: assignment.reviewedAt?.toISOString?.() ?? assignment.reviewedAt ?? null,
        completedAt: assignment.completedAt?.toISOString?.() ?? assignment.completedAt ?? null,
      },
      employee: this.buildEmployeePlanningSnapshot(assignment.employee),
      reviewer: assignment.reviewer
        ? {
            id: assignment.reviewer.id,
            fullName: assignment.reviewer.fullName,
            employeeNumber: assignment.reviewer.employeeNumber,
            email: assignment.reviewer.email ?? null,
          }
        : null,
      approver: assignment.approver
        ? {
            id: assignment.approver.id,
            fullName: assignment.approver.fullName,
            employeeNumber: assignment.approver.employeeNumber,
            email: assignment.approver.email ?? null,
          }
        : null,
      targets: assignment.targets.map((target) => ({
        id: target.id,
        name: target.name,
        status: target.status,
        targetValue: target.targetValue === null ? null : Number(target.targetValue),
        targetText: target.targetText ?? null,
        currentValue: target.currentValue === null ? null : Number(target.currentValue),
        currentText: target.currentText ?? null,
        progressPercent: target.progressPercent,
        selfComment: target.selfComment ?? null,
        reviewerComment: target.reviewerComment ?? null,
        submittedAt: target.submittedAt?.toISOString?.() ?? target.submittedAt ?? null,
        reviewedAt: target.reviewedAt?.toISOString?.() ?? target.reviewedAt ?? null,
        completedAt: target.completedAt?.toISOString?.() ?? target.completedAt ?? null,
        component: target.component
          ? {
              id: target.component.id,
              name: target.component.name,
              code: target.component.code,
              type: target.component.type,
            }
          : null,
        indicator: target.indicator
          ? {
              id: target.indicator.id,
              name: target.indicator.name,
              code: target.indicator.code,
              measurementType: target.indicator.measurementType,
              targetType: target.indicator.targetType,
              direction: target.indicator.direction,
              unit: target.indicator.unit,
            }
          : null,
        progressLogs: target.progressLogs.map((log) => ({
          id: log.id,
          progressPercent: log.progressPercent,
          currentValue: log.currentValue === null ? null : Number(log.currentValue),
          currentText: log.currentText ?? null,
          note: log.note ?? null,
          createdAt: log.createdAt.toISOString(),
          actor: log.actor
            ? {
                id: log.actor.id,
                fullName: log.actor.fullName,
                employeeNumber: log.actor.employeeNumber,
              }
            : null,
        })),
        evidences: target.evidences.map((evidence) => ({
          id: evidence.id,
          fileName: evidence.fileName,
          originalName: evidence.originalName,
          fileUrl: evidence.fileUrl,
          mimeType: evidence.mimeType,
          fileSize: evidence.fileSize,
          notes: evidence.notes ?? null,
          createdAt: evidence.createdAt.toISOString(),
          uploadedBy: evidence.uploadedBy
            ? {
                id: evidence.uploadedBy.id,
                fullName: evidence.uploadedBy.fullName,
                employeeNumber: evidence.uploadedBy.employeeNumber,
              }
            : null,
        })),
      })),
    };
  }

  private buildExecutionSubmissionIssues(
    assignment: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningAssignmentById>>>
  ) {
    const issues: string[] = [];

    if (!assignment.targets.length) {
      issues.push('Assignment must have at least one target');
    }

    for (const target of assignment.targets) {
      const hasExecutionUpdate =
        target.progressPercent > 0 ||
        target.currentValue !== null ||
        Boolean(target.currentText?.trim()) ||
        Boolean(target.selfComment?.trim()) ||
        target.progressLogs.length > 0;

      if (!hasExecutionUpdate) {
        issues.push(`Target ${target.name} must have at least one progress update`);
      }

      if (target.evidenceRequired && target.evidences.length === 0) {
        issues.push(`Target ${target.name} requires evidence before submission`);
      }
    }

    return Array.from(new Set(issues));
  }

  private roundScore(value: number, mode: string = 'ROUND', precision: number = 2) {
    const factor = 10 ** precision;

    if (mode === 'FLOOR') {
      return Math.floor(value * factor) / factor;
    }

    if (mode === 'CEIL') {
      return Math.ceil(value * factor) / factor;
    }

    return Math.round(value * factor) / factor;
  }

  private clampScore(value: number, minimum?: number | null, maximum?: number | null) {
    let next = value;
    if (minimum !== undefined && minimum !== null) {
      next = Math.max(next, minimum);
    }

    if (maximum !== undefined && maximum !== null) {
      next = Math.min(next, maximum);
    }

    return next;
  }

  private compareRecommendationOperand(left: number, operator: string, right: number) {
    if (operator === '>=') return left >= right;
    if (operator === '<=') return left <= right;
    if (operator === '>') return left > right;
    if (operator === '<') return left < right;
    return left === right;
  }

  private matchRecommendationCondition(
    condition: string,
    context: { finalScore: number; gradeCode?: string | null; gradeLabel?: string | null }
  ) {
    const clauses = condition
      .split(/\s+AND\s+/i)
      .map((item) => item.trim())
      .filter(Boolean);

    if (!clauses.length) {
      return false;
    }

    return clauses.every((clause) => {
      const gradeMatch = clause.match(/^grade\s*=\s*([A-Za-z0-9 _-]+)$/i);
      if (gradeMatch) {
        const expected = gradeMatch[1]?.trim().toLowerCase();
        return [context.gradeCode, context.gradeLabel]
          .filter(Boolean)
          .some((value) => value?.trim().toLowerCase() === expected);
      }

      const scoreMatch = clause.match(/^score\s*(>=|<=|>|<|=)\s*([0-9]+(?:\.[0-9]+)?)$/i);
      if (scoreMatch) {
        return this.compareRecommendationOperand(
          context.finalScore,
          scoreMatch[1] ?? '=',
          Number(scoreMatch[2])
        );
      }

      const normalizedClause = clause.toLowerCase();
      return [context.gradeCode, context.gradeLabel]
        .filter(Boolean)
        .some((value) => normalizedClause.includes(value?.trim().toLowerCase() || ''));
    });
  }

  private coerceRecommendationRules(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    const parsed: Array<{ label: string; condition: string; action: string; notes?: string }> = [];

    for (const item of value) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label : null;
      const condition = typeof record.condition === 'string' ? record.condition : null;
      const action = typeof record.action === 'string' ? record.action : null;
      const notes = typeof record.notes === 'string' ? record.notes : undefined;

      if (!label || !condition || !action) {
        continue;
      }

      parsed.push({
        label,
        condition,
        action,
        notes,
      });
    }

    return parsed;
  }

  private coerceVisibilityPolicy(value: unknown) {
    const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

    return {
      showCalculation: record.showCalculation !== false,
      showRecommendations: record.showRecommendations !== false,
      showCalibrationHistory: record.showCalibrationHistory === true,
    };
  }

  private sanitizePublishedResultForEmployee(
    result: NonNullable<Awaited<ReturnType<typeof performanceRepository.findResultById>>>
  ) {
    const visibilityPolicy = this.coerceVisibilityPolicy(result.visibilityPolicy);

    return {
      ...result,
      visibilityPolicy,
      rawScore: visibilityPolicy.showCalculation ? result.rawScore : null,
      normalizedScore: visibilityPolicy.showCalculation ? result.normalizedScore : null,
      weightedScore: visibilityPolicy.showCalculation ? result.weightedScore : null,
      calculationSnapshot: visibilityPolicy.showCalculation ? result.calculationSnapshot : null,
      recommendationSummary: visibilityPolicy.showRecommendations ? result.recommendationSummary : null,
      recommendationRules: visibilityPolicy.showRecommendations ? result.recommendationRules : [],
      developmentRecommendations: visibilityPolicy.showRecommendations ? result.developmentRecommendations : [],
      calibrationSnapshot: visibilityPolicy.showCalibrationHistory ? result.calibrationSnapshot : null,
    };
  }

  private buildPerformanceAttachmentCategoryCode(companyId: string) {
    return `${PERFORMANCE_ATTACHMENT_CATEGORY_PREFIX}_${companyId}`.toUpperCase();
  }

  private async ensurePerformanceAttachmentCategory(companyId: string) {
    const code = this.buildPerformanceAttachmentCategoryCode(companyId);
    const existing = await performanceRepository.findDocumentCategoryByCode(companyId, code);
    if (existing) {
      return existing;
    }

    return performanceRepository.createDocumentCategory({
      companyId,
      code,
      name: 'Performance Result Attachment',
      description: 'Managed documents linked to published performance results and disputes.',
    });
  }

  private inferDevelopmentRecommendationType(rule: { label?: string | null; action?: string | null; notes?: string | null }) {
    const haystack = [rule.label, rule.action, rule.notes].filter(Boolean).join(' ').toLowerCase();
    if (haystack.includes('succession')) return 'SUCCESSION';
    if (haystack.includes('compensation')) return 'COMPENSATION';
    if (haystack.includes('development plan') || haystack.includes('development-plan')) return 'DEVELOPMENT_PLAN';
    return 'TRAINING';
  }

  private inferDevelopmentRecommendationPriority(result: { finalScore?: unknown; gradeCode?: string | null; gradeLabel?: string | null }) {
    const score = Number(result.finalScore ?? 0);
    const gradeValue = `${result.gradeCode ?? ''} ${result.gradeLabel ?? ''}`.toUpperCase();
    if (score < 60 || /D|E|LOW/.test(gradeValue)) return 'HIGH';
    if (score < 75 || /C|NEEDS IMPROVEMENT/.test(gradeValue)) return 'MEDIUM';
    return 'LOW';
  }

  private extractRecommendationKeywords(...values: Array<string | null | undefined>) {
    return Array.from(
      new Set(
        values
          .flatMap((value) =>
            (value ?? '')
              .split(/[^A-Za-z0-9]+/)
              .map((item) => item.trim().toLowerCase())
              .filter((item) => item.length >= 4)
          )
      )
    ).slice(0, 8);
  }

  private async enqueuePerformanceAutomationJob(scheduleId: string, queueJobId: string, cadenceHours: number) {
    const cadenceMs = cadenceHours * 60 * 60 * 1000;
    await queueManager.enqueue(
      QueueNames.PERFORMANCE_AUTOMATION,
      PERFORMANCE_AUTOMATION_JOB_NAME,
      { scheduleId },
      {
        jobId: queueJobId,
        repeat: {
          every: cadenceMs,
        },
      }
    );
  }

  private async dispatchPerformanceResultReminders(
    periodId: string,
    data: SendPerformanceResultRemindersDTO
  ) {
    const period = await this.findPeriodById(periodId);
    const results = await performanceRepository.findResultsByPeriod(periodId);
    if (!results.length) {
      throw new BadRequestError('No performance results available for reminder');
    }

    const targetResults = results.filter((result) => {
      if (data.target === 'UNACKNOWLEDGED_RESULTS') {
        return result.status === 'PUBLISHED' && !result.acknowledgedAt;
      }

      if (data.target === 'OPEN_DISPUTES') {
        return result.disputes.some((dispute) => ['OPEN', 'RESPONDED'].includes(dispute.status));
      }

      return (result.status === 'PUBLISHED' && !result.acknowledgedAt)
        || result.disputes.some((dispute) => ['OPEN', 'RESPONDED'].includes(dispute.status));
    });

    if (!targetResults.length) {
      throw new BadRequestError('No result matched the selected reminder target');
    }

    const reminderNotifications: Array<{
      companyId: string;
      employeeIds: Array<string | null | undefined>;
      title: string;
      message: string;
      type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
      resource: string;
      action: string;
      referenceId: string;
    }> = [];

    for (const result of targetResults) {
      if (data.target !== 'OPEN_DISPUTES' && result.status === 'PUBLISHED' && !result.acknowledgedAt) {
        reminderNotifications.push({
          companyId: result.companyId,
          employeeIds: [result.employeeId],
          title: `Reminder acknowledge result ${period.name}`,
          message: data.notes?.trim() || 'Silakan buka dan acknowledge hasil performance Anda.',
          type: 'INFO',
          resource: 'performance-result',
          action: 'reminder',
          referenceId: result.id,
        });
      }

      if (data.target !== 'UNACKNOWLEDGED_RESULTS') {
        const openDisputes = result.disputes.filter((dispute) => ['OPEN', 'RESPONDED'].includes(dispute.status));
        for (const dispute of openDisputes) {
          reminderNotifications.push({
            companyId: result.companyId,
            employeeIds: [result.reviewerId, result.approverId, result.publishedById],
            title: `Reminder dispute ${period.name}`,
            message: data.notes?.trim() || `${result.employee.fullName} masih menunggu tindak lanjut dispute.`,
            type: 'WARNING',
            resource: 'performance-result-dispute',
            action: 'reminder',
            referenceId: dispute.id,
          });
        }
      }

      await performanceRepository.markResultReminded(result.id);
    }

    for (const notification of reminderNotifications) {
      await this.notifyEmployeeTargets(notification.companyId, notification.employeeIds, notification);
    }

    return {
      periodId,
      target: data.target,
      remindedResultCount: targetResults.length,
      notificationCount: reminderNotifications.length,
    };
  }

  private async notifyEmployeeTargets(
    companyId: string,
    employeeIds: Array<string | null | undefined>,
    payload: {
      title: string;
      message: string;
      type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
      resource?: string;
      action?: string;
      referenceId?: string;
    }
  ) {
    const resolvedEmployeeIds = Array.from(new Set(employeeIds.filter((value): value is string => Boolean(value))));
    if (!resolvedEmployeeIds.length) {
      return;
    }

    const users = await performanceRepository.findUsersByEmployeeIds(resolvedEmployeeIds);
    if (!users.length) {
      return;
    }

    await performanceRepository.createNotifications(
      users.map((user) => ({
        companyId,
        userId: user.id,
        title: payload.title,
        message: payload.message,
        type: payload.type,
        resource: payload.resource,
        action: payload.action,
        referenceId: payload.referenceId,
      }))
    );
  }

  private mapGradeResult(
    finalScore: number,
    gradeRule?: {
      recommendationRules?: unknown;
      ranges: Array<{ label: string; minimum: unknown; maximum: unknown; description?: string | null }>;
    } | null
  ) {
    if (!gradeRule) {
      return {
        gradeCode: null,
        gradeLabel: null,
        recommendationRules: [],
        recommendationSummary: null,
      };
    }

    const range = gradeRule.ranges.find((item) => finalScore >= Number(item.minimum) && finalScore <= Number(item.maximum));
    const gradeCode = range?.label ?? null;
    const gradeLabel = range?.label ?? null;

    const matchedRecommendations = this.coerceRecommendationRules(gradeRule.recommendationRules).filter((rule) =>
      this.matchRecommendationCondition(rule.condition, { finalScore, gradeCode, gradeLabel })
    );

    return {
      gradeCode,
      gradeLabel,
      recommendationRules: matchedRecommendations,
      recommendationSummary: matchedRecommendations.length
        ? matchedRecommendations.map((rule) => `${rule.label}: ${rule.action}`).join(' | ')
        : null,
    };
  }

  private calculateTargetScore(
    target: {
      name: string;
      targetValue: unknown;
      currentValue: unknown;
      progressPercent: number;
      indicator?: { direction?: string | null } | null;
      formula?: {
        strategy?: string | null;
        roundingMode?: string | null;
        roundingPrecision?: number | null;
        minimumScore?: unknown;
        maximumScore?: unknown;
      } | null;
    },
    methodVersion: { minimumScore?: unknown; maximumScore?: unknown }
  ) {
    const targetValue = target.targetValue === null || target.targetValue === undefined ? null : Number(target.targetValue);
    const currentValue = target.currentValue === null || target.currentValue === undefined ? null : Number(target.currentValue);
    const direction = target.indicator?.direction ?? 'MANUAL';
    const formula = target.formula;

    let rawScore = target.progressPercent ?? 0;

    if (formula?.strategy === 'MANUAL_RATING' && currentValue !== null) {
      rawScore = currentValue;
    } else if (targetValue !== null && currentValue !== null) {
      if (direction === 'HIGHER_BETTER') {
        rawScore = targetValue === 0 ? (currentValue === 0 ? 100 : currentValue) : (currentValue / targetValue) * 100;
      } else if (direction === 'LOWER_BETTER') {
        rawScore = currentValue === 0 ? 100 : (targetValue / currentValue) * 100;
      } else if (direction === 'EXACT') {
        const base = Math.abs(targetValue) || 1;
        rawScore = Math.max(0, 100 - (Math.abs(currentValue - targetValue) / base) * 100);
      } else {
        rawScore = target.progressPercent ?? 0;
      }
    }

    const normalizedScore = this.roundScore(
      this.clampScore(
        rawScore,
        formula?.minimumScore === undefined ? Number(methodVersion.minimumScore ?? 0) : Number(formula.minimumScore),
        formula?.maximumScore === undefined
          ? (methodVersion.maximumScore === null || methodVersion.maximumScore === undefined ? undefined : Number(methodVersion.maximumScore))
          : Number(formula.maximumScore)
      ),
      formula?.roundingMode ?? 'ROUND',
      formula?.roundingPrecision ?? 2
    );

    return {
      rawScore: this.roundScore(rawScore, formula?.roundingMode ?? 'ROUND', formula?.roundingPrecision ?? 2),
      normalizedScore,
    };
  }

  private buildPerformanceCalculation(
    period: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPeriodById>>>,
    assignment: NonNullable<Awaited<ReturnType<typeof performanceRepository.findPlanningAssignmentById>>>
  ) {
    const componentMap = new Map(
      period.methodVersion.components.map((component) => [component.id, component])
    );

    const targetScores = assignment.targets.map((target) => {
      const calculation = this.calculateTargetScore(target, period.methodVersion);
      return {
        targetId: target.id,
        targetName: target.name,
        componentId: target.componentId,
        componentName: target.component?.name ?? null,
        indicatorId: target.indicatorId,
        indicatorName: target.indicator?.name ?? null,
        weight: Number(target.weight),
        progressPercent: target.progressPercent,
        rawScore: calculation.rawScore,
        normalizedScore: calculation.normalizedScore,
        weightedContribution: this.roundScore((calculation.normalizedScore * Number(target.weight)) / 100, 'ROUND', 2),
      };
    });

    const componentScores = period.methodVersion.components.map((component) => {
      const componentTargets = targetScores.filter((target) => target.componentId === component.id);
      const componentTargetWeight = componentTargets.reduce((sum, target) => sum + target.weight, 0);
      const componentRawScore = componentTargets.length
        ? componentTargets.reduce((sum, target) => sum + target.rawScore, 0) / componentTargets.length
        : 0;
      const componentNormalizedScore = componentTargetWeight > 0
        ? componentTargets.reduce((sum, target) => sum + target.normalizedScore * target.weight, 0) / componentTargetWeight
        : 0;
      const componentWeightedScore = (componentNormalizedScore * Number(component.weight)) / 100;

      return {
        componentId: component.id,
        componentName: component.name,
        componentWeight: Number(component.weight),
        targetWeight: componentTargetWeight,
        rawScore: this.roundScore(componentRawScore, 'ROUND', 2),
        normalizedScore: this.roundScore(componentNormalizedScore, 'ROUND', 2),
        weightedScore: this.roundScore(componentWeightedScore, 'ROUND', 2),
        targets: componentTargets,
      };
    });

    const rawScore = componentScores.length
      ? this.roundScore(
          componentScores.reduce((sum, component) => sum + component.rawScore, 0) / componentScores.length,
          'ROUND',
          2
        )
      : 0;

    const weightedScore = this.roundScore(
      componentScores.reduce((sum, component) => sum + component.weightedScore, 0),
      'ROUND',
      2
    );

    let finalScore = weightedScore;
    if (period.methodVersion.scoreAggregation === 'SUM') {
      finalScore = this.roundScore(targetScores.reduce((sum, target) => sum + target.normalizedScore, 0), 'ROUND', 2);
    }

    if (period.methodVersion.scoreAggregation === 'AVERAGE') {
      finalScore = this.roundScore(
        targetScores.length
          ? targetScores.reduce((sum, target) => sum + target.normalizedScore, 0) / targetScores.length
          : 0,
        'ROUND',
        2
      );
    }

    const normalizedScore = this.roundScore(
      this.clampScore(
        finalScore,
        period.methodVersion.minimumScore === null ? undefined : Number(period.methodVersion.minimumScore ?? 0),
        period.methodVersion.maximumScore === null ? undefined : Number(period.methodVersion.maximumScore)
      ),
      'ROUND',
      2
    );

    const grade = this.mapGradeResult(normalizedScore, period.methodVersion.gradeRule);

    return {
      rawScore,
      normalizedScore,
      weightedScore,
      finalScore: normalizedScore,
      gradeCode: grade.gradeCode,
      gradeLabel: grade.gradeLabel,
      recommendationRules: grade.recommendationRules,
      recommendationSummary: grade.recommendationSummary,
      calculationSnapshot: {
        calculatedAt: new Date().toISOString(),
        assignment: {
          id: assignment.id,
          employeeId: assignment.employeeId,
          employeeName: assignment.employee.fullName,
          status: assignment.status,
        },
        methodVersion: {
          id: period.methodVersion.id,
          scoreAggregation: period.methodVersion.scoreAggregation,
          minimumScore: period.methodVersion.minimumScore,
          maximumScore: period.methodVersion.maximumScore,
          weightMode: period.methodVersion.weightMode,
        },
        components: componentScores,
        grade,
      },
    };
  }

  private buildPlanningReadiness(workspace: Awaited<ReturnType<typeof performanceRepository.findPlanningWorkspace>>) {
    if (!workspace) {
      throw new NotFoundError('Performance planning workspace not found');
    }

    const issues: string[] = [];
    const assignments = workspace.planningAssignments ?? [];
    const requiredComponents = workspace.methodVersion.components.filter((component) => component.isRequired);
    const configuredTotalWeight = workspace.methodVersion.components.reduce(
      (sum, component) => sum + Number(component.weight),
      0
    );

    if (workspace.status !== 'PUBLISHED') {
      issues.push('Performance period must be published before planning can be published');
    }

    if (!assignments.length) {
      issues.push('At least one employee assignment is required');
    }

    for (const assignment of assignments) {
      if (!assignment.reviewerId) {
        issues.push(`Assignment for ${assignment.employee.fullName} must have reviewer`);
      }

      if (!assignment.approverId) {
        issues.push(`Assignment for ${assignment.employee.fullName} must have approver`);
      }

      if (!assignment.targets.length) {
        issues.push(`Assignment for ${assignment.employee.fullName} must have at least one target`);
        continue;
      }

      const targetComponentIds = new Set(
        assignment.targets
          .map((target) => target.componentId)
          .filter((value): value is string => Boolean(value))
      );
      const targetWeight = assignment.targets.reduce((sum, target) => sum + Number(target.weight), 0);

      for (const component of requiredComponents) {
        if (!targetComponentIds.has(component.id)) {
          issues.push(`Assignment for ${assignment.employee.fullName} is missing required component ${component.name}`);
        }
      }

      if (
        (workspace.methodVersion.weightMode ?? 'STRICT_100') === 'STRICT_100' &&
        Math.abs(targetWeight - configuredTotalWeight) > 0.001
      ) {
        issues.push(`Assignment for ${assignment.employee.fullName} must keep total target weight ${configuredTotalWeight}`);
      }

      for (const target of assignment.targets) {
        if (!target.indicatorId) {
          issues.push(`Target ${target.name} for ${assignment.employee.fullName} must have indicator`);
        }

        const hasNumericTarget = target.targetValue !== null;
        const hasTextTarget = Boolean(target.targetText?.trim());
        if (!hasNumericTarget && !hasTextTarget) {
          issues.push(`Target ${target.name} for ${assignment.employee.fullName} must have target value or text`);
        }
      }
    }

    return {
      periodId: workspace.id,
      periodStatus: workspace.status,
      planningPublishedAt: workspace.planningPublishedAt?.toISOString?.() ?? workspace.planningPublishedAt ?? null,
      isReady: issues.length === 0,
      issues: Array.from(new Set(issues)),
      metrics: {
        assignmentCount: assignments.length,
        publishedAssignmentCount: assignments.filter((assignment) => assignment.status === 'PUBLISHED').length,
        targetCount: assignments.reduce((sum, assignment) => sum + assignment.targets.length, 0),
        requiredComponentCount: requiredComponents.length,
        configuredTotalWeight,
        weightMode: workspace.methodVersion.weightMode,
      },
    };
  }

  private async refreshPlanningWorkspaceSummary(periodId: string) {
    const workspace = await performanceRepository.findPlanningWorkspace(periodId);
    const readiness = this.buildPlanningReadiness(workspace);
    await performanceRepository.touchPlanningWorkspace(periodId, readiness as any);
    return readiness;
  }

  private async resolvePlanningEmployee(id: string, companyId: string, label: string) {
    const employee = await performanceRepository.findEmployeePlanningProfile(id);
    if (!employee || employee.companyId !== companyId) {
      throw new BadRequestError(`${label} must belong to the same company`);
    }
    return employee;
  }

  private buildVersionReadiness(version: MethodVersionReadinessSource | null) {
    if (!version) {
      throw new NotFoundError('Performance method version not found');
    }

    const issues: string[] = [];
    const components = version.components ?? [];
    const totalWeight = components.reduce((sum, component) => sum + Number(component.weight), 0);

    if (!components.length) {
      issues.push('At least one component is required');
    }

    if (!version.gradeRuleId) {
      issues.push('Grade rule must be assigned');
    }

    if (!version.reviewWorkflowTemplateId) {
      issues.push('Review workflow template must be assigned');
    }

    if (!version.approvalWorkflowTemplateId) {
      issues.push('Approval workflow template must be assigned');
    }

    if ((version.weightMode ?? 'STRICT_100') === 'STRICT_100' && Math.abs(totalWeight - 100) > 0.001) {
      issues.push('Component weight total must equal 100');
    }

    if (
      version.minimumScore !== null &&
      version.maximumScore !== null &&
      Number(version.minimumScore) > Number(version.maximumScore)
    ) {
      issues.push('Minimum score cannot be greater than maximum score');
    }

    return {
      isReady: issues.length === 0,
      issues,
      metrics: {
        componentCount: components.length,
        totalWeight,
        status: version.status,
        weightMode: version.weightMode ?? 'STRICT_100',
      },
    };
  }

  private buildPeriodReadiness(period: Awaited<ReturnType<typeof performanceRepository.findPeriodById>>) {
    if (!period) {
      throw new NotFoundError('Performance period not found');
    }

    const issues: string[] = [];
    const versionReadiness = this.buildVersionReadiness(period.methodVersion);

    if (period.methodVersion.methodId !== period.methodId) {
      issues.push('Period method and method version do not match');
    }

    if (period.methodVersion.status !== 'PUBLISHED') {
      issues.push('Method version must be published before the period can be published');
    }

    if (period.startDate >= period.endDate) {
      issues.push('Period start date must be earlier than end date');
    }

    if (period.reviewDeadline && period.reviewDeadline < period.startDate) {
      issues.push('Review deadline cannot be earlier than period start date');
    }

    issues.push(...versionReadiness.issues);

    return {
      periodId: period.id,
      methodId: period.methodId,
      methodVersionId: period.methodVersionId,
      isReady: issues.length === 0,
      issues: Array.from(new Set(issues)),
      metrics: {
        componentCount: versionReadiness.metrics.componentCount,
        totalWeight: versionReadiness.metrics.totalWeight,
        methodVersionStatus: period.methodVersion.status,
        periodStatus: period.status,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        reviewDeadline: period.reviewDeadline?.toISOString() ?? null,
      },
    };
  }

  private buildPeriodConfigSnapshot(period: Awaited<ReturnType<typeof performanceRepository.findPeriodById>>) {
    if (!period) {
      throw new NotFoundError('Performance period not found');
    }

    const version = period.methodVersion;

    return {
      frozenAt: new Date().toISOString(),
      period: {
        id: period.id,
        name: period.name,
        code: period.code,
        startDate: period.startDate.toISOString(),
        endDate: period.endDate.toISOString(),
        reviewDeadline: period.reviewDeadline?.toISOString() ?? null,
      },
      method: {
        id: period.method.id,
        name: period.method.name,
        code: period.method.code,
        status: period.method.status,
      },
      methodVersion: {
        id: version.id,
        versionNumber: version.versionNumber,
        status: version.status,
        summary: version.summary,
        weightMode: version.weightMode,
        scoreAggregation: version.scoreAggregation,
        minimumScore: version.minimumScore === null ? null : Number(version.minimumScore),
        maximumScore: version.maximumScore === null ? null : Number(version.maximumScore),
        normalizationRule: version.normalizationRule ?? null,
      },
      gradeRule: version.gradeRule
        ? {
            id: version.gradeRule.id,
            name: version.gradeRule.name,
            code: version.gradeRule.code,
            description: version.gradeRule.description,
            recommendationRules: version.gradeRule.recommendationRules ?? [],
            ranges: version.gradeRule.ranges.map((range) => ({
              id: range.id,
              label: range.label,
              minimum: Number(range.minimum),
              maximum: Number(range.maximum),
              sortOrder: range.sortOrder,
              description: range.description,
            })),
          }
        : null,
      reviewWorkflowTemplate: version.reviewWorkflowTemplate
        ? {
            id: version.reviewWorkflowTemplate.id,
            name: version.reviewWorkflowTemplate.name,
            approvalType: version.reviewWorkflowTemplate.approvalType,
            description: version.reviewWorkflowTemplate.description,
            stages: version.reviewWorkflowTemplate.stages.map((stage) => ({
              id: stage.id,
              name: stage.name,
              level: stage.level,
              approverType: stage.approverType,
              approverRoleCode: stage.approverRoleCode,
              approverId: stage.approverId,
              backupApproverRoleCode: stage.backupApproverRoleCode,
              backupApproverId: stage.backupApproverId,
              slaHours: stage.slaHours,
              allowEscalation: stage.allowEscalation,
              conditionRules: stage.conditionRules.map((rule) => ({
                id: rule.id,
                field: rule.field,
                operator: rule.operator,
                value: rule.value,
              })),
            })),
          }
        : null,
      approvalWorkflowTemplate: version.approvalWorkflowTemplate
        ? {
            id: version.approvalWorkflowTemplate.id,
            name: version.approvalWorkflowTemplate.name,
            approvalType: version.approvalWorkflowTemplate.approvalType,
            description: version.approvalWorkflowTemplate.description,
            stages: version.approvalWorkflowTemplate.stages.map((stage) => ({
              id: stage.id,
              name: stage.name,
              level: stage.level,
              approverType: stage.approverType,
              approverRoleCode: stage.approverRoleCode,
              approverId: stage.approverId,
              backupApproverRoleCode: stage.backupApproverRoleCode,
              backupApproverId: stage.backupApproverId,
              slaHours: stage.slaHours,
              allowEscalation: stage.allowEscalation,
              conditionRules: stage.conditionRules.map((rule) => ({
                id: rule.id,
                field: rule.field,
                operator: rule.operator,
                value: rule.value,
              })),
            })),
          }
        : null,
      components: version.components.map((component) => ({
        id: component.id,
        name: component.name,
        code: component.code,
        type: component.type,
        weight: Number(component.weight),
        sortOrder: component.sortOrder,
        isRequired: component.isRequired,
        description: component.description,
        config: component.config ?? null,
      })),
    };
  }

  async findAllMethods(companyId: string) {
    return performanceRepository.findAllMethods(companyId);
  }

  async findMethodById(id: string) {
    const method = await performanceRepository.findMethodById(id);
    if (!method) {
      throw new NotFoundError('Performance method not found');
    }
    return method;
  }

  async createMethod(data: CreatePerformanceMethodDTO, context: PerformanceAuditContext) {
    const code = this.normalizeCode(data.code);
    const existing = await performanceRepository.findMethodByCompanyAndCode(data.companyId, code);
    if (existing) {
      throw new ConflictError('Performance method code already exists');
    }

    const created = await performanceRepository.createMethod({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-method', created.id, undefined, created);
    return created;
  }

  async updateMethod(id: string, data: UpdatePerformanceMethodDTO, context: PerformanceAuditContext) {
    const current = await this.findMethodById(id);
    const nextCode = current.code;
    const payload = {
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    };

    const updated = await performanceRepository.updateMethod(id, payload);
    await this.logAudit(context, 'UPDATE', 'performance-method', id, current, updated);
    return updated;
  }

  async findMethodVersions(methodId: string) {
    await this.findMethodById(methodId);
    return performanceRepository.findMethodVersions(methodId);
  }

  async findMethodVersionById(id: string) {
    const version = await performanceRepository.findMethodVersionById(id);
    if (!version) {
      throw new NotFoundError('Performance method version not found');
    }
    return version;
  }

  async getMethodVersionReadiness(id: string) {
    const version = await this.findMethodVersionById(id);
    return {
      versionId: version.id,
      methodId: version.methodId,
      versionNumber: version.versionNumber,
      ...this.buildVersionReadiness(version),
    };
  }

  async createMethodVersion(methodId: string, data: CreatePerformanceMethodVersionDTO, context: PerformanceAuditContext) {
    const method = await this.findMethodById(methodId);
    this.ensureValidScoreRange(data.minimumScore, data.maximumScore);

    if (data.gradeRuleId) {
      const gradeRule = await this.findGradeRuleById(data.gradeRuleId);
      if (gradeRule.companyId !== method.companyId) {
        throw new BadRequestError('Grade rule must belong to the same company as the method');
      }
    }

    if (data.reviewWorkflowTemplateId) {
      const reviewWorkflow = await this.findReviewWorkflowTemplateById(data.reviewWorkflowTemplateId);
      if (reviewWorkflow.companyId !== method.companyId) {
        throw new BadRequestError('Review workflow template must belong to the same company as the method');
      }
    }

    if (data.approvalWorkflowTemplateId) {
      const approvalWorkflow = await this.findApprovalWorkflowTemplateById(data.approvalWorkflowTemplateId);
      if (approvalWorkflow.companyId !== method.companyId) {
        throw new BadRequestError('Approval workflow template must belong to the same company as the method');
      }
    }

    const latest = await performanceRepository.findLatestMethodVersion(methodId);
    const versionNumber = (latest?.versionNumber ?? 0) + 1;

    const created = await performanceRepository.createMethodVersion(methodId, method.companyId, versionNumber, {
      ...data,
      summary: data.summary?.trim() || undefined,
    });

    await performanceRepository.updateMethod(methodId, {
      latestVersionNumber: versionNumber,
    } as any);

    await this.logAudit(context, 'CREATE', 'performance-method-version', created.id, undefined, created);
    return performanceRepository.findMethodVersionById(created.id);
  }

  async updateMethodVersion(id: string, data: UpdatePerformanceMethodVersionDTO, context: PerformanceAuditContext) {
    const current = await this.findMethodVersionById(id);
    this.ensureEditableMethodVersion(current.status);
    this.ensureValidScoreRange(data.minimumScore, data.maximumScore);

    if (data.gradeRuleId) {
      const gradeRule = await this.findGradeRuleById(data.gradeRuleId);
      if (gradeRule.companyId !== current.companyId) {
        throw new BadRequestError('Grade rule must belong to the same company as the method version');
      }
    }

    if (data.reviewWorkflowTemplateId) {
      const reviewWorkflow = await this.findReviewWorkflowTemplateById(data.reviewWorkflowTemplateId);
      if (reviewWorkflow.companyId !== current.companyId) {
        throw new BadRequestError('Review workflow template must belong to the same company as the method version');
      }
    }

    if (data.approvalWorkflowTemplateId) {
      const approvalWorkflow = await this.findApprovalWorkflowTemplateById(data.approvalWorkflowTemplateId);
      if (approvalWorkflow.companyId !== current.companyId) {
        throw new BadRequestError('Approval workflow template must belong to the same company as the method version');
      }
    }

    const updated = await performanceRepository.updateMethodVersion(id, {
      ...data,
      summary: data.summary?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-method-version', id, current, updated);
    return performanceRepository.findMethodVersionById(updated.id);
  }

  async publishMethodVersion(id: string, context: PerformanceAuditContext) {
    const current = await this.findMethodVersionById(id);
    this.ensureEditableMethodVersion(current.status);

    const readiness = this.buildVersionReadiness(current);
    if (!readiness.isReady) {
      throw new BadRequestError(`Method version is not ready to publish: ${readiness.issues.join(', ')}`);
    }

    const published = await performanceRepository.updateMethodVersion(id, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
    });

    await performanceRepository.updateMethod(current.methodId, {
      status: 'ACTIVE',
    } as any);

    await this.logAudit(context, 'PUBLISH', 'performance-method-version', id, current, published);
    return performanceRepository.findMethodVersionById(id);
  }

  async findWorkflowTemplateById(id: string, expectedType?: 'PERFORMANCE_REVIEW' | 'PERFORMANCE_APPROVAL') {
    const workflowTemplate = await performanceRepository.findWorkflowTemplateById(id);
    if (!workflowTemplate || workflowTemplate.resource !== 'performance') {
      throw new NotFoundError('Performance workflow template not found');
    }

    if (expectedType && workflowTemplate.approvalType !== expectedType) {
      throw new BadRequestError('Workflow template type does not match the requested context');
    }

    return workflowTemplate;
  }

  async findReviewWorkflowTemplates(companyId: string) {
    return performanceRepository.findWorkflowTemplates(companyId, 'PERFORMANCE_REVIEW');
  }

  async findReviewWorkflowTemplateById(id: string) {
    return this.findWorkflowTemplateById(id, 'PERFORMANCE_REVIEW');
  }

  async createReviewWorkflowTemplate(data: CreatePerformanceWorkflowTemplateDTO, context: PerformanceAuditContext) {
    this.validateWorkflowStages(data.stages);

    const existing = await performanceRepository.findWorkflowTemplateByCompanyAndName(
      data.companyId,
      'PERFORMANCE_REVIEW',
      data.name.trim()
    );
    if (existing) {
      throw new ConflictError('Performance review workflow template name already exists');
    }

    const created = await performanceRepository.createWorkflowTemplate('PERFORMANCE_REVIEW', {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-review-workflow-template', created.id, undefined, created);
    return created;
  }

  async updateReviewWorkflowTemplate(id: string, data: UpdatePerformanceWorkflowTemplateDTO, context: PerformanceAuditContext) {
    const current = await this.findReviewWorkflowTemplateById(id);
    if (data.stages) {
      this.validateWorkflowStages(data.stages);
    }

    if (data.name) {
      const duplicate = await performanceRepository.findWorkflowTemplateByCompanyAndName(
        current.companyId,
        'PERFORMANCE_REVIEW',
        data.name.trim()
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Performance review workflow template name already exists');
      }
    }

    const updated = await performanceRepository.updateWorkflowTemplate(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-review-workflow-template', id, current, updated);
    return updated;
  }

  async findApprovalWorkflowTemplates(companyId: string) {
    return performanceRepository.findWorkflowTemplates(companyId, 'PERFORMANCE_APPROVAL');
  }

  async findApprovalWorkflowTemplateById(id: string) {
    return this.findWorkflowTemplateById(id, 'PERFORMANCE_APPROVAL');
  }

  async createApprovalWorkflowTemplate(data: CreatePerformanceWorkflowTemplateDTO, context: PerformanceAuditContext) {
    this.validateWorkflowStages(data.stages);

    const existing = await performanceRepository.findWorkflowTemplateByCompanyAndName(
      data.companyId,
      'PERFORMANCE_APPROVAL',
      data.name.trim()
    );
    if (existing) {
      throw new ConflictError('Performance approval workflow template name already exists');
    }

    const created = await performanceRepository.createWorkflowTemplate('PERFORMANCE_APPROVAL', {
      ...data,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-approval-workflow-template', created.id, undefined, created);
    return created;
  }

  async updateApprovalWorkflowTemplate(id: string, data: UpdatePerformanceWorkflowTemplateDTO, context: PerformanceAuditContext) {
    const current = await this.findApprovalWorkflowTemplateById(id);
    if (data.stages) {
      this.validateWorkflowStages(data.stages);
    }

    if (data.name) {
      const duplicate = await performanceRepository.findWorkflowTemplateByCompanyAndName(
        current.companyId,
        'PERFORMANCE_APPROVAL',
        data.name.trim()
      );
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Performance approval workflow template name already exists');
      }
    }

    const updated = await performanceRepository.updateWorkflowTemplate(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-approval-workflow-template', id, current, updated);
    return updated;
  }

  async findAllFormulas(companyId: string) {
    return performanceRepository.findAllFormulas(companyId);
  }

  async findFormulaById(id: string) {
    const formula = await performanceRepository.findFormulaById(id);
    if (!formula) {
      throw new NotFoundError('Performance formula not found');
    }
    return formula;
  }

  async createFormula(data: CreatePerformanceFormulaDTO, context: PerformanceAuditContext) {
    const code = this.normalizeCode(data.code);
    const existing = await performanceRepository.findFormulaByCompanyAndCode(data.companyId, code);
    if (existing) {
      throw new ConflictError('Performance formula code already exists');
    }

    this.ensureValidScoreRange(data.minimumScore, data.maximumScore);

    const created = await performanceRepository.createFormula({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      expression: data.expression?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-formula', created.id, undefined, created);
    return created;
  }

  async updateFormula(id: string, data: UpdatePerformanceFormulaDTO, context: PerformanceAuditContext) {
    const current = await this.findFormulaById(id);
    this.ensureValidScoreRange(data.minimumScore, data.maximumScore);

    if (data.code) {
      const nextCode = this.normalizeCode(data.code);
      const duplicate = await performanceRepository.findFormulaByCompanyAndCode(current.companyId, nextCode);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Performance formula code already exists');
      }
      data.code = nextCode;
    }

    const updated = await performanceRepository.updateFormula(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
      expression: data.expression?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-formula', id, current, updated);
    return updated;
  }

  async findAllIndicators(companyId: string) {
    return performanceRepository.findAllIndicators(companyId);
  }

  async findIndicatorById(id: string) {
    const indicator = await performanceRepository.findIndicatorById(id);
    if (!indicator) {
      throw new NotFoundError('Performance indicator not found');
    }
    return indicator;
  }

  async createIndicator(data: CreatePerformanceIndicatorDTO, context: PerformanceAuditContext) {
    const code = this.normalizeCode(data.code);
    const existing = await performanceRepository.findIndicatorByCompanyAndCode(data.companyId, code);
    if (existing) {
      throw new ConflictError('Performance indicator code already exists');
    }

    this.ensureValidNumericRange(data.minimumValue, data.maximumValue, 'Indicator value');

    if (data.formulaId) {
      const formula = await this.findFormulaById(data.formulaId);
      if (formula.companyId !== data.companyId) {
        throw new BadRequestError('Selected formula must belong to the same company');
      }
    }

    const created = await performanceRepository.createIndicator({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      category: data.category?.trim() || undefined,
      perspective: data.perspective?.trim() || undefined,
      unit: data.unit?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-indicator', created.id, undefined, created);
    return created;
  }

  async updateIndicator(id: string, data: UpdatePerformanceIndicatorDTO, context: PerformanceAuditContext) {
    const current = await this.findIndicatorById(id);
    this.ensureValidNumericRange(data.minimumValue, data.maximumValue, 'Indicator value');

    if (data.code) {
      const nextCode = this.normalizeCode(data.code);
      const duplicate = await performanceRepository.findIndicatorByCompanyAndCode(current.companyId, nextCode);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Performance indicator code already exists');
      }
      data.code = nextCode;
    }

    if (data.formulaId) {
      const formula = await this.findFormulaById(data.formulaId);
      if (formula.companyId !== current.companyId) {
        throw new BadRequestError('Selected formula must belong to the same company');
      }
    }

    const updated = await performanceRepository.updateIndicator(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
      category: data.category?.trim() || undefined,
      perspective: data.perspective?.trim() || undefined,
      unit: data.unit?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-indicator', id, current, updated);
    return updated;
  }

  async findAllGradeRules(companyId: string) {
    return performanceRepository.findAllGradeRules(companyId);
  }

  async findGradeRuleById(id: string) {
    const gradeRule = await performanceRepository.findGradeRuleById(id);
    if (!gradeRule) {
      throw new NotFoundError('Performance grade rule not found');
    }
    return gradeRule;
  }

  async createGradeRule(data: CreatePerformanceGradeRuleDTO, context: PerformanceAuditContext) {
    const code = this.normalizeCode(data.code);
    const existing = await performanceRepository.findGradeRuleByCompanyAndCode(data.companyId, code);
    if (existing) {
      throw new ConflictError('Performance grade rule code already exists');
    }

    this.validateGradeRanges(data.ranges);
    this.validateRecommendationRules(data.recommendationRules);

    const created = await performanceRepository.createGradeRule({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
      recommendationRules: data.recommendationRules?.map((rule) => ({
        label: rule.label.trim(),
        condition: rule.condition.trim(),
        action: rule.action.trim(),
        notes: rule.notes?.trim() || undefined,
      })),
      ranges: data.ranges.map((range) => ({
        ...range,
        label: range.label.trim(),
        description: range.description?.trim() || undefined,
      })),
    });

    await this.logAudit(context, 'CREATE', 'performance-grade-rule', created.id, undefined, created);
    return created;
  }

  async updateGradeRule(id: string, data: UpdatePerformanceGradeRuleDTO, context: PerformanceAuditContext) {
    const current = await this.findGradeRuleById(id);

    if (data.code) {
      const nextCode = this.normalizeCode(data.code);
      const duplicate = await performanceRepository.findGradeRuleByCompanyAndCode(current.companyId, nextCode);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError('Performance grade rule code already exists');
      }
      data.code = nextCode;
    }

    if (data.ranges) {
      this.validateGradeRanges(data.ranges);
    }
    if (data.recommendationRules) {
      this.validateRecommendationRules(data.recommendationRules);
    }

    const updated = await performanceRepository.updateGradeRule(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
      recommendationRules: data.recommendationRules?.map((rule) => ({
        label: rule.label.trim(),
        condition: rule.condition.trim(),
        action: rule.action.trim(),
        notes: rule.notes?.trim() || undefined,
      })),
      ranges: data.ranges?.map((range) => ({
        ...range,
        label: range.label.trim(),
        description: range.description?.trim() || undefined,
      })),
    });

    await this.logAudit(context, 'UPDATE', 'performance-grade-rule', id, current, updated);
    return updated;
  }

  async findComponentsByMethodVersion(methodVersionId: string) {
    await this.findMethodVersionById(methodVersionId);
    return performanceRepository.findComponentsByMethodVersion(methodVersionId);
  }

  async createComponent(methodVersionId: string, data: CreatePerformanceComponentDTO, context: PerformanceAuditContext) {
    const version = await this.findMethodVersionById(methodVersionId);
    this.ensureEditableMethodVersion(version.status);

    const code = this.normalizeCode(data.code);
    const duplicate = version.components.find((component) => component.code === code);
    if (duplicate) {
      throw new ConflictError('Component code already exists in this method version');
    }

    const created = await performanceRepository.createComponent(methodVersionId, version.companyId, {
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-component', created.id, undefined, created);
    return created;
  }

  async updateComponent(id: string, data: UpdatePerformanceComponentDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findComponentById(id);
    if (!current) {
      throw new NotFoundError('Performance component not found');
    }

    this.ensureEditableMethodVersion(current.methodVersion.status);

    const nextCode = data.code ? this.normalizeCode(data.code) : current.code;
    const siblings = await performanceRepository.findComponentsByMethodVersion(current.methodVersionId);
    const duplicate = siblings.find((component) => component.id !== id && component.code === nextCode);
    if (duplicate) {
      throw new ConflictError('Component code already exists in this method version');
    }

    const updated = await performanceRepository.updateComponent(id, {
      ...data,
      code: nextCode,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-component', id, current, updated);
    return updated;
  }

  async findAllPeriods(companyId: string, filters?: { methodId?: string; status?: string }) {
    return performanceRepository.findAllPeriods(companyId, filters);
  }

  async findPeriodById(id: string) {
    const period = await performanceRepository.findPeriodById(id);
    if (!period) {
      throw new NotFoundError('Performance period not found');
    }
    return period;
  }

  async createPeriod(data: CreatePerformancePeriodDTO, context: PerformanceAuditContext) {
    const method = await this.findMethodById(data.methodId);
    const version = await this.findMethodVersionById(data.methodVersionId);

    if (method.companyId !== data.companyId || version.companyId !== data.companyId) {
      throw new BadRequestError('Method and period must belong to the same company');
    }

    if (version.methodId !== method.id) {
      throw new BadRequestError('Selected method version does not belong to the selected method');
    }

    const code = this.normalizeCode(data.code);
    const existing = await performanceRepository.findPeriodByCompanyAndCode(data.companyId, code);
    if (existing) {
      throw new ConflictError('Performance period code already exists');
    }

    if (new Date(data.startDate) >= new Date(data.endDate)) {
      throw new BadRequestError('Period start date must be earlier than end date');
    }

    const created = await performanceRepository.createPeriod({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'CREATE', 'performance-period', created.id, undefined, created);
    return created;
  }

  async updatePeriod(id: string, data: UpdatePerformancePeriodDTO, context: PerformanceAuditContext) {
    const current = await this.findPeriodById(id);
    this.ensureEditablePeriod(current.status);

    let resolvedMethodId = current.methodId;
    if (data.methodVersionId) {
      const version = await this.findMethodVersionById(data.methodVersionId);
      resolvedMethodId = version.methodId;
    }

    const nextCode = data.code ? this.normalizeCode(data.code) : current.code;
    const duplicate = await performanceRepository.findPeriodByCompanyAndCode(current.companyId, nextCode);
    if (duplicate && duplicate.id !== id) {
      throw new ConflictError('Performance period code already exists');
    }

    const nextStart = data.startDate ? new Date(data.startDate) : current.startDate;
    const nextEnd = data.endDate ? new Date(data.endDate) : current.endDate;
    if (nextStart >= nextEnd) {
      throw new BadRequestError('Period start date must be earlier than end date');
    }

    const updated = await performanceRepository.updatePeriod(id, {
      ...data,
      methodId: resolvedMethodId,
      code: nextCode,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
    });

    await this.logAudit(context, 'UPDATE', 'performance-period', id, current, updated);
    return updated;
  }

  async getPeriodReadiness(id: string) {
    const period = await this.findPeriodById(id);
    return this.buildPeriodReadiness(period);
  }

  async publishPeriod(id: string, context: PerformanceAuditContext) {
    const current = await this.findPeriodById(id);
    this.ensureEditablePeriod(current.status);

    const readiness = this.buildPeriodReadiness(current);
    if (!readiness.isReady) {
      throw new BadRequestError(`Performance period is not ready to publish: ${readiness.issues.join(', ')}`);
    }

    const updated = await performanceRepository.updatePeriod(id, {
      status: 'PUBLISHED',
      readinessSummary: readiness,
      configSnapshot: this.buildPeriodConfigSnapshot(current),
      publishedAt: new Date(),
    } as any);

    await this.logAudit(context, 'PUBLISH', 'performance-period', id, current, updated);
    return updated;
  }

  async getPlanningWorkspace(periodId: string) {
    const workspace = await performanceRepository.findPlanningWorkspace(periodId);
    const readiness = this.buildPlanningReadiness(workspace);
    return {
      ...workspace,
      planningReadiness: readiness,
    };
  }

  async createPlanningAssignment(periodId: string, data: CreatePerformancePlanningAssignmentDTO, context: PerformanceAuditContext) {
    const period = await this.findPeriodById(periodId);
    this.ensurePlanningPeriodAvailable(period);

    const existing = await performanceRepository.findPlanningAssignmentByPeriodAndEmployee(periodId, data.employeeId);
    if (existing) {
      throw new ConflictError('Employee already assigned in this period');
    }

    await this.resolvePlanningEmployee(data.employeeId, period.companyId, 'Employee');
    if (data.reviewerId) {
      await this.resolvePlanningEmployee(data.reviewerId, period.companyId, 'Reviewer');
    }
    if (data.approverId) {
      await this.resolvePlanningEmployee(data.approverId, period.companyId, 'Approver');
    }

    const created = await performanceRepository.createPlanningAssignment(
      periodId,
      period.companyId,
      period.methodId,
      period.methodVersionId,
      data
    );

    await this.refreshPlanningWorkspaceSummary(periodId);
    await this.logAudit(context, 'CREATE', 'performance-planning-assignment', created.id, undefined, created);
    return created;
  }

  async updatePlanningAssignment(id: string, data: UpdatePerformancePlanningAssignmentDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensurePlanningPeriodAvailable(current.period);

    if (data.reviewerId) {
      await this.resolvePlanningEmployee(data.reviewerId, current.companyId, 'Reviewer');
    }
    if (data.approverId) {
      await this.resolvePlanningEmployee(data.approverId, current.companyId, 'Approver');
    }

    const updated = await performanceRepository.updatePlanningAssignment(id, {
      ...data,
      status: current.status === 'PUBLISHED' ? 'REASSIGNED' : current.status,
      employeeSnapshot: null,
      orgSnapshot: null,
      planningSnapshot: null,
      publishedAt: null,
      reassignmentReason: null,
    } as any);

    await this.refreshPlanningWorkspaceSummary(current.periodId);
    await this.logAudit(context, 'UPDATE', 'performance-planning-assignment', id, current, updated);
    return updated;
  }

  async reassignPlanningAssignment(id: string, data: ReassignPerformancePlanningAssignmentDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensurePlanningPeriodAvailable(current.period);

    const nextReviewerId = data.reviewerId ?? current.reviewerId ?? undefined;
    const nextApproverId = data.approverId ?? current.approverId ?? undefined;

    if (nextReviewerId) {
      await this.resolvePlanningEmployee(nextReviewerId, current.companyId, 'Reviewer');
    }
    if (nextApproverId) {
      await this.resolvePlanningEmployee(nextApproverId, current.companyId, 'Approver');
    }

    const updated = await performanceRepository.updatePlanningAssignment(id, {
      reviewerId: nextReviewerId,
      approverId: nextApproverId,
      status: current.status === 'PUBLISHED' ? 'REASSIGNED' : 'DRAFT',
      reassignmentReason: data.reason.trim(),
      employeeSnapshot: null,
      orgSnapshot: null,
      planningSnapshot: null,
      publishedAt: null,
    } as any);

    await this.refreshPlanningWorkspaceSummary(current.periodId);
    await this.logAudit(context, 'REASSIGN', 'performance-planning-assignment', id, current, updated);
    return updated;
  }

  async deletePlanningAssignment(id: string, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensurePlanningPeriodAvailable(current.period);

    await performanceRepository.deletePlanningAssignment(id);
    await this.refreshPlanningWorkspaceSummary(current.periodId);
    await this.logAudit(context, 'DELETE', 'performance-planning-assignment', id, current, null);
  }

  async createPlanningTarget(assignmentId: string, data: CreatePerformancePlanningTargetDTO, context: PerformanceAuditContext) {
    const assignment = await performanceRepository.findPlanningAssignmentById(assignmentId);
    if (!assignment) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensurePlanningPeriodAvailable(assignment.period);
    this.ensurePlanningTargetValue(data);

    const component = assignment.period.methodVersion.components.find((item) => item.id === data.componentId);
    if (!component) {
      throw new BadRequestError('Component must belong to the selected method version');
    }

    const indicator = await this.findIndicatorById(data.indicatorId);
    if (indicator.companyId !== assignment.companyId) {
      throw new BadRequestError('Indicator must belong to the same company');
    }

    if (data.formulaId) {
      const formula = await this.findFormulaById(data.formulaId);
      if (formula.companyId !== assignment.companyId) {
        throw new BadRequestError('Formula must belong to the same company');
      }
    }

    if (data.reviewerId) {
      await this.resolvePlanningEmployee(data.reviewerId, assignment.companyId, 'Reviewer');
    }
    if (data.approverId) {
      await this.resolvePlanningEmployee(data.approverId, assignment.companyId, 'Approver');
    }

    const created = await performanceRepository.createPlanningTarget(assignmentId, assignment.companyId, {
      ...data,
      name: data.name?.trim() || indicator.name,
      description: data.description?.trim() || undefined,
      targetText: data.targetText?.trim() || undefined,
      evidenceRequired: data.evidenceRequired ?? indicator.evidenceRequired,
      formulaId: data.formulaId || indicator.formulaId || undefined,
    });

    if (assignment.status === 'PUBLISHED') {
      await performanceRepository.updatePlanningAssignment(assignment.id, {
        status: 'REASSIGNED',
        employeeSnapshot: null,
        orgSnapshot: null,
        planningSnapshot: null,
        publishedAt: null,
      } as any);
    }

    await this.refreshPlanningWorkspaceSummary(assignment.periodId);
    await this.logAudit(context, 'CREATE', 'performance-planning-target', created.id, undefined, created);
    return created;
  }

  async updatePlanningTarget(id: string, data: UpdatePerformancePlanningTargetDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningTargetById(id);
    if (!current) {
      throw new NotFoundError('Performance planning target not found');
    }

    this.ensurePlanningPeriodAvailable(current.assignment.period);
    this.ensurePlanningTargetValue({
      targetValue: data.targetValue ?? (current.targetValue === null ? undefined : Number(current.targetValue)),
      targetText: data.targetText ?? current.targetText,
    });

    const componentId = data.componentId || current.componentId;
    if (!componentId) {
      throw new BadRequestError('Planning target must keep component');
    }

    const component = current.assignment.period.methodVersion.components.find((item) => item.id === componentId);
    if (!component) {
      throw new BadRequestError('Component must belong to the selected method version');
    }

    const indicatorId = data.indicatorId || current.indicatorId;
    if (!indicatorId) {
      throw new BadRequestError('Planning target must keep indicator');
    }

    const indicator = await this.findIndicatorById(indicatorId);
    if (indicator.companyId !== current.companyId) {
      throw new BadRequestError('Indicator must belong to the same company');
    }

    const formulaId = data.formulaId || current.formulaId || indicator.formulaId || undefined;
    if (formulaId) {
      const formula = await this.findFormulaById(formulaId);
      if (formula.companyId !== current.companyId) {
        throw new BadRequestError('Formula must belong to the same company');
      }
    }

    if (data.reviewerId) {
      await this.resolvePlanningEmployee(data.reviewerId, current.companyId, 'Reviewer');
    }
    if (data.approverId) {
      await this.resolvePlanningEmployee(data.approverId, current.companyId, 'Approver');
    }

    const updated = await performanceRepository.updatePlanningTarget(id, {
      ...data,
      formulaId,
      name: data.name?.trim() || current.name,
      description: data.description?.trim() || undefined,
      targetText: data.targetText?.trim() || undefined,
      status: current.status === 'PUBLISHED' ? 'DRAFT' : current.status,
    } as any);

    await performanceRepository.updatePlanningAssignment(current.assignmentId, {
      status: current.assignment.status === 'PUBLISHED' ? 'REASSIGNED' : current.assignment.status,
      employeeSnapshot: null,
      orgSnapshot: null,
      planningSnapshot: null,
      publishedAt: null,
    } as any);

    await this.refreshPlanningWorkspaceSummary(current.assignment.periodId);
    await this.logAudit(context, 'UPDATE', 'performance-planning-target', id, current, updated);
    return updated;
  }

  async deletePlanningTarget(id: string, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningTargetById(id);
    if (!current) {
      throw new NotFoundError('Performance planning target not found');
    }

    this.ensurePlanningPeriodAvailable(current.assignment.period);

    await performanceRepository.deletePlanningTarget(id);
    await performanceRepository.updatePlanningAssignment(current.assignmentId, {
      status: current.assignment.status === 'PUBLISHED' ? 'REASSIGNED' : current.assignment.status,
      employeeSnapshot: null,
      orgSnapshot: null,
      planningSnapshot: null,
      publishedAt: null,
    } as any);

    await this.refreshPlanningWorkspaceSummary(current.assignment.periodId);
    await this.logAudit(context, 'DELETE', 'performance-planning-target', id, current, null);
  }

  async publishPlanning(periodId: string, context: PerformanceAuditContext) {
    const workspace = await performanceRepository.findPlanningWorkspace(periodId);
    this.ensurePlanningPeriodAvailable(workspace as any);

    const readiness = this.buildPlanningReadiness(workspace);
    if (!readiness.isReady) {
      throw new BadRequestError(`Performance planning is not ready to publish: ${readiness.issues.join(', ')}`);
    }

    const snapshots = await Promise.all(
      (workspace?.planningAssignments ?? []).map(async (assignment) => {
        const detail = await performanceRepository.findPlanningAssignmentById(assignment.id);
        if (!detail) {
          throw new NotFoundError('Performance planning assignment not found');
        }

        return {
          id: assignment.id,
          employeeSnapshot: this.buildEmployeePlanningSnapshot(detail.employee) as any,
          orgSnapshot: this.buildPlanningOrgSnapshot(detail) as any,
          planningSnapshot: this.buildPlanningAssignmentSnapshot(detail) as any,
        };
      })
    );

    const published = await performanceRepository.publishPlanning(periodId, readiness as any, snapshots);
    await this.logAudit(context, 'PUBLISH', 'performance-planning', periodId, workspace, published);
    return published;
  }

  async createPlanningTargetProgress(id: string, data: CreatePerformanceTargetProgressDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningTargetById(id);
    if (!current) {
      throw new NotFoundError('Performance planning target not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.assignment.period as any);
    this.ensureAssignmentExecutionMutable(current.assignment.status);
    const actorRole = this.resolveExecutionTargetActorRole(current, context);

    await performanceRepository.createPlanningTargetProgress(
      current.id,
      current.assignmentId,
      current.companyId,
      context.employeeId,
      {
        ...data,
        currentText: this.sanitizeExecutionNotes(data.currentText),
        note: this.sanitizeExecutionNotes(data.note),
      }
    );

    const updated = await performanceRepository.updatePlanningTarget(id, {
      currentValue: data.currentValue,
      currentText: this.sanitizeExecutionNotes(data.currentText),
      progressPercent: data.progressPercent,
      status: this.nextExecutionTargetStatus(current.status),
      selfComment: actorRole === 'EMPLOYEE' ? this.sanitizeExecutionNotes(data.note) : current.selfComment ?? undefined,
      reviewerComment: actorRole !== 'EMPLOYEE' ? this.sanitizeExecutionNotes(data.note) : current.reviewerComment ?? undefined,
      submittedAt: null,
      reviewedAt: null,
      completedAt: null,
    } as any);

    await performanceRepository.updatePlanningAssignment(current.assignmentId, {
      status: this.nextExecutionAssignmentStatus(current.assignment.status),
      executionSnapshot: null,
      submittedAt: null,
      reviewedAt: null,
      completedAt: null,
      decisionNotes: null,
    } as any);

    await this.logAudit(context, 'PROGRESS', 'performance-planning-target', id, current, updated);
    return updated;
  }

  async uploadPlanningEvidence(
    id: string,
    file: { filename: string; originalname: string; mimetype: string; size: number } | undefined,
    notes: string | undefined,
    context: PerformanceAuditContext
  ) {
    const current = await performanceRepository.findPlanningTargetById(id);
    if (!current) {
      throw new NotFoundError('Performance planning target not found');
    }

    if (!file) {
      throw new BadRequestError('Evidence file is required');
    }

    this.ensureExecutionWorkspaceAvailable(current.assignment.period as any);
    this.ensureAssignmentExecutionMutable(current.assignment.status);
    this.resolveExecutionTargetActorRole(current, context);

    const evidence = await performanceRepository.createPlanningEvidence({
      companyId: current.companyId,
      assignmentId: current.assignmentId,
      targetId: current.id,
      uploadedById: context.employeeId,
      fileName: file.filename,
      originalName: file.originalname,
      fileUrl: `/uploads/performance/evidence/${file.filename}`,
      mimeType: file.mimetype,
      fileSize: file.size,
      notes: this.sanitizeExecutionNotes(notes),
    });

    await performanceRepository.updatePlanningTarget(id, {
      status: this.nextExecutionTargetStatus(current.status),
    } as any);

    await performanceRepository.updatePlanningAssignment(current.assignmentId, {
      status: this.nextExecutionAssignmentStatus(current.assignment.status),
      executionSnapshot: null,
      submittedAt: null,
      reviewedAt: null,
      completedAt: null,
      decisionNotes: null,
    } as any);

    await this.logAudit(context, 'UPLOAD_EVIDENCE', 'performance-planning-target', id, undefined, evidence);
    return evidence;
  }

  async submitPlanningAssignment(id: string, data: PerformanceExecutionActionDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.period as any);
    this.ensureExecutionOwner(current, context);

    if (!['PUBLISHED', 'IN_PROGRESS', 'REVISION_REQUIRED'].includes(current.status)) {
      throw new BadRequestError('Only published or in-progress assignments can be submitted');
    }

    const issues = this.buildExecutionSubmissionIssues(current);
    if (issues.length > 0) {
      throw new BadRequestError(`Assignment is not ready to submit: ${issues.join(', ')}`);
    }

    const submittedAt = new Date();

    await Promise.all(
      current.targets.map((target) =>
        performanceRepository.updatePlanningTarget(target.id, {
          status: 'SUBMITTED',
          submittedAt,
          reviewedAt: null,
          completedAt: null,
        } as any)
      )
    );

    await performanceRepository.updatePlanningAssignment(id, {
      status: 'SUBMITTED',
      submissionNotes: this.sanitizeExecutionNotes(data.notes),
      decisionNotes: null,
      submittedAt,
      reviewedAt: null,
      completedAt: null,
      executionSnapshot: null,
    } as any);

    const detail = await performanceRepository.findPlanningAssignmentById(id);
    if (!detail) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    const final = await performanceRepository.updatePlanningAssignment(id, {
      executionSnapshot: this.buildExecutionAssignmentSnapshot(detail) as any,
    } as any);

    await this.logAudit(context, 'SUBMIT', 'performance-planning-assignment', id, current, final);
    return final;
  }

  async approvePlanningAssignment(id: string, data: PerformanceExecutionActionDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.period as any);
    this.ensureExecutionApprover(current, context);

    if (current.status !== 'SUBMITTED') {
      throw new BadRequestError('Only submitted assignments can be approved');
    }

    const reviewedAt = new Date();

    await Promise.all(
      current.targets.map((target) =>
        performanceRepository.updatePlanningTarget(target.id, {
          status: 'APPROVED',
          reviewerComment: this.sanitizeExecutionNotes(data.notes),
          reviewedAt,
        } as any)
      )
    );

    await performanceRepository.updatePlanningAssignment(id, {
      status: 'APPROVED',
      decisionNotes: this.sanitizeExecutionNotes(data.notes),
      reviewedAt,
      executionSnapshot: null,
    } as any);

    const detail = await performanceRepository.findPlanningAssignmentById(id);
    if (!detail) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    const final = await performanceRepository.updatePlanningAssignment(id, {
      executionSnapshot: this.buildExecutionAssignmentSnapshot(detail) as any,
    } as any);

    await this.logAudit(context, 'APPROVE', 'performance-planning-assignment', id, current, final);
    return final;
  }

  async rejectPlanningAssignment(id: string, data: PerformanceExecutionActionDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.period as any);
    this.ensureExecutionApprover(current, context);

    if (current.status !== 'SUBMITTED') {
      throw new BadRequestError('Only submitted assignments can be rejected');
    }

    const reviewedAt = new Date();

    await Promise.all(
      current.targets.map((target) =>
        performanceRepository.updatePlanningTarget(target.id, {
          status: 'REJECTED',
          reviewerComment: this.sanitizeExecutionNotes(data.notes),
          reviewedAt,
          completedAt: null,
        } as any)
      )
    );

    await performanceRepository.updatePlanningAssignment(id, {
      status: 'REJECTED',
      decisionNotes: this.sanitizeExecutionNotes(data.notes),
      reviewedAt,
      completedAt: null,
      executionSnapshot: null,
    } as any);

    const detail = await performanceRepository.findPlanningAssignmentById(id);
    if (!detail) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    const final = await performanceRepository.updatePlanningAssignment(id, {
      executionSnapshot: this.buildExecutionAssignmentSnapshot(detail) as any,
    } as any);

    await this.logAudit(context, 'REJECT', 'performance-planning-assignment', id, current, final);
    return final;
  }

  async requestPlanningAssignmentRevision(id: string, data: PerformanceExecutionActionDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.period as any);
    this.ensureExecutionApprover(current, context);

    if (current.status !== 'SUBMITTED') {
      throw new BadRequestError('Only submitted assignments can be sent back for revision');
    }

    const reviewedAt = new Date();

    await Promise.all(
      current.targets.map((target) =>
        performanceRepository.updatePlanningTarget(target.id, {
          status: 'REVISION_REQUIRED',
          reviewerComment: this.sanitizeExecutionNotes(data.notes),
          reviewedAt,
          completedAt: null,
        } as any)
      )
    );

    await performanceRepository.updatePlanningAssignment(id, {
      status: 'REVISION_REQUIRED',
      decisionNotes: this.sanitizeExecutionNotes(data.notes),
      reviewedAt,
      completedAt: null,
      executionSnapshot: null,
    } as any);

    const detail = await performanceRepository.findPlanningAssignmentById(id);
    if (!detail) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    const final = await performanceRepository.updatePlanningAssignment(id, {
      executionSnapshot: this.buildExecutionAssignmentSnapshot(detail) as any,
    } as any);

    await this.logAudit(context, 'REVISION_REQUIRED', 'performance-planning-assignment', id, current, final);
    return final;
  }

  async completePlanningAssignment(id: string, data: PerformanceExecutionActionDTO, context: PerformanceAuditContext) {
    const current = await performanceRepository.findPlanningAssignmentById(id);
    if (!current) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    this.ensureExecutionWorkspaceAvailable(current.period as any);
    const actorId = this.ensureExecutionActor(context);
    const canComplete = current.employeeId === actorId || current.approverId === actorId;

    if (!canComplete) {
      throw new ForbiddenError('Only the assigned employee or approver can complete this assignment');
    }

    if (current.status !== 'APPROVED') {
      throw new BadRequestError('Only approved assignments can be completed');
    }

    const completedAt = new Date();

    await Promise.all(
      current.targets.map((target) =>
        performanceRepository.updatePlanningTarget(target.id, {
          status: 'COMPLETED',
          completedAt,
        } as any)
      )
    );

    await performanceRepository.updatePlanningAssignment(id, {
      status: 'COMPLETED',
      decisionNotes: this.sanitizeExecutionNotes(data.notes) ?? current.decisionNotes ?? undefined,
      completedAt,
      executionSnapshot: null,
    } as any);

    const detail = await performanceRepository.findPlanningAssignmentById(id);
    if (!detail) {
      throw new NotFoundError('Performance planning assignment not found');
    }

    const final = await performanceRepository.updatePlanningAssignment(id, {
      executionSnapshot: this.buildExecutionAssignmentSnapshot(detail) as any,
    } as any);

    await this.logAudit(context, 'COMPLETE', 'performance-planning-assignment', id, current, final);
    return final;
  }

  async getExecutionApprovalQueue(companyId: string, context: PerformanceAuditContext) {
    this.ensureExecutionActor(context);
    return performanceRepository.findExecutionApprovalQueue(companyId, context.employeeId);
  }

  async getPerformanceResults(periodId: string) {
    await this.findPeriodById(periodId);
    return performanceRepository.findResultsByPeriod(periodId);
  }

  async getDevelopmentRecommendations(periodId: string) {
    await this.findPeriodById(periodId);
    return performanceRepository.findDevelopmentRecommendations(periodId);
  }

  async syncPerformanceDevelopmentRecommendations(
    periodId: string,
    data: SyncPerformanceDevelopmentRecommendationsDTO,
    context: PerformanceAuditContext
  ) {
    await this.findPeriodById(periodId);
    const results = await performanceRepository.findResultsByPeriod(periodId);
    if (!results.length) {
      throw new BadRequestError('No performance results available to sync development recommendation');
    }

    const existingRecommendations = await performanceRepository.findDevelopmentRecommendations(periodId);
    const existingKeys = new Set(
      existingRecommendations.map((item) => `${item.resultId}:${(item.sourceRuleLabel ?? item.title).trim().toLowerCase()}`)
    );

    if (data.strategy === 'REGENERATE' && existingRecommendations.length) {
      await performanceRepository.deleteDevelopmentRecommendationsByPeriod(periodId);
      existingKeys.clear();
    }

    for (const result of results) {
      const rules = this.coerceRecommendationRules(result.recommendationRules);
      for (const rule of rules) {
        const recommendationKey = `${result.id}:${rule.label.trim().toLowerCase()}`;
        if (data.strategy === 'UPSERT_MISSING' && existingKeys.has(recommendationKey)) {
          continue;
        }

        const keywords = this.extractRecommendationKeywords(
          rule.label,
          rule.action,
          rule.notes,
          result.recommendationSummary
        );
        const matchingCourse =
          keywords.length > 0
            ? (await performanceRepository.findMatchingTrainingCourses(result.companyId, keywords))[0]
            : null;

        await performanceRepository.createDevelopmentRecommendation({
          companyId: result.companyId,
          periodId,
          resultId: result.id,
          employeeId: result.employeeId,
          type: this.inferDevelopmentRecommendationType(rule),
          priority: this.inferDevelopmentRecommendationPriority(result),
          sourceRuleLabel: rule.label,
          title: rule.action.trim(),
          description: [
            `Auto-generated from ${result.period?.name ?? 'performance result'} (${result.employee?.fullName ?? result.employeeId}).`,
            `Grade: ${result.gradeLabel || result.gradeCode || '-'} | Final Score: ${result.finalScore ?? '-'}`
              .trim(),
            rule.notes?.trim() || null,
          ].filter(Boolean).join('\n'),
          courseId: matchingCourse?.id ?? null,
          notes: result.recommendationSummary?.trim() || null,
        });

        existingKeys.add(recommendationKey);
      }
    }

    const synced = await performanceRepository.findDevelopmentRecommendations(periodId);
    await this.logAudit(context, 'SYNC_DEVELOPMENT_RECOMMENDATION', 'performance-period', periodId, undefined, {
      strategy: data.strategy,
      recommendationCount: synced.length,
    });
    return synced;
  }

  async assignPerformanceDevelopmentRecommendation(
    id: string,
    data: AssignPerformanceDevelopmentRecommendationDTO,
    context: PerformanceAuditContext
  ) {
    const current = await performanceRepository.findDevelopmentRecommendationById(id);
    if (!current) {
      throw new NotFoundError('Performance development recommendation not found');
    }

    const course = await performanceRepository.findTrainingCourseById(data.courseId);
    if (!course || course.companyId !== current.companyId || !course.isActive) {
      throw new NotFoundError('Training course not found');
    }

    const existingEnrollment = await performanceRepository.findActiveTrainingEnrollment(
      course.id,
      current.employeeId,
      current.companyId
    );
    const enrollment = existingEnrollment ?? await performanceRepository.createTrainingEnrollment({
      courseId: course.id,
      employeeId: current.employeeId,
      companyId: current.companyId,
      notes: data.notes?.trim(),
    });

    const updated = await performanceRepository.assignDevelopmentRecommendation(id, {
      ...data,
      notes: data.notes?.trim(),
      companyId: current.companyId,
      employeeId: current.employeeId,
      assignedById: context.employeeId,
      enrollmentId: enrollment.id,
    });

    await this.notifyEmployeeTargets(
      current.companyId,
      [current.employeeId],
      {
        title: 'Development recommendation assigned',
        message: `${course.title} sudah ditautkan ke recommendation performance Anda.`,
        type: 'INFO',
        resource: 'performance-development-recommendation',
        action: 'assigned',
        referenceId: id,
      }
    );

    await this.logAudit(context, 'ASSIGN_DEVELOPMENT_RECOMMENDATION', 'performance-development-recommendation', id, current, updated);
    return updated;
  }

  async getPerformanceResultDashboard(periodId: string) {
    const period = await this.findPeriodById(periodId);
    const workspace = await performanceRepository.findPlanningWorkspace(periodId);
    const results = await performanceRepository.findResultsByPeriod(periodId);

    const assignments = workspace?.planningAssignments ?? [];
    const completedAssignments = assignments.filter((assignment) => ['COMPLETED', 'APPROVED'].includes(assignment.status)).length;
    const completionRate = assignments.length ? Math.round((completedAssignments / assignments.length) * 100) : 0;
    const averageScore = results.length
      ? this.roundScore(results.reduce((sum, result) => sum + Number(result.finalScore ?? 0), 0) / results.length, 'ROUND', 2)
      : 0;

    const scoreDistribution = results.reduce<Record<string, number>>((acc, result) => {
      const key = result.gradeLabel || result.gradeCode || 'UNMAPPED';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const openDisputes = results.reduce(
      (sum, result) => sum + result.disputes.filter((dispute) => ['OPEN', 'RESPONDED'].includes(dispute.status)).length,
      0
    );

    const departmentComparison = Object.values(results.reduce<Record<string, { departmentName: string; totalScore: number; count: number }>>((acc, result) => {
      const departmentName = result.employee?.department?.name || 'No Department';
      if (!acc[departmentName]) {
        acc[departmentName] = {
          departmentName,
          totalScore: 0,
          count: 0,
        };
      }

      acc[departmentName].totalScore += Number(result.finalScore ?? 0);
      acc[departmentName].count += 1;
      return acc;
    }, {})).map((item) => ({
      departmentName: item.departmentName,
      averageScore: this.roundScore(item.count ? item.totalScore / item.count : 0, 'ROUND', 2),
      employeeCount: item.count,
    })).sort((a, b) => b.averageScore - a.averageScore);

    const rankedResults = [...results]
      .sort((a, b) => Number(b.finalScore ?? 0) - Number(a.finalScore ?? 0))
      .map((result) => ({
        id: result.id,
        employeeId: result.employeeId,
        employeeName: result.employee?.fullName || '-',
        employeeNumber: result.employee?.employeeNumber || '-',
        departmentName: result.employee?.department?.name || 'No Department',
        finalScore: Number(result.finalScore ?? 0),
        gradeLabel: result.gradeLabel || result.gradeCode || '-',
      }));

    return {
      period: {
        id: period.id,
        name: period.name,
        code: period.code,
      },
      widgets: {
        completionRate,
        averageScore,
        scoreDistribution,
        resultCount: results.length,
        publishedResultCount: results.filter((result) => result.status === 'PUBLISHED').length,
        openDisputeCount: openDisputes,
        pendingFinalApprovalCount: results.filter((result) => !result.finalApprovedAt).length,
        pendingAcknowledgmentCount: results.filter((result) => result.status === 'PUBLISHED' && !result.acknowledgedAt).length,
        reminderPendingCount: results.filter((result) => result.status === 'PUBLISHED' && !result.acknowledgedAt).length,
      },
      departmentComparison,
      topPerformers: rankedResults.slice(0, 5),
      bottomPerformers: rankedResults.slice(-5).reverse(),
    };
  }

  async calculatePerformanceResults(periodId: string, context: PerformanceAuditContext) {
    const period = await this.findPeriodById(periodId);
    this.ensureExecutionWorkspaceAvailable(period as any);

    if (!period.methodVersion.gradeRule) {
      throw new BadRequestError('Published method version must have grade rule before calculation');
    }

    const workspace = await performanceRepository.findPlanningWorkspace(periodId);
    const eligibleAssignments = (workspace?.planningAssignments ?? []).filter((assignment) =>
      ['APPROVED', 'COMPLETED'].includes(assignment.status)
    );

    if (!eligibleAssignments.length) {
      throw new BadRequestError('No approved or completed execution assignments are ready for calculation');
    }

    const results = [];
    for (const assignment of eligibleAssignments) {
      const detail = await performanceRepository.findPlanningAssignmentById(assignment.id);
      if (!detail) {
        throw new NotFoundError('Performance planning assignment not found');
      }

      const calculation = this.buildPerformanceCalculation(period, detail);
      const result = await performanceRepository.upsertPerformanceResult({
        companyId: detail.companyId,
        periodId: detail.periodId,
        assignmentId: detail.id,
        methodId: detail.methodId,
        methodVersionId: detail.methodVersionId,
        employeeId: detail.employeeId,
        reviewerId: detail.reviewerId ?? undefined,
        approverId: detail.approverId ?? undefined,
        status: 'CALCULATED',
        rawScore: calculation.rawScore,
        normalizedScore: calculation.normalizedScore,
        weightedScore: calculation.weightedScore,
        finalScore: calculation.finalScore,
        gradeCode: calculation.gradeCode ?? undefined,
        gradeLabel: calculation.gradeLabel ?? undefined,
        recommendationSummary: calculation.recommendationSummary ?? undefined,
        recommendationRules: calculation.recommendationRules as any,
        calculationVersion: 1,
        calculationSnapshot: calculation.calculationSnapshot as any,
        calculatedAt: new Date(),
      });

      await this.logAudit(context, 'CALCULATE', 'performance-result', result.id, undefined, result);
      results.push(result);
    }

    return performanceRepository.findResultsByPeriod(periodId);
  }

  async publishPerformanceResults(
    periodId: string,
    data: PublishPerformanceResultsDTO,
    context: PerformanceAuditContext
  ) {
    const period = await this.findPeriodById(periodId);
    this.ensureExecutionWorkspaceAvailable(period as any);

    const results = await performanceRepository.findResultsByPeriod(periodId);
    if (!results.length) {
      throw new BadRequestError('No performance results available to publish');
    }

    const sessions = await performanceRepository.findCalibrationSessions(periodId);
    if (sessions.some((session) => session.status !== 'FINALIZED')) {
      throw new BadRequestError('Finalize all calibration sessions before publishing results');
    }

    const pendingApproval = results.filter((result) => !result.finalApprovedAt);
    if (pendingApproval.length > 0) {
      throw new BadRequestError('Final approve all performance results before publishing');
    }

    const published = await performanceRepository.publishPerformanceResults(periodId, context.employeeId, {
      ...data,
      notes: data.notes?.trim(),
    });

    await this.notifyEmployeeTargets(
      period.companyId,
      published.map((result) => result.employeeId),
      {
        title: `Performance result ${period.name} sudah dipublish`,
        message: 'Hasil performance Anda sudah tersedia untuk dilihat dan di-acknowledge.',
        type: 'SUCCESS',
        resource: 'performance-result',
        action: 'published',
        referenceId: periodId,
      }
    );

    await this.logAudit(context, 'PUBLISH_RESULT', 'performance-result-period', periodId, results, published);
    return published;
  }

  async approvePerformanceResults(
    periodId: string,
    data: ApprovePerformanceResultsDTO,
    context: PerformanceAuditContext
  ) {
    await this.findPeriodById(periodId);
    const results = await performanceRepository.findResultsByPeriod(periodId);
    if (!results.length) {
      throw new BadRequestError('No performance results available to approve');
    }

    const approvalBlocked = results.filter((result) => !['FINALIZED', 'PUBLISHED'].includes(result.status));
    if (approvalBlocked.length > 0) {
      throw new BadRequestError('Only finalized results can be sent to final approval');
    }

    const approved = await performanceRepository.approvePerformanceResults(periodId, context.employeeId, {
      notes: data.notes?.trim(),
    });

    await this.notifyEmployeeTargets(
      results[0]?.companyId || context.companyId || '',
      approved.map((result) => result.employeeId),
      {
        title: `Performance result ${approved[0]?.period?.name || ''} sudah final approved`,
        message: 'Hasil Anda sudah lolos final approval dan siap dipublish.',
        type: 'INFO',
        resource: 'performance-result',
        action: 'final-approved',
        referenceId: periodId,
      }
    );

    await this.logAudit(context, 'FINAL_APPROVE', 'performance-result-period', periodId, results, approved);
    return approved;
  }

  async getMyPublishedResults(companyId: string, context: PerformanceAuditContext) {
    const employeeId = this.ensureExecutionActor(context);
    const results = await performanceRepository.findPublishedResultsByEmployee(companyId, employeeId);
    return results.map((result) => this.sanitizePublishedResultForEmployee(result as any));
  }

  async uploadPerformanceResultAttachment(
    id: string,
    file: Express.Multer.File | undefined,
    input: PerformanceAttachmentUploadInput,
    context: PerformanceAuditContext
  ) {
    if (!file) {
      throw new BadRequestError('Attachment file is required');
    }

    const current = await performanceRepository.findResultById(id);
    if (!current) {
      throw new NotFoundError('Performance result not found');
    }

    const actorId = this.ensureExecutionActor(context);
    const canUpload =
      current.employeeId === actorId ||
      current.reviewerId === actorId ||
      current.approverId === actorId ||
      current.publishedById === actorId;

    if (!canUpload) {
      throw new ForbiddenError('You are not allowed to upload result attachment');
    }

    const category = await this.ensurePerformanceAttachmentCategory(current.companyId);
    const document = await performanceRepository.createManagedDocument({
      companyId: current.companyId,
      categoryId: category.id,
      employeeId: current.employeeId,
      uploadedBy: context.userId,
      title: input.title?.trim() || `${current.period.name} Result Attachment - ${file.originalname}`,
      description: input.description?.trim() || undefined,
      visibility: input.visibility ?? 'RESTRICTED',
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    const attachment = await performanceRepository.createPerformanceResultAttachment({
      companyId: current.companyId,
      resultId: id,
      documentId: document.id,
      attachmentType: 'RESULT',
      createdById: context.employeeId,
    });

    await this.logAudit(context, 'UPLOAD_ATTACHMENT', 'performance-result', id, undefined, attachment);
    return attachment;
  }

  async acknowledgePerformanceResult(
    id: string,
    data: AcknowledgePerformanceResultDTO,
    context: PerformanceAuditContext
  ) {
    const employeeId = this.ensureExecutionActor(context);
    const current = await performanceRepository.findResultById(id);
    if (!current) {
      throw new NotFoundError('Performance result not found');
    }

    if (current.employeeId !== employeeId) {
      throw new ForbiddenError('You can only acknowledge your own performance result');
    }

    if (current.status !== 'PUBLISHED' || !current.publishedAt) {
      throw new BadRequestError('Performance result is not published yet');
    }

    const acknowledged = await performanceRepository.acknowledgePerformanceResult(id, data);
    await this.notifyEmployeeTargets(
      current.companyId,
      [current.reviewerId, current.approverId, current.publishedById],
      {
        title: `${current.employee.fullName} sudah acknowledge result`,
        message: `${current.period.name} telah di-acknowledge oleh employee.`,
        type: 'SUCCESS',
        resource: 'performance-result',
        action: 'acknowledged',
        referenceId: current.id,
      }
    );
    await this.logAudit(context, 'ACKNOWLEDGE', 'performance-result', id, current, acknowledged);
    return this.sanitizePublishedResultForEmployee(acknowledged as any);
  }

  async createPerformanceResultDispute(
    id: string,
    data: CreatePerformanceResultDisputeDTO,
    context: PerformanceAuditContext
  ) {
    const employeeId = this.ensureExecutionActor(context);
    const result = await performanceRepository.findResultById(id);
    if (!result) {
      throw new NotFoundError('Performance result not found');
    }

    if (result.employeeId !== employeeId) {
      throw new ForbiddenError('You can only dispute your own performance result');
    }

    if (result.status !== 'PUBLISHED' || !result.publishedAt) {
      throw new BadRequestError('Performance result is not published yet');
    }

    if (result.disputeDeadline && new Date(result.disputeDeadline) < new Date()) {
      throw new BadRequestError('Dispute window has closed for this performance result');
    }

    const dispute = await performanceRepository.createPerformanceResultDispute(id, result.companyId, employeeId, {
      title: data.title.trim(),
      message: data.message.trim(),
    });

    await this.notifyEmployeeTargets(
      result.companyId,
      [result.reviewerId, result.approverId, result.publishedById],
      {
        title: `Dispute baru untuk ${result.period.name}`,
        message: `${result.employee.fullName} mengajukan dispute: ${data.title.trim()}`,
        type: 'WARNING',
        resource: 'performance-result-dispute',
        action: 'created',
        referenceId: dispute.id,
      }
    );

    await this.logAudit(context, 'CREATE_DISPUTE', 'performance-result-dispute', dispute.id, undefined, dispute);
    return dispute;
  }

  async uploadPerformanceDisputeAttachment(
    id: string,
    file: Express.Multer.File | undefined,
    input: PerformanceAttachmentUploadInput,
    context: PerformanceAuditContext
  ) {
    if (!file) {
      throw new BadRequestError('Attachment file is required');
    }

    const current = await performanceRepository.findPerformanceResultDisputeById(id);
    if (!current) {
      throw new NotFoundError('Performance result dispute not found');
    }

    const actorId = this.ensureExecutionActor(context);
    const canUpload =
      current.employeeId === actorId ||
      current.result.reviewerId === actorId ||
      current.result.approverId === actorId ||
      current.result.publishedById === actorId;

    if (!canUpload) {
      throw new ForbiddenError('You are not allowed to upload dispute attachment');
    }

    const category = await this.ensurePerformanceAttachmentCategory(current.result.companyId);
    const document = await performanceRepository.createManagedDocument({
      companyId: current.result.companyId,
      categoryId: category.id,
      employeeId: current.employeeId,
      uploadedBy: context.userId,
      title: input.title?.trim() || `${current.result.period.name} Dispute Attachment - ${file.originalname}`,
      description: input.description?.trim() || undefined,
      visibility: input.visibility ?? 'RESTRICTED',
      fileName: file.originalname,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    const attachment = await performanceRepository.createPerformanceResultAttachment({
      companyId: current.result.companyId,
      disputeId: id,
      documentId: document.id,
      attachmentType: 'DISPUTE',
      createdById: context.employeeId,
    });

    await this.logAudit(context, 'UPLOAD_ATTACHMENT', 'performance-result-dispute', id, undefined, attachment);
    return attachment;
  }

  async respondPerformanceResultDispute(
    id: string,
    data: RespondPerformanceResultDisputeDTO,
    context: PerformanceAuditContext
  ) {
    const current = await performanceRepository.findPerformanceResultDisputeById(id);
    if (!current) {
      throw new NotFoundError('Performance result dispute not found');
    }

    const employeeId = this.ensureExecutionActor(context);
    const canRespond =
      current.result.reviewerId === employeeId ||
      current.result.approverId === employeeId ||
      current.result.publishedById === employeeId;

    if (!canRespond) {
      throw new ForbiddenError('You are not allowed to respond to this dispute');
    }

    const updated = await performanceRepository.respondPerformanceResultDispute(id, context.employeeId, {
      response: data.response.trim(),
      status: data.status,
    });

    await this.notifyEmployeeTargets(
      current.result.companyId,
      [current.employeeId],
      {
        title: `Dispute ${current.result.period.name} ditanggapi`,
        message: `Status dispute Anda sekarang ${data.status}.`,
        type: data.status === 'REJECTED' ? 'WARNING' : 'INFO',
        resource: 'performance-result-dispute',
        action: 'responded',
        referenceId: id,
      }
    );

    await this.logAudit(context, 'RESPOND_DISPUTE', 'performance-result-dispute', id, current, updated);
    return updated;
  }

  async reopenPerformanceResult(
    id: string,
    data: ReopenPerformanceResultDTO,
    context: PerformanceAuditContext
  ) {
    const current = await performanceRepository.findResultById(id);
    if (!current) {
      throw new NotFoundError('Performance result not found');
    }

    if (!['FINALIZED', 'PUBLISHED'].includes(current.status)) {
      throw new BadRequestError('Only finalized or published results can be reopened');
    }

    const reopened = await performanceRepository.reopenPerformanceResult(id, context.employeeId, {
      reason: data.reason.trim(),
    });

    await this.notifyEmployeeTargets(
      current.companyId,
      [current.employeeId, current.reviewerId, current.approverId],
      {
        title: `Performance result ${current.period.name} dibuka ulang`,
        message: data.reason.trim(),
        type: 'WARNING',
        resource: 'performance-result',
        action: 'reopened',
        referenceId: id,
      }
    );

    await this.logAudit(context, 'REOPEN', 'performance-result', id, current, reopened);
    return reopened;
  }

  async sendPerformanceResultReminders(
    periodId: string,
    data: SendPerformanceResultRemindersDTO,
    context: PerformanceAuditContext
  ) {
    const summary = await this.dispatchPerformanceResultReminders(periodId, data);
    await this.logAudit(context, 'SEND_REMINDER', 'performance-result-period', periodId, undefined, {
      target: data.target,
      totalTargets: summary.remindedResultCount,
      notifications: summary.notificationCount,
    });
    return summary;
  }

  async getAutomationSchedules(periodId: string) {
    await this.findPeriodById(periodId);
    return performanceRepository.findAutomationSchedules(periodId);
  }

  async createAutomationSchedule(
    periodId: string,
    data: CreatePerformanceAutomationScheduleDTO,
    context: PerformanceAuditContext
  ) {
    const period = await this.findPeriodById(periodId);
    const queueJobId = `performance-automation:${periodId}:${Date.now()}`;
    const created = await performanceRepository.createAutomationSchedule(
      periodId,
      period.companyId,
      context.employeeId,
      {
        ...data,
        notes: data.notes?.trim(),
        queueJobId,
      }
    );

    await this.enqueuePerformanceAutomationJob(created.id, queueJobId, data.cadenceHours);
    await this.logAudit(context, 'CREATE_AUTOMATION_SCHEDULE', 'performance-automation-schedule', created.id, undefined, created);
    return created;
  }

  async runPerformanceAutomationSchedule(id: string) {
    const schedule = await performanceRepository.findAutomationScheduleById(id);
    if (!schedule) {
      throw new NotFoundError('Performance automation schedule not found');
    }

    if (!schedule.isActive) {
      throw new BadRequestError('Performance automation schedule is inactive');
    }

    const summary = await this.dispatchPerformanceResultReminders(schedule.periodId, {
      target: schedule.reminderTarget as SendPerformanceResultRemindersDTO['target'],
      notes: schedule.notes ?? undefined,
    });

    await performanceRepository.markAutomationScheduleRun(id, schedule.cadenceHours);
    logger.info('Performance automation schedule executed', {
      scheduleId: id,
      periodId: schedule.periodId,
      remindedResultCount: summary.remindedResultCount,
      notificationCount: summary.notificationCount,
    });

    return {
      scheduleId: id,
      ...summary,
    };
  }

  async getCalibrationSessions(periodId: string) {
    await this.findPeriodById(periodId);
    return performanceRepository.findCalibrationSessions(periodId);
  }

  async createCalibrationSession(
    periodId: string,
    data: CreatePerformanceCalibrationSessionDTO,
    context: PerformanceAuditContext
  ) {
    const period = await this.findPeriodById(periodId);
    this.ensureExecutionWorkspaceAvailable(period as any);

    const results = await performanceRepository.findResultsByPeriod(periodId);
    if (!results.length) {
      throw new BadRequestError('Calculate performance results before creating calibration session');
    }

    const existingSessions = await performanceRepository.findCalibrationSessions(periodId);
    if (existingSessions.some((session) => session.code.trim().toLowerCase() === data.code.trim().toLowerCase())) {
      throw new ConflictError('Calibration session code already exists for this period');
    }

    const created = await performanceRepository.createCalibrationSession(
      periodId,
      period.companyId,
      context.employeeId,
      {
        ...data,
        name: data.name.trim(),
        code: this.normalizeCode(data.code),
        notes: data.notes?.trim(),
      },
      results.map((result) => result.id)
    );

    await this.logAudit(context, 'CREATE', 'performance-calibration-session', created.id, undefined, created);
    return created;
  }

  async openCalibrationSession(id: string, context: PerformanceAuditContext) {
    const current = await performanceRepository.findCalibrationSessionById(id);
    if (!current) {
      throw new NotFoundError('Performance calibration session not found');
    }

    if (!['DRAFT', 'CLOSED'].includes(current.status)) {
      throw new BadRequestError('Calibration session can only be opened from draft or closed state');
    }

    const opened = await performanceRepository.openCalibrationSession(id);
    await this.logAudit(context, 'OPEN', 'performance-calibration-session', id, current, opened);
    return opened;
  }

  async closeCalibrationSession(id: string, context: PerformanceAuditContext) {
    const current = await performanceRepository.findCalibrationSessionById(id);
    if (!current) {
      throw new NotFoundError('Performance calibration session not found');
    }

    if (current.status !== 'OPEN') {
      throw new BadRequestError('Only open calibration session can be closed');
    }

    const closed = await performanceRepository.updateCalibrationSession(id, {
      status: 'CLOSED',
      closedAt: new Date(),
    } as any);

    await this.logAudit(context, 'CLOSE', 'performance-calibration-session', id, current, closed);
    return closed;
  }

  async finalizeCalibrationSession(id: string, context: PerformanceAuditContext) {
    const current = await performanceRepository.findCalibrationSessionById(id);
    if (!current) {
      throw new NotFoundError('Performance calibration session not found');
    }

    if (!['OPEN', 'CLOSED'].includes(current.status)) {
      throw new BadRequestError('Calibration session can only be finalized from open or closed state');
    }

    const finalized = await performanceRepository.finalizeCalibrationSession(id);
    await this.logAudit(context, 'FINALIZE', 'performance-calibration-session', id, current, finalized);
    return finalized;
  }

  async applyCalibrationDecision(id: string, data: PerformanceCalibrationDecisionDTO, context: PerformanceAuditContext) {
    const participant = await performanceRepository.findCalibrationParticipantById(id);
    if (!participant) {
      throw new NotFoundError('Performance calibration participant not found');
    }

    if (participant.session.status !== 'OPEN') {
      throw new BadRequestError('Calibration decision can only be applied in open session');
    }

    const period = await this.findPeriodById(participant.session.periodId);
    if (!period.methodVersion.gradeRule) {
      throw new BadRequestError('Method version grade rule is required');
    }

    const grade = this.mapGradeResult(data.finalScore, period.methodVersion.gradeRule);
    const updated = await performanceRepository.applyCalibrationDecision(
      id,
      participant.companyId,
      context.employeeId,
      {
        ...data,
        reason: data.reason.trim(),
        finalGradeCode: grade.gradeCode ?? undefined,
        finalGradeLabel: grade.gradeLabel ?? undefined,
        recommendationSummary: grade.recommendationSummary ?? undefined,
        recommendationRules: grade.recommendationRules as any,
        calibrationSnapshot: {
          calibratedAt: new Date().toISOString(),
          sessionId: participant.sessionId,
          sessionName: participant.session.name,
          before: {
            score: participant.result.finalScore === null ? null : Number(participant.result.finalScore),
            gradeCode: participant.result.gradeCode,
            gradeLabel: participant.result.gradeLabel,
          },
          after: {
            score: data.finalScore,
            gradeCode: grade.gradeCode,
            gradeLabel: grade.gradeLabel,
          },
          reason: data.reason.trim(),
          recommendationRules: grade.recommendationRules,
        } as any,
      }
    );

    await this.logAudit(context, 'CALIBRATE', 'performance-calibration-participant', id, participant, updated);
    return updated;
  }

  async findAllCycles(companyId: string) {
    return performanceRepository.findAllCycles(companyId);
  }

  async createCycle(data: CreateReviewCycleDTO) {
    return performanceRepository.createCycle(data);
  }

  async findAllReviews(companyId: string, filters?: { employeeId?: string; cycleId?: string; status?: string }) {
    return performanceRepository.findAllReviews(companyId, filters);
  }

  async findReviewById(id: string) {
    const review = await performanceRepository.findReviewById(id);
    if (!review) throw new NotFoundError('Review not found');
    return review;
  }

  async createReview(data: CreateReviewDTO) {
    const review = await performanceRepository.createReview(data);
    logger.info('Performance review created', { reviewId: review.id });
    return review;
  }

  async submitReview(id: string) {
    await this.findReviewById(id);
    return performanceRepository.updateReview(id, { status: 'SUBMITTED' as any, submittedAt: new Date() });
  }

  async approveReview(id: string) {
    await this.findReviewById(id);
    return performanceRepository.updateReview(id, { status: 'APPROVED' as any, completedAt: new Date() });
  }

  async findAllGoals(companyId: string, employeeId?: string) {
    return performanceRepository.findAllGoals(companyId, employeeId);
  }

  async createGoal(data: CreateGoalDTO) {
    return performanceRepository.createGoal(data);
  }

  async updateGoalProgress(id: string, data: UpdateGoalProgressDTO) {
    return performanceRepository.addGoalUpdate(id, data.progress, data.note);
  }

  async getFeedbackRequests(companyId: string, recipientId?: string) {
    return performanceRepository.findAllFeedbackRequests(companyId, recipientId);
  }

  async requestFeedback(data: CreateFeedbackRequestDTO) {
    return performanceRepository.createFeedbackRequest(data);
  }

  async submitFeedback(data: CreateFeedbackResponseDTO) {
    const request = await performanceRepository.createFeedbackResponse(data);
    await performanceRepository.createFeedbackRequest({ ...data as any, requesterId: data.requestId, recipientId: data.requestId });
    return request;
  }
}

export const performanceService = new PerformanceService();
