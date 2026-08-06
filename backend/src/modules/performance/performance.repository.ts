import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import {
  CreateReviewCycleDTO,
  CreateReviewDTO,
  CreateGoalDTO,
  CreateFeedbackRequestDTO,
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
  CreatePerformancePlanningTargetDTO,
  UpdatePerformancePlanningTargetDTO,
  CreatePerformanceTargetProgressDTO,
  CreatePerformanceCalibrationSessionDTO,
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
  PerformanceCalibrationDecisionDTO,
  CreatePerformanceWorkflowTemplateDTO,
  UpdatePerformanceWorkflowTemplateDTO,
  PerformanceWorkflowStageDTO,
} from './performance.dto';

function mapWorkflowStageCreate(stage: PerformanceWorkflowStageDTO) {
  return {
    name: stage.name,
    level: stage.level,
    approverType: stage.approverType,
    approverRoleCode: stage.approverRoleCode,
    approverId: stage.approverId,
    backupApproverRoleCode: stage.backupApproverRoleCode,
    backupApproverId: stage.backupApproverId,
    slaHours: stage.slaHours,
    allowEscalation: stage.allowEscalation,
    conditionRules: {
      create: stage.conditionRules.map((rule) => ({
        field: rule.field,
        operator: rule.operator,
        value: rule.value,
      })),
    },
  };
}

