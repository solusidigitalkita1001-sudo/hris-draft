import { prisma } from '@/shared/database/prisma';
import type {
  CreateWorkflowTemplateDTO,
  StartWorkflowInstanceDTO,
  UpdateWorkflowTemplateDTO,
  WorkflowActionDTO,
  WorkflowRuleInput,
  WorkflowStageInput,
} from './workflow-engine.dto';

type Payload = Record<string, any>;

function compareRule(payloadValue: unknown, rule: WorkflowRuleInput) {
  const normalizedValue = rule.value;

  switch (rule.operator) {
    case 'EQ':
      return String(payloadValue ?? '') === normalizedValue;
    case 'NEQ':
      return String(payloadValue ?? '') !== normalizedValue;
    case 'GT':
      return Number(payloadValue ?? 0) > Number(normalizedValue);
    case 'GTE':
      return Number(payloadValue ?? 0) >= Number(normalizedValue);
    case 'LT':
      return Number(payloadValue ?? 0) < Number(normalizedValue);
    case 'LTE':
      return Number(payloadValue ?? 0) <= Number(normalizedValue);
    case 'IN':
      return normalizedValue
        .split(',')
        .map((value) => value.trim())
        .includes(String(payloadValue ?? ''));
    case 'CONTAINS':
      return String(payloadValue ?? '').toLowerCase().includes(normalizedValue.toLowerCase());
    default:
      return false;
  }
}

function isStageApplicable(stage: WorkflowStageInput, payload: Payload) {
  if (!stage.conditionRules.length) {
    return true;
  }

  return stage.conditionRules.every((rule) => compareRule(payload[rule.field], rule));
}

