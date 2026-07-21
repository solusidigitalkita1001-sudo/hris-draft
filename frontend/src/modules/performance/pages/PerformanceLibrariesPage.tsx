import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceFormula,
  type PerformanceIndicator,
  type PerformanceGradeRule,
  type PerformanceFormulaPayload,
  type PerformanceIndicatorPayload,
  type PerformanceGradeRulePayload,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { Braces, Calculator, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const FORMULA_STRATEGY_OPTIONS = [
  'ACHIEVEMENT_PERCENTAGE',
  'LOWER_IS_BETTER',
  'MANUAL_RATING',
  'AVERAGE',
  'WEIGHTED_AVERAGE',
  'CUSTOM',
] as const;

const ROUNDING_MODE_OPTIONS = ['ROUND', 'FLOOR', 'CEIL'] as const;
const MEASUREMENT_TYPE_OPTIONS = ['NUMBER', 'PERCENTAGE', 'CURRENCY', 'DURATION', 'BOOLEAN', 'RATING', 'TEXT', 'CUSTOM_FORMULA'] as const;
const TARGET_TYPE_OPTIONS = ['MONTHLY', 'QUARTERLY', 'SEMESTER', 'YEARLY', 'CUSTOM'] as const;
const DIRECTION_OPTIONS = ['HIGHER_BETTER', 'LOWER_BETTER', 'RANGE', 'EXACT', 'MANUAL'] as const;

function parseOptionalNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function buildEmptyRange(sortOrder: number) {
  return {
    label: '',
    minimum: '',
    maximum: '',
    sortOrder: String(sortOrder),
    description: '',
  };
}

export function PerformanceLibrariesPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [formulas, setFormulas] = useState<PerformanceFormula[]>([]);
  const [indicators, setIndicators] = useState<PerformanceIndicator[]>([]);
  const [gradeRules, setGradeRules] = useState<PerformanceGradeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingFormula, setSavingFormula] = useState(false);
  const [savingIndicator, setSavingIndicator] = useState(false);
  const [savingGradeRule, setSavingGradeRule] = useState(false);

  const [formulaForm, setFormulaForm] = useState({
    name: '',
    code: '',
    description: '',
    strategy: 'ACHIEVEMENT_PERCENTAGE' as PerformanceFormulaPayload['strategy'],
    expression: '',
    roundingMode: 'ROUND' as NonNullable<PerformanceFormulaPayload['roundingMode']>,
    roundingPrecision: '2',
    minimumScore: '0',
    maximumScore: '100',
    isActive: true,
  });

  const [indicatorForm, setIndicatorForm] = useState({
    formulaId: '',
    name: '',
    code: '',
    description: '',
    category: '',
    perspective: '',
    measurementType: 'PERCENTAGE' as PerformanceIndicatorPayload['measurementType'],
    targetType: 'YEARLY' as PerformanceIndicatorPayload['targetType'],
    direction: 'HIGHER_BETTER' as PerformanceIndicatorPayload['direction'],
    unit: '',
    defaultWeight: '10',
    minimumValue: '0',
    maximumValue: '100',
    evidenceRequired: false,
    reviewRequired: true,
    isActive: true,
  });

  const [gradeRuleForm, setGradeRuleForm] = useState({
    name: '',
    code: '',
    description: '',
    isActive: true,
    ranges: [buildEmptyRange(1), buildEmptyRange(2)],
  });

  const formulaOptions = useMemo(
    () => [
      { value: '', label: 'Tanpa formula' },
      ...formulas.map((formula) => ({ value: formula.id, label: `${formula.name} • ${formula.code}` })),
    ],
    [formulas]
  );

  const loadData = useCallback(async () => {
    if (!companyId) {
      setFormulas([]);
      setIndicators([]);
      setGradeRules([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [formulaData, indicatorData, gradeRuleData] = await Promise.all([
        performanceService.getFormulas(companyId),
        performanceService.getIndicators(companyId),
        performanceService.getGradeRules(companyId),
      ]);
      setFormulas(formulaData);
      setIndicators(indicatorData);
      setGradeRules(gradeRuleData);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat performance libraries');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateFormula = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!formulaForm.name.trim() || !formulaForm.code.trim()) {
      toast.error('Nama dan code formula wajib diisi');
      return;
    }

    setSavingFormula(true);
    try {
      const payload: PerformanceFormulaPayload = {
        companyId,
        name: formulaForm.name.trim(),
        code: formulaForm.code.trim().toUpperCase(),
        description: formulaForm.description.trim() || undefined,
        strategy: formulaForm.strategy,
        expression: formulaForm.expression.trim() || undefined,
        roundingMode: formulaForm.roundingMode,
        roundingPrecision: Number(formulaForm.roundingPrecision || 0),
        minimumScore: parseOptionalNumber(formulaForm.minimumScore),
        maximumScore: parseOptionalNumber(formulaForm.maximumScore),
        isActive: formulaForm.isActive,
      };
      await performanceService.createFormula(payload);
      toast.success('Formula berhasil dibuat');
      setFormulaForm({
        name: '',
        code: '',
        description: '',
        strategy: 'ACHIEVEMENT_PERCENTAGE',
        expression: '',
        roundingMode: 'ROUND',
        roundingPrecision: '2',
        minimumScore: '0',
        maximumScore: '100',
        isActive: true,
      });
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat formula');
    } finally {
      setSavingFormula(false);
    }
  }, [companyId, formulaForm, loadData]);

  const handleCreateIndicator = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!indicatorForm.name.trim() || !indicatorForm.code.trim()) {
      toast.error('Nama dan code indicator wajib diisi');
      return;
    }

    setSavingIndicator(true);
    try {
      const payload: PerformanceIndicatorPayload = {
        companyId,
        formulaId: indicatorForm.formulaId || undefined,
        name: indicatorForm.name.trim(),
        code: indicatorForm.code.trim().toUpperCase(),
        description: indicatorForm.description.trim() || undefined,
        category: indicatorForm.category.trim() || undefined,
        perspective: indicatorForm.perspective.trim() || undefined,
        measurementType: indicatorForm.measurementType,
        targetType: indicatorForm.targetType,
        direction: indicatorForm.direction,
        unit: indicatorForm.unit.trim() || undefined,
        defaultWeight: parseOptionalNumber(indicatorForm.defaultWeight),
        minimumValue: parseOptionalNumber(indicatorForm.minimumValue),
        maximumValue: parseOptionalNumber(indicatorForm.maximumValue),
        evidenceRequired: indicatorForm.evidenceRequired,
        reviewRequired: indicatorForm.reviewRequired,
        isActive: indicatorForm.isActive,
      };
      await performanceService.createIndicator(payload);
      toast.success('Indicator berhasil dibuat');
      setIndicatorForm({
        formulaId: '',
        name: '',
        code: '',
        description: '',
        category: '',
        perspective: '',
        measurementType: 'PERCENTAGE',
        targetType: 'YEARLY',
        direction: 'HIGHER_BETTER',
        unit: '',
        defaultWeight: '10',
        minimumValue: '0',
        maximumValue: '100',
        evidenceRequired: false,
        reviewRequired: true,
        isActive: true,
      });
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat indicator');
    } finally {
      setSavingIndicator(false);
    }
  }, [companyId, indicatorForm, loadData]);

  const updateRange = useCallback((index: number, field: string, value: string) => {
    setGradeRuleForm((prev) => ({
      ...prev,
      ranges: prev.ranges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [field]: value } : range
      ),
    }));
  }, []);

  const handleCreateGradeRule = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!gradeRuleForm.name.trim() || !gradeRuleForm.code.trim()) {
      toast.error('Nama dan code grade rule wajib diisi');
      return;
    }

    if (gradeRuleForm.ranges.some((range) => !range.label.trim() || range.minimum === '' || range.maximum === '')) {
      toast.error('Semua grade range wajib lengkap');
      return;
    }

    setSavingGradeRule(true);
    try {
      const payload: PerformanceGradeRulePayload = {
        companyId,
        name: gradeRuleForm.name.trim(),
        code: gradeRuleForm.code.trim().toUpperCase(),
        description: gradeRuleForm.description.trim() || undefined,
        isActive: gradeRuleForm.isActive,
        ranges: gradeRuleForm.ranges.map((range, index) => ({
          label: range.label.trim(),
          minimum: Number(range.minimum),
          maximum: Number(range.maximum),
          sortOrder: Number(range.sortOrder || index + 1),
          description: range.description.trim() || undefined,
        })),
      };
      await performanceService.createGradeRule(payload);
      toast.success('Grade rule berhasil dibuat');
      setGradeRuleForm({
        name: '',
        code: '',
        description: '',
        isActive: true,
        ranges: [buildEmptyRange(1), buildEmptyRange(2)],
      });
      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat grade rule');
    } finally {
      setSavingGradeRule(false);
    }
  }, [companyId, gradeRuleForm, loadData]);

  return (
    <div>
      <PageHeader
        title="Performance Libraries"
        description="Kelola formula, indicator library, dan grade rules untuk Performance Management."
        actions={(
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Formulas</p>
          <p className="mt-2 text-2xl font-semibold">{formulas.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Indicators</p>
          <p className="mt-2 text-2xl font-semibold">{indicators.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Grade Rules</p>
          <p className="mt-2 text-2xl font-semibold">{gradeRules.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calculator size={16} />
                <h2 className="text-sm font-semibold">New Formula</h2>
              </div>
              <div className="space-y-3">
                <Input value={formulaForm.name} onChange={(e) => setFormulaForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Achievement Percentage" />
                <Input value={formulaForm.code} onChange={(e) => setFormulaForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="ACH_PCT" />
                <Select2
                  value={formulaForm.strategy}
                  onValueChange={(value) => setFormulaForm((prev) => ({ ...prev, strategy: value as typeof prev.strategy }))}
                  options={FORMULA_STRATEGY_OPTIONS.map((value) => ({ value, label: value }))}
                  placeholder="Strategy"
                />
                <Input value={formulaForm.expression} onChange={(e) => setFormulaForm((prev) => ({ ...prev, expression: e.target.value }))} placeholder="(actual/target)*100" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select2
                    value={formulaForm.roundingMode}
                    onValueChange={(value) => setFormulaForm((prev) => ({ ...prev, roundingMode: value as typeof prev.roundingMode }))}
                    options={ROUNDING_MODE_OPTIONS.map((value) => ({ value, label: value }))}
                    placeholder="Rounding"
                  />
                  <Input type="number" value={formulaForm.roundingPrecision} onChange={(e) => setFormulaForm((prev) => ({ ...prev, roundingPrecision: e.target.value }))} placeholder="2" />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="checkbox" checked={formulaForm.isActive} onChange={(e) => setFormulaForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                    Active
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" value={formulaForm.minimumScore} onChange={(e) => setFormulaForm((prev) => ({ ...prev, minimumScore: e.target.value }))} placeholder="Min score" />
                  <Input type="number" value={formulaForm.maximumScore} onChange={(e) => setFormulaForm((prev) => ({ ...prev, maximumScore: e.target.value }))} placeholder="Max score" />
                </div>
                <textarea
                  value={formulaForm.description}
                  onChange={(e) => setFormulaForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Deskripsi formula dan kapan dipakai."
                />
                <Button size="sm" className="w-full" onClick={handleCreateFormula} disabled={savingFormula}>
                  {savingFormula ? 'Menyimpan...' : 'Buat Formula'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Formula List</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {formulas.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Belum ada formula.</div>
                ) : (
                  formulas.map((formula) => (
                    <div key={formula.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{formula.name}</p>
                          <p className="text-xs text-muted-foreground">{formula.code} • {formula.strategy}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {formula.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{formula.description || formula.expression || 'Belum ada deskripsi formula.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{formula.roundingMode}/{formula.roundingPrecision}</span>
                        <span>{formula._count?.indicators || 0} indicators</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Braces size={16} />
                <h2 className="text-sm font-semibold">New Indicator</h2>
              </div>
              <div className="space-y-3">
                <Input value={indicatorForm.name} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Revenue Achievement" />
                <Input value={indicatorForm.code} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="REV_ACH" />
                <Select2 value={indicatorForm.formulaId} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, formulaId: value }))} options={formulaOptions} placeholder="Formula" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={indicatorForm.category} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, category: e.target.value }))} placeholder="Category" />
                  <Input value={indicatorForm.perspective} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, perspective: e.target.value }))} placeholder="Perspective" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select2 value={indicatorForm.measurementType} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, measurementType: value as typeof prev.measurementType }))} options={MEASUREMENT_TYPE_OPTIONS.map((value) => ({ value, label: value }))} placeholder="Measurement" />
                  <Select2 value={indicatorForm.targetType} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, targetType: value as typeof prev.targetType }))} options={TARGET_TYPE_OPTIONS.map((value) => ({ value, label: value }))} placeholder="Target type" />
                  <Select2 value={indicatorForm.direction} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, direction: value as typeof prev.direction }))} options={DIRECTION_OPTIONS.map((value) => ({ value, label: value }))} placeholder="Direction" />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input value={indicatorForm.unit} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder="Unit" />
                  <Input type="number" value={indicatorForm.defaultWeight} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, defaultWeight: e.target.value }))} placeholder="Default weight" />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.isActive} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                    Active
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" value={indicatorForm.minimumValue} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, minimumValue: e.target.value }))} placeholder="Minimum value" />
                  <Input type="number" value={indicatorForm.maximumValue} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, maximumValue: e.target.value }))} placeholder="Maximum value" />
                </div>
                <textarea
                  value={indicatorForm.description}
                  onChange={(e) => setIndicatorForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Deskripsi indicator dan evidence yang dibutuhkan."
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.evidenceRequired} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, evidenceRequired: e.target.checked }))} />
                    Evidence required
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.reviewRequired} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, reviewRequired: e.target.checked }))} />
                    Review required
                  </label>
                </div>
                <Button size="sm" className="w-full" onClick={handleCreateIndicator} disabled={savingIndicator}>
                  {savingIndicator ? 'Menyimpan...' : 'Buat Indicator'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Indicator Library</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {indicators.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Belum ada indicator.</div>
                ) : (
                  indicators.map((indicator) => (
                    <div key={indicator.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{indicator.name}</p>
                          <p className="text-xs text-muted-foreground">{indicator.code} • {indicator.measurementType}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {indicator.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{indicator.description || 'Belum ada deskripsi indicator.'}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{indicator.category || '-'}</span>
                        <span>{indicator.targetType}</span>
                        <span>{indicator.direction}</span>
                        <span>{indicator.formula?.code || 'NO_FORMULA'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <ShieldCheck size={16} />
                <h2 className="text-sm font-semibold">New Grade Rule</h2>
              </div>
              <div className="space-y-3">
                <Input value={gradeRuleForm.name} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Default Grade 2026" />
                <Input value={gradeRuleForm.code} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="GRADE-2026" />
                <textarea
                  value={gradeRuleForm.description}
                  onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Deskripsi grade rule."
                />
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                  <input type="checkbox" checked={gradeRuleForm.isActive} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  Active
                </label>

                <div className="space-y-3">
                  {gradeRuleForm.ranges.map((range, index) => (
                    <div key={`${index}-${range.sortOrder}`} className="rounded-xl border border-border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">Range {index + 1}</p>
                        {gradeRuleForm.ranges.length > 1 && (
                          <button
                            type="button"
                            className="text-xs text-destructive"
                            onClick={() =>
                              setGradeRuleForm((prev) => ({
                                ...prev,
                                ranges: prev.ranges.filter((_, rangeIndex) => rangeIndex !== index),
                              }))
                            }
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Input value={range.label} onChange={(e) => updateRange(index, 'label', e.target.value)} placeholder="A" />
                        <Input type="number" value={range.sortOrder} onChange={(e) => updateRange(index, 'sortOrder', e.target.value)} placeholder="1" />
                        <Input type="number" value={range.minimum} onChange={(e) => updateRange(index, 'minimum', e.target.value)} placeholder="90" />
                        <Input type="number" value={range.maximum} onChange={(e) => updateRange(index, 'maximum', e.target.value)} placeholder="100" />
                      </div>
                      <Input className="mt-3" value={range.description} onChange={(e) => updateRange(index, 'description', e.target.value)} placeholder="Catatan / rekomendasi grade" />
                    </div>
                  ))}
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setGradeRuleForm((prev) => ({
                      ...prev,
                      ranges: [...prev.ranges, buildEmptyRange(prev.ranges.length + 1)],
                    }))
                  }
                >
                  <Plus size={14} className="mr-2" />
                  Tambah Range
                </Button>

                <Button size="sm" className="w-full" onClick={handleCreateGradeRule} disabled={savingGradeRule}>
                  {savingGradeRule ? 'Menyimpan...' : 'Buat Grade Rule'}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">Grade Rules</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {gradeRules.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">Belum ada grade rule.</div>
                ) : (
                  gradeRules.map((gradeRule) => (
                    <div key={gradeRule.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{gradeRule.name}</p>
                          <p className="text-xs text-muted-foreground">{gradeRule.code}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {gradeRule.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{gradeRule.description || 'Belum ada deskripsi grade rule.'}</p>
                      <div className="mt-3 space-y-2">
                        {(gradeRule.ranges ?? []).map((range) => (
                          <div key={`${gradeRule.id}-${range.label}-${range.sortOrder}`} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-xs">
                            <span className="font-medium">{range.label}</span>
                            <span className="text-muted-foreground">{range.minimum} - {range.maximum}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
