import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { performanceService, type PerformancePlanningAssignment } from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, RefreshCw, Save, Send, XCircle } from 'lucide-react';
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

export function PerformanceManagerReviewPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [queue, setQueue] = useState<PerformancePlanningAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [detail, setDetail] = useState<PerformancePlanningAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [acting, setActing] = useState(false);
  const [filterPeriodId, setFilterPeriodId] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const periodOptions = useMemo(() => {
    const unique = new Map<string, { value: string; label: string }>();
    for (const item of queue) {
      const periodId = item.period?.id || item.periodId;
      if (!periodId) continue;
      if (unique.has(periodId)) continue;
      unique.set(periodId, { value: periodId, label: `${item.period?.name || t('perf.common.noPeriod')} • ${item.period?.code || periodId}` });
    }
    return Array.from(unique.values());
  }, [queue, t]);

  const filteredQueue = useMemo(
    () => queue.filter((item) => !filterPeriodId || item.periodId === filterPeriodId),
    [queue, filterPeriodId]
  );

  const loadQueue = useCallback(async () => {
    if (!companyId) {
      setQueue([]);
      setSelectedAssignmentId('');
      setDetail(null);
      setFilterPeriodId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getExecutionApprovalQueue(companyId);
      setQueue(data);
      const nextId =
        selectedAssignmentId && data.some((item) => item.id === selectedAssignmentId)
          ? selectedAssignmentId
          : data[0]?.id || '';
      setSelectedAssignmentId(nextId);
      const nextPeriod = data.find((item) => item.id === nextId)?.periodId || '';
      setFilterPeriodId((prev) => (prev && data.some((item) => item.periodId === prev) ? prev : nextPeriod));
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.common.loadQueueFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedAssignmentId, t]);

  const loadDetail = useCallback(async () => {
    if (!selectedAssignmentId) {
      setDetail(null);
      setDraftComments({});
      setDecisionNotes('');
      return;
    }

    setDetailLoading(true);
    try {
      const data = await performanceService.getExecutionAssignmentById(selectedAssignmentId);
      setDetail(data);
      const nextDraft: Record<string, string> = {};
      for (const target of data.targets) {
        nextDraft[target.id] = target.reviewerComment || '';
      }
      setDraftComments(nextDraft);
      setDecisionNotes(data.decisionNotes || '');
    } catch (error) {
      console.error(error);
      setDetail(null);
      toast.error(apiErrorMessage(error, t('perf.common.loadDetailFailed')));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedAssignmentId, t]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  const handleSaveComment = useCallback(async (targetId: string) => {
    const comment = (draftComments[targetId] ?? '').trim();
    setActing(true);
    try {
      await performanceService.updateExecutionTargetComment(targetId, comment || null);
      toast.success(t('perf.managerReview.reviewerCommentSaved'));
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.common.commentSaveFailed')));
    } finally {
      setActing(false);
    }
  }, [draftComments, loadDetail, t]);

  const runDecision = useCallback(async (action: 'approve' | 'revision' | 'reject') => {
    if (!detail) {
      toast.error(t('perf.common.selectAssignmentFirst'));
      return;
    }

    setActing(true);
    try {
      const payload = { notes: decisionNotes.trim() || undefined };
      if (action === 'approve') await performanceService.approvePlanningAssignment(detail.id, payload);
      if (action === 'revision') await performanceService.requestPlanningAssignmentRevision(detail.id, payload);
      if (action === 'reject') await performanceService.rejectPlanningAssignment(detail.id, payload);
      toast.success(t('perf.managerReview.decisionSaved'));
      setDecisionNotes('');
      await loadQueue();
      await loadDetail();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.managerReview.decisionFailed')));
    } finally {
      setActing(false);
    }
  }, [decisionNotes, detail, loadDetail, loadQueue, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('perf.managerReview.title')}
        description={t('perf.managerReview.description')}
        actions={(
          <Button variant="outline" size="sm" onClick={() => void loadQueue()}>
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
              <p className="text-xs text-muted-foreground">{t('perf.managerReview.queue')}</p>
              <CheckCircle2 size={16} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-sm font-semibold">{filteredQueue.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{t('perf.managerReview.selected')}</p>
              <Clock3 size={16} className="text-muted-foreground" />
            </div>
            <p className="mt-2 text-sm font-semibold">{detail?.employee.fullName || '-'}</p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t('perf.common.approvalQueue')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.managerReview.approvalQueueHint')}</p>
            </div>
            <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: filteredQueue.length })}</span>
          </div>
          <div className="space-y-3">
            {filteredQueue.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                {t('perf.managerReview.emptyQueue')}
              </div>
            ) : (
              filteredQueue.map((item) => (
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
                      <p className="text-sm font-semibold">{item.employee.fullName}</p>
                      <p className="text-xs text-muted-foreground">{item.period?.name || item.periodId}</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[item.status] || STATUS_STYLES.SUBMITTED}`}>
                      {STATUS_LABEL_KEYS[item.status] ? t(STATUS_LABEL_KEYS[item.status]) : item.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                    <p>{t('perf.common.submittedLabel', { value: formatDateTime(item.submittedAt) })}</p>
                    <p>{t('perf.common.reviewerLabel', { value: item.reviewer?.fullName || '-' })}</p>
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
                <h3 className="text-sm font-semibold">{t('perf.managerReview.formTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.managerReview.formHint')}</p>
              </div>
              {detail && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[detail.status] || STATUS_STYLES.SUBMITTED}`}>
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
                {t('perf.managerReview.selectFromQueue')}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{detail.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {detail.period?.name || '-'} • {t('perf.common.submittedInline', { value: formatDateTime(detail.submittedAt) })}
                  </p>
                </div>

                <div className="space-y-3">
                  {detail.targets.map((target) => (
                    <div key={target.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{target.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {target.component?.name || t('perf.common.noComponent')} • {target.indicator?.name || t('perf.common.noIndicator')}
                          </p>
                        </div>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[target.status] || STATUS_STYLES.SUBMITTED}`}>
                          {STATUS_LABEL_KEYS[target.status] ? t(STATUS_LABEL_KEYS[target.status]) : target.status}
                        </span>
                      </div>
                      <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                        <p>{t('perf.common.targetLabel', { value: target.targetValue ?? target.targetText ?? '-' })}</p>
                        <p>{t('perf.common.currentLabel', { value: target.currentValue ?? target.currentText ?? '-' })}</p>
                        <p>{t('perf.managerReview.selfCommentLabel', { value: target.selfComment || '-' })}</p>
                      </div>
                      <textarea
                        value={draftComments[target.id] ?? ''}
                        onChange={(event) => setDraftComments((prev) => ({ ...prev, [target.id]: event.target.value }))}
                        placeholder={t('perf.managerReview.reviewerCommentPlaceholder')}
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
                  ))}
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-semibold">{t('perf.managerReview.decisionNotes')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{t('perf.managerReview.decisionNotesHint')}</p>
                  <Input
                    value={decisionNotes}
                    onChange={(event) => setDecisionNotes(event.target.value)}
                    placeholder={t('perf.managerReview.decisionNotesPlaceholder')}
                    className="mt-3"
                  />
                  <div className="mt-3 grid gap-2">
                    <Button size="sm" onClick={() => void runDecision('approve')} disabled={acting}>
                      <Send size={16} className="mr-2" />
                      {t('perf.common.approve')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void runDecision('revision')} disabled={acting}>
                      <Clock3 size={16} className="mr-2" />
                      {t('perf.common.requestRevision')}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void runDecision('reject')} disabled={acting}>
                      <XCircle size={16} className="mr-2" />
                      {t('perf.common.reject')}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

