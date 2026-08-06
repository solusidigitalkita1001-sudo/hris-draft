import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { performanceService, type PerformanceExecutionAssignmentSummary, type PerformancePlanningAssignment } from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { CheckCircle2, RefreshCw, Save, Send } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  SUBMITTED: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  REVISION_REQUIRED: 'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  COMPLETED: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
  REASSIGNED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  ARCHIVED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PerformanceSelfReviewPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [assignments, setAssignments] = useState<PerformanceExecutionAssignmentSummary[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [detail, setDetail] = useState<PerformancePlanningAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [filterPeriodId, setFilterPeriodId] = useState('');
  const [submitNotes, setSubmitNotes] = useState('');
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const periodOptions = useMemo(() => {
    const unique = new Map<string, { value: string; label: string }>();
    for (const item of assignments) {
      if (!item.period?.id) continue;
      if (unique.has(item.period.id)) continue;
      unique.set(item.period.id, { value: item.period.id, label: `${item.period.name} • ${item.period.code}` });
    }
    return Array.from(unique.values());
  }, [assignments]);

  const filteredAssignments = useMemo(
    () => assignments.filter((item) => !filterPeriodId || item.periodId === filterPeriodId),
    [assignments, filterPeriodId]
  );

  const selectedSummary = useMemo(
    () => assignments.find((item) => item.id === selectedAssignmentId) ?? null,
    [assignments, selectedAssignmentId]
  );

  const loadAssignments = useCallback(async () => {
    if (!companyId) {
      setAssignments([]);
      setSelectedAssignmentId('');
      setDetail(null);
      setFilterPeriodId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getMyExecutionAssignments(companyId);
      setAssignments(data);
      const nextId =
        selectedAssignmentId && data.some((item) => item.id === selectedAssignmentId)
          ? selectedAssignmentId
          : data[0]?.id || '';
      setSelectedAssignmentId(nextId);
      const nextPeriod = data.find((item) => item.id === nextId)?.periodId || '';
      setFilterPeriodId((prev) => (prev && data.some((item) => item.periodId === prev) ? prev : nextPeriod));
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memuat assignment self review');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedAssignmentId]);

  const loadDetail = useCallback(async () => {
    if (!selectedAssignmentId) {
      setDetail(null);
      setDraftComments({});
      return;
    }

    setDetailLoading(true);
    try {
      const data = await performanceService.getExecutionAssignmentById(selectedAssignmentId);
      setDetail(data);
      const nextDraft: Record<string, string> = {};
      for (const target of data.targets) {
        nextDraft[target.id] = target.selfComment || '';
      }
      setDraftComments(nextDraft);
    } catch (error: any) {
      console.error(error);
      setDetail(null);
      toast.error(error?.response?.data?.message || 'Gagal memuat detail assignment');
    } finally {
      setDetailLoading(false);
    }
  }, [selectedAssignmentId]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleSaveComment = useCallback(async (targetId: string) => {
    const comment = (draftComments[targetId] ?? '').trim();
    setActing(true);
    try {
      await performanceService.updateExecutionTargetComment(targetId, comment || null);
      toast.success('Self comment tersimpan');
      await loadDetail();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan comment');
    } finally {
      setActing(false);
    }
  }, [draftComments, loadDetail]);

  const handleSubmit = useCallback(async () => {
    if (!detail) {
      toast.error('Pilih assignment terlebih dahulu');
      return;
    }
    setActing(true);
    try {
      await performanceService.submitPlanningAssignment(detail.id, { notes: submitNotes.trim() || undefined });
      toast.success('Self review berhasil disubmit');
      setSubmitNotes('');
      await loadAssignments();
      await loadDetail();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal submit self review');
    } finally {
      setActing(false);
    }
  }, [detail, loadAssignments, loadDetail, submitNotes]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Performance Self Review"
        description="Phase 4 (MVP): isi self comment per target dan submit ke reviewer."
        actions={(
          <Button variant="outline" size="sm" onClick={() => void loadAssignments()}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">Filter Period</label>
            <Select2
              value={filterPeriodId}
              onValueChange={setFilterPeriodId}
              options={periodOptions}
              placeholder="Semua period"
            />
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Assignments</p>
              <CheckCircle2 size={16} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-sm font-semibold">{filteredAssignments.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">Selected Status</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[selectedSummary?.status || 'DRAFT'] || STATUS_STYLES.DRAFT}`}>
                {selectedSummary?.status || '-'}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold">{selectedSummary?.period?.name || '-'}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">My Assignments</h3>
              <p className="text-xs text-muted-foreground">Pilih assignment untuk isi self review.</p>
            </div>
            <span className="text-xs text-muted-foreground">{filteredAssignments.length} item</span>
          </div>
          <div className="space-y-3">
            {filteredAssignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Belum ada assignment execution untuk self review.
              </div>
            ) : (
              filteredAssignments.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedAssignmentId(item.id)}
                  className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                    item.id === selectedAssignmentId
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-background hover:bg-muted/50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{item.period?.name || 'Tanpa period'}</p>
                      <p className="text-xs text-muted-foreground">{item.period?.code || ''}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.DRAFT}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>Reviewer: {item.reviewer?.fullName || '-'}</p>
                    <p>Submitted: {formatDateTime(item.submittedAt)}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Self Review Form</h3>
                <p className="text-xs text-muted-foreground">Isi comment per target lalu submit.</p>
              </div>
              {detail && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[detail.status] || STATUS_STYLES.DRAFT}`}>
                  {detail.status}
                </span>
              )}
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Loading detail...
              </div>
            ) : !detail ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                Pilih assignment untuk mulai self review.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{detail.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.period?.name || '-'} • Reviewer {detail.reviewer?.fullName || '-'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Submitted {formatDateTime(detail.submittedAt)} • Reviewed {formatDateTime(detail.reviewedAt)}
                  </p>
                </div>

                <div className="space-y-3">
                  {detail.targets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Belum ada target.
                    </div>
                  ) : (
                    detail.targets.map((target) => (
                      <div key={target.id} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{target.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {target.component?.name || 'Tanpa component'} • {target.indicator?.name || 'Tanpa indicator'}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[target.status] || STATUS_STYLES.DRAFT}`}>
                            {target.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <p>Target: {target.targetValue ?? target.targetText ?? '-'}</p>
                          <p>Current: {target.currentValue ?? target.currentText ?? '-'}</p>
                          <p>Progress: {target.progressPercent || 0}%</p>
                        </div>
                        <textarea
                          value={draftComments[target.id] ?? ''}
                          onChange={(event) => setDraftComments((prev) => ({ ...prev, [target.id]: event.target.value }))}
                          placeholder="Self comment"
                          className="mt-3 min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 w-full"
                          onClick={() => void handleSaveComment(target.id)}
                          disabled={acting}
                        >
                          <Save size={16} className="mr-2" />
                          Simpan Comment
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">Submission Notes</p>
                  <p className="mt-1 text-xs text-muted-foreground">Optional catatan saat submit ke reviewer.</p>
                  <Input
                    value={submitNotes}
                    onChange={(event) => setSubmitNotes(event.target.value)}
                    placeholder="Catatan submit"
                    className="mt-3"
                  />
                  <Button size="sm" className="mt-3 w-full" onClick={() => void handleSubmit()} disabled={acting}>
                    <Send size={16} className="mr-2" />
                    Submit Self Review
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

