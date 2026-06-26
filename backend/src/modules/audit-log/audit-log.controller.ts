import { Request, Response, NextFunction } from 'express';
import { prisma } from '@/shared/database/prisma';
import { Result } from '@/shared/core/Result';

export class AuditLogController {
  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyId, action, entity, userId, startDate, endDate, page = '1', limit = '50' } = req.query;

      const where: any = {};
      if (companyId) where.companyId = companyId;
      if (action) where.action = action;
      if (entity) where.entity = entity;
      if (userId) where.userId = userId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate as string);
        if (endDate) where.createdAt.lte = new Date(endDate as string);
      }

      const skip = (Number(page) - 1) * Number(limit);

      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          include: {
            user: { select: { id: true, email: true } },
          },
        }),
        prisma.auditLog.count({ where }),
      ]);

      res.json(Result.paginated(data, total, Number(page), Number(limit)));
    } catch (error) { next(error); }
  }

  async findById(req: Request, res: Response, next: NextFunction) {
    try {
      const id = req.params.id as string;
      const log = await prisma.auditLog.findUnique({
        where: { id },
        include: { user: { select: { id: true, email: true } } },
      });
      if (!log) return res.status(404).json(Result.error('Audit log not found'));
      res.json(Result.success(log));
    } catch (error) { next(error); }
  }
}

export const auditLogController = new AuditLogController();
