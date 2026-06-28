import { useAuthStore } from '@/stores/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';
import { useI18n } from '@/i18n/provider';
import { Users, Building2, Clock, CalendarDays } from 'lucide-react';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { t } = useI18n();

  const stats = [
    {
      label: t('dashboard.stats.totalEmployees'),
      value: '0',
      change: '+0',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: t('dashboard.stats.departments'),
      value: '0',
      change: '0',
      icon: Building2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: t('dashboard.stats.presentToday'),
      value: '0',
      change: '0%',
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      label: t('dashboard.stats.onLeave'),
      value: '0',
      change: '0',
      icon: CalendarDays,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950',
    },
  ];

  return (
    <div>
      <PageHeader
        title={t('dashboard.welcome', { name: user?.name || user?.email || 'User' })}
        description={t('dashboard.description')}
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat, i) => (
          <div
            key={i}
            className="bg-card border border-border rounded-lg p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <div className={`p-2 rounded-md ${stat.bg}`}>
                <stat.icon size={18} className={stat.color} />
              </div>
              <span className={`text-xs font-medium ${stat.color}`}>
                {stat.change}
              </span>
            </div>
            <p className="text-2xl font-semibold">{stat.value}</p>
            <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Placeholder sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Approvals */}
        <div className="lg:col-span-1 bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-sm">{t('dashboard.pendingApprovals')}</h3>
          </div>
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('dashboard.noPendingApprovals')}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-sm">{t('dashboard.recentActivity')}</h3>
          </div>
          <div className="p-6 text-center text-sm text-muted-foreground">
            {t('dashboard.noRecentActivity')}
          </div>
        </div>
      </div>
    </div>
  );
}
