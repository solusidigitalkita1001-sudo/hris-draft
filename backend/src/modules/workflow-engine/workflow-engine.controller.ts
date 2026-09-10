import { NextFunction, Response } from 'express';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { workflowEngineRepository } from './workflow-engine.repository';
import { leaveService } from '@/modules/leave/leave.service';
import { employeeLoanService } from '@/modules/employee-loan/employee-loan.service';
import { travelExpenseService } from '@/modules/travel-expense/travel-expense.service';
import { workCalendarService } from '@/modules/work-calendar/work-calendar.service';
import { attendanceService } from '@/modules/attendance/attendance.service';
import { NotFoundError } from '@/shared/exceptions/AppError';

interface EngineActionInput { action: 'APPROVE' | 'REJECT' | 'ESCALATE'; comment?: string }
type DomainHandler = (
  referenceId: string,
  userId: string,
  roles: string[],
  actorEmployeeId: string | null,
  action: EngineActionInput,
) => Promise<unknown>;

/**
 * Acting through the generic engine routes MUST run the owning module's
 * workflow handler, never the bare engine transition: the domain services
 * carry the finalization side effects (leave balance deduction, loan
 * installments, …) and their own guards. A bare engine transition here would
 * flip the instance to APPROVED while the domain record stays PENDING forever.
 */
const DOMAIN_HANDLERS: Record<string, DomainHandler> = {
  LEAVE_REQUEST: (id, userId, roles, employeeId, action) =>
    leaveService.applyWorkflowAction(id, userId, roles, { ...action, source: 'WORKFLOW' }, employeeId),
  LOAN_REQUEST: (id, userId, roles, _employeeId, action) =>
    employeeLoanService.applyWorkflowAction(id, userId, roles, { ...action, source: 'WORKFLOW' }),
  BUSINESS_TRIP: (id, userId, roles, _employeeId, action) =>
    travelExpenseService.applyTripWorkflowAction(id, userId, roles, { ...action, source: 'WORKFLOW' }),
  EXPENSE_CLAIM: (id, userId, roles, _employeeId, action) =>
    travelExpenseService.applyClaimWorkflowAction(id, userId, roles, { ...action, source: 'WORKFLOW' }),
  SHIFT_SWAP_REQUEST: (id, userId, roles, employeeId, action) =>
    workCalendarService.applyShiftSwapWorkflowAction(id, userId, roles, employeeId, { ...action, source: 'WORKFLOW' }),
  OVERTIME_REQUEST: (id, userId, roles, _employeeId, action) =>
    attendanceService.applyOvertimeWorkflowAction(id, userId, roles, { ...action, source: 'WORKFLOW' }),
};

async function dispatchInstanceAction(
  instanceId: string,
  user: NonNullable<AuthenticatedRequest['user']>,
  action: EngineActionInput,
): Promise<unknown> {
  const instance = await workflowEngineRepository.findInstanceById(instanceId);
  if (!instance) throw new NotFoundError('Workflow instance not found');
  const handler = DOMAIN_HANDLERS[instance.referenceType];
  if (handler) {
    return handler(instance.referenceId, user.id, user.roles ?? [], user.employeeId ?? null, action);
  }
  // Unknown reference types have no domain side effects to run.
  return workflowEngineRepository.applyAction(instanceId, user.id, user.roles ?? [], action, {
    actorEmployeeId: user.employeeId ?? null,
  });
}

export class WorkflowEngineController {
  async findTemplates(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findTemplates(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findTemplateById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.findTemplateById(req.params.id as string);
      if (!data) {
        return res.status(404).json(Result.error('Workflow template not found'));
      }
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.createTemplate(req.body);
      res.status(201).json(Result.created(data, 'Workflow template created'));
    } catch (error) {
      next(error);
    }
  }

  async updateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.updateTemplate(req.params.id as string, req.body);
      res.json(Result.updated(data, 'Workflow template updated'));
    } catch (error) {
      next(error);
    }
  }

  async deleteTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await workflowEngineRepository.deleteTemplate(req.params.id as string);
      res.json(Result.deleted('Workflow template deleted'));
    } catch (error) {
      next(error);
    }
  }

  async findInstances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      const status = req.query.status as string | undefined;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findInstances(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyApprovals(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      if (!companyId || !req.user) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await workflowEngineRepository.findMyApprovals(companyId, req.user.id, req.user.roles || []);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findInstanceById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await workflowEngineRepository.findInstanceById(req.params.id as string);
      if (!data) {
        return res.status(404).json(Result.error('Workflow instance not found'));
      }
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async startInstance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const data = await workflowEngineRepository.startInstance(req.user.id, req.body);
      res.status(201).json(Result.created(data, 'Workflow instance started'));
    } catch (error) {
      next(error);
    }
  }

  async applyAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        return res.status(401).json(Result.error('Authentication required'));
      }

      const data = await dispatchInstanceAction(req.params.id as string, req.user, req.body);
      res.json(Result.updated(data, 'Workflow action applied'));
    } catch (error) {
      next(error);
    }
  }

  async bulkApproval(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { instanceIds, action, comment } = req.body as {
        instanceIds: string[];
        action: 'APPROVE' | 'REJECT' | 'ESCALATE';
        comment?: string;
      };
      // Each instance dispatches through its domain handler so bulk approval
      // carries the same side effects and guards as the per-module routes.
      const results: Array<{ instanceId: string; success: boolean; error?: string }> = [];
      for (const instanceId of instanceIds) {
        try {
          await dispatchInstanceAction(instanceId, req.user!, { action, comment });
          results.push({ instanceId, success: true });
        } catch (err) {
          results.push({ instanceId, success: false, error: err instanceof Error ? err.message : 'Unknown error' });
        }
      }
      const successful = results.filter((r) => r.success).length;
      res.json(Result.success({ total: results.length, successful, failed: results.length - successful, results }));
    } catch (e) {
      next(e);
    }
  }
}

export const workflowEngineController = new WorkflowEngineController();
