import { Request, Response, NextFunction } from 'express';
import { trainingEvaluationService } from './training-evaluation.service';
import type { RecordTrainingScoreDTO, SubmitTrainingFeedbackDTO } from './training.dto';
import { trainingService } from './training.service';
import { Result } from '@/shared/core/Result';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { prisma } from '@/shared/database/prisma';

export class TrainingController {
  private async getEmployeeContext(req: AuthenticatedRequest) {
    if (!req.user) {
      throw new ForbiddenError('Authentication required');
    }

    const employeeId = req.user.employeeId || (
      await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { employeeId: true },
      })
    )?.employeeId;

    if (!employeeId) {
      throw new ForbiddenError('This account is not linked to an employee profile');
    }

    if (!req.user.companyId) {
      throw new ForbiddenError('This account does not have an active company scope');
    }

    return {
      employeeId,
      companyId: req.user.companyId,
    };
  }

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

  async enrollSelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { employeeId, companyId } = await this.getEmployeeContext(req);
      res.status(201).json(
        Result.created(await trainingService.enrollSelf(req.params.id as string, employeeId, companyId))
      );
    } catch (error) { next(error); }
  }

  async completeSelf(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { employeeId, companyId } = await this.getEmployeeContext(req);
      res.json(
        Result.updated(await trainingService.completeSelf(req.params.id as string, employeeId, companyId))
      );
    } catch (error) { next(error); }
  }

  // ==================== Evaluasi pasca-training ====================
  async recordScore(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      res.json(Result.success(
        await trainingEvaluationService.recordScore(companyId, String(req.params.id), req.body as RecordTrainingScoreDTO),
      ));
    } catch (error) { next(error); }
  }

  async submitFeedback(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      res.status(201).json(Result.success(
        await trainingEvaluationService.submitFeedback(companyId, String(req.params.id), req.body as SubmitTrainingFeedbackDTO),
        'Terima kasih — masukanmu tercatat.',
      ));
    } catch (error) { next(error); }
  }

  /** Rekap efektivitas per kursus — satu-satunya pertanyaan yang rating itu dikumpulkan untuk menjawabnya. */
  async courseEffectiveness(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      const data = await trainingEvaluationService.courseEffectiveness(companyId, req.query.courseId as string | undefined);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findEvaluation(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.user?.companyId;
      if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
      res.json(Result.success(await trainingEvaluationService.findByEnrollment(companyId, String(req.params.id))));
    } catch (error) { next(error); }
  }
}

export const trainingController = new TrainingController();
