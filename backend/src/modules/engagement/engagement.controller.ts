import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { engagementService } from './engagement.service';
import type { CreatePostDTO, FeedQueryDTO, GiveKudosDTO, KudosQueryDTO } from './engagement.dto';

function companyOf(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
}

function employeeOf(req: AuthenticatedRequest): string {
  const employeeId = req.user?.employeeId;
  if (!employeeId) throw new BadRequestError('Akun ini tidak tertaut ke data karyawan');
  return employeeId;
}

export class EngagementController {
  async createPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await engagementService.createPost(companyOf(req), employeeOf(req), req.body as CreatePostDTO);
      res.status(201).json(Result.success(row));
    } catch (error) { next(error); }
  }

  async listFeed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await engagementService.listFeed(companyOf(req), req.query as unknown as FeedQueryDTO)));
    } catch (error) { next(error); }
  }

  async deleteOwnPost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await engagementService.deletePost(companyOf(req), String(req.params.id),
        { employeeId: employeeOf(req), isModerator: false })));
    } catch (error) { next(error); }
  }

  async moderatePost(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await engagementService.deletePost(companyOf(req), String(req.params.id),
        { employeeId: req.user?.employeeId, isModerator: true })));
    } catch (error) { next(error); }
  }

  async giveKudos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const row = await engagementService.giveKudos(companyOf(req), employeeOf(req), req.body as GiveKudosDTO);
      res.status(201).json(Result.success(row, 'Kudos terkirim'));
    } catch (error) { next(error); }
  }

  async listKudos(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await engagementService.listKudos(companyOf(req), req.query as unknown as KudosQueryDTO)));
    } catch (error) { next(error); }
  }
}

export const engagementController = new EngagementController();
