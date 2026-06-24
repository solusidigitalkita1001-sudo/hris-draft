import { useState, useEffect, useCallback } from 'react';
import { recruitmentService, type JobPosting, type JobApplication } from '@/services/recruitment.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { formatDate, getInitials } from '@/utils/format';

const STAGES = [
  { key: 'NEW', label: 'New', color: 'border-blue-400 bg-blue-50/50 dark:bg-blue-950/30' },
  { key: 'SCREENING', label: 'Screening', color: 'border-purple-400 bg-purple-50/50 dark:bg-purple-950/30' },
  { key: 'INTERVIEW', label: 'Interview', color: 'border-amber-400 bg-amber-50/50 dark:bg-amber-950/30' },
  { key: 'OFFER', label: 'Offer', color: 'border-rose-400 bg-rose-50/50 dark:bg-rose-950/30' },
  { key: 'HIRED', label: 'Hired', color: 'border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30' },
];

const REJECTED_STAGES = ['REJECTED', 'WITHDRAWN'];

export function ApplicationPipeline() {
  const [postings, setPostings] = useState<JobPosting[]>([]);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [selectedPosting, setSelectedPosting] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchPostings = useCallback(async () => {
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await recruitmentService.getJobPostings(companyId);
      setPostings(data.filter((p) => p.status === 'PUBLISHED' || p.status === 'ON_HOLD'));
    } catch (error) {
      console.error('Failed to fetch postings:', error);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await recruitmentService.getApplications(companyId, selectedPosting || undefined);
      setApplications(data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedPosting]);

  useEffect(() => {
    fetchPostings();
  }, [fetchPostings]);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const getApplicationsByStage = (stage: string) => {
    return applications.filter((a) => a.status === stage);
  };

  const rejectedApps = applications.filter((a) => REJECTED_STAGES.includes(a.status));

  const handleStageClick = async (appId: string, newStatus: string) => {
    try {
      await recruitmentService.updateApplicationStatus(appId, newStatus);
      await fetchApplications();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  return (
    <div>
      <PageHeader
        title="Application Pipeline"
        description="Track candidates through the hiring process"
        actions={
          <Button variant="outline" size="sm" onClick={fetchApplications}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        }
      />

      {/* Posting Filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setSelectedPosting('')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            !selectedPosting
              ? 'bg-primary text-primary-foreground border-primary'
              : 'bg-background text-muted-foreground border-border hover:border-primary/50'
          }`}
        >
          All Postings
        </button>
        {postings.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPosting(p.id)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              selectedPosting === p.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: 'thin' }}>
          {/* Active Stages */}
          {STAGES.map((stage) => {
            const apps = getApplicationsByStage(stage.key);
            return (
              <div
                key={stage.key}
                className={`flex-shrink-0 w-72 rounded-xl border-t-2 ${stage.color} border-border bg-white dark:bg-gray-800`}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                  <h3 className="text-sm font-medium">{stage.label}</h3>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {apps.length}
                  </span>
                </div>

                <div className="p-3 space-y-2 min-h-[200px]">
                  {apps.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-xs text-muted-foreground">No candidates</p>
                    </div>
                  ) : (
                    apps.map((app) => (
                      <div
                        key={app.id}
                        className="bg-background rounded-lg border border-border p-3 hover:border-primary/50 transition-colors cursor-pointer"
                      >
                        <div className="flex items-start gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-semibold text-primary">
                              {app.candidate
                                ? getInitials(`${app.candidate.firstName} ${app.candidate.lastName}`)
                                : '?'}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {app.candidate
                                ? `${app.candidate.firstName} ${app.candidate.lastName}`
                                : 'Unknown'}
                            </p>
                            {app.candidate?.email && (
                              <p className="text-xs text-muted-foreground truncate">
                                {app.candidate.email}
                              </p>
                            )}
                          </div>
                        </div>

                        {app.jobPosting && (
                          <p className="text-xs text-muted-foreground mb-2">
                            {app.jobPosting.title}
                          </p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">
                            {formatDate(app.appliedAt)}
                          </span>

                          {/* Quick move buttons */}
                          {stage.key !== 'HIRED' && (
                            <div className="flex gap-1">
                              {stage.key === 'NEW' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageClick(app.id, 'SCREENING');
                                  }}
                                  className="text-xs px-2 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 hover:bg-purple-200"
                                >
                                  Screen
                                </button>
                              )}
                              {stage.key === 'SCREENING' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageClick(app.id, 'INTERVIEW');
                                  }}
                                  className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300 hover:bg-amber-200"
                                >
                                  Interview
                                </button>
                              )}
                              {stage.key === 'INTERVIEW' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleStageClick(app.id, 'OFFER');
                                  }}
                                  className="text-xs px-2 py-0.5 rounded bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 hover:bg-rose-200"
                                >
                                  Offer
                                </button>
                              )}
                              {stage.key === 'OFFER' && (
                                <div className="flex gap-1">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStageClick(app.id, 'HIRED');
                                    }}
                                    className="text-xs px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 hover:bg-emerald-200"
                                  >
                                    Hire
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStageClick(app.id, 'REJECTED');
                                    }}
                                    className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 hover:bg-red-200"
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStageClick(app.id, 'REJECTED');
                                }}
                                className="text-xs px-2 py-0.5 rounded bg-red-50 text-red-500 dark:bg-red-950 dark:text-red-400 hover:bg-red-100"
                                title="Reject"
                              >
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Rejected Column */}
          <div className="flex-shrink-0 w-72 rounded-xl border-t-2 border-red-400 border-border bg-red-50/50 dark:bg-red-950/30 bg-white dark:bg-gray-800">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-red-600 dark:text-red-400">Rejected</h3>
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {rejectedApps.length}
              </span>
            </div>
            <div className="p-3 space-y-2 min-h-[200px]">
              {rejectedApps.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-xs text-muted-foreground">No rejected candidates</p>
                </div>
              ) : (
                rejectedApps.map((app) => (
                  <div
                    key={app.id}
                    className="bg-background rounded-lg border border-border p-3 opacity-75 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center shrink-0">
                        <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                          {app.candidate
                            ? getInitials(`${app.candidate.firstName} ${app.candidate.lastName}`)
                            : '?'}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {app.candidate
                            ? `${app.candidate.firstName} ${app.candidate.lastName}`
                            : 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {app.status} • {formatDate(app.appliedAt)}
                        </p>
                      </div>
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
