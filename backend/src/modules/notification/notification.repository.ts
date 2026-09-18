import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateNotificationDTO } from './notification.dto';

export class NotificationRepository {
  async findAll(companyId: string, userId: string, unreadOnly = false, page = 1, limit = 50) {
    const where: Prisma.NotificationWhereInput = { companyId, userId };
    if (unreadOnly) where.isRead = false;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.notification.count({ where }),
    ]);
    return { items, total };
  }

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  async create(data: CreateNotificationDTO & { companyId: string }) {
    return prisma.notification.create({ data: data as any });
  }

  async markAsRead(ids: string[], userId: string, companyId: string) {
    return prisma.notification.updateMany({
      where: { id: { in: ids }, userId, companyId },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string, companyId: string) {
    return prisma.notification.updateMany({
      where: { userId, companyId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async delete(id: string, userId: string, companyId: string) {
    return prisma.notification.deleteMany({ where: { id, userId, companyId } });
  }

  async getUnreadCount(userId: string, companyId: string) {
    return prisma.notification.count({
      where: { userId, companyId, isRead: false },
    });
  }
}

export const notificationRepository = new NotificationRepository();
