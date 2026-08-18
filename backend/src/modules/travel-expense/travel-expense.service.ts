import { travelExpenseRepository } from './travel-expense.repository';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { getRequestContext, getCurrentCompanyId, getCurrentRoles } from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import { NotFoundError, ForbiddenError, BadRequestError } from '@/shared/exceptions/AppError';
import prisma from '@/shared/database/prisma';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';
import type {
  CreateBusinessTripDTO,
  CreateExpenseClaimDTO,
  CreateTravelAdvanceDTO,
  ReimburseExpenseClaimDTO,
} from './travel-expense.dto';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

const ELEVATED_ROLES = ['HR_STAFF', 'HR_MANAGER', 'COMPANY_ADMIN', 'GROUP_ADMIN', 'SUPER_ADMIN', 'MANAGER', 'FINANCE'];

export class TravelExpenseService {
  getExpenseCategories() {
    return travelExpenseRepository.getExpenseCategories();
  }

  async findTrips(companyId: string, status?: string) {
    return travelExpenseRepository.findTrips(companyId, status);
  }

  async findMyTrips(employeeId: string, status?: string) {
    return travelExpenseRepository.findMyTrips(employeeId, status);
  }

  async findTripById(id: string) {
    const trip = await travelExpenseRepository.findTripById(id);
    if (!trip) throw new NotFoundError('Business trip not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && trip.companyId !== currentCompanyId) {
      throw new NotFoundError('Business trip not found');
    }

    return trip;
  }

  private async resolveDefaultTripTemplateId(companyId: string): Promise<string> {
    const template = await travelExpenseRepository.findDefaultTemplateTrip(companyId);
    if (!template) {
      throw new BadRequestError(
        'No default business trip workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createTrip(data: CreateBusinessTripDTO & { companyId: string }) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) => ELEVATED_ROLES.includes(r));

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      data.employeeId = currentUser.employeeId;
    }

    const requesterId = currentUser?.id ?? undefined;

    return prisma.$transaction(async (tx) => {
      const trip = await travelExpenseRepository.createTrip(data);

      try {
        const templateId = await this.resolveDefaultTripTemplateId(data.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: data.companyId,
          approvalType: 'BUSINESS_TRIP',
          referenceType: 'BUSINESS_TRIP',
          referenceId: trip.id,
          payload: {
            employeeId: data.employeeId,
            destination: data.destination,
            purpose: data.purpose,
            startDate: data.startDate,
            endDate: data.endDate,
            estimatedCost: data.estimatedCost,
            companyId: data.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for business trip', {
          tripId: trip.id,
          error: wfErr?.message,
        });
      }

      logger.info('Business trip created with workflow', {
        employeeId: data.employeeId,
        destination: data.destination,
      });
      return trip;
    });
  }

  async finalizeTripApproval(tripId: string, approverId: string) {
    return travelExpenseRepository.applyApprovalTripEffects(tripId, approverId);
  }

  async finalizeTripReject(tripId: string, approverId: string, rejectionReason?: string) {
    return travelExpenseRepository.finalizeRejectTripEffects(tripId, approverId, rejectionReason);
  }

  async applyTripWorkflowAction(
    tripId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource }
  ) {
    const trip = await this.findTripById(tripId);

    const instance = await travelExpenseRepository.findInstanceByTripId(tripId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this business trip');
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
      { action: action.action, comment: action.comment }
    );

    if (updatedInstance && updatedInstance.status === 'APPROVED') {
      await this.finalizeTripApproval(tripId, userId);
    }

    if (action.action === 'REJECT') {
      await this.finalizeTripReject(tripId, userId, action.comment);
    }

    const finalTrip = await travelExpenseRepository.findTripById(tripId);
    return { trip: finalTrip, workflowInstance: updatedInstance };
  }

