import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { recruitmentService, type JobPosting } from '@/services/recruitment.service';
import { useCompanyStore } from '@/stores/company.store';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Briefcase, Users, Eye } from 'lucide-react';
import { formatCurrency } from '@/utils/format';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ON_HOLD: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  CLOSED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  FILLED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.DRAFT
      }`}
    >
      {status}
    </span>
  );
}

export function JobPostingList() {
  const navigate = useNavigate();
  const { activeCompany } = useCompanyStore();
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = activeCompany?.id || '';
      const data = await recruitmentService.getJobPostings(
        companyId,
        statusFilter || undefined
      );
      setPostings(data);
    } catch (error) {
      console.error('Failed to fetch job postings:', error);
    } finally {
      setLoading(false);
    }
  }, [activeCompany?.id, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = postings.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Job Postings"
        description="Manage job vacancies and track applicants"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => navigate('/recruitment/postings/new')}
            >
              <Plus size={16} className="mr-2" />
              New Posting
            </Button>
          </>
        }
      />

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search postings..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          {['', 'DRAFT', 'PUBLISHED', 'ON_HOLD', 'CLOSED', 'FILLED'].map(
            (s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  statusFilter === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {s || 'All'}
              </button>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">
            Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Briefcase size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No job postings found
              </p>
              <p className="text-xs text-muted-foreground">
                Create a new job posting to start recruiting
              </p>
            </div>
          </div>
        ) : (
          filtered.map((posting) => (
            <div
              key={posting.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer"
              onClick={() =>
                navigate(`/recruitment/postings/${posting.id}`)
              }
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center shrink-0">
                  <Briefcase size={20} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {posting.title}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {posting.code}
                  </p>
                </div>
                <StatusBadge status={posting.status} />
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400">
                  {posting.employmentType}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400">
                  <Users size={12} />
                  {posting.vacancies} vacancy
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye size={14} />
                  <span>{posting._count?.applications || 0} applications</span>
                </div>
                {posting.department && (
                  <span>{posting.department.name}</span>
                )}
              </div>

              {posting.minSalary && (
                <p className="text-xs text-muted-foreground mt-2">
                  Salary: {formatCurrency(Number(posting.minSalary))} -{' '}
                  {posting.maxSalary
                    ? formatCurrency(Number(posting.maxSalary))
                    : '-'}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
