import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformancePlanningWorkspace,
  type PerformancePlanningAssignment,
  type PerformancePlanningTarget,
  type PerformancePlanningAssignmentPayload,
  type PerformancePlanningTargetPayload,
} from '@/services/performance.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { ClipboardCheck, Plus, RefreshCw, Rocket, Target, Trash2, Users } from 'lucide-react';
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

const FREQUENCY_LABEL_KEYS: Record<string, TranslationKey> = {
  ONCE: 'perf.frequency.once',
  MONTHLY: 'perf.frequency.monthly',
  QUARTERLY: 'perf.frequency.quarterly',
  SEMI_ANNUAL: 'perf.frequency.semiAnnual',
  ANNUAL: 'perf.frequency.annual',
  CUSTOM: 'perf.frequency.custom',
};

const ASSIGNMENT_SOURCE_LABEL_KEYS: Record<string, TranslationKey> = {
  MANUAL: 'perf.assignmentSource.manual',
  AUTO_FROM_ORG: 'perf.assignmentSource.autoFromOrg',
};

const WEIGHT_MODE_LABEL_KEYS: Record<string, TranslationKey> = {
  STRICT_100: 'perf.weightMode.strict100',
  FLEXIBLE: 'perf.weightMode.flexible',
};

const ASSIGNMENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REASSIGNED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  ARCHIVED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
};

