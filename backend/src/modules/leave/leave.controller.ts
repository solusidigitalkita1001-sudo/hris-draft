import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { leaveService } from './leave.service';
import { Result } from '@/shared/core/Result';
import { runYearlyLeaveAccrual } from './leave.scheduler';

export class LeaveController {
  async findAllLeaveTypes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findAllLeaveTypes(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async createLeaveType(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.createLeaveType(req.body))); }
    catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await leaveService.findAllLeaveRequests(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
        leaveTypeId: req.query.leaveTypeId as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findLeaveRequestById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.employeeId) req.body.employeeId = req.user.employeeId;
      res.status(201).json(Result.created(await leaveService.createLeaveRequest(req.body)));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.approveLeave(req.params.id as string, req.user!.id, req.user!.employeeId);
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.rejectLeave(req.params.id as string, req.body.reason, req.user!.employeeId);
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async getWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await leaveService.getLeaveWorkflow(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async applyWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await leaveService.applyWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' }
      );
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.getLeaveBalances(req.query.employeeId as string))); }
    catch (error) { next(error); }
  }

  async setBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.setLeaveBalance(req.body))); }
    catch (error) { next(error); }
  }

  async triggerYearlyAccrual(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const year = req.body.year ?? new Date().getFullYear();
      const result = await runYearlyLeaveAccrual(year);
      res.json(Result.success(result));
    } catch (error) { next(error); }
  }
}

export const leaveController = new LeaveController();
