import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { attendanceService } from './attendance.service';
import { Result } from '@/shared/core/Result';

export class AttendanceController {
  async findAll(req: Request, res: Response, next: NextFunction) {
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

  async findById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await attendanceService.findById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async create(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await attendanceService.create(req.body))); }
    catch (error) { next(error); }
  }

  async getContext(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.getResolvedContext(
        req.query.employeeId as string,
        req.query.date as string,
        req.query.companyId as string | undefined,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async checkOut(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.checkOut(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try { await attendanceService.delete(req.params.id as string); res.json(Result.deleted()); }
    catch (error) { next(error); }
  }

  async correction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.correction(req.params.id as string, req.body);
      res.json(Result.updated(data));
    } catch (error) { next(error); }
  }

  async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const data = await attendanceService.getSummary(companyId, month, year);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async getReport(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, month, year } = req.query as { companyId: string; month: string; year: string };
      const csv = await attendanceService.getReport(companyId, month, year);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="attendance-report-${month}-${year}.csv"`);
      res.send(csv);
    } catch (error) { next(error); }
  }

  // Overtime
  async findAllOvertime(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await attendanceService.findAllOvertime(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async createOvertime(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await attendanceService.createOvertime(req.body))); }
    catch (error) { next(error); }
  }

  async approveOvertime(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.approveOvertime(req.params.id as string, req.user!.id))); }
    catch (error) { next(error); }
  }

  async rejectOvertime(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await attendanceService.rejectOvertime(req.params.id as string))); }
    catch (error) { next(error); }
  }
}

export const attendanceController = new AttendanceController();
