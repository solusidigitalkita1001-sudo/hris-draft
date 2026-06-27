import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateNotificationDTO } from './notification.dto';

export class NotificationRepository {
  async findAll(userId: string, unreadOnly = false, limit = 50) {
    const where: Prisma.NotificationWhereInput = { userId };
    if (unreadOnly) where.isRead = false;

    return prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  async create(data: CreateNotificationDTO & { companyId: string }) {
    return prisma.notification.create({ data: data as any });
  }

  async markAsRead(ids: string[]) {
    return prisma.notification.updateMany({
      where: { id: { in: ids } },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  }

  async delete(id: string) {
    return prisma.notification.delete({ where: { id } });
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: { userId, isRead: false },
    });
  }
}

export const notificationRepository = new NotificationRepository();
