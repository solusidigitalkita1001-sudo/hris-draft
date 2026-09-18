import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '@/shared/middleware/Authenticate';
import { notificationRepository } from './notification.repository';
import { Result } from '@/shared/core/Result';
import { NotFoundError } from '@/shared/exceptions/AppError';
import { mobileDeviceRepository } from './mobile-device.repository';

export class NotificationController {
  async registerDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await mobileDeviceRepository.register(
        req.user!.companyId!,
        req.user!.id,
        req.body,
      );
      res.status(201).json(Result.created(data, 'Device token registered'));
    } catch (error) { next(error); }
  }

  async unregisterDevice(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await mobileDeviceRepository.unregister(
        req.user!.companyId!,
        req.user!.id,
        req.body.installationId,
      );
      res.json(Result.deleted('Device token unregistered'));
    } catch (error) { next(error); }
  }

  async findAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const unreadOnly = req.query.unreadOnly === 'true';
      const page = Number(req.query.page);
      const limit = Number(req.query.limit);
      const data = await notificationRepository.findAll(req.user!.companyId!, userId, unreadOnly, page, limit);
      res.json(Result.paginated(data.items, data.total, page, limit));
    } catch (error) { next(error); }
  }

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const count = await notificationRepository.getUnreadCount(req.user!.id, req.user!.companyId!);
      res.json(Result.success({ count }));
    } catch (error) { next(error); }
  }

  async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { ids } = req.body;
      await notificationRepository.markAsRead(ids, req.user!.id, req.user!.companyId!);
      res.json(Result.updated(null, 'Notifications marked as read'));
    } catch (error) { next(error); }
  }

  async markAllAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await notificationRepository.markAllAsRead(req.user!.id, req.user!.companyId!);
      res.json(Result.updated(null, 'All notifications marked as read'));
    } catch (error) { next(error); }
  }

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await notificationRepository.delete(req.params.id as string, req.user!.id, req.user!.companyId!);
      if (result.count === 0) {
        throw new NotFoundError('Notification not found');
      }
      res.json(Result.deleted());
    } catch (error) { next(error); }
  }
}

export const notificationController = new NotificationController();
