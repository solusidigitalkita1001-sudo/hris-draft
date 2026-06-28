import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { travelExpenseRepository } from './travel-expense.repository';

export class TravelExpenseController {
  async getExpenseCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(travelExpenseRepository.getExpenseCategories()));
    } catch (error) {
      next(error);
    }
  }

  async findTrips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      const status = req.query.status as string | undefined;

      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.findTrips(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyTrips(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const status = req.query.status as string | undefined;

      if (!employeeId) {
        return res.status(400).json(Result.error('employeeId is required'));
      }

      const data = await travelExpenseRepository.findMyTrips(employeeId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.createTrip({
        ...req.body,
        companyId,
      });
      res.status(201).json(Result.created(data, 'Travel request created'));
    } catch (error) {
      next(error);
    }
  }

  async approveTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseRepository.approveTrip(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Travel request approved'));
    } catch (error) {
      next(error);
    }
  }

  async rejectTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseRepository.rejectTrip(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Travel request rejected'));
    } catch (error) {
      next(error);
    }
  }

  async createAdvance(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.createAdvance(req.params.id as string, {
        ...req.body,
        companyId,
      });
      res.status(201).json(Result.created(data, 'Travel advance created'));
    } catch (error) {
      next(error);
    }
  }

  async findClaims(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = (req.query.companyId as string) || req.user?.companyId;
      const status = req.query.status as string | undefined;

      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.findClaims(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyClaims(req: Request, res: Response, next: NextFunction) {
    try {
      const employeeId = req.query.employeeId as string | undefined;
      const status = req.query.status as string | undefined;

      if (!employeeId) {
        return res.status(400).json(Result.error('employeeId is required'));
      }

      const data = await travelExpenseRepository.findMyClaims(employeeId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.createClaim({
        ...req.body,
        companyId,
      });
      res.status(201).json(Result.created(data, 'Expense claim created'));
    } catch (error) {
      next(error);
    }
  }

  async approveClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseRepository.approveClaim(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Expense claim approved'));
    } catch (error) {
      next(error);
    }
  }

  async rejectClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseRepository.rejectClaim(req.params.id as string, req.user!.id, req.body);
      res.json(Result.updated(data, 'Expense claim rejected'));
    } catch (error) {
      next(error);
    }
  }

  async reimburseClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = req.body.companyId || req.user?.companyId;
      if (!companyId) {
        return res.status(400).json(Result.error('companyId is required'));
      }

      const data = await travelExpenseRepository.reimburseClaim(req.params.id as string, req.user!.id, {
        ...req.body,
        companyId,
      });
      res.json(Result.updated(data, 'Expense claim reimbursed'));
    } catch (error) {
      next(error);
    }
  }
}

export const travelExpenseController = new TravelExpenseController();