export class PerformanceRepository {
  // ==================== Configuration: Methods ====================
  async findAllMethods(companyId: string) {
    return prisma.performanceMethod.findMany({
      where: { companyId, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            gradeRule: {
              include: {
                ranges: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            reviewWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            approvalWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            _count: {
              select: {
                components: true,
                periods: true,
              },
            },
          },
        },
        _count: {
          select: {
            versions: true,
            periods: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findMethodById(id: string) {
    return prisma.performanceMethod.findFirst({
      where: { id, deletedAt: null },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            gradeRule: {
              include: {
                ranges: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            reviewWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            approvalWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            components: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        periods: {
          where: { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
      },
    });
  }

  async findMethodByCompanyAndCode(companyId: string, code: string) {
    return prisma.performanceMethod.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
      },
    });
  }

  async createMethod(data: CreatePerformanceMethodDTO & { code: string }) {
    return prisma.performanceMethod.create({
      data,
    });
  }

  async updateMethod(id: string, data: UpdatePerformanceMethodDTO & { status?: Prisma.EnumPerformanceMethodStatusFieldUpdateOperationsInput | any }) {
    return prisma.performanceMethod.update({
      where: { id },
      data,
    });
  }

  async findLatestMethodVersion(methodId: string) {
    return prisma.performanceMethodVersion.findFirst({
      where: { methodId },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async findMethodVersions(methodId: string) {
    return prisma.performanceMethodVersion.findMany({
      where: { methodId },
      include: {
        components: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            periods: true,
          },
        },
      },
      orderBy: { versionNumber: 'desc' },
    });
  }

  async findMethodVersionById(id: string) {
    return prisma.performanceMethodVersion.findUnique({
      where: { id },
      include: {
        method: true,
        gradeRule: {
          include: {
            ranges: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        reviewWorkflowTemplate: {
          include: {
            stages: {
              orderBy: { level: 'asc' },
              include: { conditionRules: true },
            },
          },
        },
        approvalWorkflowTemplate: {
          include: {
            stages: {
              orderBy: { level: 'asc' },
              include: { conditionRules: true },
            },
          },
        },
        components: {
          orderBy: { sortOrder: 'asc' },
        },
        periods: {
          where: { deletedAt: null },
          orderBy: { startDate: 'desc' },
        },
      },
    });
  }

  async createMethodVersion(
    methodId: string,
    companyId: string,
    versionNumber: number,
    data: CreatePerformanceMethodVersionDTO
  ) {
    return prisma.performanceMethodVersion.create({
      data: {
        methodId,
        companyId,
        versionNumber,
        summary: data.summary,
        weightMode: data.weightMode as any,
        scoreAggregation: data.scoreAggregation as any,
        minimumScore: data.minimumScore,
        maximumScore: data.maximumScore,
        gradeRuleId: data.gradeRuleId,
        reviewWorkflowTemplateId: data.reviewWorkflowTemplateId,
        approvalWorkflowTemplateId: data.approvalWorkflowTemplateId,
        normalizationRule: data.normalizationRule,
      },
    });
  }

  async updateMethodVersion(
    id: string,
    data: UpdatePerformanceMethodVersionDTO & {
      status?: Prisma.EnumPerformanceMethodVersionStatusFieldUpdateOperationsInput | any;
      publishedAt?: Date | null;
    }
  ) {
    return prisma.performanceMethodVersion.update({
      where: { id },
      data: {
        ...data,
        weightMode: data.weightMode as any,
        gradeRuleId: data.gradeRuleId,
        reviewWorkflowTemplateId: data.reviewWorkflowTemplateId,
        approvalWorkflowTemplateId: data.approvalWorkflowTemplateId,
      },
    });
  }

  // ==================== Configuration: Workflow Templates ====================
  async findWorkflowTemplates(companyId: string, approvalType: 'PERFORMANCE_REVIEW' | 'PERFORMANCE_APPROVAL') {
    return prisma.workflowTemplate.findMany({
      where: {
        companyId,
        approvalType,
        resource: 'performance',
      },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
        _count: {
          select: {
            instances: true,
            reviewMethodVersions: true,
            approvalMethodVersions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findWorkflowTemplateById(id: string) {
    return prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
        _count: {
          select: {
            instances: true,
            reviewMethodVersions: true,
            approvalMethodVersions: true,
          },
        },
      },
    });
  }

  async findWorkflowTemplateByCompanyAndName(
    companyId: string,
    approvalType: 'PERFORMANCE_REVIEW' | 'PERFORMANCE_APPROVAL',
    name: string
  ) {
    return prisma.workflowTemplate.findFirst({
      where: {
        companyId,
        approvalType,
        resource: 'performance',
        name,
      },
    });
  }

  async createWorkflowTemplate(
    approvalType: 'PERFORMANCE_REVIEW' | 'PERFORMANCE_APPROVAL',
    data: CreatePerformanceWorkflowTemplateDTO
  ) {
    return prisma.workflowTemplate.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        approvalType,
        resource: 'performance',
        description: data.description,
        isActive: data.isActive ?? true,
        stages: {
          create: data.stages.map(mapWorkflowStageCreate),
        },
      },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
        _count: {
          select: {
            instances: true,
            reviewMethodVersions: true,
            approvalMethodVersions: true,
          },
        },
      },
    });
  }

  async updateWorkflowTemplate(id: string, data: UpdatePerformanceWorkflowTemplateDTO) {
    return prisma.$transaction(async (tx) => {
      if (data.stages) {
        await tx.workflowConditionRule.deleteMany({
          where: {
            stage: {
              templateId: id,
            },
          },
        });
        await tx.workflowStage.deleteMany({
          where: { templateId: id },
        });
      }

      return tx.workflowTemplate.update({
        where: { id },
        data: {
          companyId: data.companyId,
          name: data.name,
          description: data.description,
          isActive: data.isActive,
          ...(data.stages
            ? {
                stages: {
                  create: data.stages.map(mapWorkflowStageCreate),
                },
              }
            : {}),
        },
        include: {
          stages: {
            orderBy: { level: 'asc' },
            include: { conditionRules: true },
          },
          _count: {
            select: {
              instances: true,
              reviewMethodVersions: true,
              approvalMethodVersions: true,
            },
          },
        },
      });
    });
  }

  // ==================== Configuration: Formulas ====================
  async findAllFormulas(companyId: string) {
    return prisma.performanceFormula.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findFormulaById(id: string) {
    return prisma.performanceFormula.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: {
          select: {
            indicators: true,
          },
        },
      },
    });
  }

  async findFormulaByCompanyAndCode(companyId: string, code: string) {
    return prisma.performanceFormula.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createFormula(data: CreatePerformanceFormulaDTO & { code: string }) {
    return prisma.performanceFormula.create({
      data: {
        ...data,
        strategy: data.strategy as any,
        roundingMode: data.roundingMode as any,
      },
    });
  }

  async updateFormula(id: string, data: UpdatePerformanceFormulaDTO) {
    return prisma.performanceFormula.update({
      where: { id },
      data: {
        ...data,
        strategy: data.strategy as any,
        roundingMode: data.roundingMode as any,
      },
    });
  }

  // ==================== Configuration: Indicators ====================
  async findAllIndicators(companyId: string) {
    return prisma.performanceIndicator.findMany({
      where: { companyId, deletedAt: null },
      include: {
        formula: true,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findIndicatorById(id: string) {
    return prisma.performanceIndicator.findFirst({
      where: { id, deletedAt: null },
      include: {
        formula: true,
      },
    });
  }

  async findIndicatorByCompanyAndCode(companyId: string, code: string) {
    return prisma.performanceIndicator.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createIndicator(data: CreatePerformanceIndicatorDTO & { code: string }) {
    return prisma.performanceIndicator.create({
      data: {
        ...data,
        measurementType: data.measurementType as any,
        targetType: data.targetType as any,
        direction: data.direction as any,
      },
      include: {
        formula: true,
      },
    });
  }

  async updateIndicator(id: string, data: UpdatePerformanceIndicatorDTO) {
    return prisma.performanceIndicator.update({
      where: { id },
      data: {
        ...data,
        measurementType: data.measurementType as any,
        targetType: data.targetType as any,
        direction: data.direction as any,
      },
      include: {
        formula: true,
      },
    });
  }

  // ==================== Configuration: Grade Rules ====================
  async findAllGradeRules(companyId: string) {
    return prisma.performanceGradeRule.findMany({
      where: { companyId, deletedAt: null },
      include: {
        ranges: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            methodVersions: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findGradeRuleById(id: string) {
    return prisma.performanceGradeRule.findFirst({
      where: { id, deletedAt: null },
      include: {
        ranges: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            methodVersions: true,
          },
        },
      },
    });
  }

  async findGradeRuleByCompanyAndCode(companyId: string, code: string) {
    return prisma.performanceGradeRule.findFirst({
      where: { companyId, code, deletedAt: null },
    });
  }

  async createGradeRule(data: CreatePerformanceGradeRuleDTO & { code: string }) {
    return prisma.performanceGradeRule.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        description: data.description,
        recommendationRules: data.recommendationRules as any,
        isActive: data.isActive,
        ranges: {
          create: data.ranges.map((range) => ({
            label: range.label,
            minimum: range.minimum,
            maximum: range.maximum,
            sortOrder: range.sortOrder,
            description: range.description,
          })),
        },
      },
      include: {
        ranges: {
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            methodVersions: true,
          },
        },
      },
    });
  }

  async updateGradeRule(id: string, data: UpdatePerformanceGradeRuleDTO) {
    return prisma.$transaction(async (tx) => {
      if (data.ranges) {
        await tx.performanceGradeRange.deleteMany({
          where: { gradeRuleId: id },
        });
      }

      return tx.performanceGradeRule.update({
        where: { id },
        data: {
          name: data.name,
          code: data.code,
          description: data.description,
          recommendationRules: data.recommendationRules as any,
          isActive: data.isActive,
          ranges: data.ranges
            ? {
                create: data.ranges.map((range) => ({
                  label: range.label,
                  minimum: range.minimum,
                  maximum: range.maximum,
                  sortOrder: range.sortOrder,
                  description: range.description,
                })),
              }
            : undefined,
        },
        include: {
          ranges: {
            orderBy: { sortOrder: 'asc' },
          },
          _count: {
            select: {
              methodVersions: true,
            },
          },
        },
      });
    });
  }

  // ==================== Configuration: Components ====================
  async findComponentsByMethodVersion(methodVersionId: string) {
    return prisma.performanceComponent.findMany({
      where: { methodVersionId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findComponentById(id: string) {
    return prisma.performanceComponent.findUnique({
      where: { id },
      include: {
        methodVersion: {
          include: {
            method: true,
          },
        },
      },
    });
  }

  async createComponent(methodVersionId: string, companyId: string, data: CreatePerformanceComponentDTO & { code: string }) {
    return prisma.performanceComponent.create({
      data: {
        methodVersionId,
        companyId,
        name: data.name,
        code: data.code,
        type: data.type as any,
        description: data.description,
        weight: data.weight,
        sortOrder: data.sortOrder,
        isRequired: data.isRequired,
        config: data.config,
      },
    });
  }

  async updateComponent(id: string, data: UpdatePerformanceComponentDTO) {
    return prisma.performanceComponent.update({
      where: { id },
      data: {
        ...data,
        type: data.type as any,
      },
    });
  }

  // ==================== Configuration: Periods ====================
  async findAllPeriods(companyId: string, filters?: { methodId?: string; status?: string }) {
    const where: Prisma.PerformancePeriodWhereInput = { companyId, deletedAt: null };
    if (filters?.methodId) where.methodId = filters.methodId;
    if (filters?.status) where.status = filters.status as any;

    return prisma.performancePeriod.findMany({
      where,
      include: {
        method: true,
        methodVersion: {
          include: {
            components: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
      orderBy: { startDate: 'desc' },
    });
  }

  async findPeriodById(id: string) {
    return prisma.performancePeriod.findFirst({
      where: { id, deletedAt: null },
      include: {
        method: true,
        methodVersion: {
          include: {
            method: true,
            gradeRule: {
              include: {
                ranges: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            reviewWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            approvalWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            components: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  async findPeriodByCompanyAndCode(companyId: string, code: string) {
    return prisma.performancePeriod.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
      },
    });
  }

  async createPeriod(data: CreatePerformancePeriodDTO & { code: string }) {
    return prisma.performancePeriod.create({
      data: {
        ...data,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        reviewDeadline: data.reviewDeadline ? new Date(data.reviewDeadline) : undefined,
      },
      include: {
        method: true,
        methodVersion: true,
      },
    });
  }

  async updatePeriod(
    id: string,
    data: UpdatePerformancePeriodDTO & {
      methodId?: string;
      status?: Prisma.EnumPerformancePeriodStatusFieldUpdateOperationsInput | any;
      readinessSummary?: Prisma.InputJsonValue;
      configSnapshot?: Prisma.InputJsonValue;
      planningSummary?: Prisma.InputJsonValue;
      publishedAt?: Date | null;
      planningPublishedAt?: Date | null;
    }
  ) {
    const updateData: Prisma.PerformancePeriodUncheckedUpdateInput = {
      methodId: data.methodId,
      methodVersionId: data.methodVersionId,
      name: data.name,
      code: data.code,
      startDate: data.startDate ? new Date(data.startDate) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      reviewDeadline:
        data.reviewDeadline === undefined
          ? undefined
          : data.reviewDeadline
            ? new Date(data.reviewDeadline)
            : null,
      description: data.description,
      status: data.status,
      readinessSummary: data.readinessSummary,
      configSnapshot: data.configSnapshot,
      planningSummary: data.planningSummary,
      publishedAt: data.publishedAt,
      planningPublishedAt: data.planningPublishedAt,
    };

    return prisma.performancePeriod.update({
      where: { id },
      data: updateData,
      include: {
        method: true,
        methodVersion: {
          include: {
            gradeRule: {
              include: {
                ranges: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
            reviewWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            approvalWorkflowTemplate: {
              include: {
                stages: {
                  orderBy: { level: 'asc' },
                  include: { conditionRules: true },
                },
              },
            },
            components: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
  }

  // ==================== Planning & Assignment ====================
  async findPlanningWorkspace(periodId: string) {
    return prisma.performancePeriod.findFirst({
      where: { id: periodId, deletedAt: null },
      include: {
        method: true,
        methodVersion: {
          include: {
            components: {
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
        planningAssignments: {
          where: { deletedAt: null },
          include: {
            employee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
                email: true,
                branch: { select: { id: true, name: true } },
                department: { select: { id: true, name: true } },
                subDepartment: { select: { id: true, name: true } },
                position: { select: { id: true, name: true, reportsToId: true } },
              },
            },
            reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            targets: {
              where: { deletedAt: null },
              orderBy: { createdAt: 'asc' },
              include: {
                component: true,
                indicator: {
                  include: {
                    formula: true,
                  },
                },
                formula: true,
                reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
                approver: { select: { id: true, fullName: true, employeeNumber: true } },
                progressLogs: {
                  orderBy: { createdAt: 'desc' },
                  include: {
                    actor: { select: { id: true, fullName: true, employeeNumber: true } },
                  },
                },
                evidences: {
                  orderBy: { createdAt: 'desc' },
                  include: {
                    uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async findEmployeePlanningProfile(id: string) {
    return prisma.employee.findFirst({
      where: { id, deletedAt: null },
      include: {
        branch: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
        subDepartment: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, reportsToId: true } },
      },
    });
  }

  private readonly planningAssignmentDetailInclude = {
        period: {
          include: {
            methodVersion: {
              include: {
                components: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true, reportsToId: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        targets: {
          where: { deletedAt: null },
          include: {
            component: true,
            indicator: { include: { formula: true } },
            formula: true,
            reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true } },
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            evidences: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
  } satisfies Prisma.PerformancePlanningAssignmentInclude;

  async findPlanningAssignmentById(id: string) {
    return prisma.performancePlanningAssignment.findFirst({
      where: { id, deletedAt: null },
      include: this.planningAssignmentDetailInclude,
    });
  }

  // Task 2.2: batch-load full assignment details in one query (was N+1 in calc).
  async findPlanningAssignmentsByIds(ids: string[]) {
    return prisma.performancePlanningAssignment.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: this.planningAssignmentDetailInclude,
    });
  }

  async findPlanningAssignmentByPeriodAndEmployee(periodId: string, employeeId: string) {
    return prisma.performancePlanningAssignment.findFirst({
      where: { periodId, employeeId, deletedAt: null },
    });
  }

  async createPlanningAssignment(
    periodId: string,
    companyId: string,
    methodId: string,
    methodVersionId: string,
    data: CreatePerformancePlanningAssignmentDTO
  ) {
    return prisma.performancePlanningAssignment.create({
      data: {
        periodId,
        companyId,
        methodId,
        methodVersionId,
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        assignmentSource: data.assignmentSource as any,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        targets: {
          where: { deletedAt: null },
          include: {
            component: true,
            indicator: { include: { formula: true } },
            formula: true,
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            evidences: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
          },
        },
      },
    });
  }

  async updatePlanningAssignment(
    id: string,
    data: UpdatePerformancePlanningAssignmentDTO & {
      status?: Prisma.EnumPerformancePlanningAssignmentStatusFieldUpdateOperationsInput | any;
      employeeSnapshot?: Prisma.InputJsonValue | null;
      orgSnapshot?: Prisma.InputJsonValue | null;
      planningSnapshot?: Prisma.InputJsonValue | null;
      executionSnapshot?: Prisma.InputJsonValue | null;
      publishedAt?: Date | null;
      submittedAt?: Date | null;
      reviewedAt?: Date | null;
      completedAt?: Date | null;
      submissionNotes?: string | null;
      decisionNotes?: string | null;
      reassignmentReason?: string | null;
    }
  ) {
    return prisma.performancePlanningAssignment.update({
      where: { id },
      data: {
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        assignmentSource: data.assignmentSource as any,
        status: data.status,
        employeeSnapshot: data.employeeSnapshot === null ? Prisma.JsonNull : data.employeeSnapshot,
        orgSnapshot: data.orgSnapshot === null ? Prisma.JsonNull : data.orgSnapshot,
        planningSnapshot: data.planningSnapshot === null ? Prisma.JsonNull : data.planningSnapshot,
        executionSnapshot: data.executionSnapshot === null ? Prisma.JsonNull : data.executionSnapshot,
        publishedAt: data.publishedAt,
        submittedAt: data.submittedAt,
        reviewedAt: data.reviewedAt,
        completedAt: data.completedAt,
        submissionNotes: data.submissionNotes,
        decisionNotes: data.decisionNotes,
        reassignmentReason: data.reassignmentReason,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        targets: {
          where: { deletedAt: null },
          include: {
            component: true,
            indicator: { include: { formula: true } },
            formula: true,
            reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true } },
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            evidences: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async deletePlanningAssignment(id: string) {
    return prisma.$transaction(async (tx) => {
      await tx.performancePlanningTarget.updateMany({
        where: { assignmentId: id, deletedAt: null },
        data: { deletedAt: new Date() },
      });

      return tx.performancePlanningAssignment.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    });
  }

  async findPlanningTargetById(id: string) {
    return prisma.performancePlanningTarget.findFirst({
      where: { id, deletedAt: null },
      include: {
        assignment: {
          include: {
            period: {
              include: {
                methodVersion: {
                  include: {
                    components: {
                      orderBy: { sortOrder: 'asc' },
                    },
                  },
                },
              },
            },
          },
        },
        component: true,
        indicator: { include: { formula: true } },
        formula: true,
        reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true } },
        progressLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
        evidences: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
      },
    });
  }

  async createPlanningTarget(assignmentId: string, companyId: string, data: CreatePerformancePlanningTargetDTO) {
    return prisma.performancePlanningTarget.create({
      data: {
        assignmentId,
        companyId,
        componentId: data.componentId,
        indicatorId: data.indicatorId,
        formulaId: data.formulaId,
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        name: data.name ?? '',
        description: data.description,
        targetValue: data.targetValue,
        targetText: data.targetText,
        weight: data.weight,
        frequency: data.frequency as any,
        evidenceRequired: data.evidenceRequired,
        config: data.config,
      },
      include: {
        component: true,
        indicator: { include: { formula: true } },
        formula: true,
        reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async updatePlanningTarget(
    id: string,
    data: UpdatePerformancePlanningTargetDTO & {
      status?: Prisma.EnumPerformancePlanningTargetStatusFieldUpdateOperationsInput | any;
      currentValue?: number | string | null;
      currentText?: string | null;
      progressPercent?: number;
      selfComment?: string | null;
      reviewerComment?: string | null;
      submittedAt?: Date | null;
      reviewedAt?: Date | null;
      completedAt?: Date | null;
    }
  ) {
    return prisma.performancePlanningTarget.update({
      where: { id },
      data: {
        componentId: data.componentId,
        indicatorId: data.indicatorId,
        formulaId: data.formulaId,
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        name: data.name,
        description: data.description,
        targetValue: data.targetValue,
        targetText: data.targetText,
        currentValue: data.currentValue as any,
        currentText: data.currentText,
        progressPercent: data.progressPercent,
        weight: data.weight,
        frequency: data.frequency as any,
        evidenceRequired: data.evidenceRequired,
        status: data.status,
        config: data.config,
        selfComment: data.selfComment,
        reviewerComment: data.reviewerComment,
        submittedAt: data.submittedAt,
        reviewedAt: data.reviewedAt,
        completedAt: data.completedAt,
      },
      include: {
        component: true,
        indicator: { include: { formula: true } },
        formula: true,
        reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true } },
        progressLogs: {
          orderBy: { createdAt: 'desc' },
          include: {
            actor: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
        evidences: {
          orderBy: { createdAt: 'desc' },
          include: {
            uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
      },
    });
  }

  async deletePlanningTarget(id: string) {
    return prisma.performancePlanningTarget.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async createPlanningTargetProgress(
    targetId: string,
    assignmentId: string,
    companyId: string,
    actorId: string | undefined,
    data: CreatePerformanceTargetProgressDTO
  ) {
    return prisma.performancePlanningTargetProgress.create({
      data: {
        targetId,
        assignmentId,
        companyId,
        actorId,
        progressPercent: data.progressPercent,
        currentValue: data.currentValue,
        currentText: data.currentText,
        note: data.note,
      },
      include: {
        actor: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async createPlanningEvidence(data: {
    companyId: string;
    assignmentId: string;
    targetId: string;
    uploadedById?: string;
    fileName: string;
    originalName: string;
    fileUrl: string;
    mimeType: string;
    fileSize: number;
    notes?: string;
  }) {
    return prisma.performancePlanningEvidence.create({
      data,
      include: {
        uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findExecutionApprovalQueue(companyId: string, approverId?: string) {
    const where: Prisma.PerformancePlanningAssignmentWhereInput = {
      companyId,
      deletedAt: null,
      status: { in: ['SUBMITTED'] },
    };

    if (approverId) {
      where.OR = [
        { approverId },
        { targets: { some: { approverId, deletedAt: null, status: 'SUBMITTED' } } },
      ];
    }

    return prisma.performancePlanningAssignment.findMany({
      where,
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        targets: {
          where: { deletedAt: null },
          include: {
            component: true,
            indicator: { include: { formula: true } },
            formula: true,
            reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true } },
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            evidences: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
          },
        },
      },
      orderBy: [
        { submittedAt: 'asc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findMyExecutionAssignments(companyId: string, employeeId: string) {
    return prisma.performancePlanningAssignment.findMany({
      where: {
        companyId,
        employeeId,
        deletedAt: null,
        period: {
          deletedAt: null,
          status: 'PUBLISHED',
          planningPublishedAt: { not: null },
        },
      },
      include: {
        period: { select: { id: true, name: true, code: true, startDate: true, endDate: true, reviewDeadline: true, planningPublishedAt: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });
  }

  async findExecutionAssignmentByIdForActor(id: string, actorEmployeeId: string) {
    return prisma.performancePlanningAssignment.findFirst({
      where: {
        id,
        deletedAt: null,
        period: {
          deletedAt: null,
          status: 'PUBLISHED',
          planningPublishedAt: { not: null },
        },
        OR: [
          { employeeId: actorEmployeeId },
          { reviewerId: actorEmployeeId },
          { approverId: actorEmployeeId },
          { targets: { some: { reviewerId: actorEmployeeId, deletedAt: null } } },
          { targets: { some: { approverId: actorEmployeeId, deletedAt: null } } },
        ],
      },
      include: {
        period: {
          include: {
            methodVersion: {
              include: {
                components: {
                  orderBy: { sortOrder: 'asc' },
                },
              },
            },
          },
        },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true, reportsToId: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        targets: {
          where: { deletedAt: null },
          include: {
            component: true,
            indicator: { include: { formula: true } },
            formula: true,
            reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true } },
            progressLogs: {
              orderBy: { createdAt: 'desc' },
              include: {
                actor: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            evidences: {
              orderBy: { createdAt: 'desc' },
              include: {
                uploadedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
          },
        },
      },
    });
  }

  async touchPlanningWorkspace(periodId: string, planningSummary?: Prisma.InputJsonValue | null) {
    return prisma.performancePeriod.update({
      where: { id: periodId },
      data: {
        planningPublishedAt: null,
        planningSummary: planningSummary ?? undefined,
      },
    });
  }

  async publishPlanning(
    periodId: string,
    planningSummary: Prisma.InputJsonValue,
    assignmentSnapshots: Array<{
      id: string;
      employeeSnapshot: Prisma.InputJsonValue;
      orgSnapshot: Prisma.InputJsonValue;
      planningSnapshot: Prisma.InputJsonValue;
    }>
  ) {
    return prisma.$transaction(async (tx) => {
      const publishedAt = new Date();

      for (const assignment of assignmentSnapshots) {
        await tx.performancePlanningAssignment.update({
          where: { id: assignment.id },
          data: {
            status: 'PUBLISHED',
            employeeSnapshot: assignment.employeeSnapshot,
            orgSnapshot: assignment.orgSnapshot,
            planningSnapshot: assignment.planningSnapshot,
            publishedAt,
          },
        });

        await tx.performancePlanningTarget.updateMany({
          where: { assignmentId: assignment.id, deletedAt: null },
          data: { status: 'PUBLISHED' },
        });
      }

      await tx.performancePeriod.update({
        where: { id: periodId },
        data: {
          planningSummary,
          planningPublishedAt: publishedAt,
        },
      });

      return tx.performancePeriod.findUnique({
        where: { id: periodId },
        include: {
          method: true,
          methodVersion: {
            include: {
              components: {
                orderBy: { sortOrder: 'asc' },
              },
            },
          },
          planningAssignments: {
            where: { deletedAt: null },
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              targets: {
                where: { deletedAt: null },
                include: {
                  component: true,
                  indicator: { include: { formula: true } },
                  formula: true,
                  reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
                  approver: { select: { id: true, fullName: true, employeeNumber: true } },
                },
              },
            },
          },
        },
      });
    });
  }

  // ==================== Score & Calibration ====================
  async findResultsByPeriod(periodId: string) {
    return prisma.performanceResult.findMany({
      where: { periodId },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        assignment: {
          include: {
            targets: {
              where: { deletedAt: null },
              include: {
                component: true,
                indicator: { include: { formula: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
          },
        },
        disputes: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            attachments: {
              include: {
                document: {
                  include: {
                    category: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        developmentRecommendations: {
          include: {
            course: { select: { id: true, title: true, code: true } },
            enrollment: true,
            assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            document: {
              include: {
                category: true,
              },
            },
            createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        calibrationParticipants: {
          include: {
            session: {
              select: { id: true, name: true, code: true, status: true },
            },
            decisions: {
              include: {
                changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { finalScore: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async findResultById(id: string) {
    return prisma.performanceResult.findUnique({
      where: { id },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        assignment: {
          include: {
            targets: {
              where: { deletedAt: null },
              include: {
                component: true,
                indicator: { include: { formula: true } },
              },
            },
          },
        },
        disputes: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            attachments: {
              include: {
                document: {
                  include: {
                    category: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        developmentRecommendations: {
          include: {
            course: { select: { id: true, title: true, code: true } },
            enrollment: true,
            assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            document: {
              include: {
                category: true,
              },
            },
            createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        calibrationParticipants: {
          include: {
            session: {
              select: { id: true, name: true, code: true, status: true },
            },
            decisions: {
              include: {
                changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async upsertPerformanceResult(data: {
    companyId: string;
    periodId: string;
    assignmentId: string;
    methodId: string;
    methodVersionId: string;
    employeeId: string;
    reviewerId?: string;
    approverId?: string;
    status: string;
    rawScore?: number;
    normalizedScore?: number;
    weightedScore?: number;
    finalScore?: number;
    gradeCode?: string;
    gradeLabel?: string;
    recommendationSummary?: string;
    recommendationRules?: Prisma.InputJsonValue | null;
    visibilityPolicy?: Prisma.InputJsonValue | null;
    publishNotes?: string | null;
    calculationVersion: number;
    calculationSnapshot?: Prisma.InputJsonValue | null;
    calibratedAt?: Date | null;
    finalizedAt?: Date | null;
    publishedAt?: Date | null;
    publishedById?: string | null;
    finalApprovedAt?: Date | null;
    finalApprovedById?: string | null;
    finalApprovalNote?: string | null;
    disputeDeadline?: Date | null;
    acknowledgedAt?: Date | null;
    acknowledgementNote?: string | null;
    reopenedAt?: Date | null;
    reopenedById?: string | null;
    reopenReason?: string | null;
    reopenCount?: number;
    lastReminderAt?: Date | null;
    reminderCount?: number;
    calculatedAt?: Date | null;
    calibrationSnapshot?: Prisma.InputJsonValue | null;
    finalSnapshot?: Prisma.InputJsonValue | null;
    overrideReason?: string | null;
    overriddenById?: string | null;
  }) {
    return prisma.performanceResult.upsert({
      where: { assignmentId: data.assignmentId },
      create: {
        companyId: data.companyId,
        periodId: data.periodId,
        assignmentId: data.assignmentId,
        methodId: data.methodId,
        methodVersionId: data.methodVersionId,
        employeeId: data.employeeId,
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        status: data.status as any,
        rawScore: data.rawScore,
        normalizedScore: data.normalizedScore,
        weightedScore: data.weightedScore,
        finalScore: data.finalScore,
        gradeCode: data.gradeCode,
        gradeLabel: data.gradeLabel,
        recommendationSummary: data.recommendationSummary,
        recommendationRules: data.recommendationRules === null ? Prisma.JsonNull : data.recommendationRules,
        visibilityPolicy: data.visibilityPolicy === null ? Prisma.JsonNull : data.visibilityPolicy,
        publishNotes: data.publishNotes,
        calculationVersion: data.calculationVersion,
        calculationSnapshot: data.calculationSnapshot === null ? Prisma.JsonNull : data.calculationSnapshot,
        calibrationSnapshot: data.calibrationSnapshot === null ? Prisma.JsonNull : data.calibrationSnapshot,
        finalSnapshot: data.finalSnapshot === null ? Prisma.JsonNull : data.finalSnapshot,
        overrideReason: data.overrideReason,
        overriddenById: data.overriddenById,
        publishedById: data.publishedById,
        finalApprovedAt: data.finalApprovedAt,
        finalApprovedById: data.finalApprovedById,
        finalApprovalNote: data.finalApprovalNote,
        disputeDeadline: data.disputeDeadline,
        acknowledgedAt: data.acknowledgedAt,
        acknowledgementNote: data.acknowledgementNote,
        reopenedAt: data.reopenedAt,
        reopenedById: data.reopenedById,
        reopenReason: data.reopenReason,
        reopenCount: data.reopenCount,
        lastReminderAt: data.lastReminderAt,
        reminderCount: data.reminderCount,
        calculatedAt: data.calculatedAt,
        calibratedAt: data.calibratedAt,
        finalizedAt: data.finalizedAt,
        publishedAt: data.publishedAt,
      },
      update: {
        reviewerId: data.reviewerId,
        approverId: data.approverId,
        status: data.status as any,
        rawScore: data.rawScore,
        normalizedScore: data.normalizedScore,
        weightedScore: data.weightedScore,
        finalScore: data.finalScore,
        gradeCode: data.gradeCode,
        gradeLabel: data.gradeLabel,
        recommendationSummary: data.recommendationSummary,
        recommendationRules: data.recommendationRules === null ? Prisma.JsonNull : data.recommendationRules,
        visibilityPolicy: data.visibilityPolicy === null ? Prisma.JsonNull : data.visibilityPolicy,
        publishNotes: data.publishNotes,
        calculationVersion: data.calculationVersion,
        calculationSnapshot: data.calculationSnapshot === null ? Prisma.JsonNull : data.calculationSnapshot,
        calibrationSnapshot: data.calibrationSnapshot === null ? Prisma.JsonNull : data.calibrationSnapshot,
        finalSnapshot: data.finalSnapshot === null ? Prisma.JsonNull : data.finalSnapshot,
        overrideReason: data.overrideReason,
        overriddenById: data.overriddenById,
        publishedById: data.publishedById,
        finalApprovedAt: data.finalApprovedAt,
        finalApprovedById: data.finalApprovedById,
        finalApprovalNote: data.finalApprovalNote,
        disputeDeadline: data.disputeDeadline,
        acknowledgedAt: data.acknowledgedAt,
        acknowledgementNote: data.acknowledgementNote,
        reopenedAt: data.reopenedAt,
        reopenedById: data.reopenedById,
        reopenReason: data.reopenReason,
        reopenCount: data.reopenCount,
        lastReminderAt: data.lastReminderAt,
        reminderCount: data.reminderCount,
        calculatedAt: data.calculatedAt,
        calibratedAt: data.calibratedAt,
        finalizedAt: data.finalizedAt,
        publishedAt: data.publishedAt,
      },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
      },
    });
  }

  async publishPerformanceResults(
    periodId: string,
    publishedById: string | undefined,
    data: PublishPerformanceResultsDTO
  ) {
    return prisma.$transaction(async (tx) => {
      const results = await tx.performanceResult.findMany({
        where: { periodId },
      });

      const publishedAt = new Date();
      const disputeDeadline = new Date(publishedAt);
      disputeDeadline.setDate(disputeDeadline.getDate() + data.disputeWindowDays);

      for (const result of results) {
        const finalSnapshot =
          result.finalSnapshot === null
            ? (
                result.calibrationSnapshot === null && result.calculationSnapshot === null
                  ? Prisma.JsonNull
                  : ((result.calibrationSnapshot ?? result.calculationSnapshot) as Prisma.InputJsonValue)
              )
            : (result.finalSnapshot as Prisma.InputJsonValue);

        await tx.performanceResult.update({
          where: { id: result.id },
          data: {
            status: 'PUBLISHED',
            publishedAt,
            publishedById,
            publishNotes: data.notes?.trim() || null,
            visibilityPolicy: data.visibilityPolicy as any,
            disputeDeadline,
            finalizedAt: result.finalizedAt ?? publishedAt,
            finalSnapshot,
          },
        });
      }

      return tx.performanceResult.findMany({
        where: { periodId },
        include: {
          period: { select: { id: true, name: true, code: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeNumber: true,
              email: true,
              branch: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
              subDepartment: { select: { id: true, name: true } },
              position: { select: { id: true, name: true } },
            },
          },
          reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          disputes: {
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { finalScore: 'desc' },
          { updatedAt: 'desc' },
        ],
      });
    });
  }

  async findPublishedResultsByEmployee(companyId: string, employeeId: string) {
    return prisma.performanceResult.findMany({
      where: {
        companyId,
        employeeId,
        status: 'PUBLISHED',
        publishedAt: { not: null },
      },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        disputes: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            attachments: {
              include: {
                document: {
                  include: {
                    category: true,
                  },
                },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        developmentRecommendations: {
          include: {
            course: { select: { id: true, title: true, code: true } },
            enrollment: true,
            assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        attachments: {
          include: {
            document: {
              include: {
                category: true,
              },
            },
            createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [
        { publishedAt: 'desc' },
        { updatedAt: 'desc' },
      ],
    });
  }

  async approvePerformanceResults(
    periodId: string,
    finalApprovedById: string | undefined,
    data: ApprovePerformanceResultsDTO
  ) {
    const finalApprovedAt = new Date();

    return prisma.$transaction(async (tx) => {
      await tx.performanceResult.updateMany({
        where: { periodId },
        data: {
          finalApprovedAt,
          finalApprovedById,
          finalApprovalNote: data.notes?.trim() || null,
        },
      });

      return tx.performanceResult.findMany({
        where: { periodId },
        include: {
          period: { select: { id: true, name: true, code: true } },
          employee: {
            select: {
              id: true,
              fullName: true,
              employeeNumber: true,
              email: true,
              branch: { select: { id: true, name: true } },
              department: { select: { id: true, name: true } },
              subDepartment: { select: { id: true, name: true } },
              position: { select: { id: true, name: true } },
            },
          },
          reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          disputes: {
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: [
          { finalScore: 'desc' },
          { updatedAt: 'desc' },
        ],
      });
    });
  }

  async reopenPerformanceResult(
    id: string,
    reopenedById: string | undefined,
    data: ReopenPerformanceResultDTO
  ) {
    return prisma.performanceResult.update({
      where: { id },
      data: {
        status: 'CALCULATED',
        publishedAt: null,
        publishedById: null,
        publishNotes: null,
        visibilityPolicy: Prisma.JsonNull,
        disputeDeadline: null,
        acknowledgedAt: null,
        acknowledgementNote: null,
        finalApprovedAt: null,
        finalApprovedById: null,
        finalApprovalNote: null,
        reopenedAt: new Date(),
        reopenedById,
        reopenReason: data.reason.trim(),
        reopenCount: { increment: 1 },
      },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            email: true,
            branch: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            subDepartment: { select: { id: true, name: true } },
            position: { select: { id: true, name: true } },
          },
        },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        finalApprovedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reopenedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        disputes: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async markResultReminded(id: string) {
    return prisma.performanceResult.update({
      where: { id },
      data: {
        lastReminderAt: new Date(),
        reminderCount: { increment: 1 },
      },
    });
  }

  async acknowledgePerformanceResult(id: string, data: AcknowledgePerformanceResultDTO) {
    return prisma.performanceResult.update({
      where: { id },
      data: {
        acknowledgedAt: new Date(),
        acknowledgementNote: data.notes?.trim() || null,
      },
      include: {
        period: { select: { id: true, name: true, code: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        publishedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        disputes: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createPerformanceResultDispute(
    resultId: string,
    companyId: string,
    employeeId: string,
    data: CreatePerformanceResultDisputeDTO
  ) {
    return prisma.performanceResultDispute.create({
      data: {
        resultId,
        companyId,
        employeeId,
        title: data.title.trim(),
        message: data.message.trim(),
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
      },
    });
  }

  async findPerformanceResultDisputeById(id: string) {
    return prisma.performanceResultDispute.findUnique({
      where: { id },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
      },
    });
  }

  async respondPerformanceResultDispute(
    id: string,
    respondedById: string | undefined,
    data: RespondPerformanceResultDisputeDTO
  ) {
    const resolvedAt = ['RESOLVED', 'REJECTED', 'CLOSED'].includes(data.status) ? new Date() : null;

    return prisma.performanceResultDispute.update({
      where: { id },
      data: {
        status: data.status as any,
        responseMessage: data.response.trim(),
        respondedById,
        respondedAt: new Date(),
        resolvedAt,
        closedAt: data.status === 'CLOSED' ? new Date() : null,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        respondedBy: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            reviewer: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
      },
    });
  }

  async findUsersByEmployeeIds(employeeIds: string[]) {
    return prisma.user.findMany({
      where: {
        employeeId: {
          in: employeeIds.filter(Boolean),
        },
      },
      select: {
        id: true,
        employeeId: true,
      },
    });
  }

  async createNotifications(
    notifications: Array<{
      companyId: string;
      userId: string;
      title: string;
      message?: string;
      type?: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
      resource?: string;
      action?: string;
      referenceId?: string;
    }>
  ) {
    if (!notifications.length) {
      return { count: 0 };
    }

    return prisma.notification.createMany({
      data: notifications.map((notification) => ({
        companyId: notification.companyId,
        userId: notification.userId,
        title: notification.title,
        message: notification.message,
        type: (notification.type ?? 'INFO') as any,
        resource: notification.resource,
        action: notification.action,
        referenceId: notification.referenceId,
      })),
    });
  }

  async findTrainingCourseById(id: string) {
    return prisma.trainingCourse.findFirst({
      where: { id, deletedAt: null, isActive: true },
    });
  }

  async findMatchingTrainingCourses(companyId: string, keywords: string[]) {
    const normalized = keywords.map((keyword) => keyword.trim()).filter(Boolean);
    if (!normalized.length) {
      return [];
    }

    return prisma.trainingCourse.findMany({
      where: {
        companyId,
        deletedAt: null,
        isActive: true,
        OR: normalized.flatMap((keyword) => ([
          { title: { contains: keyword } },
          { description: { contains: keyword } },
          { code: { contains: keyword } },
        ])),
      },
      orderBy: { title: 'asc' },
      take: 10,
    });
  }

  async findActiveTrainingEnrollment(courseId: string, employeeId: string, companyId: string) {
    return prisma.trainingEnrollment.findFirst({
      where: {
        courseId,
        employeeId,
        companyId,
        deletedAt: null,
      },
    });
  }

  async createTrainingEnrollment(data: { courseId: string; employeeId: string; companyId: string; notes?: string }) {
    return prisma.trainingEnrollment.create({
      data,
    });
  }

  async findDevelopmentRecommendations(periodId: string) {
    return prisma.performanceDevelopmentRecommendation.findMany({
      where: { periodId },
      include: {
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        course: { select: { id: true, title: true, code: true } },
        enrollment: true,
        assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteDevelopmentRecommendationsByPeriod(periodId: string) {
    return prisma.performanceDevelopmentRecommendation.deleteMany({
      where: { periodId },
    });
  }

  async createDevelopmentRecommendation(data: {
    companyId: string;
    periodId: string;
    resultId: string;
    employeeId: string;
    type?: string;
    priority?: string;
    sourceRuleLabel?: string | null;
    title: string;
    description?: string | null;
    courseId?: string | null;
    notes?: string | null;
  }) {
    return prisma.performanceDevelopmentRecommendation.create({
      data: {
        companyId: data.companyId,
        periodId: data.periodId,
        resultId: data.resultId,
        employeeId: data.employeeId,
        type: (data.type ?? 'TRAINING') as any,
        priority: data.priority ?? 'MEDIUM',
        sourceRuleLabel: data.sourceRuleLabel,
        title: data.title,
        description: data.description,
        courseId: data.courseId,
        notes: data.notes,
      },
      include: {
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        course: { select: { id: true, title: true, code: true } },
        enrollment: true,
        assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findDevelopmentRecommendationById(id: string) {
    return prisma.performanceDevelopmentRecommendation.findUnique({
      where: { id },
      include: {
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        course: { select: { id: true, title: true, code: true } },
        enrollment: true,
        assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async assignDevelopmentRecommendation(
    id: string,
    data: AssignPerformanceDevelopmentRecommendationDTO & {
      companyId: string;
      employeeId: string;
      assignedById?: string;
      enrollmentId?: string | null;
    }
  ) {
    return prisma.performanceDevelopmentRecommendation.update({
      where: { id },
      data: {
        courseId: data.courseId,
        status: data.enrollmentId ? 'ENROLLED' : 'ASSIGNED',
        assignedById: data.assignedById,
        assignedAt: new Date(),
        enrollmentId: data.enrollmentId,
        notes: data.notes?.trim() || null,
      },
      include: {
        result: {
          include: {
            period: { select: { id: true, name: true, code: true } },
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
          },
        },
        employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
        course: { select: { id: true, title: true, code: true } },
        enrollment: true,
        assignedBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findDocumentCategoryByCode(companyId: string, code: string) {
    return prisma.documentCategory.findFirst({
      where: {
        companyId,
        code,
      },
    });
  }

  async createDocumentCategory(data: { companyId: string; name: string; code: string; description?: string }) {
    return prisma.documentCategory.create({
      data,
    });
  }

  async createManagedDocument(data: {
    companyId: string;
    categoryId: string;
    employeeId?: string;
    uploadedBy: string;
    title: string;
    description?: string;
    visibility: 'INTERNAL' | 'RESTRICTED' | 'PUBLIC';
    fileName: string;
    filePath: string;
    mimeType: string;
    fileSize: number;
  }) {
    return prisma.document.create({
      data: {
        companyId: data.companyId,
        categoryId: data.categoryId,
        employeeId: data.employeeId,
        ownerType: data.employeeId ? 'EMPLOYEE' : 'COMPANY',
        title: data.title,
        description: data.description,
        visibility: data.visibility as any,
        uploadedBy: data.uploadedBy,
        fileName: data.fileName,
        filePath: data.filePath,
        mimeType: data.mimeType,
        fileSize: data.fileSize,
      },
      include: {
        category: true,
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        uploader: { select: { id: true, email: true } },
      },
    });
  }

  async createPerformanceResultAttachment(data: {
    companyId: string;
    resultId?: string;
    disputeId?: string;
    documentId: string;
    attachmentType: 'RESULT' | 'DISPUTE';
    createdById?: string;
  }) {
    return prisma.performanceResultAttachment.create({
      data: {
        companyId: data.companyId,
        resultId: data.resultId,
        disputeId: data.disputeId,
        documentId: data.documentId,
        attachmentType: data.attachmentType as any,
        createdById: data.createdById,
      },
      include: {
        document: {
          include: {
            category: true,
            employee: { select: { id: true, fullName: true, employeeNumber: true } },
            uploader: { select: { id: true, email: true } },
          },
        },
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findAutomationSchedules(periodId: string) {
    return prisma.performanceAutomationSchedule.findMany({
      where: { periodId },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createAutomationSchedule(
    periodId: string,
    companyId: string,
    createdById: string | undefined,
    data: CreatePerformanceAutomationScheduleDTO & { queueJobId?: string | null }
  ) {
    return prisma.performanceAutomationSchedule.create({
      data: {
        periodId,
        companyId,
        createdById,
        name: data.name,
        reminderTarget: data.reminderTarget as any,
        cadenceHours: data.cadenceHours,
        queueJobId: data.queueJobId,
        notes: data.notes,
        nextRunAt: new Date(Date.now() + data.cadenceHours * 60 * 60 * 1000),
      },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findAutomationScheduleById(id: string) {
    return prisma.performanceAutomationSchedule.findUnique({
      where: { id },
      include: {
        period: { select: { id: true, name: true, code: true, companyId: true } },
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async markAutomationScheduleRun(id: string, cadenceHours: number) {
    const now = new Date();
    const nextRunAt = new Date(now.getTime() + cadenceHours * 60 * 60 * 1000);

    return prisma.performanceAutomationSchedule.update({
      where: { id },
      data: {
        lastRunAt: now,
        nextRunAt,
      },
      include: {
        period: { select: { id: true, name: true, code: true, companyId: true } },
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
      },
    });
  }

  async findCalibrationSessions(periodId: string) {
    return prisma.performanceCalibrationSession.findMany({
      where: { periodId },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
        participants: {
          include: {
            result: {
              include: {
                employee: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            decisions: {
              include: {
                changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findCalibrationSessionById(id: string) {
    return prisma.performanceCalibrationSession.findUnique({
      where: { id },
      include: {
        period: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
        participants: {
          include: {
            result: {
              include: {
                employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
                reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
                approver: { select: { id: true, fullName: true, employeeNumber: true } },
              },
            },
            decisions: {
              include: {
                changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async createCalibrationSession(
    periodId: string,
    companyId: string,
    createdById: string | undefined,
    data: CreatePerformanceCalibrationSessionDTO & { code: string },
    participantResultIds: string[]
  ) {
    return prisma.performanceCalibrationSession.create({
      data: {
        periodId,
        companyId,
        createdById,
        name: data.name,
        code: data.code,
        scope: data.scope,
        forcedDistribution: data.forcedDistribution,
        notes: data.notes,
        participants: {
          create: participantResultIds.map((resultId) => ({
            companyId,
            resultId,
          })),
        },
      },
      include: {
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
        participants: {
          include: {
            result: {
              include: {
                employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              },
            },
          },
        },
      },
    });
  }

  async updateCalibrationSession(
    id: string,
    data: {
      status?: Prisma.EnumPerformanceCalibrationSessionStatusFieldUpdateOperationsInput | any;
      scope?: Prisma.InputJsonValue;
      forcedDistribution?: Prisma.InputJsonValue;
      notes?: string | null;
      openedAt?: Date | null;
      closedAt?: Date | null;
      finalizedAt?: Date | null;
    }
  ) {
    return prisma.performanceCalibrationSession.update({
      where: { id },
      data: {
        status: data.status,
        scope: data.scope,
        forcedDistribution: data.forcedDistribution,
        notes: data.notes,
        openedAt: data.openedAt,
        closedAt: data.closedAt,
        finalizedAt: data.finalizedAt,
      },
      include: {
        period: { select: { id: true, name: true, code: true } },
        createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
        participants: {
          include: {
            result: {
              include: {
                employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
              },
            },
            decisions: {
              include: {
                changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async openCalibrationSession(id: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.performanceCalibrationSession.findUnique({
        where: { id },
        include: { participants: true },
      });

      if (!session) {
        throw new Error('Calibration session not found');
      }

      await tx.performanceCalibrationSession.update({
        where: { id },
        data: {
          status: 'OPEN',
          openedAt: new Date(),
          closedAt: null,
          finalizedAt: null,
        },
      });

      if (session.participants.length) {
        await tx.performanceResult.updateMany({
          where: {
            id: { in: session.participants.map((participant) => participant.resultId) },
          },
          data: {
            status: 'CALIBRATION_IN_PROGRESS',
          },
        });
      }

      return tx.performanceCalibrationSession.findUnique({
        where: { id },
        include: {
          period: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
          participants: {
            include: {
              result: {
                include: {
                  employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
                },
              },
              decisions: {
                include: {
                  changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  async finalizeCalibrationSession(id: string) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.performanceCalibrationSession.findUnique({
        where: { id },
        include: { participants: true },
      });

      if (!session) {
        throw new Error('Calibration session not found');
      }

      const finalizedAt = new Date();

      await tx.performanceCalibrationSession.update({
        where: { id },
        data: {
          status: 'FINALIZED',
          closedAt: session.closedAt ?? finalizedAt,
          finalizedAt,
        },
      });

      if (session.participants.length) {
        await tx.performanceCalibrationParticipant.updateMany({
          where: {
            sessionId: id,
            status: 'PENDING',
          },
          data: {
            status: 'CONFIRMED',
          },
        });

        const results = await tx.performanceResult.findMany({
          where: {
            id: { in: session.participants.map((participant) => participant.resultId) },
          },
        });

        for (const result of results) {
          const finalSnapshot =
            result.calibrationSnapshot === null && result.calculationSnapshot === null
              ? Prisma.JsonNull
              : ((result.calibrationSnapshot ?? result.calculationSnapshot) as Prisma.InputJsonValue);

          await tx.performanceResult.update({
            where: { id: result.id },
            data: {
              status: 'FINALIZED',
              finalizedAt,
              finalSnapshot,
            },
          });
        }
      }

      return tx.performanceCalibrationSession.findUnique({
        where: { id },
        include: {
          period: { select: { id: true, name: true, code: true } },
          createdBy: { select: { id: true, fullName: true, employeeNumber: true } },
          participants: {
            include: {
              result: {
                include: {
                  employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
                },
              },
              decisions: {
                include: {
                  changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
                },
                orderBy: { createdAt: 'desc' },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
    });
  }

  async findCalibrationParticipantById(id: string) {
    return prisma.performanceCalibrationParticipant.findUnique({
      where: { id },
      include: {
        session: {
          include: {
            period: { select: { id: true, name: true, code: true } },
          },
        },
        result: {
          include: {
            employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            reviewer: { select: { id: true, fullName: true, employeeNumber: true } },
            approver: { select: { id: true, fullName: true, employeeNumber: true } },
          },
        },
        decisions: {
          include: {
            changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async applyCalibrationDecision(
    participantId: string,
    companyId: string,
    changedById: string | undefined,
    data: PerformanceCalibrationDecisionDTO & {
      finalGradeCode?: string | null;
      finalGradeLabel?: string | null;
      recommendationSummary?: string | null;
      recommendationRules?: Prisma.InputJsonValue | null;
      calibrationSnapshot?: Prisma.InputJsonValue | null;
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const participant = await tx.performanceCalibrationParticipant.findUnique({
        where: { id: participantId },
        include: { result: true, session: true },
      });

      if (!participant) {
        throw new Error('Calibration participant not found');
      }

      await tx.performanceCalibrationDecision.create({
        data: {
          companyId,
          sessionId: participant.sessionId,
          participantId,
          resultId: participant.resultId,
          beforeScore: participant.result.finalScore,
          beforeGradeCode: participant.result.gradeCode,
          beforeGradeLabel: participant.result.gradeLabel,
          afterScore: data.finalScore,
          afterGradeCode: data.finalGradeCode,
          afterGradeLabel: data.finalGradeLabel,
          reason: data.reason,
          changedById,
        },
      });

      await tx.performanceCalibrationParticipant.update({
        where: { id: participantId },
        data: {
          status: 'ADJUSTED',
          beforeScore: participant.beforeScore ?? participant.result.finalScore,
          beforeGradeCode: participant.beforeGradeCode ?? participant.result.gradeCode,
          beforeGradeLabel: participant.beforeGradeLabel ?? participant.result.gradeLabel,
          afterScore: data.finalScore,
          afterGradeCode: data.finalGradeCode,
          afterGradeLabel: data.finalGradeLabel,
          reason: data.reason,
        },
      });

      await tx.performanceResult.update({
        where: { id: participant.resultId },
        data: {
          status: 'CALIBRATION_IN_PROGRESS',
          finalScore: data.finalScore,
          gradeCode: data.finalGradeCode,
          gradeLabel: data.finalGradeLabel,
          recommendationSummary: data.recommendationSummary,
          recommendationRules: data.recommendationRules === null ? Prisma.JsonNull : data.recommendationRules,
          overrideReason: data.reason,
          overriddenById: changedById,
          calibratedAt: new Date(),
          calibrationSnapshot: data.calibrationSnapshot === null ? Prisma.JsonNull : data.calibrationSnapshot,
        },
      });

      return tx.performanceCalibrationParticipant.findUnique({
        where: { id: participantId },
        include: {
          session: true,
          result: {
            include: {
              employee: { select: { id: true, fullName: true, employeeNumber: true, email: true } },
            },
          },
          decisions: {
            include: {
              changedBy: { select: { id: true, fullName: true, employeeNumber: true } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
      });
    });
  }

  // ==================== Review Cycles ====================
  async findAllCycles(companyId: string) {
    return prisma.reviewCycle.findMany({
      where: { companyId, deletedAt: null },
      include: { _count: { select: { reviews: true } } },
      orderBy: { startDate: 'desc' },
    });
  }

  async findCycleById(id: string) {
    return prisma.reviewCycle.findFirst({ where: { id, deletedAt: null } });
  }

  async findCycleByCode(code: string) {
    return prisma.reviewCycle.findUnique({ where: { code } });
  }

  async createCycle(data: CreateReviewCycleDTO & { code: string }) {
    return prisma.reviewCycle.create({
      data: { ...data, type: data.type as any, startDate: new Date(data.startDate), endDate: new Date(data.endDate), reviewDeadline: data.reviewDeadline ? new Date(data.reviewDeadline) : undefined },
    });
  }

  // ==================== Reviews ====================
  async findAllReviews(companyId: string, filters?: { employeeId?: string; cycleId?: string; status?: string }) {
    const where: Prisma.PerformanceReviewWhereInput = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.cycleId) where.cycleId = filters.cycleId;
    if (filters?.status) where.status = filters.status as any;

    return prisma.performanceReview.findMany({
      where, include: { employee: { select: { id: true, fullName: true, employeeNumber: true } }, reviewer: { select: { id: true, fullName: true } }, cycle: { select: { id: true, name: true } }, sections: { include: { scores: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findReviewById(id: string) {
    return prisma.performanceReview.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } }, reviewer: { select: { id: true, fullName: true } }, cycle: true, sections: { include: { scores: true }, orderBy: { sortOrder: 'asc' } } },
    });
  }

  async createReview(data: CreateReviewDTO) {
    return prisma.performanceReview.create({ data: { ...data, type: data.type as any } });
  }

  async updateReview(id: string, data: Prisma.PerformanceReviewUpdateInput) {
    return prisma.performanceReview.update({ where: { id }, data });
  }

  // ==================== Goals ====================
  async findAllGoals(companyId: string, employeeId?: string) {
    const where: Prisma.GoalWhereInput = { companyId, deletedAt: null };
    if (employeeId) where.employeeId = employeeId;
    return prisma.goal.findMany({ where, include: { employee: { select: { id: true, fullName: true } }, updates: { orderBy: { createdAt: 'desc' } } }, orderBy: { createdAt: 'desc' } });
  }

  async createGoal(data: CreateGoalDTO) {
    return prisma.goal.create({ data: { ...data, type: data.type as any, priority: data.priority as any, startDate: new Date(data.startDate), endDate: data.endDate ? new Date(data.endDate) : undefined } });
  }

  async addGoalUpdate(goalId: string, progress: number, note?: string) {
    await prisma.goal.update({ where: { id: goalId }, data: { progress } });
    return prisma.goalUpdate.create({ data: { goalId, progress, note } });
  }

  // ==================== Feedback ====================
  async findAllFeedbackRequests(companyId: string, recipientId?: string) {
    const where: Prisma.FeedbackRequestWhereInput = { companyId };
    if (recipientId) where.recipientId = recipientId;
    return prisma.feedbackRequest.findMany({ where, include: { requester: { select: { id: true, fullName: true } }, recipient: { select: { id: true, fullName: true } }, responses: true } });
  }

  async createFeedbackRequest(data: CreateFeedbackRequestDTO) {
    return prisma.feedbackRequest.create({ data });
  }

  async createFeedbackResponse(data: { requestId: string; rating?: number; strengths?: string; improvements?: string; notes?: string; isAnonymous: boolean }) {
    return prisma.feedbackResponse.create({ data });
  }
}

export const performanceRepository = new PerformanceRepository();
