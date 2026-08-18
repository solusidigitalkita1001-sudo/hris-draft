import { leaveRepository } from './leave.repository';
import { CreateLeaveTypeDTO, CreateLeaveRequestDTO, CreateLeaveBalanceDTO } from './leave.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';
import { calculateOpeningBalance } from '@/shared/leave/accrual';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import { getCurrentCompanyId, getCurrentRoles, getRequestContext } from '@/shared/context/RequestContext';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

export class LeaveService {
  async findAllLeaveTypes(companyId: string) {
    return leaveRepository.findAllLeaveTypes(companyId);
  }

  async createLeaveType(data: CreateLeaveTypeDTO) {
    const type = await leaveRepository.createLeaveType(data);
    logger.info('Leave type created', { typeId: type.id, code: type.code });
    return type;
  }

  async findAllLeaveRequests(companyId: string, filters?: any) {
    return leaveRepository.findAllLeaveRequests(companyId, filters);
  }

  async findLeaveRequestById(id: string) {
    const request = await leaveRepository.findLeaveRequestById(id);
    if (!request) throw new NotFoundError('Leave request not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && request.companyId !== currentCompanyId) {
      throw new NotFoundError('Leave request not found');
    }

    return request;
  }

  private async resolveDefaultWorkflowTemplateId(companyId: string): Promise<string> {
    const template = await workflowEngineRepository.findDefaultTemplate(
      companyId,
      'LEAVE_REQUEST',
      'leave'
    );
    if (!template) {
      throw new BadRequestError(
        'No default leave workflow template configured for company. Please run seed.'
      );
    }
    return template.id;
  }

