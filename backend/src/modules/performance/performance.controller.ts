import { Request, Response, NextFunction } from 'express';
import { performanceService } from './performance.service';
import { Result } from '@/shared/core/Result';

export class PerformanceController {
  async findAllCycles(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; res.json(Result.success(await performanceService.findAllCycles(companyId))); }
    catch (error) { next(error); }
  }

  async createCycle(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createCycle(req.body))); }
    catch (error) { next(error); }
  }

  async findAllReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const filters = { employeeId: req.query.employeeId as string, cycleId: req.query.cycleId as string, status: req.query.status as string };
      res.json(Result.success(await performanceService.findAllReviews(companyId, filters)));
    } catch (error) { next(error); }
  }

  async findReviewById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await performanceService.findReviewById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createReview(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createReview(req.body))); }
    catch (error) { next(error); }
  }

  async submitReview(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.submitReview(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async approveReview(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.approveReview(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async findAllGoals(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; const eid = req.query.employeeId as string; res.json(Result.success(await performanceService.findAllGoals(companyId, eid))); }
    catch (error) { next(error); }
  }

  async createGoal(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.createGoal(req.body))); }
    catch (error) { next(error); }
  }

  async updateGoalProgress(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await performanceService.updateGoalProgress(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async getFeedbackRequests(req: Request, res: Response, next: NextFunction) {
    try { const companyId = req.query.companyId as string; const rid = req.query.recipientId as string; res.json(Result.success(await performanceService.getFeedbackRequests(companyId, rid))); }
    catch (error) { next(error); }
  }

  async requestFeedback(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.requestFeedback(req.body))); }
    catch (error) { next(error); }
  }

  async submitFeedback(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await performanceService.submitFeedback(req.body))); }
    catch (error) { next(error); }
  }
}

export const performanceController = new PerformanceController();
