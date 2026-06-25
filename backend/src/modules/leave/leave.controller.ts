import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { leaveService } from './leave.service';
import { Result } from '@/shared/core/Result';

export class LeaveController {
  async findAllLeaveTypes(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findAllLeaveTypes(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async createLeaveType(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.createLeaveType(req.body))); }
    catch (error) { next(error); }
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await leaveService.findAllLeaveRequests(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
        leaveTypeId: req.query.leaveTypeId as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.findLeaveRequestById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.createLeaveRequest(req.body))); }
    catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await leaveService.approveLeave(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }

  async reject(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await leaveService.rejectLeave(req.params.id as string, req.body.reason))); }
    catch (error) { next(error); }
  }

  async getBalances(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.getLeaveBalances(req.query.employeeId as string))); }
    catch (error) { next(error); }
  }

  async setBalance(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.setLeaveBalance(req.body))); }
    catch (error) { next(error); }
  }
}

export const leaveController = new LeaveController();
