import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { attendanceService } from './attendance.service';
import { Result } from '@/shared/core/Result';
import { ForbiddenError } from '@/shared/exceptions/AppError';

export class AttendanceController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.findAll(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        date: req.query.date as string,
        month: req.query.month as string,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.success(await attendanceService.findById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      // [Finding #10] Strict ownership guard: EMPLOYEE role self-service TIDAK BOLEH clock-in atas nama karyawan lain
      const isPureEmployee = req.user?.roles?.includes('EMPLOYEE') &&
        !req.user?.roles?.some((r: string) =>
          ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'BRANCH_MANAGER', 'MANAGER'].includes(r)
        );
      if (isPureEmployee && req.body.employeeId && req.body.employeeId !== req.user?.employeeId) {
        throw new ForbiddenError('Anda tidak boleh clock-in atas nama karyawan lain sebagai role EMPLOYEE');
      }
      // Elevated roles (HR/Admin/Manager) tetap bisa override employeeId untuk create attendance manual;
      // Employee-linked user tanpa elevated role: silent override ke user sendiri (existing pattern)
      if (req.user?.employeeId && isPureEmployee) {
        req.body.employeeId = req.user.employeeId;
      }
      res.status(201).json(Result.created(await attendanceService.create(req.body)));
    } catch (error) { next(error); }
  }

  async getContext(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.getResolvedContext(
        req.query.employeeId as string,
        req.query.date as string,
        req.query.companyId as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async checkOut(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.checkOut(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { await attendanceService.delete(req.params.id as string); res.json(Result.deleted()); }
    catch (error) { next(error); }
  }

  async correction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.correction(req.params.id as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async getSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const data = await attendanceService.getSummary(companyId, month, year);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async getReport(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const csv = await attendanceService.getReport(companyId, month, year);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}-${year}.csv"`);
      res.send(csv);
    } catch (error) { next(error); }
  }

  // Overtime
  async findAllOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.findAllOvertime(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async createOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.employeeId && !req.body.companyId) {
        // will be resolved in service or leave as-is if companyId provided in body
      }
      res.status(201).json(Result.created(await attendanceService.createOvertime(req.body)));
    }
    catch (error) { next(error); }
  }

  async approveOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.approveOvertime(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }

  async rejectOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.rejectOvertime(req.params.id as string, req.body.reason))); }
    catch (error) { next(error); }
  }

  async getOvertimeWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await attendanceService.getOvertimeWorkflow(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async applyOvertimeWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await attendanceService.applyOvertimeWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' },
      );
      res.json(Result.updated(result));
    } catch (error) { next(error); }
  }

  async calculateOvertimePay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const dayType = req.query.dayType === 'HOLIDAY' ? 'HOLIDAY' : 'WORKDAY';
      const workweekDays = req.query.workweekDays === '6' ? 6 : 5;
      res.json(Result.success(await attendanceService.calculateOvertimePay(req.params.id as string, { dayType, workweekDays })));
    } catch (error) { next(error); }
  }
}

export const attendanceController = new AttendanceController();
