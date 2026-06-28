import { useState, useEffect, useCallback } from 'react';
import { recruitmentService, type Interview } from '@/services/recruitment.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import toast from 'react-hot-toast';
import {
  Search,
  RefreshCw,
  CalendarDays,
  Clock,
  Video,
  MapPin,
  UserRound,
  Plus,
  ExternalLink,
} from 'lucide-react';
import { formatDate, formatTime } from '@/utils/format';

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  CONFIRMED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  COMPLETED: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  CANCELLED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  NO_SHOW: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        STATUS_STYLES[status] || STATUS_STYLES.SCHEDULED
      }`}
    >
      {status}
    </span>
  );
}

export function InterviewSchedule() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await recruitmentService.getInterviews(companyId);
      setInterviews(data);
    } catch (error) {
      console.error('Failed to fetch interviews:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = interviews.filter((i) => {
    const matchesSearch =
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.candidate?.firstName.toLowerCase().includes(search.toLowerCase()) ||
      i.candidate?.lastName.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !filterStatus || i.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  // Group interviews by date
  const grouped = filtered.reduce<Record<string, Interview[]>>((acc, interview) => {
    const dateKey = formatDate(interview.scheduledAt);
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(interview);
    return acc;
  }, {});

  const handleScheduleInterview = () => {
    toast('Form schedule interview belum tersedia. Route create interview belum disambungkan.');
  };

  return (
    <div>
      <PageHeader
        title="Interview Schedule"
        description="Manage and track candidate interviews"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={handleScheduleInterview}>
              <Plus size={16} className="mr-2" />
              Schedule Interview
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
            placeholder="Search interviews..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-2">
          {['', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].map(
            (s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  filterStatus === s
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

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <div className="flex flex-col items-center gap-2">
            <CalendarDays size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No interviews found</p>
            <p className="text-xs text-muted-foreground">
              Schedule interviews for candidates in your pipeline
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, items]) => (
            <div key={date}>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
                <CalendarDays size={14} />
                {date}
                <span className="text-xs text-muted-foreground/60">({items.length})</span>
              </h3>

              <div className="space-y-3">
                {items.map((interview) => (
                  <div
                    key={interview.id}
                    className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        {/* Avatar */}
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-sm font-semibold text-primary">
                            {interview.candidate
                              ? `${interview.candidate.firstName[0]}${interview.candidate.lastName[0]}`
                              : '?'}
                          </span>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium">
                              {interview.candidate
                                ? `${interview.candidate.firstName} ${interview.candidate.lastName}`
                                : 'Unknown'}
                            </p>
                            <StatusBadge status={interview.status} />
                          </div>

                          <p className="text-sm text-muted-foreground">{interview.title}</p>

                          {interview.application?.jobPosting && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {interview.application.jobPosting.title}
                            </p>
                          )}

                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatTime(interview.scheduledAt)}
                              {interview.durationMinutes &&
                                ` (${interview.durationMinutes}min)`}
                            </span>

                            {interview.type === 'ONLINE' && interview.meetingLink ? (
                              <a
                                href={interview.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Video size={12} />
                                Join Online
                                <ExternalLink size={10} />
                              </a>
                            ) : interview.location ? (
                              <span className="flex items-center gap-1">
                                <MapPin size={12} />
                                {interview.location}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {/* Type icon */}
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          interview.type === 'ONLINE'
                            ? 'bg-sky-50 dark:bg-sky-950'
                            : 'bg-gray-50 dark:bg-gray-900'
                        }`}
                      >
                        {interview.type === 'ONLINE' ? (
                          <Video size={16} className="text-sky-600 dark:text-sky-400" />
                        ) : (
                          <UserRound size={16} className="text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
