import { appConfig } from '@/config/app';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformancePlanningAssignment,
  type PerformancePlanningWorkspace,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { CheckCircle2, Clock3, RefreshCw, Send, Target, Upload, Users, XCircle } from 'lucide-react';
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

function safeNumber(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

function formatFileSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(size / 1024).toFixed(1)} KB`;
}

export function PerformanceExecutionPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [periods, setPeriods] = useState<Array<{ id: string; name: string; code: string; planningPublishedAt?: string | null }>>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [workspace, setWorkspace] = useState<PerformancePlanningWorkspace | null>(null);
  const [approvalQueue, setApprovalQueue] = useState<PerformancePlanningAssignment[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [acting, setActing] = useState(false);
  const [progressForm, setProgressForm] = useState({
    progressPercent: '0',
    currentValue: '',
    currentText: '',
    note: '',
  });
  const [actionNotes, setActionNotes] = useState('');
  const [evidenceNotes, setEvidenceNotes] = useState('');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const periodOptions = useMemo(
    () => periods.map((period) => ({ value: period.id, label: `${period.name} • ${period.code}` })),
    [periods]
  );

  const selectedAssignment = useMemo(
    () => workspace?.planningAssignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [selectedAssignmentId, workspace]
  );

  const selectedTarget = useMemo(
    () => selectedAssignment?.targets.find((target) => target.id === selectedTargetId) ?? null,
    [selectedAssignment, selectedTargetId]
  );

  const filteredQueue = useMemo(
    () => approvalQueue.filter((assignment) => !selectedPeriodId || assignment.periodId === selectedPeriodId),
    [approvalQueue, selectedPeriodId]
  );

  const loadQueue = useCallback(async () => {
    if (!companyId) {
      setApprovalQueue([]);
      return;
    }

    setQueueLoading(true);
    try {
      const data = await performanceService.getExecutionApprovalQueue(companyId);
      setApprovalQueue(data);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.common.loadQueueFailed')));
    } finally {
      setQueueLoading(false);
    }
  }, [companyId, t]);

  const loadWorkspace = useCallback(async (periodId: string) => {
    if (!periodId) {
      setWorkspace(null);
      setSelectedAssignmentId('');
      setSelectedTargetId('');
      return;
    }

    setWorkspaceLoading(true);
    try {
      const data = await performanceService.getPlanningWorkspace(periodId);
      setWorkspace(data);
      const nextAssignmentId =
        selectedAssignmentId && data.planningAssignments.some((assignment) => assignment.id === selectedAssignmentId)
          ? selectedAssignmentId
          : data.planningAssignments[0]?.id || '';
      setSelectedAssignmentId(nextAssignmentId);
      const nextAssignment = data.planningAssignments.find((assignment) => assignment.id === nextAssignmentId);
      const nextTargetId =
        selectedTargetId && nextAssignment?.targets.some((target) => target.id === selectedTargetId)
          ? selectedTargetId
          : nextAssignment?.targets[0]?.id || '';
      setSelectedTargetId(nextTargetId);
    } catch (error) {
      console.error(error);
      setWorkspace(null);
      toast.error(apiErrorMessage(error, t('perf.execution.loadWorkspaceFailed')));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedAssignmentId, selectedTargetId, t]);

  const loadBootstrap = useCallback(async () => {
    if (!companyId) {
      setPeriods([]);
      setSelectedPeriodId('');
      setWorkspace(null);
      setApprovalQueue([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [periodData] = await Promise.all([
        performanceService.getPeriods(companyId, { status: 'PUBLISHED' }),
        loadQueue(),
      ]);

      const executionPeriods = periodData.filter((period) => period.planningPublishedAt);
      setPeriods(executionPeriods.map((period) => ({
        id: period.id,
        name: period.name,
        code: period.code,
        planningPublishedAt: period.planningPublishedAt,
      })));

      const nextPeriodId =
        selectedPeriodId && executionPeriods.some((period) => period.id === selectedPeriodId)
          ? selectedPeriodId
          : executionPeriods[0]?.id || '';
      setSelectedPeriodId(nextPeriodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.execution.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, loadQueue, selectedPeriodId, t]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    void loadWorkspace(selectedPeriodId);
  }, [loadWorkspace, selectedPeriodId]);

  useEffect(() => {
    if (!selectedAssignment) {
      setSelectedTargetId('');
      return;
    }

    const nextTargetId = selectedAssignment.targets.find((target) => target.id === selectedTargetId)?.id
      || selectedAssignment.targets[0]?.id
      || '';
    setSelectedTargetId(nextTargetId);
  }, [selectedAssignment, selectedTargetId]);

  useEffect(() => {
    if (!selectedTarget) {
      setProgressForm({
        progressPercent: '0',
        currentValue: '',
        currentText: '',
        note: '',
      });
      setEvidenceNotes('');
      setEvidenceFile(null);
      return;
    }

    setProgressForm({
      progressPercent: String(selectedTarget.progressPercent ?? 0),
      currentValue: selectedTarget.currentValue === null || selectedTarget.currentValue === undefined ? '' : String(selectedTarget.currentValue),
      currentText: selectedTarget.currentText || '',
      note: selectedTarget.selfComment || selectedTarget.reviewerComment || '',
    });
    setEvidenceNotes('');
    setEvidenceFile(null);
  }, [selectedTarget]);

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadWorkspace(selectedPeriodId),
      loadQueue(),
    ]);
  }, [loadQueue, loadWorkspace, selectedPeriodId]);

  const handleSaveProgress = useCallback(async () => {
    if (!selectedTarget || !selectedAssignment) {
      toast.error(t('perf.execution.selectTargetFirst'));
      return;
    }

    setSavingProgress(true);
    try {
      await performanceService.createPlanningTargetProgress(selectedTarget.id, {
        progressPercent: Math.min(100, Math.max(0, Number(progressForm.progressPercent || 0))),
        currentValue: safeNumber(progressForm.currentValue),
        currentText: progressForm.currentText.trim() || undefined,
        note: progressForm.note.trim() || undefined,
      });
      toast.success(t('perf.execution.progressSaved'));
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.execution.progressSaveFailed')));
    } finally {
      setSavingProgress(false);
    }
  }, [progressForm, refreshAll, selectedAssignment, selectedTarget, t]);

  const handleUploadEvidence = useCallback(async () => {
    if (!selectedTarget) {
      toast.error(t('perf.execution.selectTargetFirst'));
      return;
    }

    if (!evidenceFile) {
      toast.error(t('perf.execution.selectEvidenceFile'));
      return;
    }

    setUploadingEvidence(true);
    try {
      await performanceService.uploadPlanningEvidence(selectedTarget.id, evidenceFile, evidenceNotes.trim() || undefined);
      toast.success(t('perf.execution.evidenceUploaded'));
      setEvidenceFile(null);
      setEvidenceNotes('');
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.execution.evidenceUploadFailed')));
    } finally {
      setUploadingEvidence(false);
    }
  }, [evidenceFile, evidenceNotes, refreshAll, selectedTarget, t]);

  const runAssignmentAction = useCallback(async (
    action: 'submit' | 'approve' | 'reject' | 'revision' | 'complete',
    successMessage: string
  ) => {
    if (!selectedAssignment) {
      toast.error(t('perf.common.selectAssignmentFirst'));
      return;
    }

    setActing(true);
    try {
      const payload = { notes: actionNotes.trim() || undefined };
      if (action === 'submit') await performanceService.submitPlanningAssignment(selectedAssignment.id, payload);
      if (action === 'approve') await performanceService.approvePlanningAssignment(selectedAssignment.id, payload);
      if (action === 'reject') await performanceService.rejectPlanningAssignment(selectedAssignment.id, payload);
      if (action === 'revision') await performanceService.requestPlanningAssignmentRevision(selectedAssignment.id, payload);
      if (action === 'complete') await performanceService.completePlanningAssignment(selectedAssignment.id, payload);
      toast.success(successMessage);
      setActionNotes('');
      await refreshAll();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.execution.actionFailed')));
    } finally {
      setActing(false);
    }
  }, [actionNotes, refreshAll, selectedAssignment, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('perf.execution.title')}
        description={t('perf.execution.description')}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap()}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
          </div>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('perf.execution.periodLabel')}</label>
            <Select2
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              options={periodOptions}
              placeholder={t('perf.execution.periodPlaceholder')}
            />
          </div>
          <StatCard label={t('perf.execution.stats.planningPublished')} value={formatDateTime(workspace?.planningPublishedAt)} icon={<Clock3 size={16} />} />
          <StatCard label={t('perf.execution.stats.assignments')} value={workspace?.planningAssignments.length || 0} icon={<Users size={16} />} />
          <StatCard label={t('perf.common.approvalQueue')} value={filteredQueue.length} icon={<CheckCircle2 size={16} />} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.execution.assignmentListTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.execution.assignmentListHint')}</p>
              </div>
              <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: workspace?.planningAssignments.length || 0 })}</span>
            </div>
            <div className="space-y-3">
              {workspaceLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.execution.loadingWorkspace')}
                </div>
              ) : !workspace?.planningAssignments.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.execution.emptyAssignments')}
                </div>
              ) : (
                workspace.planningAssignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      assignment.id === selectedAssignmentId
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{assignment.employee.fullName}</p>
                        <p className="text-xs text-muted-foreground">{assignment.employee.employeeNumber}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[assignment.status] || STATUS_STYLES.DRAFT}`}>
                        {STATUS_LABEL_KEYS[assignment.status] ? t(STATUS_LABEL_KEYS[assignment.status]) : assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>{t('perf.common.reviewerLabel', { value: assignment.reviewer?.fullName || '-' })}</p>
                      <p>{t('perf.common.approverLabel', { value: assignment.approver?.fullName || '-' })}</p>
                      <p>{t('perf.common.submittedLabel', { value: formatDateTime(assignment.submittedAt) })}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.execution.approverQueueTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.execution.approverQueueHint')}</p>
            </div>
            <div className="space-y-3">
              {queueLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.execution.loadingQueue')}
                </div>
              ) : !filteredQueue.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.execution.emptyQueue')}
                </div>
              ) : (
                filteredQueue.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => {
                      setSelectedPeriodId(assignment.periodId);
                      setSelectedAssignmentId(assignment.id);
                    }}
                    className="w-full rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold">{assignment.employee.fullName}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[assignment.status] || STATUS_STYLES.SUBMITTED}`}>
                        {STATUS_LABEL_KEYS[assignment.status] ? t(STATUS_LABEL_KEYS[assignment.status]) : assignment.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {assignment.period?.name || t('perf.common.noPeriod')} • {t('perf.common.submittedInline', { value: formatDateTime(assignment.submittedAt) })}
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.execution.targetRuntimeTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.execution.targetRuntimeHint')}</p>
              </div>
              {selectedAssignment && (
                <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[selectedAssignment.status] || STATUS_STYLES.DRAFT}`}>
                  {STATUS_LABEL_KEYS[selectedAssignment.status] ? t(STATUS_LABEL_KEYS[selectedAssignment.status]) : selectedAssignment.status}
                </span>
              )}
            </div>

            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">{t('perf.execution.selectAssignmentLeft')}</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedAssignment.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('perf.execution.reviewerApproverInline', { reviewer: selectedAssignment.reviewer?.fullName || '-', approver: selectedAssignment.approver?.fullName || '-' })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('perf.execution.publishedSubmittedInline', { published: formatDateTime(selectedAssignment.publishedAt), submitted: formatDateTime(selectedAssignment.submittedAt) })}
                  </p>
                </div>

                <div className="space-y-3">
                  {selectedAssignment.targets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('perf.execution.emptyTargets')}
                    </div>
                  ) : (
                    selectedAssignment.targets.map((target) => (
                      <button
                        key={target.id}
                        type="button"
                        onClick={() => setSelectedTargetId(target.id)}
                        className={`w-full rounded-xl border px-4 py-4 text-left transition ${
                          target.id === selectedTargetId
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-background hover:bg-muted/50'
                        }`}
                      >
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
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{t('perf.common.progress')}</span>
                            <span>{target.progressPercent || 0}%</span>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary transition-all"
                              style={{ width: `${Math.min(100, Math.max(0, target.progressPercent || 0))}%` }}
                            />
                          </div>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <p>{t('perf.common.targetLabel', { value: target.targetValue ?? target.targetText ?? '-' })}</p>
                          <p>{t('perf.common.currentLabel', { value: target.currentValue ?? target.currentText ?? '-' })}</p>
                          <p>{t('perf.execution.evidenceCount', { count: target.evidences.length })}</p>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.execution.progressTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.execution.progressHint')}</p>
            </div>
            {!selectedTarget ? (
              <p className="text-sm text-muted-foreground">{t('perf.execution.selectTargetForProgress')}</p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedTarget.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('perf.execution.progressSummary', { percent: selectedTarget.progressPercent, count: selectedTarget.evidences.length })}
                  </p>
                </div>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={progressForm.progressPercent}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, progressPercent: event.target.value }))}
                  placeholder={t('perf.execution.progressPercentPlaceholder')}
                />
                <Input
                  type="number"
                  value={progressForm.currentValue}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, currentValue: event.target.value }))}
                  placeholder={t('perf.execution.currentValuePlaceholder')}
                />
                <Input
                  value={progressForm.currentText}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, currentText: event.target.value }))}
                  placeholder={t('perf.execution.currentTextPlaceholder')}
                />
                <textarea
                  value={progressForm.note}
                  onChange={(event) => setProgressForm((prev) => ({ ...prev, note: event.target.value }))}
                  placeholder={t('perf.execution.progressNotePlaceholder')}
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" className="w-full" onClick={() => void handleSaveProgress()} disabled={savingProgress}>
                  <Target size={16} className="mr-2" />
                  {savingProgress ? t('perf.common.saving') : t('perf.execution.saveProgress')}
                </Button>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.execution.evidenceTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.execution.evidenceHint')}</p>
            </div>
            {!selectedTarget ? (
              <p className="text-sm text-muted-foreground">{t('perf.execution.selectTargetForEvidence')}</p>
            ) : (
              <div className="space-y-3">
                <Input type="file" onChange={(event) => setEvidenceFile(event.target.files?.[0] || null)} />
                <Input
                  value={evidenceNotes}
                  onChange={(event) => setEvidenceNotes(event.target.value)}
                  placeholder={t('perf.execution.evidenceNotePlaceholder')}
                />
                <Button size="sm" className="w-full" variant="outline" onClick={() => void handleUploadEvidence()} disabled={uploadingEvidence}>
                  <Upload size={16} className="mr-2" />
                  {uploadingEvidence ? t('perf.common.uploading') : t('perf.execution.uploadEvidence')}
                </Button>
                <div className="space-y-2">
                  {selectedTarget.evidences.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{t('perf.execution.emptyEvidence')}</p>
                  ) : (
                    selectedTarget.evidences.map((evidence) => (
                      <div key={evidence.id} className="rounded-lg border border-border bg-background px-3 py-2">
                        <a href={`${appConfig.apiUrl}/private-files/performance-evidence/${evidence.id}`} target="_blank" rel="noreferrer" className="text-sm font-medium text-primary underline-offset-2 hover:underline">
                          {evidence.originalName}
                        </a>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatFileSize(evidence.fileSize)} • {formatDateTime(evidence.createdAt)}
                        </p>
                        {evidence.notes && (
                          <p className="mt-1 text-xs text-muted-foreground">{evidence.notes}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.execution.actionsTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.execution.actionsHint')}</p>
            </div>
            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">{t('perf.execution.selectAssignmentForAction')}</p>
            ) : (
              <div className="space-y-3">
                <textarea
                  value={actionNotes}
                  onChange={(event) => setActionNotes(event.target.value)}
                  placeholder={t('perf.execution.actionNotePlaceholder')}
                  className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <div className="grid gap-2">
                  <Button size="sm" onClick={() => void runAssignmentAction('submit', t('perf.execution.submitSuccess'))} disabled={acting}>
                    <Send size={16} className="mr-2" />
                    {t('perf.execution.submitAssignment')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void runAssignmentAction('approve', t('perf.execution.approveSuccess'))} disabled={acting}>
                    <CheckCircle2 size={16} className="mr-2" />
                    {t('perf.execution.approveAssignment')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void runAssignmentAction('revision', t('perf.execution.revisionSuccess'))} disabled={acting}>
                    <Clock3 size={16} className="mr-2" />
                    {t('perf.common.requestRevision')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void runAssignmentAction('reject', t('perf.execution.rejectSuccess'))} disabled={acting}>
                    <XCircle size={16} className="mr-2" />
                    {t('perf.execution.rejectAssignment')}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void runAssignmentAction('complete', t('perf.execution.completeSuccess'))} disabled={acting}>
                    <CheckCircle2 size={16} className="mr-2" />
                    {t('perf.execution.completeAssignment')}
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

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
