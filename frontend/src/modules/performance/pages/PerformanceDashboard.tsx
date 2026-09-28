import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { performanceService, type ReviewCycle, type PerformanceReview, type Goal } from '@/services/performance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { RefreshCw, BarChart3, Target, MessageSquare, ChevronRight, Star } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const CYCLE_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  COMPLETED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  ARCHIVED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const REVIEW_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  COMPLETED: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
};

const CYCLE_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.status.draft',
  ACTIVE: 'perf.status.active',
  COMPLETED: 'perf.status.completed',
  ARCHIVED: 'perf.status.archived',
};

const REVIEW_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.status.draft',
  SUBMITTED: 'perf.status.submitted',
  APPROVED: 'perf.status.approved',
  COMPLETED: 'perf.status.completed',
};

function CycleStatusBadge({ status }: { status: string }) {
  const { t } = useI18n();
  const labelKey = CYCLE_STATUS_LABEL_KEYS[status];

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CYCLE_STATUS_STYLES[status] || CYCLE_STATUS_STYLES.DRAFT}`}>
      {labelKey ? t(labelKey) : status}
    </span>
  );
}

export function PerformanceDashboard() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const companyId = activeCompany?.id || '';
    if (!companyId) {
      setCycles([]);
      setReviews([]);
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [cycleData, reviewData, goalData] = await Promise.all([
        performanceService.getReviewCycles(companyId),
        performanceService.getReviews(companyId),
        performanceService.getGoals(companyId),
      ]);
      setCycles(cycleData);
      setReviews(reviewData);
      setGoals(goalData);
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      toast.error(t('perf.dashboard.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const activeCycles = cycles.filter((c) => c.status === 'ACTIVE');
  const pendingReviews = reviews.filter((r) => r.status === 'DRAFT');
  const completedReviews = reviews.filter((r) => r.status === 'APPROVED' || r.status === 'COMPLETED');

  const stats = [
    {
      label: t('perf.dashboard.stats.activeCycles'),
      value: activeCycles.length,
      icon: BarChart3,
      color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-400',
    },
    {
      label: t('perf.dashboard.stats.pendingReviews'),
      value: pendingReviews.length,
      icon: MessageSquare,
      color: 'text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400',
    },
    {
      label: t('perf.dashboard.stats.completedReviews'),
      value: completedReviews.length,
      icon: Star,
      color: 'text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400',
    },
    {
      label: t('perf.dashboard.stats.totalGoals'),
      value: goals.length,
      icon: Target,
      color: 'text-purple-600 bg-purple-50 dark:bg-purple-950 dark:text-purple-400',
    },
  ];

  const handleViewCycles = () => {
    navigate('/performance/cycles');
  };

  return (
    <div>
      <PageHeader
        title={t('perf.dashboard.title')}
        description={t('perf.dashboard.description')}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/config/methods')}>
              {t('perf.dashboard.nav.configMethods')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/config/periods')}>
              {t('perf.dashboard.nav.configPeriods')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/config/libraries')}>
              {t('perf.dashboard.nav.configLibraries')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/config/workflows')}>
              {t('perf.dashboard.nav.configWorkflows')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/planning')}>
              {t('perf.dashboard.nav.planning')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/execution')}>
              {t('perf.dashboard.nav.execution')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/results')}>
              {t('perf.dashboard.nav.results')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/performance/my-results')}>
              {t('perf.dashboard.nav.myResults')}
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{stat.label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon size={16} />
              </div>
            </div>
            <p className="text-xl font-semibold">{stat.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Review Cycles */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">{t('perf.dashboard.cycles.title')}</h3>
              <Button size="sm" variant="ghost" onClick={handleViewCycles}>
                {t('perf.dashboard.viewAll')} <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {cycles.length === 0 ? (
                <div className="p-8 text-center">
                  <BarChart3 size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('perf.dashboard.cycles.empty')}</p>
                </div>
              ) : (
                cycles.slice(0, 5).map((cycle) => (
                  <div
                    key={cycle.id}
                    className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium">{cycle.name}</p>
                      <CycleStatusBadge status={cycle.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{cycle.type}</span>
                      <span>{formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}</span>
                      <span>{t('perf.dashboard.cycles.reviewCount', { count: cycle._count?.reviews || 0 })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Reviews */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium">{t('perf.dashboard.reviews.title')}</h3>
              <Button size="sm" variant="ghost" onClick={() => navigate('/performance/reviews')}>
                {t('perf.dashboard.viewAll')} <ChevronRight size={14} className="ml-1" />
              </Button>
            </div>
            <div className="divide-y divide-border">
              {reviews.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquare size={24} className="mx-auto mb-2 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('perf.dashboard.reviews.empty')}</p>
                </div>
              ) : (
                reviews.slice(0, 5).map((review) => (
                  <div
                    key={review.id}
                    className="px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium truncate">{review.title}</p>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${REVIEW_STATUS_STYLES[review.status] || REVIEW_STATUS_STYLES.DRAFT}`}>
                        {REVIEW_STATUS_LABEL_KEYS[review.status] ? t(REVIEW_STATUS_LABEL_KEYS[review.status]) : review.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {review.employee && <span>{review.employee.fullName}</span>}
                      {review.cycle && <span>{review.cycle.name}</span>}
                      {review.type && <span>{review.type}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
