import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { Result } from '@/shared/core/Result';
import { ForbiddenError } from '@/shared/exceptions/AppError';
import { announcementService } from './announcement.service';
import type { AnnouncementListQuery } from './announcement.dto';

function actor(req: AuthenticatedRequest) {
  if (!req.user?.companyId) {
    throw new ForbiddenError('Company context is required');
  }
  return {
    userId: req.user.id,
    companyId: req.user.companyId,
    employeeId: req.user.employeeId,
  };
}

export class AnnouncementController {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await announcementService.list(actor(req), req.query as unknown as AnnouncementListQuery);
      res.json(Result.paginated(result.items, result.total, result.page, result.limit));
    } catch (error) { next(error); }
  }

  async unreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await announcementService.unreadCount(actor(req));
      res.json(Result.success({ count }));
    } catch (error) { next(error); }
  }

  async detail(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      res.json(Result.success(await announcementService.detail(actor(req), req.params.id as string)));
    } catch (error) { next(error); }
  }

  async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await announcementService.markRead(actor(req), req.params.id as string);
      res.json(Result.updated(data, 'Announcement marked as read'));
    } catch (error) { next(error); }
  }
}

export const announcementController = new AnnouncementController();
