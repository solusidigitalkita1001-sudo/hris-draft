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
  type PerformanceRecommendationRule,
  type PerformanceFormulaPayload,
  type PerformanceIndicatorPayload,
  type PerformanceGradeRulePayload,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { Braces, Calculator, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const FORMULA_STRATEGY_LABEL_KEYS: Record<string, TranslationKey> = {
  ACHIEVEMENT_PERCENTAGE: 'perf.formulaStrategy.achievementPercentage',
  LOWER_IS_BETTER: 'perf.formulaStrategy.lowerIsBetter',
  MANUAL_RATING: 'perf.formulaStrategy.manualRating',
  AVERAGE: 'perf.formulaStrategy.average',
  WEIGHTED_AVERAGE: 'perf.formulaStrategy.weightedAverage',
  CUSTOM: 'perf.formulaStrategy.custom',
};

const ROUNDING_MODE_LABEL_KEYS: Record<string, TranslationKey> = {
  ROUND: 'perf.roundingMode.round',
  FLOOR: 'perf.roundingMode.floor',
  CEIL: 'perf.roundingMode.ceil',
};

const MEASUREMENT_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  NUMBER: 'perf.measurementType.number',
  PERCENTAGE: 'perf.measurementType.percentage',
  CURRENCY: 'perf.measurementType.currency',
  DURATION: 'perf.measurementType.duration',
  BOOLEAN: 'perf.measurementType.boolean',
  RATING: 'perf.measurementType.rating',
  TEXT: 'perf.measurementType.text',
  CUSTOM_FORMULA: 'perf.measurementType.customFormula',
};

const TARGET_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  MONTHLY: 'perf.targetType.monthly',
  QUARTERLY: 'perf.targetType.quarterly',
  SEMESTER: 'perf.targetType.semester',
  YEARLY: 'perf.targetType.yearly',
  CUSTOM: 'perf.targetType.custom',
};

const DIRECTION_LABEL_KEYS: Record<string, TranslationKey> = {
  HIGHER_BETTER: 'perf.direction.higherBetter',
  LOWER_BETTER: 'perf.direction.lowerBetter',
  RANGE: 'perf.direction.range',
  EXACT: 'perf.direction.exact',
  MANUAL: 'perf.direction.manual',
};

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

function buildEmptyRecommendationRule(): PerformanceRecommendationRule {
  return {
    label: '',
    condition: '',
    action: '',
    notes: '',
  };
}

