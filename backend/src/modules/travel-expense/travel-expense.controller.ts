import { NextFunction, Request, Response } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { travelExpenseService } from './travel-expense.service';
import { BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { prisma } from '@/shared/database/prisma';
import config from '@/config';

export class TravelExpenseController {
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

  async getExpenseCategories(_req: Request, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(travelExpenseService.getExpenseCategories()));
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

      const data = await travelExpenseService.findTrips(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyTrips(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { employeeId } = await this.getEmployeeContext(req);
      const status = req.query.status as string | undefined;

      const data = await travelExpenseService.findMyTrips(employeeId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findTripById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseService.findTripById(req.params.id as string);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, employeeId } = await this.getEmployeeContext(req);

      const data = await travelExpenseService.createTrip({
        ...req.body,
        companyId,
        employeeId,
      });
      res.status(201).json(Result.created(data, 'Travel request created'));
    } catch (error) {
      next(error);
    }
  }

  async approveTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trip = await travelExpenseService.findTripById(req.params.id as string);
      if (req.user!.employeeId && req.user!.employeeId === trip.employeeId) {
        throw new ForbiddenError('Cannot approve your own travel request');
      }
      const data = await travelExpenseService.approveTrip(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId
      );
      res.json(Result.updated(data, 'Travel request approved via workflow'));
    } catch (error) {
      next(error);
    }
  }

  async rejectTrip(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const trip = await travelExpenseService.findTripById(req.params.id as string);
      if (req.user!.employeeId && req.user!.employeeId === trip.employeeId) {
        throw new ForbiddenError('Cannot reject your own travel request');
      }
      const data = await travelExpenseService.rejectTrip(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId,
        req.body?.reason ?? req.body?.notes
      );
      res.json(Result.updated(data, 'Travel request rejected via workflow'));
    } catch (error) {
      next(error);
    }
  }

  async getTripWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await travelExpenseService.getTripWorkflow(req.params.id as string)));
    } catch (error) {
      next(error);
    }
  }

  async applyTripWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await travelExpenseService.applyTripWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' }
      );
      res.json(Result.updated(result));
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

      const data = await travelExpenseService.createAdvance(req.params.id as string, {
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

      const data = await travelExpenseService.findClaims(companyId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findMyClaims(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { employeeId } = await this.getEmployeeContext(req);
      const status = req.query.status as string | undefined;

      const data = await travelExpenseService.findMyClaims(employeeId, status);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async findClaimById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await travelExpenseService.findClaimById(req.params.id as string);
      res.json(Result.success(data));
    } catch (error) {
      next(error);
    }
  }

  async createClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { companyId, employeeId } = await this.getEmployeeContext(req);

      const data = await travelExpenseService.createClaim({
        ...req.body,
        companyId,
        employeeId,
      });
      res.status(201).json(Result.created(data, 'Expense claim created'));
    } catch (error) {
      next(error);
    }
  }

  async uploadReceipt(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) {
        throw new BadRequestError('Receipt file is required');
      }

      const receiptUrl = `${config.app.url}/uploads/travel-expenses/receipts/${req.file.filename}`;

      res.status(201).json(
        Result.created(
          {
            fileName: req.file.filename,
            originalName: req.file.originalname,
            mimeType: req.file.mimetype,
            size: req.file.size,
            filePath: req.file.path,
            url: receiptUrl,
          },
          'Receipt uploaded'
        )
      );
    } catch (error) {
      next(error);
    }
  }

  async approveClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const claim = await travelExpenseService.findClaimById(req.params.id as string);
      if (req.user!.employeeId && req.user!.employeeId === claim.employeeId) {
        throw new ForbiddenError('Cannot approve your own expense claim');
      }
      const data = await travelExpenseService.approveClaim(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId
      );
      res.json(Result.updated(data, 'Expense claim approved via workflow'));
    } catch (error) {
      next(error);
    }
  }

  async rejectClaim(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const claim = await travelExpenseService.findClaimById(req.params.id as string);
      if (req.user!.employeeId && req.user!.employeeId === claim.employeeId) {
        throw new ForbiddenError('Cannot reject your own expense claim');
      }
      const data = await travelExpenseService.rejectClaim(
        req.params.id as string,
        req.user!.id,
        req.user!.employeeId,
        req.body?.reason ?? req.body?.notes
      );
      res.json(Result.updated(data, 'Expense claim rejected via workflow'));
    } catch (error) {
      next(error);
    }
  }

  async getClaimWorkflow(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await travelExpenseService.getClaimWorkflow(req.params.id as string)));
    } catch (error) {
      next(error);
    }
  }

  async applyClaimWorkflowAction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await travelExpenseService.applyClaimWorkflowAction(
        req.params.id as string,
        req.user!.id,
        req.user!.roles ?? [],
        { ...req.body, source: 'WORKFLOW' }
      );
      res.json(Result.updated(result));
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

      const data = await travelExpenseService.reimburseClaim(req.params.id as string, req.user!.id, {
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