  async approveTrip(id: string, userId: string, approverEmployeeId?: string | null) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyTripWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectTrip(id: string, userId: string, approverEmployeeId?: string | null, reason?: string) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyTripWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  async getTripWorkflow(tripId: string) {
    const instance = await travelExpenseRepository.findInstanceByTripId(tripId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this business trip');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async createAdvance(tripId: string, data: CreateTravelAdvanceDTO & { companyId: string }) {
    return travelExpenseRepository.createAdvance(tripId, data);
  }

  async findClaims(companyId: string, status?: string) {
    return travelExpenseRepository.findClaims(companyId, status);
  }

  async findMyClaims(employeeId: string, status?: string) {
    return travelExpenseRepository.findMyClaims(employeeId, status);
  }

  async findClaimById(id: string) {
    const claim = await travelExpenseRepository.findClaimById(id);
    if (!claim) throw new NotFoundError('Expense claim not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && claim.companyId !== currentCompanyId) {
      throw new NotFoundError('Expense claim not found');
    }

    return claim;
  }

  private async resolveDefaultClaimTemplateId(companyId: string): Promise<string> {
    const template = await travelExpenseRepository.findDefaultTemplateClaim(companyId);
    if (!template) {
      throw new BadRequestError(
        'No default expense claim workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createClaim(data: CreateExpenseClaimDTO & { companyId: string }) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) => ELEVATED_ROLES.includes(r));

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      data.employeeId = currentUser.employeeId;
    }

    const requesterId = currentUser?.id ?? undefined;

    return prisma.$transaction(async (tx) => {
      const claim = await travelExpenseRepository.createClaim(data);

      try {
        const templateId = await this.resolveDefaultClaimTemplateId(data.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: data.companyId,
          approvalType: 'EXPENSE_CLAIM',
          referenceType: 'EXPENSE_CLAIM',
          referenceId: claim.id,
          payload: {
            employeeId: data.employeeId,
            tripId: data.tripId,
            category: data.category,
            amount: data.amount,
            description: data.description,
            expenseDate: data.expenseDate,
            companyId: data.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for expense claim', {
          claimId: claim.id,
          error: wfErr?.message,
        });
      }

      logger.info('Expense claim created with workflow', {
        employeeId: data.employeeId,
        category: data.category,
        amount: data.amount,
      });
      return claim;
    });
  }

  async finalizeClaimApproval(claimId: string, approverId: string) {
    return travelExpenseRepository.applyApprovalClaimEffects(claimId, approverId);
  }

  async finalizeClaimReject(claimId: string, approverId: string, rejectionReason?: string) {
    return travelExpenseRepository.finalizeRejectClaimEffects(claimId, approverId, rejectionReason);
  }

  async applyClaimWorkflowAction(
    claimId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource }
  ) {
    const claim = await this.findClaimById(claimId);

    const instance = await travelExpenseRepository.findInstanceByClaimId(claimId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this expense claim');
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
      { action: action.action, comment: action.comment }
    );

    if (updatedInstance && updatedInstance.status === 'APPROVED') {
      await this.finalizeClaimApproval(claimId, userId);
    }

    if (action.action === 'REJECT') {
      await this.finalizeClaimReject(claimId, userId, action.comment);
    }

    const finalClaim = await travelExpenseRepository.findClaimById(claimId);
    return { claim: finalClaim, workflowInstance: updatedInstance };
  }

  async approveClaim(id: string, userId: string, approverEmployeeId?: string | null) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyClaimWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectClaim(id: string, userId: string, approverEmployeeId?: string | null, reason?: string) {
    const ctx = getRequestContext();
    const roles = ctx?.user?.roles ?? getCurrentRoles();
    return this.applyClaimWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  async getClaimWorkflow(claimId: string) {
    const instance = await travelExpenseRepository.findInstanceByClaimId(claimId);
    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this expense claim');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async reimburseClaim(id: string, processedBy: string, data: ReimburseExpenseClaimDTO & { companyId: string }) {
    return travelExpenseRepository.reimburseClaim(id, processedBy, data);
  }
}

export const travelExpenseService = new TravelExpenseService();
