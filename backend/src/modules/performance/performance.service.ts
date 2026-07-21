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
  CreatePerformanceFormulaDTO,
  UpdatePerformanceFormulaDTO,
  CreatePerformanceIndicatorDTO,
  UpdatePerformanceIndicatorDTO,
  CreatePerformanceGradeRuleDTO,
  UpdatePerformanceGradeRuleDTO,
  PerformanceGradeRangeDTO,
  CreatePerformanceWorkflowTemplateDTO,
  UpdatePerformanceWorkflowTemplateDTO,
  PerformanceWorkflowStageDTO,
} from './performance.dto';
import { NotFoundError, BadRequestError, ConflictError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { createAuditLog } from '@/shared/middleware/AuditLog';

interface PerformanceAuditContext {
  userId: string;
  companyId?: string;
  ipAddress?: string;
  userAgent?: string;
}

interface MethodVersionReadinessSource {
  status: string;
  gradeRuleId?: string | null;
  reviewWorkflowTemplateId?: string | null;
  approvalWorkflowTemplateId?: string | null;
  minimumScore: unknown;
  maximumScore: unknown;
  components: Array<{ weight: unknown }>;
}

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

    if (Math.abs(totalWeight - 100) > 0.001) {
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

    const created = await performanceRepository.createGradeRule({
      ...data,
      code,
      name: data.name.trim(),
      description: data.description?.trim() || undefined,
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

    const updated = await performanceRepository.updateGradeRule(id, {
      ...data,
      name: data.name?.trim(),
      description: data.description?.trim() || undefined,
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
