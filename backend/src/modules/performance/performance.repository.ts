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
  CreatePerformanceFormulaDTO,
  UpdatePerformanceFormulaDTO,
  CreatePerformanceIndicatorDTO,
  UpdatePerformanceIndicatorDTO,
  CreatePerformanceGradeRuleDTO,
  UpdatePerformanceGradeRuleDTO,
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

  async createMethod(data: CreatePerformanceMethodDTO) {
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

  async createFormula(data: CreatePerformanceFormulaDTO) {
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

  async createIndicator(data: CreatePerformanceIndicatorDTO) {
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

  async createGradeRule(data: CreatePerformanceGradeRuleDTO) {
    return prisma.performanceGradeRule.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        code: data.code,
        description: data.description,
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

  async createComponent(methodVersionId: string, companyId: string, data: CreatePerformanceComponentDTO) {
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

  async createPeriod(data: CreatePerformancePeriodDTO) {
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
      publishedAt?: Date | null;
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
      publishedAt: data.publishedAt,
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

  async createCycle(data: CreateReviewCycleDTO) {
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
