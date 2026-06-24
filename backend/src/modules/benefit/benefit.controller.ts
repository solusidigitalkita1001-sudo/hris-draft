import { Request, Response, NextFunction } from 'express';
import { benefitService } from './benefit.service';
import { Result } from '@/shared/core/Result';

export class BenefitController {
  // ==================== Benefit Plans ====================

  async findAllPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const data = await benefitService.findAllPlans(companyId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findPlanById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await benefitService.findPlanById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createPlan(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await benefitService.createPlan(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updatePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await benefitService.updatePlan(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await benefitService.deletePlan(id);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }

  // ==================== Benefit Enrollments ====================

  async findAllEnrollments(req: Request, res: Response, next: NextFunction) {
    try {
      const companyId = req.query.companyId as string;
      const employeeId = req.query.employeeId as string | undefined;
      const data = await benefitService.findAllEnrollments(companyId, employeeId);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findEnrollmentById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await benefitService.findEnrollmentById(id);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await benefitService.createEnrollment(req.body);
      res.status(201).json(Result.created(data));
    } catch (error) {
      next(error);
    }
  }

  async updateEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const data = await benefitService.updateEnrollment(id, req.body);
      res.json(Result.updated(data));
    } catch (error) {
      next(error);
    }
  }

  async deleteEnrollment(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      await benefitService.cancelEnrollment(id);
      res.json(Result.deleted());
    } catch (error) {
      next(error);
    }
  }
}

export const benefitController = new BenefitController();