export function PerformanceLibrariesPage() {
  const { t } = useI18n();
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
    recommendationRules: [buildEmptyRecommendationRule()],
    ranges: [buildEmptyRange(1), buildEmptyRange(2)],
  });

  const formulaOptions = useMemo(
    () => [
      { value: '', label: t('perf.libraries.noFormula') },
      ...formulas.map((formula) => ({ value: formula.id, label: `${formula.name} • ${formula.code}` })),
    ],
    [formulas, t]
  );

  const strategyOptions = useMemo(
    () => FORMULA_STRATEGY_OPTIONS.map((value) => ({ value, label: t(FORMULA_STRATEGY_LABEL_KEYS[value]) })),
    [t]
  );

  const roundingModeOptions = useMemo(
    () => ROUNDING_MODE_OPTIONS.map((value) => ({ value, label: t(ROUNDING_MODE_LABEL_KEYS[value]) })),
    [t]
  );

  const measurementTypeOptions = useMemo(
    () => MEASUREMENT_TYPE_OPTIONS.map((value) => ({ value, label: t(MEASUREMENT_TYPE_LABEL_KEYS[value]) })),
    [t]
  );

  const targetTypeOptions = useMemo(
    () => TARGET_TYPE_OPTIONS.map((value) => ({ value, label: t(TARGET_TYPE_LABEL_KEYS[value]) })),
    [t]
  );

  const directionOptions = useMemo(
    () => DIRECTION_OPTIONS.map((value) => ({ value, label: t(DIRECTION_LABEL_KEYS[value]) })),
    [t]
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
      toast.error(t('perf.libraries.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleCreateFormula = useCallback(async () => {
    if (!companyId) {
      toast.error(t('perf.cycles.noCompany'));
      return;
    }

    if (!formulaForm.name.trim() || !formulaForm.code.trim()) {
      toast.error(t('perf.libraries.formulaValidation'));
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
      toast.success(t('perf.libraries.formulaCreated'));
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
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.libraries.formulaCreateFailed')));
    } finally {
      setSavingFormula(false);
    }
  }, [companyId, formulaForm, loadData, t]);

  const handleCreateIndicator = useCallback(async () => {
    if (!companyId) {
      toast.error(t('perf.cycles.noCompany'));
      return;
    }

    if (!indicatorForm.name.trim() || !indicatorForm.code.trim()) {
      toast.error(t('perf.libraries.indicatorValidation'));
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
      toast.success(t('perf.libraries.indicatorCreated'));
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
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.libraries.indicatorCreateFailed')));
    } finally {
      setSavingIndicator(false);
    }
  }, [companyId, indicatorForm, loadData, t]);

  const updateRange = useCallback((index: number, field: string, value: string) => {
    setGradeRuleForm((prev) => ({
      ...prev,
      ranges: prev.ranges.map((range, rangeIndex) =>
        rangeIndex === index ? { ...range, [field]: value } : range
      ),
    }));
  }, []);

  const updateRecommendationRule = useCallback((index: number, field: keyof PerformanceRecommendationRule, value: string) => {
    setGradeRuleForm((prev) => ({
      ...prev,
      recommendationRules: prev.recommendationRules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, [field]: value } : rule
      ),
    }));
  }, []);

  const handleCreateGradeRule = useCallback(async () => {
    if (!companyId) {
      toast.error(t('perf.cycles.noCompany'));
      return;
    }

    if (!gradeRuleForm.name.trim() || !gradeRuleForm.code.trim()) {
      toast.error(t('perf.libraries.gradeRuleValidation'));
      return;
    }

    if (gradeRuleForm.ranges.some((range) => !range.label.trim() || range.minimum === '' || range.maximum === '')) {
      toast.error(t('perf.libraries.rangeValidation'));
      return;
    }
    if (gradeRuleForm.recommendationRules.some((rule) => rule.label.trim() || rule.condition.trim() || rule.action.trim())) {
      const hasIncompleteRecommendation = gradeRuleForm.recommendationRules.some(
        (rule) => !rule.label.trim() || !rule.condition.trim() || !rule.action.trim()
      );
      if (hasIncompleteRecommendation) {
        toast.error(t('perf.libraries.recommendationValidation'));
        return;
      }
    }

    setSavingGradeRule(true);
    try {
      const payload: PerformanceGradeRulePayload = {
        companyId,
        name: gradeRuleForm.name.trim(),
        code: gradeRuleForm.code.trim().toUpperCase(),
        description: gradeRuleForm.description.trim() || undefined,
        isActive: gradeRuleForm.isActive,
        recommendationRules: gradeRuleForm.recommendationRules
          .filter((rule) => rule.label.trim() || rule.condition.trim() || rule.action.trim())
          .map((rule) => ({
            label: rule.label.trim(),
            condition: rule.condition.trim(),
            action: rule.action.trim(),
            notes: rule.notes?.trim() || undefined,
          })),
        ranges: gradeRuleForm.ranges.map((range, index) => ({
          label: range.label.trim(),
          minimum: Number(range.minimum),
          maximum: Number(range.maximum),
          sortOrder: Number(range.sortOrder || index + 1),
          description: range.description.trim() || undefined,
        })),
      };
      await performanceService.createGradeRule(payload);
      toast.success(t('perf.libraries.gradeRuleCreated'));
      setGradeRuleForm({
        name: '',
        code: '',
        description: '',
        isActive: true,
        recommendationRules: [buildEmptyRecommendationRule()],
        ranges: [buildEmptyRange(1), buildEmptyRange(2)],
      });
      await loadData();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.libraries.gradeRuleCreateFailed')));
    } finally {
      setSavingGradeRule(false);
    }
  }, [companyId, gradeRuleForm, loadData, t]);

  return (
    <div>
      <PageHeader
        title={t('perf.libraries.title')}
        description={t('perf.libraries.description')}
        actions={(
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw size={16} className="mr-2" />
            {t('common.refresh')}
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.libraries.stats.formulas')}</p>
          <p className="mt-2 text-2xl font-semibold">{formulas.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.libraries.stats.indicators')}</p>
          <p className="mt-2 text-2xl font-semibold">{indicators.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t('perf.libraries.stats.gradeRules')}</p>
          <p className="mt-2 text-2xl font-semibold">{gradeRules.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-4 flex items-center gap-2">
                <Calculator size={16} />
                <h2 className="text-sm font-semibold">{t('perf.libraries.newFormula')}</h2>
              </div>
              <div className="space-y-3">
                <Input value={formulaForm.name} onChange={(e) => setFormulaForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('perf.libraries.formulaNamePlaceholder')} />
                <Input value={formulaForm.code} onChange={(e) => setFormulaForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="ACH_PCT" />
                <Select2
                  value={formulaForm.strategy}
                  onValueChange={(value) => setFormulaForm((prev) => ({ ...prev, strategy: value as typeof prev.strategy }))}
                  options={strategyOptions}
                  placeholder={t('perf.libraries.strategyPlaceholder')}
                />
                <Input value={formulaForm.expression} onChange={(e) => setFormulaForm((prev) => ({ ...prev, expression: e.target.value }))} placeholder="(actual/target)*100" />
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select2
                    value={formulaForm.roundingMode}
                    onValueChange={(value) => setFormulaForm((prev) => ({ ...prev, roundingMode: value as typeof prev.roundingMode }))}
                    options={roundingModeOptions}
                    placeholder={t('perf.libraries.roundingPlaceholder')}
                  />
                  <Input type="number" value={formulaForm.roundingPrecision} onChange={(e) => setFormulaForm((prev) => ({ ...prev, roundingPrecision: e.target.value }))} placeholder="2" />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="checkbox" checked={formulaForm.isActive} onChange={(e) => setFormulaForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                    {t('common.active')}
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" value={formulaForm.minimumScore} onChange={(e) => setFormulaForm((prev) => ({ ...prev, minimumScore: e.target.value }))} placeholder={t('perf.libraries.minScorePlaceholder')} />
                  <Input type="number" value={formulaForm.maximumScore} onChange={(e) => setFormulaForm((prev) => ({ ...prev, maximumScore: e.target.value }))} placeholder={t('perf.libraries.maxScorePlaceholder')} />
                </div>
                <textarea
                  value={formulaForm.description}
                  onChange={(e) => setFormulaForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t('perf.libraries.formulaDescriptionPlaceholder')}
                />
                <Button size="sm" className="w-full" onClick={handleCreateFormula} disabled={savingFormula}>
                  {savingFormula ? t('perf.common.saving') : t('perf.libraries.createFormula')}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">{t('perf.libraries.formulaListTitle')}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {formulas.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">{t('perf.libraries.emptyFormulas')}</div>
                ) : (
                  formulas.map((formula) => (
                    <div key={formula.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{formula.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formula.code} • {FORMULA_STRATEGY_LABEL_KEYS[formula.strategy] ? t(FORMULA_STRATEGY_LABEL_KEYS[formula.strategy]) : formula.strategy}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {formula.isActive ? t('perf.common.activeUpper') : t('perf.common.inactiveUpper')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{formula.description || formula.expression || t('perf.libraries.noFormulaDescription')}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>
                          {ROUNDING_MODE_LABEL_KEYS[formula.roundingMode] ? t(ROUNDING_MODE_LABEL_KEYS[formula.roundingMode]) : formula.roundingMode}/{formula.roundingPrecision}
                        </span>
                        <span>{t('perf.libraries.indicatorCount', { count: formula._count?.indicators || 0 })}</span>
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
                <h2 className="text-sm font-semibold">{t('perf.libraries.newIndicator')}</h2>
              </div>
              <div className="space-y-3">
                <Input value={indicatorForm.name} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('perf.libraries.indicatorNamePlaceholder')} />
                <Input value={indicatorForm.code} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="REV_ACH" />
                <Select2 value={indicatorForm.formulaId} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, formulaId: value }))} options={formulaOptions} placeholder={t('perf.libraries.formulaPlaceholder')} />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input value={indicatorForm.category} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, category: e.target.value }))} placeholder={t('perf.libraries.categoryPlaceholder')} />
                  <Input value={indicatorForm.perspective} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, perspective: e.target.value }))} placeholder={t('perf.libraries.perspectivePlaceholder')} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Select2 value={indicatorForm.measurementType} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, measurementType: value as typeof prev.measurementType }))} options={measurementTypeOptions} placeholder={t('perf.libraries.measurementPlaceholder')} />
                  <Select2 value={indicatorForm.targetType} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, targetType: value as typeof prev.targetType }))} options={targetTypeOptions} placeholder={t('perf.libraries.targetTypePlaceholder')} />
                  <Select2 value={indicatorForm.direction} onValueChange={(value) => setIndicatorForm((prev) => ({ ...prev, direction: value as typeof prev.direction }))} options={directionOptions} placeholder={t('perf.libraries.directionPlaceholder')} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Input value={indicatorForm.unit} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, unit: e.target.value }))} placeholder={t('perf.libraries.unitPlaceholder')} />
                  <Input type="number" value={indicatorForm.defaultWeight} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, defaultWeight: e.target.value }))} placeholder={t('perf.libraries.defaultWeightPlaceholder')} />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.isActive} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                    {t('common.active')}
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input type="number" value={indicatorForm.minimumValue} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, minimumValue: e.target.value }))} placeholder={t('perf.libraries.minValuePlaceholder')} />
                  <Input type="number" value={indicatorForm.maximumValue} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, maximumValue: e.target.value }))} placeholder={t('perf.libraries.maxValuePlaceholder')} />
                </div>
                <textarea
                  value={indicatorForm.description}
                  onChange={(e) => setIndicatorForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t('perf.libraries.indicatorDescriptionPlaceholder')}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.evidenceRequired} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, evidenceRequired: e.target.checked }))} />
                    {t('perf.common.evidenceRequired')}
                  </label>
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                    <input type="checkbox" checked={indicatorForm.reviewRequired} onChange={(e) => setIndicatorForm((prev) => ({ ...prev, reviewRequired: e.target.checked }))} />
                    {t('perf.libraries.reviewRequired')}
                  </label>
                </div>
                <Button size="sm" className="w-full" onClick={handleCreateIndicator} disabled={savingIndicator}>
                  {savingIndicator ? t('perf.common.saving') : t('perf.libraries.createIndicator')}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">{t('perf.libraries.indicatorLibraryTitle')}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {indicators.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">{t('perf.libraries.emptyIndicators')}</div>
                ) : (
                  indicators.map((indicator) => (
                    <div key={indicator.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{indicator.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {indicator.code} • {MEASUREMENT_TYPE_LABEL_KEYS[indicator.measurementType] ? t(MEASUREMENT_TYPE_LABEL_KEYS[indicator.measurementType]) : indicator.measurementType}
                          </p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {indicator.isActive ? t('perf.common.activeUpper') : t('perf.common.inactiveUpper')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{indicator.description || t('perf.libraries.noIndicatorDescription')}</p>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                        <span>{indicator.category || '-'}</span>
                        <span>{TARGET_TYPE_LABEL_KEYS[indicator.targetType] ? t(TARGET_TYPE_LABEL_KEYS[indicator.targetType]) : indicator.targetType}</span>
                        <span>{DIRECTION_LABEL_KEYS[indicator.direction] ? t(DIRECTION_LABEL_KEYS[indicator.direction]) : indicator.direction}</span>
                        <span>{indicator.formula?.code || t('perf.libraries.noFormulaCode')}</span>
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
                <h2 className="text-sm font-semibold">{t('perf.libraries.newGradeRule')}</h2>
              </div>
              <div className="space-y-3">
                <Input value={gradeRuleForm.name} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, name: e.target.value }))} placeholder={t('perf.libraries.gradeRuleNamePlaceholder')} />
                <Input value={gradeRuleForm.code} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))} placeholder="GRADE-2026" />
                <textarea
                  value={gradeRuleForm.description}
                  onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
                  placeholder={t('perf.libraries.gradeRuleDescriptionPlaceholder')}
                />
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                  <input type="checkbox" checked={gradeRuleForm.isActive} onChange={(e) => setGradeRuleForm((prev) => ({ ...prev, isActive: e.target.checked }))} />
                  {t('common.active')}
                </label>

                <div className="space-y-3 rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{t('perf.libraries.recommendationRulesTitle')}</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setGradeRuleForm((prev) => ({
                          ...prev,
                          recommendationRules: [...prev.recommendationRules, buildEmptyRecommendationRule()],
                        }))
                      }
                    >
                      <Plus size={14} className="mr-2" />
                      {t('perf.libraries.addRule')}
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {gradeRuleForm.recommendationRules.map((rule, index) => (
                      <div key={`recommendation-${index}`} className="rounded-xl border border-border p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{t('perf.libraries.ruleIndex', { index: index + 1 })}</p>
                          {gradeRuleForm.recommendationRules.length > 1 && (
                            <button
                              type="button"
                              className="text-xs text-destructive"
                              onClick={() =>
                                setGradeRuleForm((prev) => ({
                                  ...prev,
                                  recommendationRules: prev.recommendationRules.filter((_, ruleIndex) => ruleIndex !== index),
                                }))
                              }
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Input value={rule.label} onChange={(e) => updateRecommendationRule(index, 'label', e.target.value)} placeholder={t('perf.libraries.recommendationLabelPlaceholder')} />
                          <Input value={rule.action} onChange={(e) => updateRecommendationRule(index, 'action', e.target.value)} placeholder="PROMOTION" />
                        </div>
                        <Input className="mt-3" value={rule.condition} onChange={(e) => updateRecommendationRule(index, 'condition', e.target.value)} placeholder="Grade=A AND Attendance>95" />
                        <Input className="mt-3" value={rule.notes || ''} onChange={(e) => updateRecommendationRule(index, 'notes', e.target.value)} placeholder={t('perf.libraries.recommendationNotesPlaceholder')} />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {gradeRuleForm.ranges.map((range, index) => (
                    <div key={`${index}-${range.sortOrder}`} className="rounded-xl border border-border p-3">
                      <div className="mb-3 flex items-center justify-between">
                        <p className="text-sm font-medium">{t('perf.libraries.rangeIndex', { index: index + 1 })}</p>
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
                      <Input className="mt-3" value={range.description} onChange={(e) => updateRange(index, 'description', e.target.value)} placeholder={t('perf.libraries.rangeDescriptionPlaceholder')} />
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
                  {t('perf.libraries.addRange')}
                </Button>

                <Button size="sm" className="w-full" onClick={handleCreateGradeRule} disabled={savingGradeRule}>
                  {savingGradeRule ? t('perf.common.saving') : t('perf.libraries.createGradeRule')}
                </Button>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="mb-4 text-sm font-semibold">{t('perf.libraries.gradeRulesTitle')}</h2>
              <div className="grid gap-3 lg:grid-cols-2">
                {gradeRules.length === 0 ? (
                  <div className="col-span-full py-10 text-center text-sm text-muted-foreground">{t('perf.libraries.emptyGradeRules')}</div>
                ) : (
                  gradeRules.map((gradeRule) => (
                    <div key={gradeRule.id} className="rounded-xl border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{gradeRule.name}</p>
                          <p className="text-xs text-muted-foreground">{gradeRule.code}</p>
                        </div>
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {gradeRule.isActive ? t('perf.common.activeUpper') : t('perf.common.inactiveUpper')}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{gradeRule.description || t('perf.libraries.noGradeRuleDescription')}</p>
                      {(gradeRule.recommendationRules ?? []).length > 0 && (
                        <div className="mt-3 space-y-2 rounded-xl bg-muted/40 p-3">
                          <p className="text-xs font-medium text-muted-foreground">{t('perf.libraries.recommendationRulesTitle')}</p>
                          {(gradeRule.recommendationRules ?? []).map((rule, index) => (
                            <div key={`${gradeRule.id}-recommendation-${index}`} className="rounded-lg bg-background px-3 py-2 text-xs">
                              <p className="font-medium">{rule.label} • {rule.action}</p>
                              <p className="mt-1 text-muted-foreground">{rule.condition}</p>
                              {rule.notes && <p className="mt-1 text-muted-foreground">{rule.notes}</p>}
                            </div>
                          ))}
                        </div>
                      )}
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
