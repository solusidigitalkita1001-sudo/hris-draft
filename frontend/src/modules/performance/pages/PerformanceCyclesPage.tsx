import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type ReviewCycle,
  type ReviewCyclePayload,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { BarChart3, Plus, RefreshCw } from 'lucide-react';
import { formatDate } from '@/utils/format';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const CYCLE_TYPE_OPTIONS: { value: ReviewCyclePayload['type']; labelKey: TranslationKey }[] = [
  { value: 'MONTHLY', labelKey: 'perf.cycleType.monthly' },
  { value: 'QUARTERLY', labelKey: 'perf.cycleType.quarterly' },
  { value: 'SEMI_ANNUAL', labelKey: 'perf.cycleType.semiAnnual' },
  { value: 'ANNUAL', labelKey: 'perf.cycleType.annual' },
];

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.status.draft',
  ACTIVE: 'perf.status.active',
  COMPLETED: 'perf.status.completed',
  ARCHIVED: 'perf.status.archived',
};

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  COMPLETED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  ARCHIVED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

function toIsoDateBoundary(value: string, endOfDay = false) {
  if (!value) return undefined;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  return new Date(`${value}${suffix}`).toISOString();
}

export function PerformanceCyclesPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [cycles, setCycles] = useState<ReviewCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    code: '',
    type: 'QUARTERLY' as ReviewCyclePayload['type'],
    startDate: '',
    endDate: '',
    reviewDeadline: '',
    description: '',
  });

  const stats = useMemo(() => {
    const activeCount = cycles.filter((cycle) => cycle.status === 'ACTIVE').length;
    const completedCount = cycles.filter((cycle) => cycle.status === 'COMPLETED').length;
    const totalReviews = cycles.reduce((sum, cycle) => sum + (cycle._count?.reviews || 0), 0);
    return { activeCount, completedCount, totalReviews };
  }, [cycles]);

  const resetForm = useCallback(() => {
    setForm({
      name: '',
      code: '',
      type: 'QUARTERLY',
      startDate: '',
      endDate: '',
      reviewDeadline: '',
      description: '',
    });
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setCycles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await performanceService.getReviewCycles(companyId);
      setCycles(data);
    } catch (error) {
      console.error(error);
      toast.error(t('perf.cycles.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error(t('perf.cycles.noCompany'));
      return;
    }

    if (!form.name.trim() || !form.startDate || !form.endDate) {
      toast.error(t('perf.cycles.validation.required'));
      return;
    }

    if (form.endDate < form.startDate) {
      toast.error(t('perf.cycles.validation.endBeforeStart'));
      return;
    }

    setSaving(true);
    try {
      const payload: ReviewCyclePayload = {
        companyId,
        name: form.name.trim(),
        type: form.type,
        startDate: toIsoDateBoundary(form.startDate) as string,
        endDate: toIsoDateBoundary(form.endDate, true) as string,
        reviewDeadline: toIsoDateBoundary(form.reviewDeadline, true),
        description: form.description.trim() || undefined,
      };
      await performanceService.createReviewCycle(payload);
      toast.success(t('perf.cycles.createSuccess'));
      resetForm();
      setFormOpen(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.cycles.createFailed')));
    } finally {
      setSaving(false);
    }
  }, [companyId, fetchData, form, resetForm, t]);

  return (
    <div>
      <PageHeader
        title={t('perf.cycles.title')}
        description={t('perf.cycles.description')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                resetForm();
                setFormOpen((prev) => !prev);
              }}
            >
              <Plus size={16} className="mr-2" />
              {formOpen ? t('perf.cycles.closeForm') : t('perf.cycles.newCycle')}
            </Button>
          </>
        }
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.cycles.stats.active')}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.activeCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.cycles.stats.completed')}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.completedCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.cycles.stats.totalReviews')}</p>
          <p className="mt-2 text-2xl font-semibold">{stats.totalReviews}</p>
        </div>
      </div>

      {formOpen && (
        <div className="mb-6 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.name')}</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder={t('perf.cycles.form.namePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.code')}</label>
              <Input
                value=""
                placeholder={t('perf.cycles.form.codePlaceholder')}
                disabled
              />
              <p className="text-xs text-muted-foreground">{t('perf.cycles.form.codeHint')}</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.type')}</label>
              <Select2
                value={form.type}
                onValueChange={(value) => setForm((prev) => ({ ...prev, type: value as ReviewCyclePayload['type'] }))}
                options={CYCLE_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                placeholder={t('perf.cycles.form.typePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.reviewDeadline')}</label>
              <Input
                type="date"
                value={form.reviewDeadline}
                onChange={(e) => setForm((prev) => ({ ...prev, reviewDeadline: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.startDate')}</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('perf.cycles.form.endDate')}</label>
              <Input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <label className="text-sm font-medium">{t('perf.cycles.form.description')}</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              className="min-h-28 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder={t('perf.cycles.form.descriptionPlaceholder')}
            />
          </div>

          <div className="mt-5 flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
            >
              {t('common.cancel')}
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={saving}>
              {saving ? t('perf.common.saving') : t('perf.cycles.form.submit')}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="col-span-full py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : cycles.length === 0 ? (
          <div className="col-span-full rounded-xl border border-dashed border-border bg-card py-12 text-center">
            <BarChart3 size={32} className="mx-auto text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">{t('perf.cycles.empty.title')}</p>
            <p className="text-xs text-muted-foreground">{t('perf.cycles.empty.description')}</p>
          </div>
        ) : (
          cycles.map((cycle) => (
            <div key={cycle.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{cycle.name}</p>
                  <p className="text-xs text-muted-foreground">{cycle.code}</p>
                </div>
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[cycle.status] || STATUS_STYLES.DRAFT}`}>
                  {STATUS_LABEL_KEYS[cycle.status] ? t(STATUS_LABEL_KEYS[cycle.status]) : cycle.status}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span>{cycle.type}</span>
                <span>{formatDate(cycle.startDate)} - {formatDate(cycle.endDate)}</span>
                <span>{t('perf.cycles.reviewCount', { count: cycle._count?.reviews || 0 })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
