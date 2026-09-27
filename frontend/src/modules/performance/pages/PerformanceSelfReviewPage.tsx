import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { performanceService, type PerformanceExecutionAssignmentSummary, type PerformancePlanningAssignment } from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { CheckCircle2, RefreshCw, Save, Send } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.status.draft',
  PUBLISHED: 'perf.status.published',
  IN_PROGRESS: 'perf.status.inProgress',
  SUBMITTED: 'perf.status.submitted',
  APPROVED: 'perf.status.approved',
  REJECTED: 'perf.status.rejected',
  REVISION_REQUIRED: 'perf.status.revisionRequired',
  COMPLETED: 'perf.status.completed',
  REASSIGNED: 'perf.status.reassigned',
  ARCHIVED: 'perf.status.archived',
};

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
  const { t } = useI18n();
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
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.selfReview.loadAssignmentsFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedAssignmentId, t]);

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
    } catch (error) {
      console.error(error);
      setDetail(null);
      toast.error(apiErrorMessage(error, t('perf.common.loadDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedAssignmentId, t]);

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
      toast.success(t('perf.selfReview.commentSaved'));
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.common.commentSaveFailed')));
    } finally {
      setActing(false);
    }
  }, [draftComments, loadDetail, t]);

  const handleSubmit = useCallback(async () => {
    if (!detail) {
      toast.error(t('perf.common.selectAssignmentFirst'));
      return;
    }
    setActing(true);
    try {
      await performanceService.submitPlanningAssignment(detail.id, { notes: submitNotes.trim() || undefined });
      toast.success(t('perf.selfReview.submitSuccess'));
      setSubmitNotes('');
      await loadAssignments();
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.selfReview.submitFailed')));
    } finally {
      setActing(false);
    }
  }, [detail, loadAssignments, loadDetail, submitNotes, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('perf.selfReview.title')}
        description={t('perf.selfReview.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => void loadAssignments()}>
            <RefreshCw size={16} className="mr-2" />
            {t('common.refresh')}
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('perf.common.filterPeriod')}</label>
            <Select2
              value={filterPeriodId}
              onValueChange={setFilterPeriodId}
              options={periodOptions}
              placeholder={t('perf.common.allPeriods')}
            />
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{t('perf.selfReview.assignments')}</p>
              <CheckCircle2 size={16} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-sm font-semibold">{filteredAssignments.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{t('perf.selfReview.selectedStatus')}</p>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[selectedSummary?.status || 'DRAFT'] || STATUS_STYLES.DRAFT}`}>
                {selectedSummary?.status
                  ? STATUS_LABEL_KEYS[selectedSummary.status]
                    ? t(STATUS_LABEL_KEYS[selectedSummary.status])
                    : selectedSummary.status
                  : '-'}
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
              <h3 className="text-sm font-semibold">{t('perf.selfReview.myAssignments')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.selfReview.myAssignmentsHint')}</p>
            </div>
            <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: filteredAssignments.length })}</span>
          </div>
          <div className="space-y-3">
            {filteredAssignments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t('perf.selfReview.emptyAssignments')}
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
                      <p className="text-sm font-semibold">{item.period?.name || t('perf.selfReview.noPeriod')}</p>
                      <p className="text-xs text-muted-foreground">{item.period?.code || ''}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.DRAFT}`}>
                      {STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>{t('perf.common.reviewerLabel', { value: item.reviewer?.fullName || '-' })}</p>
                    <p>{t('perf.common.submittedLabel', { value: formatDateTime(item.submittedAt) })}</p>
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
                <h3 className="text-sm font-semibold">{t('perf.selfReview.formTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.selfReview.formHint')}</p>
              </div>
              {detail && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[detail.status] || STATUS_STYLES.DRAFT}`}>
                  {STATUS_LABEL_KEYS[detail.status] ? t(STATUS_LABEL_KEYS[detail.status]) : detail.status}
                </span>
              )}
            </div>

            {detailLoading ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t('perf.common.loadingDetail')}
              </div>
            ) : !detail ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t('perf.selfReview.selectAssignment')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{detail.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.period?.name || '-'} • {t('perf.selfReview.reviewerInline', { value: detail.reviewer?.fullName || '-' })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('perf.selfReview.submittedInline', { value: formatDateTime(detail.submittedAt) })} • {t('perf.selfReview.reviewedInline', { value: formatDateTime(detail.reviewedAt) })}
                  </p>
                </div>

                <div className="space-y-3">
                  {detail.targets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('perf.selfReview.noTargets')}
                    </div>
                  ) : (
                    detail.targets.map((target) => (
                      <div key={target.id} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{target.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {target.component?.name || t('perf.common.noComponent')} • {target.indicator?.name || t('perf.common.noIndicator')}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[target.status] || STATUS_STYLES.DRAFT}`}>
                            {STATUS_LABEL_KEYS[target.status] ? t(STATUS_LABEL_KEYS[target.status]) : target.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <p>{t('perf.common.targetLabel', { value: target.targetValue ?? target.targetText ?? '-' })}</p>
                          <p>{t('perf.common.currentLabel', { value: target.currentValue ?? target.currentText ?? '-' })}</p>
                          <p>{t('perf.selfReview.progressLabel', { value: target.progressPercent || 0 })}</p>
                        </div>
                        <textarea
                          value={draftComments[target.id] ?? ''}
                          onChange={(event) => setDraftComments((prev) => ({ ...prev, [target.id]: event.target.value }))}
                          placeholder={t('perf.selfReview.selfCommentPlaceholder')}
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
                          {t('perf.common.saveComment')}
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{t('perf.selfReview.submissionNotes')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('perf.selfReview.submissionNotesHint')}</p>
                  <Input
                    value={submitNotes}
                    onChange={(event) => setSubmitNotes(event.target.value)}
                    placeholder={t('perf.selfReview.submitNotesPlaceholder')}
                    className="mt-3"
                  />
                  <Button size="sm" className="mt-3 w-full" onClick={() => void handleSubmit()} disabled={acting}>
                    <Send size={16} className="mr-2" />
                    {t('perf.selfReview.submitButton')}
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

