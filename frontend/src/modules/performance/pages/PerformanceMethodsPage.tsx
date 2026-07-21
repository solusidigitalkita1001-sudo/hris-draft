import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceMethod,
  type PerformanceMethodVersion,
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

const VERSION_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ARCHIVED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

const COMPONENT_TYPE_OPTIONS = ['KPI', 'GOAL', 'COMPETENCY', 'BEHAVIOR', 'CUSTOM'] as const;
const AGGREGATION_OPTIONS = ['WEIGHTED_AVERAGE', 'SUM', 'AVERAGE'] as const;

function safeNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function PerformanceMethodsPage() {
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
  const [methodForm, setMethodForm] = useState({
    name: '',
    code: '',
    description: '',
  });
  const [versionForm, setVersionForm] = useState({
    summary: '',
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
        label: `v${version.versionNumber} • ${version.status}`,
      })),
    [methodDetail?.versions]
  );

  const gradeRuleOptions = useMemo(
    () => [
      { value: '', label: 'Tanpa grade rule' },
      ...gradeRules.map((gradeRule) => ({
        value: gradeRule.id,
        label: `${gradeRule.name} • ${gradeRule.code}`,
      })),
    ],
    [gradeRules]
  );

  const reviewWorkflowOptions = useMemo(
    () => [
      { value: '', label: 'Tanpa review workflow' },
      ...reviewWorkflows.map((workflow) => ({
        value: workflow.id,
        label: `${workflow.name} • ${workflow.stages.length} stages`,
      })),
    ],
    [reviewWorkflows]
  );

  const approvalWorkflowOptions = useMemo(
    () => [
      { value: '', label: 'Tanpa approval workflow' },
      ...approvalWorkflows.map((workflow) => ({
        value: workflow.id,
        label: `${workflow.name} • ${workflow.stages.length} stages`,
      })),
    ],
    [approvalWorkflows]
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
      toast.error('Gagal memuat performance methods');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedMethodId]);

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
      toast.error('Gagal memuat detail performance method');
    } finally {
      setDetailLoading(false);
    }
  }, [selectedVersionId]);

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
        toast.error('Gagal memuat governance config');
      }
    };

    void loadGovernanceLibraries();
  }, [companyId]);

  useEffect(() => {
    void loadMethodDetail(selectedMethodId);
  }, [loadMethodDetail, selectedMethodId]);

  const handleCreateMethod = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!methodForm.name.trim() || !methodForm.code.trim()) {
      toast.error('Nama dan code method wajib diisi');
      return;
    }

    setSavingMethod(true);
    try {
      const payload: PerformanceMethodPayload = {
        companyId,
        name: methodForm.name.trim(),
        code: methodForm.code.trim().toUpperCase(),
        description: methodForm.description.trim() || undefined,
      };
      const created = await performanceService.createMethod(payload);
      toast.success('Performance method berhasil dibuat');
      setMethodForm({ name: '', code: '', description: '' });
      await loadMethods();
      setSelectedMethodId(created.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat performance method');
    } finally {
      setSavingMethod(false);
    }
  }, [companyId, loadMethods, methodForm]);

  const handleCreateVersion = useCallback(async () => {
    if (!selectedMethodId) {
      toast.error('Pilih method dulu');
      return;
    }

    setSavingVersion(true);
    try {
      const created = await performanceService.createMethodVersion(selectedMethodId, {
        summary: versionForm.summary.trim() || undefined,
        scoreAggregation: versionForm.scoreAggregation,
        minimumScore: safeNumber(versionForm.minimumScore),
        maximumScore: safeNumber(versionForm.maximumScore),
      });
      toast.success('Version method berhasil dibuat');
      setVersionForm({
        summary: '',
        scoreAggregation: 'WEIGHTED_AVERAGE',
        minimumScore: '',
        maximumScore: '',
      });
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
      setSelectedVersionId(created.id);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat version method');
    } finally {
      setSavingVersion(false);
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, versionForm]);

  const handleCreateComponent = useCallback(async () => {
    if (!selectedVersionId) {
      toast.error('Pilih version dulu');
      return;
    }

    if (!componentForm.name.trim() || !componentForm.code.trim() || !componentForm.weight) {
      toast.error('Nama, code, dan weight component wajib diisi');
      return;
    }

    setSavingComponent(true);
    try {
      await performanceService.createComponent(selectedVersionId, {
        name: componentForm.name.trim(),
        code: componentForm.code.trim().toUpperCase(),
        type: componentForm.type,
        weight: Number(componentForm.weight),
        sortOrder: componentForm.sortOrder ? Number(componentForm.sortOrder) : 0,
        description: componentForm.description.trim() || undefined,
        isRequired: componentForm.isRequired,
      });
      toast.success('Component berhasil ditambahkan');
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
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menambah component');
    } finally {
      setSavingComponent(false);
    }
  }, [componentForm, loadMethodDetail, selectedMethodId, selectedVersionId]);

  const handlePublishVersion = useCallback(async (version: PerformanceMethodVersion) => {
    setPublishingVersionId(version.id);
    try {
      await performanceService.publishMethodVersion(version.id);
      toast.success(`Version v${version.versionNumber} berhasil dipublish`);
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal publish version');
    } finally {
      setPublishingVersionId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId]);

  const handleAssignGradeRule = useCallback(async (gradeRuleId: string) => {
    if (!selectedVersion) {
      toast.error('Pilih version dulu');
      return;
    }

    setSavingGradeRuleId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        gradeRuleId: gradeRuleId || undefined,
      });
      toast.success('Grade rule berhasil di-assign ke version');
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal assign grade rule');
    } finally {
      setSavingGradeRuleId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion]);

  const handleAssignReviewWorkflow = useCallback(async (reviewWorkflowTemplateId: string) => {
    if (!selectedVersion) {
      toast.error('Pilih version dulu');
      return;
    }

    setSavingReviewWorkflowId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        reviewWorkflowTemplateId: reviewWorkflowTemplateId || undefined,
      });
      toast.success('Review workflow berhasil di-assign ke version');
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal assign review workflow');
    } finally {
      setSavingReviewWorkflowId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion]);

  const handleAssignApprovalWorkflow = useCallback(async (approvalWorkflowTemplateId: string) => {
    if (!selectedVersion) {
      toast.error('Pilih version dulu');
      return;
    }

    setSavingApprovalWorkflowId(selectedVersion.id);
    try {
      await performanceService.updateMethodVersion(selectedVersion.id, {
        approvalWorkflowTemplateId: approvalWorkflowTemplateId || undefined,
      });
      toast.success('Approval workflow berhasil di-assign ke version');
      await loadMethods();
      await loadMethodDetail(selectedMethodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal assign approval workflow');
    } finally {
      setSavingApprovalWorkflowId('');
    }
  }, [loadMethodDetail, loadMethods, selectedMethodId, selectedVersion]);

  const versionTotalWeight = (selectedVersion?.components ?? []).reduce(
    (sum, component) => sum + Number(component.weight),
    0
  );

  return (
    <div>
      <PageHeader
        title="Performance Config Methods"
        description="Kelola method, version, dan component untuk fondasi engine Performance Management."
        actions={(
          <Button size="sm" variant="outline" onClick={loadMethods}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Methods</p>
          <p className="mt-2 text-2xl font-semibold">{methods.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Versions</p>
          <p className="mt-2 text-2xl font-semibold">{methods.reduce((sum, method) => sum + (method._count?.versions || 0), 0)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Published Versions</p>
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
              <h2 className="text-sm font-semibold">New Method</h2>
            </div>

            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Method Name</label>
                <Input
                  value={methodForm.name}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Balanced Scorecard Annual"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Code</label>
                <Input
                  value={methodForm.code}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="BSC-ANNUAL"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <textarea
                  value={methodForm.description}
                  onChange={(e) => setMethodForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Scope method, scoring model, dan governance ringkas."
                />
              </div>
              <Button size="sm" className="w-full" onClick={handleCreateMethod} disabled={savingMethod}>
                {savingMethod ? 'Menyimpan...' : 'Buat Method'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 text-sm font-semibold">Method List</h2>
            {loading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading...</div>
            ) : methods.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Belum ada method.</div>
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
                        {method.status}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span>{method._count?.versions || 0} versions</span>
                      <span>{method._count?.periods || 0} periods</span>
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
                <h2 className="text-sm font-semibold">Method Detail</h2>
                <p className="text-xs text-muted-foreground">Pilih method untuk kelola version dan component.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select2
                  value={selectedMethodId}
                  onValueChange={setSelectedMethodId}
                  options={methodOptions}
                  placeholder="Pilih method"
                />
                <Select2
                  value={selectedVersionId}
                  onValueChange={setSelectedVersionId}
                  options={versionOptions}
                  placeholder="Pilih version"
                />
              </div>
            </div>

            {detailLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Loading detail...</div>
            ) : !methodDetail ? (
              <div className="py-10 text-center text-sm text-muted-foreground">Pilih method untuk melihat detail.</div>
            ) : (
              <div className="mt-5 space-y-6">
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold">{methodDetail.name}</p>
                      <p className="text-xs text-muted-foreground">{methodDetail.code}</p>
                    </div>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {methodDetail.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground">
                    {methodDetail.description || 'Belum ada deskripsi method.'}
                  </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Sparkles size={16} />
                      <h3 className="text-sm font-semibold">New Version</h3>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Summary</label>
                        <textarea
                          value={versionForm.summary}
                          onChange={(e) => setVersionForm((prev) => ({ ...prev, summary: e.target.value }))}
                          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                          placeholder="Rangkuman perubahan version, formula, dan scope component."
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Score Aggregation</label>
                        <Select2
                          value={versionForm.scoreAggregation}
                          onValueChange={(value) => setVersionForm((prev) => ({ ...prev, scoreAggregation: value as typeof prev.scoreAggregation }))}
                          options={AGGREGATION_OPTIONS.map((value) => ({ value, label: value }))}
                          placeholder="Pilih agregasi"
                        />
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Minimum Score</label>
                          <Input
                            type="number"
                            value={versionForm.minimumScore}
                            onChange={(e) => setVersionForm((prev) => ({ ...prev, minimumScore: e.target.value }))}
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Maximum Score</label>
                          <Input
                            type="number"
                            value={versionForm.maximumScore}
                            onChange={(e) => setVersionForm((prev) => ({ ...prev, maximumScore: e.target.value }))}
                            placeholder="100"
                          />
                        </div>
                      </div>
                      <Button size="sm" className="w-full" onClick={handleCreateVersion} disabled={savingVersion}>
                        {savingVersion ? 'Menyimpan...' : 'Tambah Version'}
                      </Button>
                    </div>
                  </div>

                  <div className="rounded-xl border border-border bg-background p-4">
                    <div className="mb-4 flex items-center gap-2">
                      <Layers3 size={16} />
                      <h3 className="text-sm font-semibold">Version List</h3>
                    </div>
                    <div className="space-y-3">
                      {(methodDetail.versions ?? []).length === 0 ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">Belum ada version.</div>
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
                                <p className="text-sm font-semibold">Version {version.versionNumber}</p>
                                <p className="text-xs text-muted-foreground">{version.scoreAggregation}</p>
                              </button>
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[version.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                                {version.status}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-muted-foreground">
                              {version.summary || 'Belum ada summary version.'}
                            </p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              Grade rule: {version.gradeRule?.code || 'Belum di-assign'}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Review workflow: {version.reviewWorkflowTemplate?.name || 'Belum di-assign'}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              Approval workflow: {version.approvalWorkflowTemplate?.name || 'Belum di-assign'}
                            </p>
                            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                              <span>
                                {version._count?.components || version.components?.length || 0} components
                              </span>
                              {version.status === 'PUBLISHED' ? (
                                <span>Published {version.publishedAt ? formatDate(version.publishedAt) : '-'}</span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePublishVersion(version)}
                                  disabled={publishingVersionId === version.id}
                                >
                                  {publishingVersionId === version.id ? 'Publishing...' : 'Publish'}
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
                      <h3 className="text-sm font-semibold">Version Governance</h3>
                      <p className="text-xs text-muted-foreground">Assign grade rule ke version yang sedang dipilih.</p>
                    </div>
                    {selectedVersion && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[selectedVersion.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                        v{selectedVersion.versionNumber}
                      </span>
                    )}
                  </div>

                  {!selectedVersion ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Pilih version untuk atur governance.</div>
                  ) : (
                    <div className="grid gap-4 lg:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Grade Rule</label>
                        <Select2
                          value={selectedVersion.gradeRuleId || ''}
                          onValueChange={(value) => {
                            void handleAssignGradeRule(value);
                          }}
                          options={gradeRuleOptions}
                          placeholder="Pilih grade rule"
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingGradeRuleId === selectedVersion.id
                            ? 'Menyimpan assignment grade rule...'
                            : selectedVersion.gradeRule
                              ? `Terpasang: ${selectedVersion.gradeRule.name}`
                              : 'Version ini belum punya grade rule.'}
                        </p>
                      </div>
                      <div className="rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
                        {selectedVersion.status === 'DRAFT'
                          ? 'Version draft masih bisa diubah. Lengkapi grade rule, review workflow, dan approval workflow sebelum publish.'
                          : 'Version non-draft sudah dibekukan. Governance template hanya bisa diganti lewat version draft baru.'}
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Review Workflow</label>
                        <Select2
                          value={selectedVersion.reviewWorkflowTemplateId || ''}
                          onValueChange={(value) => {
                            void handleAssignReviewWorkflow(value);
                          }}
                          options={reviewWorkflowOptions}
                          placeholder="Pilih review workflow"
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingReviewWorkflowId === selectedVersion.id
                            ? 'Menyimpan assignment review workflow...'
                            : selectedVersion.reviewWorkflowTemplate
                              ? `Terpasang: ${selectedVersion.reviewWorkflowTemplate.name}`
                              : 'Version ini belum punya review workflow.'}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Approval Workflow</label>
                        <Select2
                          value={selectedVersion.approvalWorkflowTemplateId || ''}
                          onValueChange={(value) => {
                            void handleAssignApprovalWorkflow(value);
                          }}
                          options={approvalWorkflowOptions}
                          placeholder="Pilih approval workflow"
                        />
                        <p className="text-xs text-muted-foreground">
                          {savingApprovalWorkflowId === selectedVersion.id
                            ? 'Menyimpan assignment approval workflow...'
                            : selectedVersion.approvalWorkflowTemplate
                              ? `Terpasang: ${selectedVersion.approvalWorkflowTemplate.name}`
                              : 'Version ini belum punya approval workflow.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-semibold">Selected Version Components</h3>
                      <p className="text-xs text-muted-foreground">
                        Total weight saat ini: {versionTotalWeight.toFixed(2)}%
                      </p>
                    </div>
                    {selectedVersion && (
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${VERSION_STATUS_STYLES[selectedVersion.status] || VERSION_STATUS_STYLES.DRAFT}`}>
                        v{selectedVersion.versionNumber}
                      </span>
                    )}
                  </div>

                  {!selectedVersion ? (
                    <div className="py-8 text-center text-sm text-muted-foreground">Pilih version untuk kelola component.</div>
                  ) : (
                    <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Component Name</label>
                          <Input
                            value={componentForm.name}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Goal Achievement"
                            disabled={selectedVersion.status !== 'DRAFT'}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Code</label>
                          <Input
                            value={componentForm.code}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))}
                            placeholder="GOAL"
                            disabled={selectedVersion.status !== 'DRAFT'}
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-sm font-medium">Type</label>
                          <Select2
                            value={componentForm.type}
                            onValueChange={(value) => setComponentForm((prev) => ({ ...prev, type: value as typeof prev.type }))}
                            options={COMPONENT_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                            placeholder="Pilih type"
                          />
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Weight</label>
                            <Input
                              type="number"
                              value={componentForm.weight}
                              onChange={(e) => setComponentForm((prev) => ({ ...prev, weight: e.target.value }))}
                              placeholder="40"
                              disabled={selectedVersion.status !== 'DRAFT'}
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="text-sm font-medium">Sort Order</label>
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
                          <label className="text-sm font-medium">Description</label>
                          <textarea
                            value={componentForm.description}
                            onChange={(e) => setComponentForm((prev) => ({ ...prev, description: e.target.value }))}
                            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                            placeholder="Tujuan component dan rule penilaian."
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
                          Required component
                        </label>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={handleCreateComponent}
                          disabled={savingComponent || selectedVersion.status !== 'DRAFT'}
                        >
                          {savingComponent ? 'Menyimpan...' : 'Tambah Component'}
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {(selectedVersion.components ?? []).length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                            Belum ada component di version ini.
                          </div>
                        ) : (
                          (selectedVersion.components as PerformanceComponent[]).map((component) => (
                            <div key={component.id} className="rounded-xl border border-border p-4">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold">{component.name}</p>
                                  <p className="text-xs text-muted-foreground">{component.code} • {component.type}</p>
                                </div>
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                                  {Number(component.weight).toFixed(2)}%
                                </span>
                              </div>
                              <p className="mt-2 text-sm text-muted-foreground">
                                {component.description || 'Belum ada deskripsi component.'}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                                <span>Sort order {component.sortOrder}</span>
                                <span>{component.isRequired ? 'Required' : 'Optional'}</span>
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
