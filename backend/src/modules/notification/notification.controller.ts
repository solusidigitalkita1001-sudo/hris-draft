import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { notificationRepository } from './notification.repository';
import { Result } from '@/shared/core/Result';

export class NotificationController {
  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const limit = Number(req.query.limit) || 50;
      const data = await notificationRepository.findAll(userId, unreadOnly, limit);
      res.json(Result.success(data));
    } catch (error) { next(error); }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await notificationRepository.getUnreadCount(req.user!.id);
      res.json(Result.success({ count }));
    } catch (error) { next(error); }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      await notificationRepository.markAsRead(ids);
      res.json(Result.updated(null, 'Notifications marked as read'));
    } catch (error) { next(error); }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await notificationRepository.markAllAsRead(req.user!.id);
      res.json(Result.updated(null, 'All notifications marked as read'));
    } catch (error) { next(error); }
  }

  async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await notificationRepository.delete(req.params.id as string);
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }
}

export const notificationController = new NotificationController();
