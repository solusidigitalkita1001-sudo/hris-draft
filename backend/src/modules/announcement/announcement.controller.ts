import type { NextFunction, Response } from 'express';
import { announcementAdminService } from './announcement-admin.service';
import type { AnnouncementAdminQueryDTO, AnnouncementWriteDTO } from './announcement.dto';
import { BadRequestError } from '@/shared/exceptions/AppError';
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

function adminCompanyId(req: AuthenticatedRequest): string {
  const companyId = req.user?.companyId;
  if (!companyId) throw new BadRequestError('Akun ini tidak tertaut ke perusahaan aktif');
  return companyId;
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

  // ==================== Sisi admin/HR ====================
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      const announcement = await announcementAdminService.create(companyId, req.body as AnnouncementWriteDTO);
      res.status(201).json(Result.success(announcement, 'Pengumuman dibuat sebagai DRAFT. Terbitkan bila sudah siap.'));
    } catch (error) { next(error); }
  }

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      res.json(Result.success(
        await announcementAdminService.update(companyId, String(req.params.id), req.body as AnnouncementWriteDTO),
      ));
    } catch (error) { next(error); }
  }

  async publish(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      res.json(Result.success(await announcementAdminService.publish(companyId, String(req.params.id)), 'Pengumuman diterbitkan.'));
    } catch (error) { next(error); }
  }

  async archive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      res.json(Result.success(await announcementAdminService.archive(companyId, String(req.params.id))));
    } catch (error) { next(error); }
  }

  async adminList(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      const query = req.query as unknown as AnnouncementAdminQueryDTO;
      res.json(Result.success(await announcementAdminService.list(companyId, query)));
    } catch (error) { next(error); }
  }

  async readers(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const companyId = adminCompanyId(req);
      res.json(Result.success(await announcementAdminService.readers(companyId, String(req.params.id))));
    } catch (error) { next(error); }
  }
}

export const announcementController = new AnnouncementController();
