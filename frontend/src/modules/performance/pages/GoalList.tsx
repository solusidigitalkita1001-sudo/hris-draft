import { useState, useEffect, useCallback } from 'react';
import { performanceService, type Goal } from '@/services/performance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCompanyStore } from '@/stores/company.store';
import { Search, RefreshCw, Plus, Target, TrendingUp, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { formatDate } from '@/utils/format';
import toast from 'react-hot-toast';

const PRIORITY_STYLES: Record<string, string> = {
  LOW: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  MEDIUM: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  HIGH: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  CRITICAL: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  IN_PROGRESS: <Clock size={14} className="text-amber-500" />,
  COMPLETED: <CheckCircle2 size={14} className="text-emerald-500" />,
  CANCELLED: <AlertCircle size={14} className="text-red-500" />,
};

export function GoalList() {
  const { activeCompany } = useCompanyStore();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    const companyId = activeCompany?.id || '';
    if (!companyId) {
      setGoals([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getGoals(companyId);
      setGoals(data);
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      toast.error('Gagal memuat data goals');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = goals.filter((g) => {
    const matchesSearch =
      g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.employee?.fullName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !statusFilter || g.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const completedCount = goals.filter((g) => g.status === 'COMPLETED').length;
  const avgProgress = goals.length
    ? Math.round(goals.reduce((sum, g) => sum + g.progress, 0) / goals.length)
    : 0;

  return (
    <div>
      <PageHeader
        title="Goals & OKRs"
        description="Track employee goals and objectives"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm">
              <Plus size={16} className="mr-2" />
              New Goal
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Target size={14} /> Total Goals
          </div>
          <p className="text-xl font-semibold">{goals.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" /> Completed
          </div>
          <p className="text-xl font-semibold">{completedCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <TrendingUp size={14} /> Avg Progress
          </div>
          <p className="text-xl font-semibold">{avgProgress}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1">
          {['', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {s ? s.replace(/_/g, ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Target size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No goals found</p>
              <p className="text-xs text-muted-foreground">Create goals to track employee objectives</p>
            </div>
          </div>
        ) : (
          filtered.map((goal) => (
            <div
              key={goal.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950 flex items-center justify-center shrink-0">
                    <Target size={16} className="text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{goal.title}</p>
                    {goal.employee && (
                      <p className="text-xs text-muted-foreground">{goal.employee.fullName}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    PRIORITY_STYLES[goal.priority] || PRIORITY_STYLES.MEDIUM
                  }`}>
                    {goal.priority}
                  </span>
                  <span className="flex items-center">
                    {STATUS_ICONS[goal.status]}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium">{goal.progress}%</span>
                </div>
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      goal.progress === 100
                        ? 'bg-emerald-500'
                        : goal.progress >= 50
                        ? 'bg-blue-500'
                        : 'bg-amber-500'
                    }`}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                <span>{goal.type}</span>
                {goal.endDate && (
                  <span>Due: {formatDate(goal.endDate)}</span>
                )}
                <span>{formatDate(goal.startDate)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
