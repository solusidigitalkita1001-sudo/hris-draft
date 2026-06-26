import { Request, Response, NextFunction } from 'express';
import { reportsRepository } from './reports.repository';
import { Result } from '@/shared/core/Result';

export class ReportsController {
  async headcount(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.headcount(
        req.query.companyId as string,
        req.query.departmentId as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async attendance(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.attendance(
        req.query.companyId as string,
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async leave(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.leave(
        req.query.companyId as string,
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async payroll(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.payroll(
        req.query.companyId as string,
        req.query.periodId as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async turnover(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.turnover(
        req.query.companyId as string,
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async recruitment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.recruitment(
        req.query.companyId as string,
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const reportsController = new ReportsController();