function mapStageCreate(stage: WorkflowStageInput) {
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

export class WorkflowEngineRepository {
  async findTemplates(companyId: string) {
    return prisma.workflowTemplate.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
        _count: { select: { instances: true } },
      },
    });
  }

  async findTemplateById(id: string) {
    return prisma.workflowTemplate.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
        _count: { select: { instances: true } },
      },
    });
  }

  async createTemplate(data: CreateWorkflowTemplateDTO) {
    return prisma.workflowTemplate.create({
      data: {
        companyId: data.companyId,
        name: data.name,
        approvalType: data.approvalType,
        resource: data.resource,
        description: data.description,
        isActive: data.isActive ?? true,
        stages: {
          create: data.stages.map(mapStageCreate),
        },
      },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
      },
    });
  }

  async updateTemplate(id: string, data: UpdateWorkflowTemplateDTO) {
    return prisma.$transaction(async (tx) => {
      if (data.stages) {
        await tx.workflowConditionRule.deleteMany({
          where: {
            stage: {
              templateId: id,
            },
          },
        });
        await tx.workflowStage.deleteMany({ where: { templateId: id } });
      }

      const updated = await tx.workflowTemplate.update({
        where: { id },
        data: {
          companyId: data.companyId,
          name: data.name,
          approvalType: data.approvalType,
          resource: data.resource,
          description: data.description,
          isActive: data.isActive,
          ...(data.stages
            ? {
                stages: {
                  create: data.stages.map(mapStageCreate),
                },
              }
            : {}),
        },
        include: {
          stages: {
            orderBy: { level: 'asc' },
            include: { conditionRules: true },
          },
        },
      });

      return updated;
    });
  }

  async deleteTemplate(id: string) {
    return prisma.workflowTemplate.delete({ where: { id } });
  }

  async findInstances(companyId: string, status?: string) {
    return prisma.workflowInstance.findMany({
      where: {
        companyId,
        ...(status ? { status: status as any } : {}),
      },
      orderBy: { createdAt: 'desc' },
      include: {
        template: { select: { id: true, name: true, approvalType: true } },
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
  }

  async findMyApprovals(companyId: string, userId: string, roles: string[]) {
    return prisma.workflowInstanceStep.findMany({
      where: {
        instance: { companyId },
        isCurrent: true,
        status: 'PENDING',
        OR: [
          { approverId: userId },
          { approverRoleCode: { in: roles } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      include: {
        instance: {
          include: {
            template: { select: { id: true, name: true, approvalType: true } },
          },
        },
      },
    });
  }

  async findInstanceById(id: string) {
    return prisma.workflowInstance.findUnique({
      where: { id },
      include: {
        template: {
          include: {
            stages: {
              orderBy: { level: 'asc' },
              include: { conditionRules: true },
            },
          },
        },
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async startInstance(requesterId: string, data: StartWorkflowInstanceDTO) {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: data.templateId },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
      },
    });

    if (!template) {
      throw new Error('Workflow template not found');
    }

    const payload = (data.payload || {}) as Payload;
    const applicableStages = template.stages.filter((stage: (typeof template.stages)[number]) =>
      isStageApplicable(
        {
          name: stage.name,
          level: stage.level,
          approverType: stage.approverType as any,
          approverRoleCode: stage.approverRoleCode || undefined,
          approverId: stage.approverId || undefined,
          backupApproverRoleCode: stage.backupApproverRoleCode || undefined,
          backupApproverId: stage.backupApproverId || undefined,
          slaHours: stage.slaHours,
          allowEscalation: stage.allowEscalation,
          conditionRules: stage.conditionRules.map((rule: (typeof stage.conditionRules)[number]) => ({
            field: rule.field,
            operator: rule.operator as any,
            value: rule.value,
          })),
        },
        payload
      )
    );

    if (!applicableStages.length) {
      throw new Error('No workflow stage matches the provided payload');
    }

    return prisma.$transaction(async (tx) => {
      const instance = await tx.workflowInstance.create({
        data: {
          templateId: template.id,
          companyId: data.companyId,
          approvalType: data.approvalType || template.approvalType,
          referenceType: data.referenceType,
          referenceId: data.referenceId,
          requesterId,
          payload,
          status: 'PENDING',
          currentLevel: applicableStages[0].level,
          steps: {
            create: applicableStages.map((stage: (typeof applicableStages)[number], index: number) => ({
              stageId: stage.id,
              name: stage.name,
              level: stage.level,
              approverType: stage.approverType,
              approverRoleCode: stage.approverRoleCode,
              approverId: stage.approverId,
              backupApproverRoleCode: stage.backupApproverRoleCode,
              backupApproverId: stage.backupApproverId,
              isCurrent: index === 0,
              status: 'PENDING',
            })),
          },
        },
        include: {
          steps: { orderBy: { level: 'asc' } },
          template: { select: { id: true, name: true, approvalType: true } },
        },
      });

      await tx.workflowInstanceLog.create({
        data: {
          instanceId: instance.id,
          action: 'STARTED',
          actorId: requesterId,
          comment: 'Workflow instance started',
        },
      });

      return instance;
    });
  }

  async applyAction(instanceId: string, userId: string, roles: string[], action: WorkflowActionDTO) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: {
          orderBy: { level: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new Error('Workflow instance not found');
    }

    const currentStep = instance.steps.find(
      (step: (typeof instance.steps)[number]) => step.isCurrent && step.status === 'PENDING'
    );
    if (!currentStep) {
      throw new Error('No pending approval step found');
    }

    const canAct =
      currentStep.approverId === userId ||
      (!!currentStep.approverRoleCode && roles.includes(currentStep.approverRoleCode)) ||
      roles.includes('SUPER_ADMIN');

    if (!canAct) {
      throw new Error('You are not allowed to act on this workflow step');
    }

    return prisma.$transaction(async (tx) => {
      if (action.action === 'APPROVE') {
        const nextStep = instance.steps.find(
          (step: (typeof instance.steps)[number]) => step.level > currentStep.level
        );

        await tx.workflowInstanceStep.update({
          where: { id: currentStep.id },
          data: {
            status: 'APPROVED',
            isCurrent: false,
            actedBy: userId,
            actedAt: new Date(),
            comment: action.comment,
          },
        });

        if (nextStep) {
          await tx.workflowInstanceStep.update({
            where: { id: nextStep.id },
            data: { isCurrent: true },
          });

          await tx.workflowInstance.update({
            where: { id: instanceId },
            data: {
              status: 'PENDING',
              currentLevel: nextStep.level,
            },
          });
        } else {
          await tx.workflowInstance.update({
            where: { id: instanceId },
            data: {
              status: 'APPROVED',
              currentLevel: null,
            },
          });
        }

        await tx.workflowInstanceLog.create({
          data: {
            instanceId,
            stepId: currentStep.id,
            action: 'APPROVED',
            actorId: userId,
            comment: action.comment,
          },
        });
      }

      if (action.action === 'REJECT') {
        await tx.workflowInstanceStep.update({
          where: { id: currentStep.id },
          data: {
            status: 'REJECTED',
            isCurrent: false,
            actedBy: userId,
            actedAt: new Date(),
            comment: action.comment,
          },
        });

        await tx.workflowInstance.update({
          where: { id: instanceId },
          data: {
            status: 'REJECTED',
            currentLevel: null,
          },
        });

        await tx.workflowInstanceLog.create({
          data: {
            instanceId,
            stepId: currentStep.id,
            action: 'REJECTED',
            actorId: userId,
            comment: action.comment,
          },
        });
      }

      if (action.action === 'ESCALATE') {
        if (!currentStep.backupApproverId && !currentStep.backupApproverRoleCode) {
          const nextStep = instance.steps.find(
            (step: (typeof instance.steps)[number]) => step.level > currentStep.level
          );

          if (!nextStep) {
            throw new Error('No backup approver or next step available for escalation');
          }

          await tx.workflowInstanceStep.update({
            where: { id: currentStep.id },
            data: {
              status: 'ESCALATED',
              isCurrent: false,
              actedBy: userId,
              actedAt: new Date(),
              comment: action.comment,
            },
          });

          await tx.workflowInstanceStep.update({
            where: { id: nextStep.id },
            data: { isCurrent: true },
          });

          await tx.workflowInstance.update({
            where: { id: instanceId },
            data: {
              status: 'ESCALATED',
              currentLevel: nextStep.level,
            },
          });
        } else {
          await tx.workflowInstanceStep.update({
            where: { id: currentStep.id },
            data: {
              status: 'PENDING',
              approverId: currentStep.backupApproverId,
              approverRoleCode: currentStep.backupApproverRoleCode,
              comment: action.comment,
            },
          });

          await tx.workflowInstance.update({
            where: { id: instanceId },
            data: {
              status: 'ESCALATED',
              currentLevel: currentStep.level,
            },
          });
        }

        await tx.workflowInstanceLog.create({
          data: {
            instanceId,
            stepId: currentStep.id,
            action: 'ESCALATED',
            actorId: userId,
            comment: action.comment,
          },
        });
      }

      return tx.workflowInstance.findUnique({
        where: { id: instanceId },
        include: {
          template: { select: { id: true, name: true, approvalType: true } },
          steps: { orderBy: { level: 'asc' } },
          logs: { orderBy: { createdAt: 'desc' } },
        },
      });
    });
  }
}

export const workflowEngineRepository = new WorkflowEngineRepository();