  async createLeaveRequest(data: CreateLeaveRequestDTO) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) =>
      ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(r)
    );

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      if (data.employeeId !== currentUser.employeeId) {
        throw new ForbiddenError('IDOR: Employee cannot create leave request for other employees');
      }
    }

    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const computedTotalDays =
      Math.max(
        1,
        Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
      );

    const balances = await leaveRepository.findLeaveBalances(data.employeeId);
    const balance = balances.find((b) => b.leaveTypeId === data.leaveTypeId);
    if (balance && balance.remainingDays <= 0) {
      throw new BadRequestError('Insufficient leave balance');
    }

    const requesterId = currentUser?.id ?? undefined;

    return prisma.$transaction(async (tx) => {
      const request = await leaveRepository.createLeaveRequest(data);

      try {
        const templateId = await this.resolveDefaultWorkflowTemplateId(data.companyId);
        await workflowEngineRepository.startInstance(requesterId ?? 'system', {
          templateId,
          companyId: data.companyId,
          approvalType: 'LEAVE_REQUEST',
          referenceType: 'LEAVE_REQUEST',
          referenceId: request.id,
          payload: {
            leaveTypeId: data.leaveTypeId,
            totalDays: computedTotalDays,
            reason: data.reason,
            startDate: data.startDate,
            endDate: data.endDate,
            employeeId: data.employeeId,
            companyId: data.companyId,
          },
        });
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for leave request', {
          leaveRequestId: request.id,
          error: wfErr?.message,
        });
      }

      logger.info('Leave request created with workflow', {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
      });
      return request;
    });
  }

  async finalizeApprovalEffects(leaveRequestId: string) {
    return prisma.$transaction(async (tx) => {
      const [req] = await tx.$queryRaw<
        Array<{
          id: string;
          status: string;
          employee_id: string;
          leave_type_id: string;
          total_days: number;
          start_date: Date;
        }>
      >`SELECT id, status, employee_id, leave_type_id, total_days, start_date
        FROM leave_requests WHERE id = ${leaveRequestId} FOR UPDATE`;

      if (!req) throw new NotFoundError('Leave request not found');
      if (req.status === 'APPROVED') {
        return tx.leaveRequest.findUnique({ where: { id: leaveRequestId } });
      }

      const year = new Date(req.start_date).getFullYear();
      const [bal] = await tx.$queryRaw<
        Array<{ id: string; used_days: number; remaining_days: number }>
      >`SELECT id, used_days, remaining_days FROM leave_balances
        WHERE employee_id = ${req.employee_id} AND leave_type_id = ${req.leave_type_id} AND year = ${year}
        FOR UPDATE`;

      if (!bal || bal.remaining_days < req.total_days) {
        throw new BadRequestError('Leave balance tidak cukup');
      }

      await tx.leaveBalance.update({
        where: { id: bal.id },
        data: {
          usedDays: bal.used_days + req.total_days,
          remainingDays: bal.remaining_days - req.total_days,
        },
      });

      const ctx = getRequestContext();
      const approvedBy = ctx?.user?.id ?? 'workflow';

      const approved = await tx.leaveRequest.update({
        where: { id: leaveRequestId },
        data: { status: 'APPROVED', approvedBy, approvedAt: new Date() },
      });
      logger.info('Leave finalized approved via workflow', {
        id: leaveRequestId,
        employeeId: req.employee_id,
        days: req.total_days,
      });
      return approved;
    });
  }

  async applyWorkflowAction(
    leaveRequestId: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource }
  ) {
    const leaveRequest = await this.findLeaveRequestById(leaveRequestId);

    const instance = await prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'LEAVE_REQUEST',
        referenceId: leaveRequestId,
      },
    });

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this leave request');
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
      await this.finalizeApprovalEffects(leaveRequestId);
    }

    if (action.action === 'REJECT') {
      await leaveRepository.updateLeaveStatus(
        leaveRequestId,
        'REJECTED',
        undefined,
        action.comment
      );
    }

    const finalLeave = await leaveRepository.findLeaveRequestById(leaveRequestId);
    return { leaveRequest: finalLeave, workflowInstance: updatedInstance };
  }

  async approveLeave(id: string, userId: string, approverEmployeeId?: string | null) {
    const roles = getCurrentRoles();
    return this.applyWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectLeave(id: string, reason?: string, approverEmployeeId?: string | null) {
    const ctx = getRequestContext();
    const userId = ctx?.user?.id ?? 'legacy';
    const roles = ctx?.user?.roles ?? [];

    const request = await this.findLeaveRequestById(id);
    if (approverEmployeeId && approverEmployeeId === request.employeeId) {
      throw new ForbiddenError('Cannot reject your own leave request');
    }

    return this.applyWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  async getLeaveWorkflow(id: string) {
    const instance = await prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'LEAVE_REQUEST',
        referenceId: id,
      },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: { select: { id: true, name: true, approvalType: true } },
      },
    });

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this leave request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async getLeaveBalances(employeeId: string) {
    return leaveRepository.findLeaveBalances(employeeId);
  }

  async setLeaveBalance(data: CreateLeaveBalanceDTO) {
    return leaveRepository.upsertLeaveBalance(data);
  }

  async accrueAnnualBalance(params: {
    employeeId: string;
    leaveTypeId: string;
    year?: number;
    maxCarryOver?: number;
  }) {
    const year = params.year ?? new Date().getFullYear();
    const { employee, leaveType, previousBalance } = await leaveRepository.findAccrualInputs(
      params.employeeId,
      params.leaveTypeId,
      year
    );

    if (!employee) throw new NotFoundError('Employee not found');
    if (!leaveType) throw new NotFoundError('Leave type not found');
    if (!leaveType.isAnnual) {
      throw new BadRequestError('Akrual hanya berlaku untuk tipe cuti tahunan (isAnnual)');
    }
    if (!employee.joinDate) {
      throw new BadRequestError('Tanggal masuk (joinDate) karyawan belum diisi, tidak bisa pro-rate');
    }

    const { entitlement, carryOver, totalDays } = calculateOpeningBalance({
      joinDate: employee.joinDate,
      year,
      annualQuota: leaveType.maxDays,
      previousRemaining: previousBalance?.remainingDays ?? 0,
      maxCarryOver: params.maxCarryOver,
    });

    const balance = await leaveRepository.upsertAccruedBalance({
      employeeId: employee.id,
      companyId: employee.companyId,
      leaveTypeId: leaveType.id,
      year,
      totalDays,
    });

    logger.info('Leave balance accrued', {
      employeeId: employee.id,
      leaveTypeId: leaveType.id,
      year,
      entitlement,
      carryOver,
      totalDays,
    });

    return { ...balance, breakdown: { entitlement, carryOver, totalDays } };
  }
}

export const leaveService = new LeaveService();
