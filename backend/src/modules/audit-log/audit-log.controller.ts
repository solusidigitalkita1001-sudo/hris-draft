import { Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { Result } from '@/shared/core/Result';

export class AuditLogController {
  private buildWhere(req: Request): Prisma.AuditLogWhereInput {
    const {
      companyId,
      action,
      entity,
      userId,
      entityId,
      ipAddress,
      search,
      startDate,
      endDate,
    } = req.query;

    const where: Prisma.AuditLogWhereInput = {};
    const resolvedCompanyId = (companyId as string) || (req as any).user?.companyId;

    if (resolvedCompanyId) where.companyId = resolvedCompanyId;
    if (action) where.action = action as string;
    if (entity) where.entity = { contains: entity as string };
    if (userId) where.userId = userId as string;
    if (entityId) where.entityId = { contains: entityId as string };
    if (ipAddress) where.ipAddress = { contains: ipAddress as string };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate as string);
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    if (search) {
      where.OR = [
        { action: { contains: search as string } },
        { entity: { contains: search as string } },
        { entityId: { contains: search as string } },
        { ipAddress: { contains: search as string } },
        { userAgent: { contains: search as string } },
        { oldValue: { contains: search as string } },
        { newValue: { contains: search as string } },
        { user: { email: { contains: search as string } } },
      ];
    }

    return where;
  }

  private csvEscape(value: unknown): string {
    const normalized = value === null || value === undefined ? '' : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  }

  async findAll(req: Request, res: Response, next: NextFunction) {
    try {
      const { page = '1', limit = '50' } = req.query;
      const where = this.buildWhere(req);
      const skip = (Number(page) - 1) * Number(limit);

      const [data, total] = await Promise.all([
        prisma.auditLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit),
          include: {
            user: { select: { id: true, email: true } },
            company: { select: { id: true, name: true } },
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
        include: {
          user: { select: { id: true, email: true } },
          company: { select: { id: true, name: true } },
        },
      });
      if (!log) return res.status(404).json(Result.error('Audit log not found'));
      res.json(Result.success(log));
    } catch (error) { next(error); }
  }

  async exportCsv(req: Request, res: Response, next: NextFunction) {
    try {
      const where = this.buildWhere(req);
      const logs = await prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, email: true } },
          company: { select: { id: true, name: true } },
        },
      });

      const header = [
        'Timestamp',
        'Company',
        'User Email',
        'Action',
        'Entity',
        'Entity ID',
        'IP Address',
        'User Agent',
        'Old Value',
        'New Value',
      ].join(',');

      const rows = logs.map((log) =>
        [
          this.csvEscape(log.createdAt.toISOString()),
          this.csvEscape(log.company?.name ?? ''),
          this.csvEscape(log.user?.email ?? ''),
          this.csvEscape(log.action),
          this.csvEscape(log.entity),
          this.csvEscape(log.entityId),
          this.csvEscape(log.ipAddress),
          this.csvEscape(log.userAgent),
          this.csvEscape(log.oldValue),
          this.csvEscape(log.newValue),
        ].join(',')
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-logs.csv"');
      res.send([header, ...rows].join('\n'));
    } catch (error) {
      next(error);
    }
  }
}

export const auditLogController = new AuditLogController();
