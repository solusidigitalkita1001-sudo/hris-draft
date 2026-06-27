import { useState, useEffect, useCallback } from 'react';
import { notificationService, type Notification } from '@/services/notification.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Info, AlertCircle, XCircle, Clock, Trash2 } from 'lucide-react';
import { timeAgo } from '@/utils/format';

const TYPE_ICONS: Record<string, React.ReactNode> = {
  SUCCESS: <CheckCheck size={18} className="text-emerald-500" />,
  INFO: <Info size={18} className="text-blue-500" />,
  WARNING: <AlertCircle size={18} className="text-amber-500" />,
  ERROR: <XCircle size={18} className="text-red-500" />,
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [data, countRes] = await Promise.all([
        notificationService.findAll(filter === 'unread'),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(data);
      setUnreadCount(countRes.count);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      fetchData();
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const displayData = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notifications`}
        actions={
          unreadCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
              <CheckCheck size={16} className="mr-2" /> Mark All Read
            </Button>
          )
        }
      />

      <div className="flex gap-1 mb-6 border-b border-border">
        {(['all', 'unread'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              filter === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'all' ? 'All' : `Unread (${unreadCount})`}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading notifications...</div>
        </div>
      ) : displayData.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Bell size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayData.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                n.isRead
                  ? 'bg-white dark:bg-gray-800 border-border'
                  : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="mt-0.5">{TYPE_ICONS[n.type] || <Bell size={18} className="text-muted-foreground" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${n.isRead ? 'font-normal' : 'font-semibold'}`}>{n.title}</p>
                  {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                {n.message && (
                  <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                )}
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{timeAgo(n.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {!n.isRead && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-500 transition-colors"
                    title="Mark as read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(n.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
