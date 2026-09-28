import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceMethod,
  type PerformanceMethodVersion,
  type PerformanceMethodVersionReadiness,
  type PerformanceComponent,
  type PerformanceGradeRule,
  type PerformanceWorkflowTemplate,
  type PerformanceMethodPayload,
  type PerformanceMethodVersionPayload,
  type PerformanceComponentPayload,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { formatDate } from '@/utils/format';
import { Layers3, Plus, RefreshCw, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.status.draft',
  PUBLISHED: 'perf.status.published',
  ACTIVE: 'perf.status.active',
  ARCHIVED: 'perf.status.archived',
};

const COMPONENT_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  KPI: 'perf.componentType.kpi',
  GOAL: 'perf.componentType.goal',
  COMPETENCY: 'perf.componentType.competency',
  BEHAVIOR: 'perf.componentType.behavior',
  CUSTOM: 'perf.componentType.custom',
};

const AGGREGATION_LABEL_KEYS: Record<string, TranslationKey> = {
  WEIGHTED_AVERAGE: 'perf.aggregation.weightedAverage',
  SUM: 'perf.aggregation.sum',
  AVERAGE: 'perf.aggregation.average',
};

const WEIGHT_MODE_LABEL_KEYS: Record<string, TranslationKey> = {
  STRICT_100: 'perf.weightMode.strict100',
  FLEXIBLE: 'perf.weightMode.flexible',
};

const VERSION_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ARCHIVED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const COMPONENT_TYPE_OPTIONS = ['KPI', 'GOAL', 'COMPETENCY', 'BEHAVIOR', 'CUSTOM'] as const;
const AGGREGATION_OPTIONS = ['WEIGHTED_AVERAGE', 'SUM', 'AVERAGE'] as const;
const WEIGHT_MODE_OPTIONS = ['STRICT_100', 'FLEXIBLE'] as const;

function safeNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PerformanceMethodsPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [methods, setMethods] = useState<PerformanceMethod[]>([]);
  const [gradeRules, setGradeRules] = useState<PerformanceGradeRule[]>([]);
  const [reviewWorkflows, setReviewWorkflows] = useState<PerformanceWorkflowTemplate[]>([]);
  const [approvalWorkflows, setApprovalWorkflows] = useState<PerformanceWorkflowTemplate[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState('');
  const [methodDetail, setMethodDetail] = useState<PerformanceMethod | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [savingMethod, setSavingMethod] = useState(false);
  const [savingVersion, setSavingVersion] = useState(false);
  const [savingComponent, setSavingComponent] = useState(false);
  const [savingGradeRuleId, setSavingGradeRuleId] = useState('');
  const [savingReviewWorkflowId, setSavingReviewWorkflowId] = useState('');
  const [savingApprovalWorkflowId, setSavingApprovalWorkflowId] = useState('');
  const [publishingVersionId, setPublishingVersionId] = useState('');
  const [readinessLoadingId, setReadinessLoadingId] = useState('');
  const [versionReadiness, setVersionReadiness] = useState<PerformanceMethodVersionReadiness | null>(null);
  const [methodForm, setMethodForm] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [versionForm, setVersionForm] = useState({
    summary: '',
    weightMode: 'STRICT_100' as NonNullable<PerformanceMethodVersionPayload['weightMode']>,
    scoreAggregation: 'WEIGHTED_AVERAGE' as NonNullable<PerformanceMethodVersionPayload['scoreAggregation']>,
    minimumScore: '',
    maximumScore: '',
  });
  const [componentForm, setComponentForm] = useState({
    name: '',
    code: '',
    type: 'CUSTOM' as NonNullable<PerformanceComponentPayload['type']>,
    weight: '',
    sortOrder: '',
    description: '',
    isRequired: true,
  });

  const selectedVersion = useMemo(
    () => methodDetail?.versions?.find((version) => version.id === selectedVersionId) ?? null,
    [methodDetail, selectedVersionId]
  );

  const methodOptions = useMemo(
    () => methods.map((method) => ({ value: method.id, label: `${method.name} • ${method.code}` })),
    [methods]
  );

  const versionOptions = useMemo(
    () =>
      (methodDetail?.versions ?? []).map((version) => ({
        value: version.id,
        label: `v${version.versionNumber} • ${STATUS_LABEL_KEYS[version.status] ? t(STATUS_LABEL_KEYS[version.status]) : version.status}`,
      })),
    [methodDetail?.versions, t]
  );

  const gradeRuleOptions = useMemo(
    () => [
      { value: '', label: t('perf.methods.noGradeRule') },
      ...gradeRules.map((gradeRule) => ({
        value: gradeRule.id,
        label: `${gradeRule.name} • ${gradeRule.code}`,
      })),
    ],
    [gradeRules, t]
  );

  const reviewWorkflowOptions = useMemo(
    () => [
      { value: '', label: t('perf.methods.noReviewWorkflow') },
      ...reviewWorkflows.map((workflow) => ({
        value: workflow.id,
        label: `${workflow.name} • ${t('perf.methods.stageCount', { count: workflow.stages.length })}`,
      })),
    ],
    [reviewWorkflows, t]
  );

  const approvalWorkflowOptions = useMemo(
    () => [
      { value: '', label: t('perf.methods.noApprovalWorkflow') },
      ...approvalWorkflows.map((workflow) => ({
        value: workflow.id,
        label: `${workflow.name} • ${t('perf.methods.stageCount', { count: workflow.stages.length })}`,
      })),
    ],
    [approvalWorkflows, t]
  );

  const componentTypeOptions = useMemo(
    () => COMPONENT_TYPE_OPTIONS.map((value) => ({ value, label: t(COMPONENT_TYPE_LABEL_KEYS[value]) })),
    [t]
  );

  const aggregationOptions = useMemo(
    () => AGGREGATION_OPTIONS.map((value) => ({ value, label: t(AGGREGATION_LABEL_KEYS[value]) })),
    [t]
  );

  const weightModeOptions = useMemo(
    () => WEIGHT_MODE_OPTIONS.map((value) => ({ value, label: t(WEIGHT_MODE_LABEL_KEYS[value]) })),
    [t]
  );

  const loadMethods = useCallback(async () => {
    if (!companyId) {
      setMethods([]);
      setMethodDetail(null);
      setSelectedMethodId('');
      setSelectedVersionId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getMethods(companyId);
      setMethods(data);

      const nextMethodId = selectedMethodId && data.some((method) => method.id === selectedMethodId)
        ? selectedMethodId
        : data[0]?.id || '';
      setSelectedMethodId(nextMethodId);
    } catch (error) {
      console.error(error);
      toast.error(t('perf.methods.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedMethodId, t]);

  const loadMethodDetail = useCallback(async (methodId: string) => {
    if (!methodId) {
      setMethodDetail(null);
      setSelectedVersionId('');
      return;
    }

    setDetailLoading(true);
    try {
      const detail = await performanceService.getMethod(methodId);
      setMethodDetail(detail);
      const nextVersionId = selectedVersionId && detail.versions?.some((version) => version.id === selectedVersionId)
        ? selectedVersionId
        : detail.versions?.[0]?.id || '';
      setSelectedVersionId(nextVersionId);
    } catch (error) {
      console.error(error);
      toast.error(t('perf.methods.loadDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [selectedVersionId, t]);

  useEffect(() => {
    void loadMethods();
  }, [loadMethods]);

  useEffect(() => {
    if (!companyId) {
      setGradeRules([]);
      setReviewWorkflows([]);
      setApprovalWorkflows([]);
      return;
    }

    const loadGovernanceLibraries = async () => {
      try {
        const [gradeRuleData, reviewWorkflowData, approvalWorkflowData] = await Promise.all([
          performanceService.getGradeRules(companyId),
          performanceService.getReviewWorkflows(companyId),
          performanceService.getApprovalWorkflows(companyId),
        ]);
        setGradeRules(gradeRuleData);
        setReviewWorkflows(reviewWorkflowData);
        setApprovalWorkflows(approvalWorkflowData);
      } catch (error) {
        console.error(error);
        toast.error(t('perf.methods.loadGovernanceFailed'));
      }
    };

    void loadGovernanceLibraries();
  }, [companyId, t]);

  useEffect(() => {
    void loadMethodDetail(selectedMethodId);
  }, [loadMethodDetail, selectedMethodId]);

  const handleCreateMethod = useCallback(async () => {
    if (!companyId) {
      toast.error(t('perf.cycles.noCompany'));
      return;
    }

    if (!methodForm.name.trim()) {
      toast.error(t('perf.methods.nameRequired'));
      return;
    }

    setSavingMethod(true);
    try {
      const payload: PerformanceMethodPayload = {
        companyId,
        name: methodForm.name.trim(),
        description: methodForm.description.trim() || undefined,
      };
      const created = await performanceService.createMethod(payload);
      toast.success(t('perf.methods.methodCreated'));
      setMethodForm({ name: '', code: '', description: '' });
      await loadMethods();
      setSelectedMethodId(created.id);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.methodCreateFailed')));
    } finally {
      setSavingMethod(false);
    }
  }, [companyId, loadMethods, methodForm, t]);

  const handleCreateVersion = useCallback(async () => {
    if (!selectedMethodId) {
      toast.error(t('perf.methods.selectMethodFirst'));
      return;
    }

    setSavingVersion(true);
    try {
      const created = await performanceService.createMethodVersion(selectedMethodId, {
        summary: versionForm.summary.trim() || undefined,
        weightMode: versionForm.weightMode,
        scoreAggregation: versionForm.scoreAggregation,
        minimumScore: safeNumber(versionForm.minimumScore),
        maximumScore: safeNumber(versionForm.maximumScore),
      });
      toast.success(t('perf.methods.versionCreated'));
      setVersionForm({
        summary: '',
        weightMode: 'STRICT_100',
        scoreAggregation: 'WEIGHTED_AVERAGE',
        minimumScore: '',
        maximumScore: '',
      });
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
      setSelectedVersionId(created.id);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.versionCreateFailed')));
    } finally {
      setSavingVersion(false);
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, t, versionForm]);

  const handleLoadVersionReadiness = useCallback(async (versionId: string) => {
    setReadinessLoadingId(versionId);
    try {
      const data = await performanceService.getMethodVersionReadiness(versionId);
      setVersionReadiness(data);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.readinessLoadFailed')));
    } finally {
      setReadinessLoadingId('');
    }
  }, [t]);

  const handleCreateComponent = useCallback(async () => {
    if (!selectedVersionId) {
      toast.error(t('perf.methods.selectVersionFirst'));
      return;
    }

    if (!componentForm.name.trim() || !componentForm.weight) {
      toast.error(t('perf.methods.componentValidation'));
      return;
    }

    setSavingComponent(true);
    try {
      await performanceService.createComponent(selectedVersionId, {
        name: componentForm.name.trim(),
        type: componentForm.type,
        weight: Number(componentForm.weight),
        sortOrder: componentForm.sortOrder ? Number(componentForm.sortOrder) : 0,
        description: componentForm.description.trim() || undefined,
        isRequired: componentForm.isRequired,
      });
      toast.success(t('perf.methods.componentCreated'));
      setComponentForm({
        name: '',
        code: '',
        type: 'CUSTOM',
        weight: '',
        sortOrder: '',
        description: '',
        isRequired: true,
      });
      await loadMethodDetail(selectedMethodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.componentCreateFailed')));
    } finally {
      setSavingComponent(false);
    }
  }, [componentForm, loadMethodDetail, selectedMethodId, selectedVersionId, t]);

  const handlePublishVersion = useCallback(async (version: PerformanceMethodVersion) => {
    setPublishingVersionId(version.id);
    try {
      await performanceService.publishMethodVersion(version.id);
      toast.success(t('perf.methods.versionPublished', { version: version.versionNumber }));
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.versionPublishFailed')));
    } finally {
      setPublishingVersionId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, t]);

  const handleAssignGradeRule = useCallback(async (gradeRuleId: string) => {
    if (!selectedVersion) {
      toast.error(t('perf.methods.selectVersionFirst'));
      return;
    }

    setSavingGradeRuleId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        gradeRuleId: gradeRuleId || undefined,
      });
      toast.success(t('perf.methods.gradeRuleAssigned'));
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.gradeRuleAssignFailed')));
    } finally {
      setSavingGradeRuleId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion, t]);

  const handleAssignReviewWorkflow = useCallback(async (reviewWorkflowTemplateId: string) => {
    if (!selectedVersion) {
      toast.error(t('perf.methods.selectVersionFirst'));
      return;
    }

    setSavingReviewWorkflowId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        reviewWorkflowTemplateId: reviewWorkflowTemplateId || undefined,
      });
      toast.success(t('perf.methods.reviewWorkflowAssigned'));
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.reviewWorkflowAssignFailed')));
    } finally {
      setSavingReviewWorkflowId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion, t]);

  const handleAssignApprovalWorkflow = useCallback(async (approvalWorkflowTemplateId: string) => {
    if (!selectedVersion) {
      toast.error(t('perf.methods.selectVersionFirst'));
      return;
    }

    setSavingApprovalWorkflowId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        approvalWorkflowTemplateId: approvalWorkflowTemplateId || undefined,
      });
      toast.success(t('perf.methods.approvalWorkflowAssigned'));
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.methods.approvalWorkflowAssignFailed')));
    } finally {
      setSavingApprovalWorkflowId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion, t]);

  const versionTotalWeight = (selectedVersion?.components ?? []).reduce(
    (sum, component) => sum + Number(component.weight),
    0
  );

  useEffect(() => {
    if (!selectedVersionId) {
      setVersionReadiness(null);
      return;
    }

    void handleLoadVersionReadiness(selectedVersionId);
  }, [handleLoadVersionReadiness, selectedVersionId]);

  return (
    <div>
      <PageHeader
        title={t('perf.methods.title')}
        description={t('perf.methods.description')}
        actions={(
          <Button size="sm" variant="outline" onClick={loadMethods}>
            <RefreshCw size={16} className="mr-2" />
            {t('common.refresh')}
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.methods.stats.totalMethods')}</p>
          <p className="mt-2 text-2xl font-semibold">{methods.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.methods.stats.totalVersions')}</p>
          <p className="mt-2 text-2xl font-semibold">{methods.reduce((sum, method) => sum + (method._count?.versions || 0), 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.methods.stats.publishedVersions')}</p>
          <p className="mt-2 text-2xl font-semibold">
            {methods.reduce((sum, method) => sum + (method.versions?.filter((version) => version.status === 'PUBLISHED').length || 0), 0)}
          </p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center gap-2">
              <Plus size={16} />
              <h2 className="text-sm font-semibold">{t('perf.methods.newMethod')}</h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('perf.methods.methodName')}</label>
                <Input
                  value={methodForm.name}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder={t('perf.methods.methodNamePlaceholder')}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('perf.methods.code')}</label>
                <Input
                  value=""
                  placeholder={t('perf.methods.autoCodePlaceholder')}
                  disabled
                />
                <p className="text-xs text-muted-foreground">{t('perf.methods.methodCodeHint')}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('perf.methods.descriptionLabel')}</label>
                <textarea
                  value={methodForm.description}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t('perf.methods.methodDescriptionPlaceholder')}
                />
              </div>
              <Button size="sm" className="w-full" onClick={handleCreateMethod} disabled={savingMethod}>
                {savingMethod ? t('perf.common.saving') : t('perf.methods.createMethod')}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">{t('perf.methods.methodListTitle')}</h2>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
            ) : methods.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">{t('perf.methods.emptyMethods')}</div>
            ) : (
              <div className="space-y-3">
                {methods.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      selectedMethodId === method.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:border-primary/40'
                    }`}
                    onClick={() => setSelectedMethodId(method.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{method.code}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {STATUS_LABEL_KEYS[method.status] ? t(STATUS_LABEL_KEYS[method.status]) : method.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{t('perf.methods.versionCount', { count: method._count?.versions || 0 })}</span>
                      <span>{t('perf.methods.periodCount', { count: method._count?.periods || 0 })}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold">{t('perf.methods.detailTitle')}</h2>
                <p className="text-xs text-muted-foreground">{t('perf.methods.detailHint')}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select2
                  value={selectedMethodId}
                  onValueChange={setSelectedMethodId}
                  options={methodOptions}
                  placeholder={t('perf.methods.selectMethod')}
                />
                <Select2
                  value={selectedVersionId}
                  onValueChange={setSelectedVersionId}
                  options={versionOptions}
                  placeholder={t('perf.methods.selectVersion')}
                />
              </div>
            </div>

            {detailLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('perf.common.loadingDetail')}</div>
            ) : !methodDetail ? (
              <div className="py-10 text-center text-sm text-muted-foreground">{t('perf.methods.selectMethodForDetail')}</div>
            ) : (
              <div className="mt-5 space-y-6">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{methodDetail.name}</p>
                      <p className="text-xs text-muted-foreground">{methodDetail.code}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {STATUS_LABEL_KEYS[methodDetail.status] ? t(STATUS_LABEL_KEYS[methodDetail.status]) : methodDetail.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {methodDetail.description || t('perf.methods.noMethodDescription')}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles size={16} />
                      <h3 className="text-sm font-semibold">{t('perf.methods.newVersion')}</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.summaryLabel')}</label>
                        <textarea
                          value={versionForm.summary}
                          onChange={(e) => setVersionForm((prev) => ({ ...prev, summary: e.target.value }))}
                          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          placeholder={t('perf.methods.summaryPlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.weightModeLabel')}</label>
                        <Select2
                          value={versionForm.weightMode}
                          onValueChange={(value) => setVersionForm((prev) => ({ ...prev, weightMode: value as typeof prev.weightMode }))}
                          options={weightModeOptions}
                          placeholder={t('perf.methods.weightModePlaceholder')}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.aggregationLabel')}</label>
                        <Select2
                          value={versionForm.scoreAggregation}
                          onValueChange={(value) => setVersionForm((prev) => ({ ...prev, scoreAggregation: value as typeof prev.scoreAggregation }))}
                          options={aggregationOptions}
                          placeholder={t('perf.methods.aggregationPlaceholder')}
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.minimumScore')}</label>
                          <Input
                            type="number"
                            value={versionForm.minimumScore}
                            onChange={(e) => setVersionForm((prev) => ({ ...prev, minimumScore: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.maximumScore')}</label>
                          <Input
                            type="number"
                            value={versionForm.maximumScore}
                            onChange={(e) => setVersionForm((prev) => ({ ...prev, maximumScore: e.target.value }))}
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <Button size="sm" className="w-full" onClick={handleCreateVersion} disabled={savingVersion}>
                        {savingVersion ? t('perf.common.saving') : t('perf.methods.addVersion')}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Layers3 size={16} />
                      <h3 className="text-sm font-semibold">{t('perf.methods.versionListTitle')}</h3>
                    </div>
                    <div className="space-y-3">
                      {(methodDetail.versions ?? []).length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">{t('perf.methods.emptyVersions')}</div>
                      ) : (
                        (methodDetail.versions ?? []).map((version) => (
                          <div
                            key={version.id}
                            className={`rounded-xl border px-4 py-3 ${
                              selectedVersionId === version.id ? 'border-primary bg-primary/5' : 'border-border'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <button
                                type="button"
                                className="min-w-0 text-left"
                                onClick={() => setSelectedVersionId(version.id)}
                              >
                                <p className="text-sm font-semibold">{t('perf.methods.versionLabel', { number: version.versionNumber })}</p>
                                <p className="text-xs text-muted-foreground">
                                  {WEIGHT_MODE_LABEL_KEYS[version.weightMode] ? t(WEIGHT_MODE_LABEL_KEYS[version.weightMode]) : version.weightMode}
                                  {' • '}
                                  {AGGREGATION_LABEL_KEYS[version.scoreAggregation] ? t(AGGREGATION_LABEL_KEYS[version.scoreAggregation]) : version.scoreAggregation}
                                </p>
                              </button>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[version.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                                {STATUS_LABEL_KEYS[version.status] ? t(STATUS_LABEL_KEYS[version.status]) : version.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {version.summary || t('perf.methods.noVersionSummary')}
                            </p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {t('perf.methods.gradeRuleInline', { value: version.gradeRule?.code || t('perf.methods.notAssigned') })}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {t('perf.methods.reviewWorkflowInline', { value: version.reviewWorkflowTemplate?.name || t('perf.methods.notAssigned') })}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {t('perf.methods.approvalWorkflowInline', { value: version.approvalWorkflowTemplate?.name || t('perf.methods.notAssigned') })}
                            </p>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                {t('perf.methods.componentCount', { count: version._count?.components || version.components?.length || 0 })}
                              </span>
                              {version.status === 'PUBLISHED' ? (
                                <span>{t('perf.methods.publishedOn', { value: version.publishedAt ? formatDate(version.publishedAt) : '-' })}</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePublishVersion(version)}
                                  disabled={publishingVersionId === version.id}
                                >
                                  {publishingVersionId === version.id ? t('perf.methods.publishing') : t('perf.methods.publish')}
                                </Button>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{t('perf.methods.governanceTitle')}</h3>
                      <p className="text-xs text-muted-foreground">{t('perf.methods.governanceHint')}</p>
                    </div>
                    {selectedVersion && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[selectedVersion.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                        v{selectedVersion.versionNumber}
                      </span>
                    )}
                  </div>

                  {!selectedVersion ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t('perf.methods.selectVersionForGovernance')}</div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.gradeRuleLabel')}</label>
                        <Select2
                          value={selectedVersion.gradeRuleId || ''}
                          onValueChange={(value) => {
                            void handleAssignGradeRule(value);
                          }}
                          options={gradeRuleOptions}
                          placeholder={t('perf.methods.selectGradeRule')}
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingGradeRuleId === selectedVersion.id
                            ? t('perf.methods.savingGradeRule')
                            : selectedVersion.gradeRule
                              ? t('perf.methods.attached', { value: selectedVersion.gradeRule.name })
                              : t('perf.methods.noGradeRuleYet')}
                        </p>
                      </div>
                      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                        {selectedVersion.status === 'DRAFT'
                          ? t('perf.methods.draftHint')
                          : t('perf.methods.nonDraftHint')}
                      </div>
                      <div className={`rounded-xl border px-4 py-3 text-sm ${versionReadiness?.isReady ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{t('perf.methods.readinessTitle')}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('perf.methods.readinessSummary', {
                                mode: WEIGHT_MODE_LABEL_KEYS[selectedVersion.weightMode]
                                  ? t(WEIGHT_MODE_LABEL_KEYS[selectedVersion.weightMode])
                                  : selectedVersion.weightMode,
                                total: versionTotalWeight.toFixed(2),
                              })}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleLoadVersionReadiness(selectedVersion.id)}
                            disabled={readinessLoadingId === selectedVersion.id}
                          >
                            {readinessLoadingId === selectedVersion.id ? t('perf.methods.checking') : t('perf.methods.checkReadiness')}
                          </Button>
                        </div>
                        {versionReadiness ? (
                          versionReadiness.isReady ? (
                            <p className="mt-3 text-xs text-emerald-700 dark:text-emerald-400">
                              {t('perf.methods.readyMessage')}
                            </p>
                          ) : (
                            <ul className="mt-3 space-y-1 text-xs text-amber-700 dark:text-amber-300">
                              {versionReadiness.issues.map((issue) => (
                                <li key={issue}>- {issue}</li>
                              ))}
                            </ul>
                          )
                        ) : (
                          <p className="mt-3 text-xs text-muted-foreground">{t('perf.methods.readinessNotLoaded')}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.reviewWorkflowLabel')}</label>
                        <Select2
                          value={selectedVersion.reviewWorkflowTemplateId || ''}
                          onValueChange={(value) => {
                            void handleAssignReviewWorkflow(value);
                          }}
                          options={reviewWorkflowOptions}
                          placeholder={t('perf.methods.selectReviewWorkflow')}
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingReviewWorkflowId === selectedVersion.id
                            ? t('perf.methods.savingReviewWorkflow')
                            : selectedVersion.reviewWorkflowTemplate
                              ? t('perf.methods.attached', { value: selectedVersion.reviewWorkflowTemplate.name })
                              : t('perf.methods.noReviewWorkflowYet')}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">{t('perf.methods.approvalWorkflowLabel')}</label>
                        <Select2
                          value={selectedVersion.approvalWorkflowTemplateId || ''}
                          onValueChange={(value) => {
                            void handleAssignApprovalWorkflow(value);
                          }}
                          options={approvalWorkflowOptions}
                          placeholder={t('perf.methods.selectApprovalWorkflow')}
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingApprovalWorkflowId === selectedVersion.id
                            ? t('perf.methods.savingApprovalWorkflow')
                            : selectedVersion.approvalWorkflowTemplate
                              ? t('perf.methods.attached', { value: selectedVersion.approvalWorkflowTemplate.name })
                              : t('perf.methods.noApprovalWorkflowYet')}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">{t('perf.methods.componentsTitle')}</h3>
                      <p className="text-xs text-muted-foreground">
                        {t('perf.methods.componentsHint', {
                          total: versionTotalWeight.toFixed(2),
                          mode: selectedVersion?.weightMode
                            ? (WEIGHT_MODE_LABEL_KEYS[selectedVersion.weightMode]
                              ? t(WEIGHT_MODE_LABEL_KEYS[selectedVersion.weightMode])
                              : selectedVersion.weightMode)
                            : '-',
                        })}
                      </p>
                    </div>
                    {selectedVersion && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[selectedVersion.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                        v{selectedVersion.versionNumber}
                      </span>
                    )}
                  </div>

                  {!selectedVersion ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">{t('perf.methods.selectVersionForComponent')}</div>
                  ) : (
                    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.componentName')}</label>
                          <Input
                            value={componentForm.name}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder={t('perf.methods.componentNamePlaceholder')}
                            disabled={selectedVersion.status !== 'DRAFT'}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.code')}</label>
                          <Input
                            value=""
                            placeholder={t('perf.methods.autoCodePlaceholder')}
                            disabled
                          />
                          <p className="text-xs text-muted-foreground">{t('perf.methods.componentCodeHint')}</p>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.typeLabel')}</label>
                          <Select2
                            value={componentForm.type}
                            onValueChange={(value) => setComponentForm((prev) => ({ ...prev, type: value as typeof prev.type }))}
                            options={componentTypeOptions}
                            placeholder={t('perf.methods.selectType')}
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('perf.methods.weightLabel')}</label>
                            <Input
                              type="number"
                              value={componentForm.weight}
                              onChange={(e) => setComponentForm((prev) => ({ ...prev, weight: e.target.value }))}
                              placeholder="40"
                              disabled={selectedVersion.status !== 'DRAFT'}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">{t('perf.methods.sortOrderLabel')}</label>
                            <Input
                              type="number"
                              value={componentForm.sortOrder}
                              onChange={(e) => setComponentForm((prev) => ({ ...prev, sortOrder: e.target.value }))}
                              placeholder="1"
                              disabled={selectedVersion.status !== 'DRAFT'}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">{t('perf.methods.descriptionLabel')}</label>
                          <textarea
                            value={componentForm.description}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            placeholder={t('perf.methods.componentDescriptionPlaceholder')}
                            disabled={selectedVersion.status !== 'DRAFT'}
                          />
                        </div>
                        <label className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={componentForm.isRequired}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, isRequired: e.target.checked }))}
                            disabled={selectedVersion.status !== 'DRAFT'}
                          />
                          {t('perf.methods.requiredComponent')}
                        </label>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={handleCreateComponent}
                          disabled={savingComponent || selectedVersion.status !== 'DRAFT'}
                        >
                          {savingComponent ? t('perf.common.saving') : t('perf.methods.addComponent')}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {(selectedVersion.components ?? []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                            {t('perf.methods.emptyComponents')}
                          </div>
                        ) : (
                          (selectedVersion.components as PerformanceComponent[]).map((component) => (
                            <div key={component.id} className="rounded-xl border border-border p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{component.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {component.code} • {COMPONENT_TYPE_LABEL_KEYS[component.type] ? t(COMPONENT_TYPE_LABEL_KEYS[component.type]) : component.type}
                                  </p>
                                </div>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {Number(component.weight).toFixed(2)}%
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {component.description || t('perf.methods.noComponentDescription')}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span>{t('perf.methods.sortOrderValue', { value: component.sortOrder })}</span>
                                <span>{component.isRequired ? t('perf.methods.required') : t('perf.methods.optional')}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
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
