import { Request, Response, NextFunction } from 'express';
import { trainingService } from './training.service';
import { Result } from '@/shared/core/Result';

export class TrainingController {
  async findAllCategories(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await trainingService.findAllCategories(req.query.companyId as string))); }
    catch (error) { next(error); }
  }

  async createCategory(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await trainingService.createCategory(req.body))); }
    catch (error) { next(error); }
  }

  async findAllCourses(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await trainingService.findAllCourses(req.query.companyId as string, req.query.categoryId as string))); }
    catch (error) { next(error); }
  }

  async findCourseById(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await trainingService.findCourseById(req.params.id as string))); }
    catch (error) { next(error); }
  }

  async createCourse(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await trainingService.createCourse(req.body))); }
    catch (error) { next(error); }
  }

  async updateCourse(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await trainingService.updateCourse(req.params.id as string, req.body))); }
    catch (error) { next(error); }
  }

  async findAllSessions(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await trainingService.findAllSessions(req.query.courseId as string))); }
    catch (error) { next(error); }
  }

  async createSession(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await trainingService.createSession(req.body))); }
    catch (error) { next(error); }
  }

  async findAllEnrollments(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.success(await trainingService.findAllEnrollments(req.query.companyId as string, req.query.employeeId as string))); }
    catch (error) { next(error); }
  }

  async createEnrollment(req: Request, res: Response, next: NextFunction) {
    try { res.status(201).json(Result.created(await trainingService.createEnrollment(req.body))); }
    catch (error) { next(error); }
  }

  async completeEnrollment(req: Request, res: Response, next: NextFunction) {
    try { res.json(Result.updated(await trainingService.completeEnrollment(req.params.id as string))); }
    catch (error) { next(error); }
  }
}

export const trainingController = new TrainingController();
