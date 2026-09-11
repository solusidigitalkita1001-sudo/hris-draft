import { prisma } from '@/shared/database/prisma';
import type { Prisma } from '@prisma/client';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { getCurrentCompanyId, getCurrentRoles, isSuperAdmin, getRequestContext } from '@/shared/context/RequestContext';
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

  async findDefaultTemplate(companyId: string, approvalType: string, resource: string) {
    return prisma.workflowTemplate.findFirst({
      where: {
        companyId,
        approvalType,
        resource,
        isActive: true,
        OR: [{ effectiveFrom: null }, { effectiveFrom: { lte: new Date() } }],
      },
      orderBy: [{ version: 'desc' }, { createdAt: 'desc' }],
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
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
      const current = await tx.workflowTemplate.findUnique({
        where: { id },
        include: { stages: { orderBy: { level: 'asc' }, include: { conditionRules: true } } },
      });
      if (!current) throw new NotFoundError('Workflow template not found');

      // Metadata-only edits stay in place; structural (stage) edits are
      // copy-on-write. The old delete-and-recreate nulled stageId on every
      // in-flight instance step and rewrote history under running approvals.
      if (!data.stages) {
        return tx.workflowTemplate.update({
          where: { id },
          data: {
            name: data.name,
            description: data.description,
            isActive: data.isActive,
          },
          include: { stages: { orderBy: { level: 'asc' }, include: { conditionRules: true } } },
        });
      }

      const nextVersion = await tx.workflowTemplate.create({
        data: {
          companyId: current.companyId,
          name: data.name ?? current.name,
          approvalType: data.approvalType ?? current.approvalType,
          resource: data.resource ?? current.resource,
          description: data.description ?? current.description,
          isActive: data.isActive ?? true,
          version: current.version + 1,
          previousVersionId: current.id,
          stages: { create: data.stages.map(mapStageCreate) },
        },
        include: { stages: { orderBy: { level: 'asc' }, include: { conditionRules: true } } },
      });

      // Retire the old version; its stages stay linked to in-flight steps.
      await tx.workflowTemplate.update({ where: { id }, data: { isActive: false } });

      return nextVersion;
    });
  }

  async deleteTemplate(id: string) {
    // Templates with workflow history are retired, never destroyed: instances
    // reference them (FK Restrict) and the audit trail must survive.
    const instances = await prisma.workflowInstance.count({ where: { templateId: id } });
    if (instances > 0) {
      return prisma.workflowTemplate.update({ where: { id }, data: { isActive: false } });
    }
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

  async listDelegations(companyId: string, delegatorId?: string) {
    return prisma.approvalDelegation.findMany({
      where: { companyId, ...(delegatorId ? { delegatorId } : {}) },
      orderBy: { createdAt: 'desc' },
      include: {
        delegator: { select: { id: true, email: true } },
        delegate: { select: { id: true, email: true } },
      },
    });
  }

  async createDelegation(data: { companyId: string; delegatorId: string; delegateId: string; startDate: Date; endDate: Date; reason?: string }) {
    if (data.delegateId === data.delegatorId) {
      throw new BadRequestError('Tidak dapat mendelegasikan approval ke diri sendiri');
    }
    if (data.endDate.getTime() < data.startDate.getTime()) {
      throw new BadRequestError('Tanggal akhir delegasi harus setelah tanggal mulai');
    }
    const delegate = await prisma.user.findFirst({
      where: { id: data.delegateId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!delegate) throw new NotFoundError('Delegate user tidak ditemukan atau tidak aktif');
    return prisma.approvalDelegation.create({ data });
  }

  async revokeDelegation(id: string, delegatorId: string) {
    const revoked = await prisma.approvalDelegation.updateMany({
      where: { id, delegatorId, isActive: true },
      data: { isActive: false },
    });
    if (revoked.count !== 1) throw new ConflictError('Delegasi tidak ditemukan atau sudah dicabut');
    return prisma.approvalDelegation.findFirstOrThrow({ where: { id } });
  }

  /** User ids the given user may act as right now: themselves + active delegators. */
  async resolveDelegatedApproverIds(userId: string): Promise<string[]> {
    const now = new Date();
    const delegations = await prisma.approvalDelegation.findMany({
      where: { delegateId: userId, isActive: true, startDate: { lte: now }, endDate: { gte: now } },
      select: { delegatorId: true },
    });
    return [userId, ...delegations.map((d) => d.delegatorId)];
  }

  async findMyApprovals(companyId: string, userId: string, roles: string[]) {
    const actorIds = await this.resolveDelegatedApproverIds(userId);
    return prisma.workflowInstanceStep.findMany({
      where: {
        instance: { companyId },
        isCurrent: true,
        status: 'PENDING',
        OR: [
          { approverId: { in: actorIds } },
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
    const instance = await prisma.workflowInstance.findUnique({
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

    if (instance) {
      const currentCompanyId = getCurrentCompanyId();
      const roles = getCurrentRoles();
      const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
      if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
        throw new NotFoundError('Workflow instance not found');
      }
    }

    return instance;
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
      throw new NotFoundError('Workflow template not found');
    }

    if (template.companyId !== data.companyId) {
      throw new BadRequestError('Workflow template does not belong to the provided company');
    }

    const payload = (data.payload || {}) as Payload;
    const requesterRoles = getCurrentRoles();
    const hasElevatedRole = requesterRoles.some((r) =>
      ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(r)
    );
    const currentUser = getRequestContext()?.user;

    if (payload.employeeId && !hasElevatedRole && requesterRoles.includes('EMPLOYEE')) {
      if (currentUser?.employeeId && payload.employeeId !== currentUser.employeeId) {
        throw new ForbiddenError('IDOR: Employee cannot start workflow for other employees');
      }
    }

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
      throw new BadRequestError('No workflow stage matches the provided payload');
    }

    // Resolve MANAGER stages against the subject employee's reporting line
    // and refuse to start when any stage has no actionable approver — a step
    // nobody can act on dead-locks the request forever.
    const resolvedStages = [] as Array<(typeof applicableStages)[number] & { resolvedApproverId: string | null; resolvedBackupApproverId: string | null; resolvedApproverRoleCode: string | null }>;
    for (const stage of applicableStages) {
      let approverId = stage.approverId ?? null;
      let approverRoleCode = stage.approverRoleCode ?? null;
      let backupApproverId = stage.backupApproverId ?? null;
      if (stage.approverType === 'MANAGER') {
        const manager = await this.resolveManagerApprover(String(payload.employeeId ?? ''), data.companyId);
        if (!manager) {
          throw new BadRequestError(`Workflow stage "${stage.name}" requires a reporting-line manager, but none could be resolved for this employee. Check the position hierarchy.`);
        }
        approverId = manager.userId;
        backupApproverId = backupApproverId ?? manager.backupUserId;
        approverRoleCode = null;
      }
      if (!approverId && !approverRoleCode) {
        throw new BadRequestError(`Workflow stage "${stage.name}" has no resolvable approver; fix the template before starting this workflow.`);
      }
      resolvedStages.push({ ...stage, resolvedApproverId: approverId, resolvedApproverRoleCode: approverRoleCode, resolvedBackupApproverId: backupApproverId });
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
          currentLevel: resolvedStages[0].level,
          steps: {
            create: resolvedStages.map((stage: (typeof resolvedStages)[number], index: number) => ({
              stageId: stage.id,
              name: stage.name,
              level: stage.level,
              approverType: stage.approverType,
              approverRoleCode: stage.resolvedApproverRoleCode,
              approverId: stage.resolvedApproverId,
              backupApproverRoleCode: stage.backupApproverRoleCode,
              backupApproverId: stage.resolvedBackupApproverId,
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

  /**
   * Cancel the open workflow instance attached to a domain record, so a
   * cancelled request stops sitting in approver queues forever (and cannot be
   * approved afterwards). No-op when no open instance exists.
   */
  async cancelInstanceByReference(referenceType: string, referenceId: string, actorId: string, comment?: string) {
    const instance = await prisma.workflowInstance.findFirst({
      where: { referenceType, referenceId, status: { in: ['PENDING', 'ESCALATED'] } },
      select: { id: true, status: true },
    });
    if (!instance) return null;
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.workflowInstance.updateMany({
        where: { id: instance.id, status: { in: ['PENDING', 'ESCALATED'] } },
        data: { status: 'CANCELLED', currentLevel: null },
      });
      if (claimed.count !== 1) return null;
      await tx.workflowInstanceStep.updateMany({
        where: { instanceId: instance.id, status: 'PENDING' },
        data: { status: 'SKIPPED', isCurrent: false },
      });
      await tx.workflowInstanceLog.create({
        data: { instanceId: instance.id, action: 'COMMENTED', actorId, comment: comment ?? 'Request dibatalkan' },
      });
      return instance.id;
    });
  }

  /**
   * Reporting line: employee -> position -> reportsTo position -> the active
   * user(s) of whoever holds that position. First holder approves, second (if
   * any) becomes the backup.
   */
  private async resolveManagerApprover(employeeId: string, companyId: string): Promise<{ userId: string; backupUserId: string | null } | null> {
    if (!employeeId) return null;
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: { positionId: true },
    });
    if (!employee?.positionId) return null;
    const position = await prisma.position.findFirst({
      where: { id: employee.positionId, deletedAt: null },
      select: { reportsToId: true },
    });
    if (!position?.reportsToId) return null;
    const managers = await prisma.employee.findMany({
      where: { positionId: position.reportsToId, companyId, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
      take: 2,
    });
    if (!managers.length) return null;
    const users = await prisma.user.findMany({
      where: { employeeId: { in: managers.map((m) => m.id) }, deletedAt: null, status: 'ACTIVE' },
      select: { id: true },
      take: 2,
    });
    if (!users.length) return null;
    return { userId: users[0].id, backupUserId: users[1]?.id ?? null };
  }

  async applyAction(
    instanceId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO,
    opts: { actorEmployeeId?: string | null } = {},
  ) {
    const instance = await prisma.workflowInstance.findUnique({
      where: { id: instanceId },
      include: {
        steps: {
          orderBy: { level: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new NotFoundError('Workflow instance not found');
    }

    if (!['PENDING', 'ESCALATED'].includes(instance.status)) {
      throw new ConflictError('Workflow is no longer pending');
    }
    if (action.action === 'REJECT' && !action.comment?.trim()) {
      throw new BadRequestError('A rejection reason is required');
    }
    if (action.action === 'APPROVE' || action.action === 'REJECT' || action.action === 'ESCALATE') {
      if (instance.requesterId === userId) {
        throw new ForbiddenError('Cannot approve/reject your own request via workflow');
      }
      // Subject-level self-approval: the employee the request is ABOUT cannot
      // act on it, even when HR filed it on their behalf (requesterId differs).
      const payload = (instance.payload ?? {}) as Record<string, unknown>;
      const subjectEmployeeIds = [payload.employeeId, payload.targetEmployeeId]
        .filter((value): value is string => typeof value === 'string' && value.length > 0);
      const actorEmployeeId = opts.actorEmployeeId ?? getRequestContext()?.user?.employeeId ?? null;
      if (actorEmployeeId && subjectEmployeeIds.includes(actorEmployeeId)) {
        throw new ForbiddenError('Cannot act on a workflow that concerns yourself');
      }
      // Separation of duties: one user decides at most one level per instance.
      if (instance.steps.some((step: (typeof instance.steps)[number]) => step.actedBy === userId && step.status !== 'PENDING')) {
        throw new ForbiddenError('Separation of duties: you already acted on an earlier step of this workflow');
      }
    }

    const currentStep = instance.steps.find(
      (step: (typeof instance.steps)[number]) => step.isCurrent && step.status === 'PENDING'
    );
    if (!currentStep) {
      throw new BadRequestError('No pending approval step found');
    }

    // Delegation (checklist §6): an active delegate may act as the assigned
    // approver. Resolved only when the direct/role checks miss, to avoid the
    // query on the common path.
    let canAct =
      currentStep.approverId === userId ||
      (!!currentStep.approverRoleCode && roles.includes(currentStep.approverRoleCode)) ||
      roles.includes('SUPER_ADMIN');
    if (!canAct && currentStep.approverId) {
      const actorIds = await this.resolveDelegatedApproverIds(userId);
      canAct = actorIds.includes(currentStep.approverId);
    }

    if (!canAct) {
      throw new ForbiddenError('You are not allowed to act on this workflow step');
    }

    return prisma.$transaction(async (tx) => {
      // Lock and compare the instance snapshot before changing steps or logs.
      const claimed = await tx.workflowInstance.updateMany({
        where: { id: instanceId, status: instance.status, currentLevel: currentStep.level, updatedAt: instance.updatedAt },
        data: { updatedAt: new Date() },
      });
      if (claimed.count !== 1) throw new ConflictError('Workflow changed; reload before taking action');

      const transitionCurrentStep = async (data: Prisma.WorkflowInstanceStepUpdateManyMutationInput) => {
        const result = await tx.workflowInstanceStep.updateMany({
          where: {
            id: currentStep.id, instanceId, status: 'PENDING', isCurrent: true,
            approverId: currentStep.approverId, approverRoleCode: currentStep.approverRoleCode,
            updatedAt: currentStep.updatedAt,
          },
          data,
        });
        if (result.count !== 1) throw new ConflictError('Approval step changed; reload before taking action');
      };

      if (action.action === 'APPROVE') {
        const nextStep = instance.steps.find(
          (step: (typeof instance.steps)[number]) => step.level > currentStep.level
        );

        await transitionCurrentStep({
            status: 'APPROVED',
            isCurrent: false,
            actedBy: userId,
            actedAt: new Date(),
            comment: action.comment,
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
        await transitionCurrentStep({
            status: 'REJECTED',
            isCurrent: false,
            actedBy: userId,
            actedAt: new Date(),
            comment: action.comment,
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
            throw new BadRequestError('No backup approver or next step available for escalation');
          }

          await transitionCurrentStep({
              status: 'ESCALATED',
              isCurrent: false,
              actedBy: userId,
              actedAt: new Date(),
              comment: action.comment,
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
          if (currentStep.approverId === currentStep.backupApproverId && currentStep.approverRoleCode === currentStep.backupApproverRoleCode) {
            throw new BadRequestError('Workflow is already assigned to its backup approver');
          }
          await transitionCurrentStep({
              status: 'PENDING',
              approverId: currentStep.backupApproverId,
              approverRoleCode: currentStep.backupApproverRoleCode,
              comment: action.comment,
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

  async bulkApplyAction(
    instanceIds: string[],
    userId: string,
    roles: string[],
    action: WorkflowActionDTO
  ): Promise<{
    total: number;
    successful: number;
    failed: number;
    results: Array<{
      instanceId: string;
      success: boolean;
      status?: string;
      error?: string;
    }>;
  }> {
    const currentCompanyId = getCurrentCompanyId();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');

    const results: Array<{
      instanceId: string;
      success: boolean;
      status?: string;
      error?: string;
    }> = [];
    let successful = 0;
    let failed = 0;

    for (const instanceId of instanceIds) {
      try {
        const instance = await prisma.workflowInstance.findUnique({
          where: { id: instanceId },
          select: { companyId: true, status: true },
        });

        if (!instance) {
          results.push({
            instanceId,
            success: false,
            error: 'Workflow instance not found',
          });
          failed++;
          continue;
        }

        if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
          results.push({
            instanceId,
            success: false,
            error: 'Company scope mismatch: instance does not belong to current company',
          });
          failed++;
          continue;
        }

        const updated = await this.applyAction(instanceId, userId, roles, action);
        results.push({
          instanceId,
          success: true,
          status: updated?.status ?? undefined,
        });
        successful++;
      } catch (err: any) {
        results.push({
          instanceId,
          success: false,
          error: err?.message || 'Unknown error',
        });
        failed++;
      }
    }

    return {
      total: instanceIds.length,
      successful,
      failed,
      results,
    };
  }
}

export const workflowEngineRepository = new WorkflowEngineRepository();
