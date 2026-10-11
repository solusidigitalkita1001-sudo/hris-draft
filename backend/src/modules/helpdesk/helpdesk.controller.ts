import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { helpdeskService, requireEmployee } from './helpdesk.service';
import type { CommentDTO, CreateTicketDTO, TicketQueryDTO, UpdateTicketDTO } from './helpdesk.dto';

function companyOf(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

export class HelpdeskController {
  // ==================== Self service ====================
  async createMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = requireEmployee(req.user?.employeeId);
      const row = await helpdeskService.createMine(companyOf(req), employeeId, req.body as CreateTicketDTO);
      res.status(201).json(Result.success(row, 'Tiket dibuat; HR akan menindaklanjuti'));
    } catch (error) { next(error); }
  }

  async listMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = requireEmployee(req.user?.employeeId);
      res.json(Result.success(await helpdeskService.listMine(companyOf(req), employeeId)));
    } catch (error) { next(error); }
  }

  async commentMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = requireEmployee(req.user?.employeeId);
      const row = await helpdeskService.comment(companyOf(req), String(req.params.id),
        { userId: String(req.user?.id), employeeId, canReadAll: false }, req.body as CommentDTO);
      res.status(201).json(Result.success(row));
    } catch (error) { next(error); }
  }

  async closeMine(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const employeeId = requireEmployee(req.user?.employeeId);
      res.json(Result.success(await helpdeskService.closeMine(companyOf(req), String(req.params.id), employeeId), 'Tiket ditutup'));
    } catch (error) { next(error); }
  }

  // ==================== HR queue ====================
  async listQueue(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await helpdeskService.listQueue(companyOf(req), req.query as unknown as TicketQueryDTO)));
    } catch (error) { next(error); }
  }

  async getOne(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await helpdeskService.getForActor(companyOf(req), String(req.params.id),
        { employeeId: req.user?.employeeId, canReadAll: true })));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await helpdeskService.update(companyOf(req), String(req.params.id), req.body as UpdateTicketDTO)));
    } catch (error) { next(error); }
  }

  async comment(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await helpdeskService.comment(companyOf(req), String(req.params.id),
        { userId: String(req.user?.id), employeeId: req.user?.employeeId, canReadAll: true }, req.body as CommentDTO);
      res.status(201).json(Result.success(row));
    } catch (error) { next(error); }
  }
}

export const helpdeskController = new HelpdeskController();
