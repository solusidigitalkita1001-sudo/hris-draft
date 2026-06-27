import api from './api';

export interface Notification {
  id: string;
  companyId: string;
  userId: string;
  title: string;
  message?: string | null;
  type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  resource?: string | null;
  action?: string | null;
  referenceId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  createdAt: string;
}

class NotificationService {
  async findAll(unreadOnly = false, limit = 50) {
    const params: Record<string, any> = { limit };
    if (unreadOnly) params.unreadOnly = true;
    const r = await api.get('/notifications', { params });
    return r.data.data as Notification[];
  }

  async getUnreadCount() {
    const r = await api.get('/notifications/unread-count');
    return r.data.data as { count: number };
  }

  async markAsRead(ids: string[]) {
    await api.put('/notifications/read', { ids });
  }

  async markAllAsRead() {
    await api.put('/notifications/read-all');
  }

  async delete(id: string) {
    await api.delete(`/notifications/${id}`);
  }
}

export const notificationService = new NotificationService();
