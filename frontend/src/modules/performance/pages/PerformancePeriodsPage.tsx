import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceMethod,
  type PerformancePeriod,
  type PerformanceReadinessSummary,
  type PerformanceConfigSnapshot,
  type PerformancePeriodPayload,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { formatDate } from '@/utils/format';
import { AlertCircle, CalendarRange, RefreshCw, Rocket } from 'lucide-react';
import toast from 'react-hot-toast';

const PERIOD_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  READY: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  CLOSED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  ARCHIVED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
};

function toIsoDateBoundary(value: string, endOfDay = false) {
  if (!value) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  return new Date(`${value}${suffix}`).toISOString();
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

function slugifyFileName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'performance-period';
}

function SnapshotDetailModal({
  open,
  snapshot,
  periodName,
  onClose,
}: {
  open: boolean;
  snapshot: PerformanceConfigSnapshot | null;
  periodName: string;
  onClose: () => void;
}) {
  if (!open || !snapshot) return null;

  const snapshotJson = JSON.stringify(snapshot, null, 2);
  const exportFileName = `${slugifyFileName(periodName)}-snapshot.json`;

  const handleCopyJson = async () => {
    try {
      await navigator.clipboard.writeText(snapshotJson);
      toast.success('Snapshot JSON berhasil dicopy');
    } catch (error) {
      console.error(error);
      toast.error('Gagal copy snapshot JSON');
    }
  };

  const handleExportJson = () => {
    try {
      const blob = new Blob([snapshotJson], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = exportFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      toast.success('Snapshot JSON berhasil diunduh');
    } catch (error) {
      console.error(error);
      toast.error('Gagal export snapshot JSON');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
          <div>
            <p className="text-lg font-semibold">Snapshot Period</p>
            <p className="text-sm text-muted-foreground">
              {periodName} • frozen at {formatDateTime(snapshot.frozenAt)}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="outline" onClick={() => void handleCopyJson()}>
              Copy JSON
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportJson}>
              Export JSON
            </Button>
            <Button size="sm" variant="outline" onClick={onClose}>
              Tutup
            </Button>
          </div>
        </div>

        <div className="max-h-[calc(90vh-80px)] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Method</p>
              <p className="mt-2 text-sm font-semibold">{snapshot.method.name}</p>
              <p className="text-xs text-muted-foreground">{snapshot.method.code}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Version</p>
              <p className="mt-2 text-sm font-semibold">v{snapshot.methodVersion.versionNumber}</p>
              <p className="text-xs text-muted-foreground">{snapshot.methodVersion.status}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Components</p>
              <p className="mt-2 text-sm font-semibold">{snapshot.components.length}</p>
              <p className="text-xs text-muted-foreground">Item dibekukan</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs text-muted-foreground">Governance</p>
              <p className="mt-2 text-sm font-semibold">{snapshot.gradeRule?.code || 'NO_GRADE'}</p>
              <p className="text-xs text-muted-foreground">
                {snapshot.reviewWorkflowTemplate?.stages.length || 0} review • {snapshot.approvalWorkflowTemplate?.stages.length || 0} approval
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Period Scope</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Period</span>
                  <span className="font-medium">{snapshot.period.name}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Code</span>
                  <span className="font-medium">{snapshot.period.code}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Start</span>
                  <span className="font-medium">{formatDateTime(snapshot.period.startDate)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">End</span>
                  <span className="font-medium">{formatDateTime(snapshot.period.endDate)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Review Deadline</span>
                  <span className="font-medium">{formatDateTime(snapshot.period.reviewDeadline)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-semibold">Method Version Rule</h3>
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Aggregation</span>
                  <span className="font-medium">{snapshot.methodVersion.scoreAggregation}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Minimum Score</span>
                  <span className="font-medium">{snapshot.methodVersion.minimumScore ?? '-'}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Maximum Score</span>
                  <span className="font-medium">{snapshot.methodVersion.maximumScore ?? '-'}</span>
                </div>
              </div>
              {snapshot.methodVersion.summary && (
                <p className="mt-4 text-sm text-muted-foreground">{snapshot.methodVersion.summary}</p>
              )}
              {snapshot.methodVersion.normalizationRule && (
                <pre className="mt-4 overflow-x-auto rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                  {JSON.stringify(snapshot.methodVersion.normalizationRule, null, 2)}
                </pre>
              )}
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-card p-5">
            <h3 className="text-sm font-semibold">Frozen Components</h3>
            <div className="mt-4 space-y-3">
              {snapshot.components.map((component) => (
                <div key={component.id} className="rounded-xl border border-border bg-background p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{component.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {component.code} • {component.type}
                      </p>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{component.weight}%</p>
                      <p>Sort {component.sortOrder}</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {component.description || 'Tanpa deskripsi component.'}
                  </p>
                  <div className="mt-2 text-xs text-muted-foreground">
                    {component.isRequired ? 'Required component' : 'Optional component'}
                  </div>
                  {component.config && (
                    <pre className="mt-3 overflow-x-auto rounded-xl bg-muted p-3 text-xs text-muted-foreground">
                      {JSON.stringify(component.config, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5 xl:col-span-1">
              <h3 className="text-sm font-semibold">Grade Rule</h3>
              {snapshot.gradeRule ? (
                <>
                  <p className="mt-3 text-sm font-medium">{snapshot.gradeRule.name}</p>
                  <p className="text-xs text-muted-foreground">{snapshot.gradeRule.code}</p>
                  <div className="mt-4 space-y-2">
                    {snapshot.gradeRule.ranges.map((range) => (
                      <div key={range.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{range.label}</span>
                          <span className="text-muted-foreground">{range.minimum} - {range.maximum}</span>
                        </div>
                        {range.description && (
                          <p className="mt-1 text-xs text-muted-foreground">{range.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Snapshot ini tidak punya grade rule.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 xl:col-span-1">
              <h3 className="text-sm font-semibold">Review Workflow</h3>
              {snapshot.reviewWorkflowTemplate ? (
                <>
                  <p className="mt-3 text-sm font-medium">{snapshot.reviewWorkflowTemplate.name}</p>
                  <div className="mt-4 space-y-2">
                    {snapshot.reviewWorkflowTemplate.stages.map((stage) => (
                      <div key={stage.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{stage.level}. {stage.name}</span>
                          <span className="text-xs text-muted-foreground">{stage.approverType}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stage.approverRoleCode || stage.approverId || 'Auto step'} • SLA {stage.slaHours} jam
                        </p>
                        {stage.conditionRules.length > 0 && (
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-2 text-[11px] text-muted-foreground">
                            {JSON.stringify(stage.conditionRules, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Snapshot ini tidak punya review workflow.</p>
              )}
            </div>

            <div className="rounded-xl border border-border bg-card p-5 xl:col-span-1">
              <h3 className="text-sm font-semibold">Approval Workflow</h3>
              {snapshot.approvalWorkflowTemplate ? (
                <>
                  <p className="mt-3 text-sm font-medium">{snapshot.approvalWorkflowTemplate.name}</p>
                  <div className="mt-4 space-y-2">
                    {snapshot.approvalWorkflowTemplate.stages.map((stage) => (
                      <div key={stage.id} className="rounded-lg bg-muted/60 px-3 py-2 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-medium">{stage.level}. {stage.name}</span>
                          <span className="text-xs text-muted-foreground">{stage.approverType}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {stage.approverRoleCode || stage.approverId || 'Auto step'} • SLA {stage.slaHours} jam
                        </p>
                        {stage.conditionRules.length > 0 && (
                          <pre className="mt-2 overflow-x-auto rounded-lg bg-background p-2 text-[11px] text-muted-foreground">
                            {JSON.stringify(stage.conditionRules, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">Snapshot ini tidak punya approval workflow.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PerformancePeriodsPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [methods, setMethods] = useState<PerformanceMethod[]>([]);
  const [periods, setPeriods] = useState<PerformancePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishingId, setPublishingId] = useState('');
  const [readinessLoadingId, setReadinessLoadingId] = useState('');
  const [readinessMap, setReadinessMap] = useState<Record<string, PerformanceReadinessSummary>>({});
  const [snapshotPeriod, setSnapshotPeriod] = useState<PerformancePeriod | null>(null);
  const [form, setForm] = useState({
    methodId: '',
    methodVersionId: '',
    name: '',
    code: '',
    startDate: '',
    endDate: '',
    reviewDeadline: '',
    description: '',
  });

  const selectedMethod = useMemo(
    () => methods.find((method) => method.id === form.methodId) ?? null,
    [form.methodId, methods]
  );

  const selectedVersionOptions = useMemo(
    () =>
      (selectedMethod?.versions ?? []).map((version) => ({
        value: version.id,
        label: `v${version.versionNumber} • ${version.status}`,
      })),
    [selectedMethod?.versions]
  );

  const loadData = useCallback(async () => {
    if (!companyId) {
      setMethods([]);
      setPeriods([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [methodData, periodData] = await Promise.all([
        performanceService.getMethods(companyId),
        performanceService.getPeriods(companyId),
      ]);
      setMethods(methodData);
      setPeriods(periodData);
      setForm((prev) => {
        const methodId = prev.methodId && methodData.some((method) => method.id === prev.methodId)
          ? prev.methodId
          : methodData[0]?.id || '';
        const method = methodData.find((item) => item.id === methodId);
        const versionId = prev.methodVersionId && method?.versions?.some((version) => version.id === prev.methodVersionId)
          ? prev.methodVersionId
          : method?.versions?.[0]?.id || '';

        return {
          ...prev,
          methodId,
          methodVersionId: versionId,
        };
      });
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat performance periods');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const method = methods.find((item) => item.id === form.methodId);
    const firstVersionId = method?.versions?.[0]?.id || '';
    if (!form.methodId) return;
    if (form.methodVersionId && method?.versions?.some((version) => version.id === form.methodVersionId)) return;

    setForm((prev) => ({
      ...prev,
      methodVersionId: firstVersionId,
    }));
  }, [form.methodId, form.methodVersionId, methods]);

  const handleCreatePeriod = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!form.methodId || !form.methodVersionId || !form.name.trim() || !form.startDate || !form.endDate) {
      toast.error('Method, version, nama, start date, dan end date wajib diisi');
      return;
    }

    if (form.endDate < form.startDate) {
      toast.error('End date tidak boleh lebih kecil dari start date');
      return;
    }

    setSaving(true);
    try {
      const payload: PerformancePeriodPayload = {
        companyId,
        methodId: form.methodId,
        methodVersionId: form.methodVersionId,
        name: form.name.trim(),
        startDate: toIsoDateBoundary(form.startDate) as string,
        endDate: toIsoDateBoundary(form.endDate, true) as string,
        reviewDeadline: toIsoDateBoundary(form.reviewDeadline, true),
        description: form.description.trim() || undefined,
      };
      await performanceService.createPeriod(payload);
      toast.success('Performance period berhasil dibuat');
      setForm((prev) => ({
        ...prev,
        name: '',
        code: '',
        startDate: '',
        endDate: '',
        reviewDeadline: '',
        description: '',
      }));
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat performance period');
    } finally {
      setSaving(false);
    }
  }, [companyId, form, loadData]);

  const handleLoadReadiness = useCallback(async (periodId: string) => {
    setReadinessLoadingId(periodId);
    try {
      const summary = await performanceService.getPeriodReadiness(periodId);
      setReadinessMap((prev) => ({ ...prev, [periodId]: summary }));
      toast.success(summary.isReady ? 'Period ready untuk publish' : 'Readiness summary berhasil dimuat');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal mengecek readiness period');
    } finally {
      setReadinessLoadingId('');
    }
  }, []);

  const handlePublishPeriod = useCallback(async (periodId: string) => {
    setPublishingId(periodId);
    try {
      const published = await performanceService.publishPeriod(periodId);
      toast.success(`Period ${published.name} berhasil dipublish`);
      const readiness = await performanceService.getPeriodReadiness(periodId);
      setReadinessMap((prev) => ({ ...prev, [periodId]: readiness }));
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal publish period');
    } finally {
      setPublishingId('');
    }
  }, [loadData]);

  const publishedCount = periods.filter((period) => period.status === 'PUBLISHED').length;

  return (
    <div>
      <PageHeader
        title="Performance Config Periods"
        description="Kelola period, cek readiness, dan publish period yang sudah siap."
        actions={(
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Total Periods</p>
          <p className="mt-2 text-2xl font-semibold">{periods.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Published Periods</p>
          <p className="mt-2 text-2xl font-semibold">{publishedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Methods Available</p>
          <p className="mt-2 text-2xl font-semibold">{methods.length}</p>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          <CalendarRange size={16} />
          <h2 className="text-sm font-semibold">New Period</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Method</label>
            <Select2
              value={form.methodId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, methodId: value }))}
              options={methods.map((method) => ({ value: method.id, label: `${method.name} • ${method.code}` }))}
              placeholder="Pilih method"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Version</label>
            <Select2
              value={form.methodVersionId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, methodVersionId: value }))}
              options={selectedVersionOptions}
              placeholder="Pilih version"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Period Name</label>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="2026 Annual Appraisal"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <Input
              value=""
              placeholder="Akan dibuat otomatis oleh sistem"
              disabled
            />
            <p className="text-xs text-muted-foreground">Code period digenerate otomatis saat create.</p>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date</label>
            <Input
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date</label>
            <Input
              type="date"
              value={form.endDate}
              onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Review Deadline</label>
            <Input
              type="date"
              value={form.reviewDeadline}
              onChange={(e) => setForm((prev) => ({ ...prev, reviewDeadline: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Selected Version Status</label>
            <div className="flex h-10 items-center rounded-lg border border-input bg-background px-3 text-sm text-muted-foreground">
              {selectedMethod?.versions?.find((version) => version.id === form.methodVersionId)?.status || '-'}
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-24 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Tujuan period, timeline, dan catatan publish."
          />
        </div>

        <div className="mt-5 flex justify-end">
          <Button size="sm" onClick={handleCreatePeriod} disabled={saving}>
            {saving ? 'Menyimpan...' : 'Buat Period'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">Loading...</div>
        ) : periods.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <CalendarRange size={32} className="mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">Belum ada performance period.</p>
          </div>
        ) : (
          periods.map((period) => {
            const readiness = readinessMap[period.id] ?? period.readinessSummary ?? null;
            const snapshot = period.configSnapshot;
            return (
              <div key={period.id} className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{period.name}</p>
                    <p className="text-xs text-muted-foreground">{period.code}</p>
                  </div>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${PERIOD_STATUS_STYLES[period.status] || PERIOD_STATUS_STYLES.DRAFT}`}>
                    {period.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>{period.method?.name || period.methodId}</span>
                  <span>v{period.methodVersion?.versionNumber || '-'}</span>
                  <span>{formatDate(period.startDate)} - {formatDate(period.endDate)}</span>
                </div>

                <p className="mt-3 text-sm text-muted-foreground">
                  {period.description || 'Belum ada deskripsi period.'}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleLoadReadiness(period.id)}
                    disabled={readinessLoadingId === period.id}
                  >
                    {readinessLoadingId === period.id ? 'Checking...' : 'Check Readiness'}
                  </Button>
                  {period.status !== 'PUBLISHED' && (
                    <Button
                      size="sm"
                      onClick={() => handlePublishPeriod(period.id)}
                      disabled={publishingId === period.id}
                    >
                      <Rocket size={14} className="mr-2" />
                      {publishingId === period.id ? 'Publishing...' : 'Publish Period'}
                    </Button>
                  )}
                  {snapshot && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSnapshotPeriod(period)}
                    >
                      Lihat Snapshot
                    </Button>
                  )}
                </div>

                {readiness && (
                  <div className={`mt-4 rounded-xl border p-4 ${readiness.isReady ? 'border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20'}`}>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <AlertCircle size={16} />
                      {readiness.isReady ? 'Ready to Publish' : 'Belum Ready'}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{readiness.metrics.componentCount} components</span>
                      <span>{readiness.metrics.totalWeight.toFixed(2)}% weight</span>
                      <span>{readiness.metrics.methodVersionStatus}</span>
                    </div>
                    {readiness.issues.length > 0 ? (
                      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                        {readiness.issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-sm text-muted-foreground">
                        Semua rule readiness lulus. Period aman untuk dipublish.
                      </p>
                    )}
                  </div>
                )}

                {snapshot && (
                  <div className="mt-4 rounded-xl border border-border bg-background p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">Frozen Config Snapshot</p>
                        <p className="text-xs text-muted-foreground">
                          Dibekukan pada {formatDate(snapshot.frozenAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        v{snapshot.methodVersion.versionNumber}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{snapshot.components.length} components</span>
                      <span>{snapshot.gradeRule?.code || 'NO_GRADE_RULE'}</span>
                      <span>{snapshot.reviewWorkflowTemplate?.stages.length || 0} review stages</span>
                      <span>{snapshot.approvalWorkflowTemplate?.stages.length || 0} approval stages</span>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      Snapshot ini mengunci config method, component, grade rule, dan workflow yang dipakai saat period dipublish.
                    </p>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      <SnapshotDetailModal
        open={!!snapshotPeriod}
        snapshot={snapshotPeriod?.configSnapshot || null}
        periodName={snapshotPeriod?.name || '-'}
        onClose={() => setSnapshotPeriod(null)}
      />
    </div>
  );
}
