import { Response, NextFunction } from 'express';
import { reportsRepository } from './reports.repository';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { BadRequestError } from '@/shared/exceptions/AppError';

export class ReportsController {
  private resolveCompanyId(req: AuthenticatedRequest) {
    const companyId = (req.query.companyId as string | undefined) || req.user?.companyId;
    if (!companyId) {
      throw new BadRequestError('companyId is required');
    }
    return companyId;
  }

  async dashboardSummary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.dashboardSummary(
        this.resolveCompanyId(req),
        req.user!.id,
        req.user!.roles || [],
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async headcount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.headcount(
        this.resolveCompanyId(req),
        req.query.departmentId as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async attendance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.attendance(
        this.resolveCompanyId(req),
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async leave(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.leave(
        this.resolveCompanyId(req),
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async payroll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.payroll(
        this.resolveCompanyId(req),
        req.query.periodId as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async turnover(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.turnover(
        this.resolveCompanyId(req),
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async recruitment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await reportsRepository.recruitment(
        this.resolveCompanyId(req),
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }
}

export const reportsController = new ReportsController();
