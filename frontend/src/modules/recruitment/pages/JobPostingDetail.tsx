import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { recruitmentService, type JobPosting } from '@/services/recruitment.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Briefcase, Building2, MapPin, Users, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDateTime } from '@/utils/format';

export function JobPostingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [posting, setPosting] = useState<JobPosting | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await recruitmentService.getJobPosting(id);
      setPosting(data);
    } catch (error) {
      console.error('Failed to fetch job posting:', error);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('approve');
    try {
      await recruitmentService.approveJobPosting(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading('');
    }
  };

  const handleClose = async () => {
    if (!id) return;
    setActionLoading('close');
    try {
      await recruitmentService.closeJobPosting(id);
      await fetchData();
    } catch (error) {
      console.error('Failed to close:', error);
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    );
  }

  if (!posting) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">Job posting not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/recruitment')}>
          Back to Job Postings
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={posting.title}
        description={`${posting.status} · ${posting.code}`}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => navigate('/recruitment')}>
              <ArrowLeft size={16} className="mr-2" />
              Back
            </Button>
            {posting.status === 'DRAFT' && (
              <Button size="sm" onClick={handleApprove} disabled={actionLoading === 'approve'}>
                <CheckCircle size={16} className="mr-2" />
                {actionLoading === 'approve' ? 'Publishing...' : 'Publish'}
              </Button>
            )}
            {(posting.status === 'PUBLISHED' || posting.status === 'ON_HOLD') && (
              <Button size="sm" variant="destructive" onClick={handleClose} disabled={actionLoading === 'close'}>
                <XCircle size={16} className="mr-2" />
                {actionLoading === 'close' ? 'Closing...' : 'Close'}
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Job Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Building2 size={14} />
                Department
              </div>
              <p className="text-sm font-medium">{posting.department?.name || '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Briefcase size={14} />
                Type
              </div>
              <p className="text-sm font-medium">{posting.employmentType}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <MapPin size={14} />
                Location
              </div>
              <p className="text-sm font-medium">{posting.location || '-'}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Users size={14} />
                Vacancies
              </div>
              <p className="text-sm font-medium">{posting.vacancies}</p>
            </div>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-2">Description</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
              {posting.description || 'No description provided'}
            </p>
          </div>

          {/* Requirements */}
          {posting.requirements && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Requirements</h3>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {posting.requirements}
              </p>
            </div>
          )}

          {/* Salary */}
          {(posting.minSalary || posting.maxSalary) && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">Salary Range</h3>
              <p className="text-sm text-muted-foreground">
                {posting.minSalary
                  ? formatCurrency(Number(posting.minSalary))
                  : 'Negotiable'}
                {posting.maxSalary && ` - ${formatCurrency(Number(posting.maxSalary))}`}
              </p>
            </div>
          )}
        </div>

        {/* Right - Sidebar Info */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">Timeline</h3>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm">{formatDateTime(posting.createdAt)}</p>
              </div>
              {posting.postedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Published</p>
                  <p className="text-sm">{formatDateTime(posting.postedAt)}</p>
                </div>
              )}
              {posting.closedAt && (
                <div>
                  <p className="text-xs text-muted-foreground">Closed</p>
                  <p className="text-sm">{formatDateTime(posting.closedAt)}</p>
                </div>
              )}
            </div>
          </div>

          {posting.position && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-1">Position</h3>
              <p className="text-sm text-muted-foreground">{posting.position.name}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
