import { workCalendarRepository } from './work-calendar.repository';
import { CreateShiftSwapRequestDTO } from './work-calendar.dto';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';
import { getCurrentCompanyId, getCurrentRoles, getRequestContext } from '@/shared/context/RequestContext';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

export class WorkCalendarService {
  async findShiftSwapById(id: string) {
    const request = await workCalendarRepository.findShiftSwapRequestById(id);
    if (!request) throw new NotFoundError('Shift swap request not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && request.companyId !== currentCompanyId) {
      throw new NotFoundError('Shift swap request not found');
    }

    return request;
  }

  private async resolveDefaultWorkflowTemplateId(companyId: string): Promise<string> {
    const template = await workCalendarRepository.findDefaultShiftSwapTemplate(companyId);
    if (!template) {
      throw new BadRequestError(
        'No default shift swap workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createShiftSwapRequest(requesterUserId: string, data: CreateShiftSwapRequestDTO & { companyId?: string }) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) =>
      ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(r)
    );

    const requesterEmployeeId = currentUser?.employeeId ?? undefined;
    if (requesterEmployeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      // IDOR guard: untuk EMPLOYEE non elevated, create via userId path (bukan employeeId payload)
      // di repo method, createShiftSwapRequest resolve employee dari userId, jadi aman.
    }

    const requesterId = currentUser?.id ?? requesterUserId;

    return prisma.$transaction(async (tx) => {
      const request = await workCalendarRepository.createShiftSwapRequest(requesterUserId, {
        targetEmployeeId: data.targetEmployeeId,
        shiftDate: data.shiftDate,
        reason: data.reason,
      });

      try {
        const templateId = await this.resolveDefaultWorkflowTemplateId(request.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: request.companyId,
          approvalType: 'SHIFT_SWAP',
          referenceType: 'SHIFT_SWAP_REQUEST',
          referenceId: request.id,
          payload: {
            shiftDate: data.shiftDate,
            reason: data.reason,
            requesterEmployeeId: request.requesterEmployeeId,
            targetEmployeeId: request.targetEmployeeId,
            companyId: request.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for shift swap request', {
          shiftSwapRequestId: request.id,
          error: wfErr?.message,
        });
      }

      logger.info('Shift swap request created with workflow', {
        requesterEmployeeId: request.requesterEmployeeId,
        targetEmployeeId: request.targetEmployeeId,
        shiftDate: data.shiftDate,
      });
      return request;
    });
  }

  async finalizeApprovalEffects(
    requestId: string,
    approverUserId: string,
    approverEmployeeId: string,
    approvalNotes?: string,
  ) {
    return workCalendarRepository.finalizeShiftSwapApprovalEffects(
      requestId,
      approverUserId,
      approverEmployeeId,
      approvalNotes,
    );
  }

  async applyShiftSwapWorkflowAction(
    requestId: string,
    userId: string,
    roles: string[],
    approverEmployeeId: string | null,
    action: WorkflowActionDTO & { source?: WorkflowSource },
  ) {
    const shiftSwapRequest = await this.findShiftSwapById(requestId);

    const instance = await workCalendarRepository.findWorkflowInstanceByShiftSwapId(requestId);

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this shift swap request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    const updatedInstance = await workflowEngineRepository.applyAction(
      instance.id,
      userId,
      roles,
      { action: action.action, comment: action.comment },
    );

    if (!updatedInstance) {
      throw new NotFoundError('Failed to update workflow instance');
    }

    if (updatedInstance.status === 'APPROVED') {
      const approverEmpId = approverEmployeeId ?? shiftSwapRequest.approverEmployeeId;
      await this.finalizeApprovalEffects(requestId, userId, approverEmpId, action.comment);
    }

    if (action.action === 'REJECT') {
      await workCalendarRepository.finalizeShiftSwapRejectEffects(
        requestId,
        userId,
        action.comment,
      );
    }

    const finalRequest = await workCalendarRepository.findShiftSwapRequestById(requestId);
    return { shiftSwapRequest: finalRequest, workflowInstance: updatedInstance };
  }

  async approveShiftSwap(
    id: string,
    userId: string,
    approverEmployeeId?: string | null,
  ) {
    const roles = getCurrentRoles();
    return this.applyShiftSwapWorkflowAction(id, userId, roles, approverEmployeeId ?? null, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectShiftSwap(
    id: string,
    userId: string,
    notes?: string,
    approverEmployeeId?: string | null,
  ) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? [];

    return this.applyShiftSwapWorkflowAction(id, userId, roles, approverEmployeeId ?? null, {
      action: 'REJECT',
      comment: notes ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  async getShiftSwapWorkflow(id: string) {
    await this.findShiftSwapById(id);

    const instance = await workCalendarRepository.findWorkflowInstanceByShiftSwapId(id);

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this shift swap request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }
}

export const workCalendarService = new WorkCalendarService();
