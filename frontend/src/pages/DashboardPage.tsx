import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import { PageHeader } from '@/components/shared/PageHeader';
import { useI18n } from '@/i18n/provider';
import { reportsService, type DashboardSummary } from '@/services/reports.service';
import { Users, Building2, Clock, CalendarDays, RefreshCw, Activity, ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function DashboardPage() {
  const { user } = useAuthStore();
  const { activeCompany } = useCompanyStore();
  const { t } = useI18n();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = activeCompany?.id || user?.companyId || '';

  const loadSummary = useCallback(async () => {
    if (!companyId) {
      setSummary(null);
      setError('Company belum aktif');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await reportsService.getDashboardSummary(companyId);
      setSummary(data);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal memuat dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const stats = useMemo(() => ([
    {
      label: t('dashboard.stats.totalEmployees'),
      value: String(summary?.stats.totalEmployees ?? 0),
      change: activeCompany?.name || '-',
      icon: Users,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
    },
    {
      label: t('dashboard.stats.departments'),
      value: String(summary?.stats.totalDepartments ?? 0),
      change: 'Dept aktif',
      icon: Building2,
      color: 'text-emerald-600 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-950',
    },
    {
      label: t('dashboard.stats.presentToday'),
      value: String(summary?.stats.presentToday ?? 0),
      change: dayjs().format('DD MMM YYYY'),
      icon: Clock,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950',
    },
    {
      label: t('dashboard.stats.onLeave'),
      value: String(summary?.stats.onLeaveToday ?? 0),
      change: 'Hari ini',
      icon: CalendarDays,
      color: 'text-violet-600 dark:text-violet-400',
      bg: 'bg-violet-50 dark:bg-violet-950',
    },
  ]), [activeCompany?.name, summary, t]);

  return (
    <div>
      <PageHeader
        title={t('dashboard.welcome', { name: user?.name || user?.email || 'User' })}
        description={t('dashboard.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => void loadSummary()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        )}
      />

      {error && (
        <div className="mb-6 rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

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
            <h3 className="font-medium text-sm flex items-center gap-2">
              <ClipboardList size={16} />
              {t('dashboard.pendingApprovals')}
            </h3>
          </div>
          <div className="p-6">
            <p className="text-3xl font-semibold">{summary?.pendingApprovals ?? 0}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {(summary?.pendingApprovals ?? 0) > 0
                ? 'Approval workflow menunggu aksi lo.'
                : t('dashboard.noPendingApprovals')}
            </p>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg">
          <div className="p-4 border-b border-border">
            <h3 className="font-medium text-sm flex items-center gap-2">
              <Activity size={16} />
              {t('dashboard.recentActivity')}
            </h3>
          </div>
          <div className="divide-y divide-border">
            {summary?.recentActivity?.length ? summary.recentActivity.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    {item.action} {item.entity}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {item.actorEmail}
                    {item.entityId ? ` • ${item.entityId}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  {dayjs(item.createdAt).format('DD MMM HH:mm')}
                </p>
              </div>
            )) : (
              <div className="p-6 text-center text-sm text-muted-foreground">
                {t('dashboard.noRecentActivity')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
