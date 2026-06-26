import { useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Info, AlertCircle, Clock } from 'lucide-react';
import { timeAgo } from '@/utils/format';

// Mock data — backend notification module will be built in later phase
const MOCK_NOTIFICATIONS = [
  { id: '1', title: 'Leave request approved', message: 'Your annual leave request has been approved.', type: 'success', read: false, createdAt: new Date(Date.now() - 3600000).toISOString() },
  { id: '2', title: 'Payroll processed', message: 'Payroll for June 2026 has been processed. Check your payslip.', type: 'info', read: false, createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: '3', title: 'Training reminder', message: 'Mandatory training "Safety Induction" is due next week.', type: 'warning', read: true, createdAt: new Date(Date.now() - 172800000).toISOString() },
  { id: '4', title: 'Contract expiring', message: 'Employee contract for Andi Pratama will expire in 30 days.', type: 'warning', read: true, createdAt: new Date(Date.now() - 259200000).toISOString() },
  { id: '5', title: 'New resignation submitted', message: 'Siti Nurhaliza has submitted a resignation request.', type: 'info', read: true, createdAt: new Date(Date.now() - 345600000).toISOString() },
];

const TYPE_ICONS: Record<string, React.ReactNode> = {
  success: <CheckCheck size={18} className="text-emerald-500" />,
  info: <Info size={18} className="text-blue-500" />,
  warning: <AlertCircle size={18} className="text-amber-500" />,
};

export function NotificationsPage() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const notifications = filter === 'unread' ? MOCK_NOTIFICATIONS.filter((n) => !n.read) : MOCK_NOTIFICATIONS;
  const unreadCount = MOCK_NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description={`${unreadCount} unread notifications`}
        actions={
          <Button variant="outline" size="sm" onClick={() => {}}>
            <CheckCheck size={16} className="mr-2" /> Mark All Read
          </Button>
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

      {notifications.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Bell size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No notifications</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-colors ${
                n.read ? 'bg-white dark:bg-gray-800 border-border' : 'bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800'
              }`}
            >
              <div className="mt-0.5">{TYPE_ICONS[n.type] || <Bell size={18} className="text-muted-foreground" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className={`text-sm ${n.read ? 'font-normal' : 'font-semibold'}`}>{n.title}</p>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                  <Clock size={12} />
                  <span>{timeAgo(n.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
