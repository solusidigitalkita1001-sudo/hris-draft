import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { attendanceCorrectionService } from './attendance-correction.service';

export class AttendanceCorrectionController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await attendanceCorrectionService.findAll(req.query.companyId as string, {
        employeeId: req.query.employeeId as string,
        status: req.query.status as string,
      });
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async findById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await attendanceCorrectionService.findById(req.params.id as string)));
    } catch (error) { next(error); }
  }

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (req.user?.employeeId) req.body.employeeId = req.user.employeeId;
      if (req.user?.companyId) req.body.companyId = req.user.companyId;
      res.status(201).json(Result.created(await attendanceCorrectionService.create(req.body)));
    } catch (error) { next(error); }
  }

  async approve(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(
        await attendanceCorrectionService.approve(req.params.id as string, req.user!.id, req.user!.employeeId)
      ));
    } catch (error) { next(error); }
  }

  async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.updated(
        await attendanceCorrectionService.reject(req.params.id as string, req.user!.employeeId, req.body.rejectionReason)
      ));
    } catch (error) { next(error); }
  }
}

export const attendanceCorrectionController = new AttendanceCorrectionController();