const FREQUENCY_OPTIONS = ['ONCE', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM'] as const;
const ASSIGNMENT_SOURCE_OPTIONS = ['MANUAL', 'AUTO_FROM_ORG'] as const;

function safeNumber(value: string) {
  if (!value) return undefined;
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

export function PerformancePlanningPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [periods, setPeriods] = useState<Array<{ id: string; name: string; code: string; planningPublishedAt?: string | null }>>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [indicators, setIndicators] = useState(awaitableEmptyIndicators());
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [workspace, setWorkspace] = useState<PerformancePlanningWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<PerformancePlanningAssignmentPayload>({
    employeeId: '',
    reviewerId: '',
    approverId: '',
    assignmentSource: 'MANUAL',
  });
  const [assignmentEditForm, setAssignmentEditForm] = useState({
    reviewerId: '',
    approverId: '',
    assignmentSource: 'MANUAL' as 'MANUAL' | 'AUTO_FROM_ORG',
  });
  const [reassignReason, setReassignReason] = useState('');
  const [editingTargetId, setEditingTargetId] = useState('');
  const [targetForm, setTargetForm] = useState({
    componentId: '',
    indicatorId: '',
    reviewerId: '',
    approverId: '',
    name: '',
    description: '',
    targetValue: '',
    targetText: '',
    weight: '',
    frequency: 'ONCE' as PerformancePlanningTargetPayload['frequency'],
    evidenceRequired: false,
  });

  const selectedAssignment = useMemo(
    () => workspace?.planningAssignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [workspace, selectedAssignmentId]
  );

  const periodOptions = useMemo(
    () => periods.map((period) => ({ value: period.id, label: `${period.name} • ${period.code}` })),
    [periods]
  );

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ value: employee.id, label: `${employee.fullName} • ${employee.employeeNumber}` })),
    [employees]
  );

  const componentOptions = useMemo(
    () =>
      (workspace?.methodVersion.components ?? []).map((component) => ({
        value: component.id,
        label: `${component.name} • ${component.weight}%`,
      })),
    [workspace?.methodVersion.components]
  );

  const indicatorOptions = useMemo(
    () => indicators.map((indicator) => ({ value: indicator.id, label: `${indicator.name} • ${indicator.code}` })),
    [indicators]
  );

  const selectedTarget = useMemo(
    () => selectedAssignment?.targets.find((target) => target.id === editingTargetId) ?? null,
    [editingTargetId, selectedAssignment]
  );

  const frequencyOptions = useMemo(
    () => FREQUENCY_OPTIONS.map((value) => ({ value, label: t(FREQUENCY_LABEL_KEYS[value]) })),
    [t]
  );

  const assignmentSourceOptions = useMemo(
    () => ASSIGNMENT_SOURCE_OPTIONS.map((value) => ({ value, label: t(ASSIGNMENT_SOURCE_LABEL_KEYS[value]) })),
    [t]
  );

  const loadWorkspace = useCallback(async (periodId: string) => {
    if (!periodId) {
      setWorkspace(null);
      setSelectedAssignmentId('');
      return;
    }

    setWorkspaceLoading(true);
    try {
      const data = await performanceService.getPlanningWorkspace(periodId);
      setWorkspace(data);
      const nextAssignmentId = selectedAssignmentId && data.planningAssignments.some((assignment) => assignment.id === selectedAssignmentId)
        ? selectedAssignmentId
        : data.planningAssignments[0]?.id || '';
      setSelectedAssignmentId(nextAssignmentId);
    } catch (error) {
      console.error(error);
      setWorkspace(null);
      toast.error(apiErrorMessage(error, t('perf.planning.loadWorkspaceFailed')));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedAssignmentId, t]);

  const loadBootstrap = useCallback(async () => {
    if (!companyId) {
      setPeriods([]);
      setEmployees([]);
      setIndicators(awaitableEmptyIndicators());
      setWorkspace(null);
      setSelectedPeriodId('');
      setSelectedAssignmentId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [periodData, employeeData, indicatorData] = await Promise.all([
        performanceService.getPeriods(companyId, { status: 'PUBLISHED' }),
        employeeService.getEmployees({ companyId, page: 1, limit: 500 }),
        performanceService.getIndicators(companyId),
      ]);

      setPeriods(periodData.map((period) => ({
        id: period.id,
        name: period.name,
        code: period.code,
        planningPublishedAt: period.planningPublishedAt,
      })));
      setEmployees(employeeData.data);
      setIndicators(indicatorData);

      const nextPeriodId = selectedPeriodId && periodData.some((period) => period.id === selectedPeriodId)
        ? selectedPeriodId
        : periodData[0]?.id || '';
      setSelectedPeriodId(nextPeriodId);
    } catch (error) {
      console.error(error);
      toast.error(t('perf.planning.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedPeriodId, t]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    void loadWorkspace(selectedPeriodId);
  }, [loadWorkspace, selectedPeriodId]);

  useEffect(() => {
    if (!selectedAssignment) {
      setAssignmentEditForm({
        reviewerId: '',
        approverId: '',
        assignmentSource: 'MANUAL',
      });
      setReassignReason('');
      setEditingTargetId('');
      resetTargetForm(setTargetForm);
      return;
    }

    setAssignmentEditForm({
      reviewerId: selectedAssignment.reviewerId || '',
      approverId: selectedAssignment.approverId || '',
      assignmentSource: selectedAssignment.assignmentSource,
    });
    setReassignReason(selectedAssignment.reassignmentReason || '');
    setEditingTargetId('');
    resetTargetForm(setTargetForm);
  }, [selectedAssignment]);

  useEffect(() => {
    if (!selectedTarget) {
      resetTargetForm(setTargetForm);
      return;
    }

    setTargetForm({
      componentId: selectedTarget.componentId || '',
      indicatorId: selectedTarget.indicatorId || '',
      reviewerId: selectedTarget.reviewerId || '',
      approverId: selectedTarget.approverId || '',
      name: selectedTarget.name || '',
      description: selectedTarget.description || '',
      targetValue: selectedTarget.targetValue ? String(selectedTarget.targetValue) : '',
      targetText: selectedTarget.targetText || '',
      weight: String(selectedTarget.weight ?? ''),
      frequency: selectedTarget.frequency,
      evidenceRequired: selectedTarget.evidenceRequired,
    });
  }, [selectedTarget]);

  const handleCreateAssignment = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.planning.selectPeriodFirst'));
      return;
    }

    if (!assignmentForm.employeeId) {
      toast.error(t('perf.planning.employeeRequired'));
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.createPlanningAssignment(selectedPeriodId, {
        employeeId: assignmentForm.employeeId,
        reviewerId: assignmentForm.reviewerId || undefined,
        approverId: assignmentForm.approverId || undefined,
        assignmentSource: assignmentForm.assignmentSource || 'MANUAL',
      });
      toast.success(t('perf.planning.assignmentCreated'));
      setAssignmentForm({
        employeeId: '',
        reviewerId: '',
        approverId: '',
        assignmentSource: 'MANUAL',
      });
      await loadWorkspace(selectedPeriodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.assignmentCreateFailed')));
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentForm, loadWorkspace, selectedPeriodId, t]);

  const handleSaveReviewerMatrix = useCallback(async () => {
    if (!selectedAssignment) return;

    setSavingAssignment(true);
    try {
      await performanceService.updatePlanningAssignment(selectedAssignment.id, {
        reviewerId: assignmentEditForm.reviewerId || undefined,
        approverId: assignmentEditForm.approverId || undefined,
        assignmentSource: assignmentEditForm.assignmentSource,
      });
      toast.success(t('perf.planning.matrixUpdated'));
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.matrixUpdateFailed')));
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentEditForm, loadWorkspace, selectedAssignment, t]);

  const handleReassign = useCallback(async () => {
    if (!selectedAssignment) return;
    if (!reassignReason.trim()) {
      toast.error(t('perf.planning.reassignReasonRequired'));
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.reassignPlanningAssignment(selectedAssignment.id, {
        reviewerId: assignmentEditForm.reviewerId || undefined,
        approverId: assignmentEditForm.approverId || undefined,
        reason: reassignReason.trim(),
      });
      toast.success(t('perf.planning.reassignSuccess'));
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.reassignFailed')));
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentEditForm, loadWorkspace, reassignReason, selectedAssignment, t]);

  const handleDeleteAssignment = useCallback(async (assignment: PerformancePlanningAssignment) => {
    if (!window.confirm(t('perf.planning.deleteAssignmentConfirm', { name: assignment.employee.fullName }))) {
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.deletePlanningAssignment(assignment.id);
      toast.success(t('perf.planning.assignmentDeleted'));
      await loadWorkspace(assignment.periodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.assignmentDeleteFailed')));
    } finally {
      setSavingAssignment(false);
    }
  }, [loadWorkspace, t]);

  const handleSaveTarget = useCallback(async () => {
    if (!selectedAssignment) {
      toast.error(t('perf.common.selectAssignmentFirst'));
      return;
    }
    if (!targetForm.componentId) {
      toast.error(t('perf.planning.componentRequired'));
      return;
    }
    if (!targetForm.indicatorId) {
      toast.error(t('perf.planning.indicatorRequired'));
      return;
    }

    const selectedIndicator = indicators.find((indicator) => indicator.id === targetForm.indicatorId);
    const payload: PerformancePlanningTargetPayload = {
      componentId: targetForm.componentId,
      indicatorId: targetForm.indicatorId,
      formulaId: selectedIndicator?.formulaId || undefined,
      reviewerId: targetForm.reviewerId || undefined,
      approverId: targetForm.approverId || undefined,
      name: targetForm.name.trim() || undefined,
      description: targetForm.description.trim() || undefined,
      targetValue: safeNumber(targetForm.targetValue),
      targetText: targetForm.targetText.trim() || undefined,
      weight: safeNumber(targetForm.weight) || 0,
      frequency: targetForm.frequency,
      evidenceRequired: targetForm.evidenceRequired,
    };

    if (!payload.weight) {
      toast.error(t('perf.planning.weightRequired'));
      return;
    }

    setSavingTarget(true);
    try {
      if (editingTargetId) {
        await performanceService.updatePlanningTarget(editingTargetId, payload);
        toast.success(t('perf.planning.targetUpdated'));
      } else {
        await performanceService.createPlanningTarget(selectedAssignment.id, payload);
        toast.success(t('perf.planning.targetCreated'));
      }
      resetTargetForm(setTargetForm);
      setEditingTargetId('');
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.targetSaveFailed')));
    } finally {
      setSavingTarget(false);
    }
  }, [editingTargetId, indicators, loadWorkspace, selectedAssignment, t, targetForm]);

  const handleEditTarget = useCallback((target: PerformancePlanningTarget) => {
    setEditingTargetId(target.id);
  }, []);

  const handleDeleteTarget = useCallback(async (target: PerformancePlanningTarget) => {
    if (!selectedAssignment) return;
    if (!window.confirm(t('perf.planning.deleteTargetConfirm', { name: target.name }))) {
      return;
    }

    setSavingTarget(true);
    try {
      await performanceService.deletePlanningTarget(target.id);
      toast.success(t('perf.planning.targetDeleted'));
      if (editingTargetId === target.id) {
        setEditingTargetId('');
        resetTargetForm(setTargetForm);
      }
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.targetDeleteFailed')));
    } finally {
      setSavingTarget(false);
    }
  }, [editingTargetId, loadWorkspace, selectedAssignment, t]);

  const handlePublishPlanning = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.planning.selectPeriodFirst'));
      return;
    }

    setPublishing(true);
    try {
      const data = await performanceService.publishPlanning(selectedPeriodId);
      setWorkspace(data);
      toast.success(t('perf.planning.publishSuccess'));
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.planning.publishFailed')));
    } finally {
      setPublishing(false);
    }
  }, [selectedPeriodId, t]);

  const handleComponentChange = useCallback((componentId: string) => {
    const component = workspace?.methodVersion.components.find((item) => item.id === componentId);
    setTargetForm((prev) => ({
      ...prev,
      componentId,
      weight: component ? String(component.weight) : prev.weight,
    }));
  }, [workspace?.methodVersion.components]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('perf.planning.title')}
        description={t('perf.planning.description')}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap()}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => void handlePublishPlanning()} disabled={publishing || !workspace}>
              <Rocket size={16} className="mr-2" />
              {publishing ? t('perf.planning.publishing') : t('perf.planning.publishButton')}
            </Button>
          </div>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('perf.planning.periodLabel')}</label>
            <Select2
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              options={periodOptions}
              placeholder={t('perf.planning.periodPlaceholder')}
            />
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('perf.planning.planningPublished')}</p>
            <p className="mt-2 text-sm font-semibold">{formatDateTime(workspace?.planningPublishedAt)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">{t('perf.planning.validationStatus')}</p>
            <p className="mt-2 text-sm font-semibold">
              {workspace?.planningReadiness.isReady ? t('perf.planning.readyToPublish') : t('perf.planning.needsFixUpper')}
            </p>
          </div>
        </div>

        {workspace && (
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <StatCard label={t('perf.planning.stats.assignments')} value={workspace.planningReadiness.metrics.assignmentCount} icon={<Users size={16} />} />
            <StatCard label={t('perf.planning.stats.targets')} value={workspace.planningReadiness.metrics.targetCount} icon={<Target size={16} />} />
            <StatCard label={t('perf.planning.stats.requiredComponents')} value={workspace.planningReadiness.metrics.requiredComponentCount} icon={<ClipboardCheck size={16} />} />
            <StatCard label={t('perf.planning.stats.configuredWeight')} value={`${workspace.planningReadiness.metrics.configuredTotalWeight}%`} icon={<Target size={16} />} />
            <StatCard
              label={t('perf.planning.stats.weightMode')}
              value={WEIGHT_MODE_LABEL_KEYS[workspace.planningReadiness.metrics.weightMode]
                ? t(WEIGHT_MODE_LABEL_KEYS[workspace.planningReadiness.metrics.weightMode])
                : workspace.planningReadiness.metrics.weightMode}
              icon={<ClipboardCheck size={16} />}
            />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.planning.builderTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.planning.builderHint')}</p>
            </div>
            <div className="space-y-3">
              <Select2
                value={assignmentForm.employeeId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, employeeId: value }))}
                options={employeeOptions}
                placeholder={t('perf.planning.selectEmployee')}
              />
              <Select2
                value={assignmentForm.reviewerId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, reviewerId: value }))}
                options={[{ value: '', label: t('perf.planning.noReviewer') }, ...employeeOptions]}
                placeholder={t('perf.planning.selectReviewer')}
              />
              <Select2
                value={assignmentForm.approverId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, approverId: value }))}
                options={[{ value: '', label: t('perf.planning.noApprover') }, ...employeeOptions]}
                placeholder={t('perf.planning.selectApprover')}
              />
              <Select2
                value={assignmentForm.assignmentSource || 'MANUAL'}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, assignmentSource: value as PerformancePlanningAssignmentPayload['assignmentSource'] }))}
                options={assignmentSourceOptions}
                placeholder={t('perf.planning.selectSource')}
              />
              <Button size="sm" className="w-full" onClick={() => void handleCreateAssignment()} disabled={savingAssignment || !selectedPeriodId}>
                <Plus size={16} className="mr-2" />
                {savingAssignment ? t('perf.common.saving') : t('perf.planning.addAssignment')}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.planning.assignmentListTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.planning.assignmentListHint')}</p>
              </div>
              <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: workspace?.planningAssignments.length || 0 })}</span>
            </div>
            <div className="space-y-3">
              {workspaceLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.planning.loadingWorkspace')}
                </div>
              ) : !workspace?.planningAssignments.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.planning.emptyAssignments')}
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
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ASSIGNMENT_STATUS_STYLES[assignment.status] || ASSIGNMENT_STATUS_STYLES.DRAFT}`}>
                        {STATUS_LABEL_KEYS[assignment.status] ? t(STATUS_LABEL_KEYS[assignment.status]) : assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>{t('perf.common.reviewerLabel', { value: assignment.reviewer?.fullName || '-' })}</p>
                      <p>{t('perf.common.approverLabel', { value: assignment.approver?.fullName || '-' })}</p>
                      <p>{t('perf.planning.targetsLabel', { count: assignment.targets.length })}</p>
                    </div>
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
                <h3 className="text-sm font-semibold">{t('perf.planning.validationTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.planning.validationHint')}</p>
              </div>
              {workspace?.planningReadiness.isReady ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  {t('perf.planning.ready')}
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  {t('perf.planning.needsFix')}
                </span>
              )}
            </div>
            {!workspace ? (
              <p className="text-sm text-muted-foreground">{t('perf.planning.selectPeriodToOpen')}</p>
            ) : workspace.planningReadiness.isReady ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                {t('perf.planning.readyMessage')}
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                {workspace.planningReadiness.issues.map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.planning.matrixTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.planning.matrixHint')}</p>
              </div>
              {selectedAssignment && (
                <Button size="sm" variant="outline" onClick={() => void handleDeleteAssignment(selectedAssignment)} disabled={savingAssignment}>
                  <Trash2 size={14} className="mr-2" />
                  {t('common.delete')}
                </Button>
              )}
            </div>
            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">{t('perf.planning.selectAssignmentLeft')}</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedAssignment.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAssignment.employee.employeeNumber} • {selectedAssignment.employee.department?.name || t('perf.planning.noDepartment')} • {selectedAssignment.employee.position?.name || t('perf.planning.noPosition')}
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <Select2
                    value={assignmentEditForm.reviewerId}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, reviewerId: value }))}
                    options={[{ value: '', label: t('perf.planning.noReviewer') }, ...employeeOptions]}
                    placeholder={t('perf.planning.selectReviewer')}
                  />
                  <Select2
                    value={assignmentEditForm.approverId}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, approverId: value }))}
                    options={[{ value: '', label: t('perf.planning.noApprover') }, ...employeeOptions]}
                    placeholder={t('perf.planning.selectApprover')}
                  />
                  <Select2
                    value={assignmentEditForm.assignmentSource}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, assignmentSource: value as typeof prev.assignmentSource }))}
                    options={assignmentSourceOptions}
                    placeholder={t('perf.planning.sourcePlaceholder')}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleSaveReviewerMatrix()} disabled={savingAssignment}>
                    {savingAssignment ? t('perf.common.saving') : t('perf.planning.saveMatrix')}
                  </Button>
                </div>
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm font-medium">{t('perf.planning.reassignTitle')}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('perf.planning.reassignHint')}
                  </p>
                  <Input
                    className="mt-3"
                    value={reassignReason}
                    onChange={(event) => setReassignReason(event.target.value)}
                    placeholder={t('perf.planning.reassignReasonPlaceholder')}
                  />
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void handleReassign()} disabled={savingAssignment}>
                    {t('perf.planning.reassignButton')}
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.planning.targetSectionTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.planning.targetSectionHint')}</p>
            </div>
            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">{t('perf.planning.selectAssignmentForTarget')}</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <Select2 value={targetForm.componentId} onValueChange={handleComponentChange} options={componentOptions} placeholder={t('perf.planning.selectComponent')} />
                  <Select2 value={targetForm.indicatorId} onValueChange={(value) => setTargetForm((prev) => ({ ...prev, indicatorId: value }))} options={indicatorOptions} placeholder={t('perf.planning.selectIndicator')} />
                  <Input value={targetForm.name} onChange={(event) => setTargetForm((prev) => ({ ...prev, name: event.target.value }))} placeholder={t('perf.planning.targetNamePlaceholder')} />
                  <Input value={targetForm.weight} onChange={(event) => setTargetForm((prev) => ({ ...prev, weight: event.target.value }))} placeholder={t('perf.planning.weightPlaceholder')} type="number" min={0} max={100} />
                  <Input value={targetForm.targetValue} onChange={(event) => setTargetForm((prev) => ({ ...prev, targetValue: event.target.value }))} placeholder={t('perf.planning.targetNumericPlaceholder')} type="number" />
                  <Input value={targetForm.targetText} onChange={(event) => setTargetForm((prev) => ({ ...prev, targetText: event.target.value }))} placeholder={t('perf.planning.targetTextPlaceholder')} />
                  <Select2
                    value={targetForm.reviewerId}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, reviewerId: value }))}
                    options={[{ value: '', label: t('perf.planning.useAssignmentReviewer') }, ...employeeOptions]}
                    placeholder={t('perf.planning.overrideReviewer')}
                  />
                  <Select2
                    value={targetForm.approverId}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, approverId: value }))}
                    options={[{ value: '', label: t('perf.planning.useAssignmentApprover') }, ...employeeOptions]}
                    placeholder={t('perf.planning.overrideApprover')}
                  />
                  <Select2
                    value={targetForm.frequency || 'ONCE'}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, frequency: value as PerformancePlanningTargetPayload['frequency'] }))}
                    options={frequencyOptions}
                    placeholder={t('perf.planning.selectFrequency')}
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={targetForm.evidenceRequired}
                      onChange={(event) => setTargetForm((prev) => ({ ...prev, evidenceRequired: event.target.checked }))}
                    />
                    {t('perf.common.evidenceRequired')}
                  </label>
                </div>
                <Input value={targetForm.description} onChange={(event) => setTargetForm((prev) => ({ ...prev, description: event.target.value }))} placeholder={t('perf.planning.descriptionPlaceholder')} />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleSaveTarget()} disabled={savingTarget}>
                    {savingTarget
                      ? t('perf.common.saving')
                      : editingTargetId
                        ? t('perf.planning.saveTargetChanges')
                        : t('perf.planning.addTarget')}
                  </Button>
                  {editingTargetId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTargetId('');
                        resetTargetForm(setTargetForm);
                      }}
                    >
                      {t('perf.planning.cancelEdit')}
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedAssignment.targets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      {t('perf.planning.emptyTargets')}
                    </div>
                  ) : (
                    selectedAssignment.targets.map((target) => (
                      <div key={target.id} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{target.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {target.component?.name || t('perf.common.noComponent')} • {target.indicator?.name || t('perf.common.noIndicator')}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ASSIGNMENT_STATUS_STYLES[target.status] || ASSIGNMENT_STATUS_STYLES.DRAFT}`}>
                            {STATUS_LABEL_KEYS[target.status] ? t(STATUS_LABEL_KEYS[target.status]) : target.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <p>{t('perf.planning.weightFrequencyLabel', { weight: target.weight, frequency: FREQUENCY_LABEL_KEYS[target.frequency] ? t(FREQUENCY_LABEL_KEYS[target.frequency]) : target.frequency })}</p>
                          <p>{t('perf.common.targetLabel', { value: target.targetValue ?? target.targetText ?? '-' })}</p>
                          <p>{t('perf.common.reviewerLabel', { value: target.reviewer?.fullName || selectedAssignment.reviewer?.fullName || '-' })}</p>
                          <p>{t('perf.common.approverLabel', { value: target.approver?.fullName || selectedAssignment.approver?.fullName || '-' })}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditTarget(target)}>
                            {t('common.edit')}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleDeleteTarget(target)}>
                            {t('common.delete')}
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
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

function resetTargetForm(
  setter: React.Dispatch<React.SetStateAction<{
    componentId: string;
    indicatorId: string;
    reviewerId: string;
    approverId: string;
    name: string;
    description: string;
    targetValue: string;
    targetText: string;
    weight: string;
    frequency: PerformancePlanningTargetPayload['frequency'];
    evidenceRequired: boolean;
  }>>
) {
  setter({
    componentId: '',
    indicatorId: '',
    reviewerId: '',
    approverId: '',
    name: '',
    description: '',
    targetValue: '',
    targetText: '',
    weight: '',
    frequency: 'ONCE',
    evidenceRequired: false,
  });
}

function awaitableEmptyIndicators() {
  return [] as Awaited<ReturnType<typeof performanceService.getIndicators>>;
}
