import { useState, useEffect, useCallback } from 'react';
import { notificationService, type Notification } from '@/services/notification.service';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Info, AlertCircle, XCircle, Trash2, Loader2 } from 'lucide-react';
import { timeAgo } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';
import { cn } from '@/utils/cn';

/** Ikon bertone sesuai handoff: kotak radius kecil dengan pasangan fg/bg semantik. */
const TYPE_TONES: Record<string, { icon: React.ReactNode; box: string }> = {
  SUCCESS: { icon: <CheckCheck size={17} />, box: 'bg-success-bg text-success' },
  INFO: { icon: <Info size={17} />, box: 'bg-accent text-primary' },
  WARNING: { icon: <AlertCircle size={17} />, box: 'bg-warning-bg text-warning' },
  ERROR: { icon: <XCircle size={17} />, box: 'bg-danger-bg text-danger' },
};

export function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, countRes] = await Promise.all([
        notificationService.findAll(filter === 'unread'),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(data);
      setUnreadCount(countRes.count);
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal memuat notifikasi'));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      fetchData();
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menandai semua terbaca'));
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead([id]);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menandai notifikasi terbaca'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await notificationService.delete(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menghapus notifikasi'));
    }
  };

  const displayData = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.9px]">Notifikasi</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua sudah terbaca'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <CheckCheck size={16} className="mr-2" /> Tandai semua terbaca
          </Button>
        )}
      </div>

      {/* Segmented filter ala handoff */}
      <div className="mb-5 inline-flex rounded-field bg-muted p-1">
        {(['all', 'unread'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={cn(
              'rounded-[12px] px-4 py-1.5 text-sm font-medium transition-colors',
              filter === tab ? 'bg-card text-foreground shadow-card' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'all' ? 'Semua' : `Belum dibaca (${unreadCount})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-field border border-danger/20 bg-danger-bg p-3 text-sm text-danger" role="alert">
          <AlertCircle size={16} className="shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Memuat notifikasi…
        </div>
      ) : displayData.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-border bg-card py-20">
          <Bell size={44} className="text-muted-foreground/40" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {filter === 'unread' ? 'Tidak ada notifikasi yang belum dibaca' : 'Belum ada notifikasi'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {displayData.map((n) => {
            const tone = TYPE_TONES[n.type] ?? { icon: <Bell size={17} />, box: 'bg-secondary text-muted-foreground' };
            return (
              <div
                key={n.id}
                className={cn(
                  'flex items-start gap-3.5 rounded-card-sm border p-4 shadow-card transition-colors',
                  n.isRead ? 'border-border bg-card' : 'border-primary/25 bg-accent/40'
                )}
              >
                <div className={cn('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]', tone.box)}>
                  {tone.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm', n.isRead ? 'font-normal' : 'font-semibold')}>{n.title}</p>
                    {!n.isRead && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Belum dibaca" />}
                  </div>
                  {n.message && (
                    <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                  )}
                  <p className="mt-2 text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {!n.isRead && (
                    <button
                      onClick={() => handleMarkRead(n.id)}
                      className="rounded-[10px] p-1.5 text-primary transition-colors hover:bg-accent"
                      title="Tandai terbaca"
                      aria-label="Tandai terbaca"
                    >
                      <CheckCheck size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(n.id)}
                    className="rounded-[10px] p-1.5 text-muted-foreground transition-colors hover:bg-danger-bg hover:text-danger"
                    title="Hapus"
                    aria-label="Hapus notifikasi"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
