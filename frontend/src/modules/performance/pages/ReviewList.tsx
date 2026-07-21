import { useState, useEffect, useCallback } from 'react';
import { performanceService, type PerformanceReview, type ReviewCycle } from '@/services/performance.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import { Search, RefreshCw, MessageSquare } from 'lucide-react';
import { formatDate } from '@/utils/format';
import toast from 'react-hot-toast';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  SUBMITTED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  COMPLETED: 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[status] || STATUS_STYLES.DRAFT}`}>
      {status}
    </span>
  );
}

export function ReviewList() {
  const { activeCompany } = useCompanyStore();
  const [reviews, setReviews] = useState<PerformanceReview[]>([]);
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cycleFilter, setCycleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    const companyId = activeCompany?.id || '';
    if (!companyId) {
      setReviews([]);
      setCycles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (cycleFilter) params.cycleId = cycleFilter;
      if (statusFilter) params.status = statusFilter;

      const [reviewData, cycleData] = await Promise.all([
        performanceService.getReviews(companyId, Object.keys(params).length ? params : undefined),
        performanceService.getReviewCycles(companyId),
      ]);
      setReviews(reviewData);
      setCycles(cycleData);
    } catch (error) {
      console.error('Failed to fetch reviews:', error);
      toast.error('Gagal memuat data review');
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, cycleFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = reviews.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.employee?.fullName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Performance Reviews"
        description="Create and manage employee performance reviews"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search reviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <Select2
          value={cycleFilter}
          onValueChange={setCycleFilter}
          options={[
            { value: '', label: 'All Cycles' },
            ...cycles.map((c) => ({ value: c.id, label: c.name })),
          ]}
          className="h-9 text-xs"
        />

        <div className="flex gap-1">
          {['', 'DRAFT', 'SUBMITTED', 'APPROVED', 'COMPLETED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {s || 'All'}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Review</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employee</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Cycle</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Score</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <MessageSquare size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No reviews found</p>
                    <p className="text-xs text-muted-foreground">Start a review cycle to begin performance evaluations</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((review) => (
                <tr key={review.id} className="table-row-hover cursor-pointer">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <MessageSquare size={14} className="text-primary" />
                      </div>
                      <p className="text-sm font-medium">{review.title}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {review.employee?.fullName || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {review.cycle?.name || '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-50 dark:bg-gray-900 text-muted-foreground">
                      {review.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm font-medium">
                    {review.overallScore != null ? review.overallScore : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={review.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {review.submittedAt ? formatDate(review.submittedAt) : formatDate(review.createdAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
