import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { leaveService } from './leave.service';
import { Result } from '@/shared/core/Result';

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
      // Employee-linked users can only request leave for themselves
      if (req.user?.employeeId) req.body.employeeId = req.user.employeeId;
      res.status(201).json(Result.created(await leaveService.createLeaveRequest(req.body)));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await leaveService.approveLeave(req.params.id as string, req.user!.id, req.user!.employeeId))); }
    catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await leaveService.rejectLeave(req.params.id as string, req.body.reason, req.user!.employeeId))); }
    catch (error) { next(error); }
  }

  async getBalances(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await leaveService.getLeaveBalances(req.query.employeeId as string))); }
    catch (error) { next(error); }
  }

  async setBalance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await leaveService.setLeaveBalance(req.body))); }
    catch (error) { next(error); }
  }
}

export const leaveController = new LeaveController();
