import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  trainingService,
  type TrainingCategory,
  type TrainingCourse,
  type TrainingCoursePayload,
  type UpdateTrainingCoursePayload,
} from '@/services/training.service';
import { useCompanyStore } from '@/stores/company.store';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const DURATION_UNIT_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'HOUR', labelKey: 'ops.training.durationUnits.hour' },
  { value: 'DAY', labelKey: 'ops.training.durationUnits.day' },
  { value: 'WEEK', labelKey: 'ops.training.durationUnits.week' },
  { value: 'MONTH', labelKey: 'ops.training.durationUnits.month' },
];

interface CourseFormState {
  categoryId: string;
  title: string;
  code: string;
  description: string;
  duration: string;
  durationUnit: string;
  provider: string;
  isMandatory: boolean;
  isActive: boolean;
}

function getInitialForm(): CourseFormState {
  return {
    categoryId: '',
    title: '',
    code: '',
    description: '',
    duration: '',
    durationUnit: 'HOUR',
    provider: '',
    isMandatory: false,
    isActive: true,
  };
}

export function CourseFormPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const isEditMode = Boolean(id);

  const [categories, setCategories] = useState<TrainingCategory[]>([]);
  const [course, setCourse] = useState<TrainingCourse | null>(null);
  const [form, setForm] = useState<CourseFormState>(getInitialForm);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  const categoryOptions = useMemo(
    () => [
      { value: '', label: t('ops.training.form.noCategory') },
      ...categories.map((category) => ({ value: category.id, label: `${category.name} • ${category.code}` })),
    ],
    [categories, t]
  );

  const durationUnitOptions = useMemo(
    () => DURATION_UNIT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t]
  );

  useEffect(() => {
    if (!companyId) {
      setCategories([]);
      return;
    }

    const loadCategories = async () => {
      try {
        const data = await trainingService.getCategories(companyId);
        setCategories(data);
      } catch (error) {
        console.error(error);
        toast.error(t('ops.training.toast.loadCategoriesFailed'));
      }
    };

    void loadCategories();
  }, [companyId, t]);

  useEffect(() => {
    if (!id) {
      setCourse(null);
      setForm(getInitialForm());
      setLoading(false);
      return;
    }

    const loadCourse = async () => {
      setLoading(true);
      try {
        const data = await trainingService.getCourse(id);
        setCourse(data);
        setForm({
          categoryId: data.category?.id || '',
          title: data.title,
          code: data.code,
          description: data.description || '',
          duration: data.duration ? String(data.duration) : '',
          durationUnit: data.durationUnit || 'HOUR',
          provider: data.provider || '',
          isMandatory: data.isMandatory,
          isActive: data.isActive,
        });
      } catch (error) {
        console.error(error);
        toast.error(t('ops.training.toast.loadCourseFailed'));
      } finally {
        setLoading(false);
      }
    };

    void loadCourse();
  }, [id, t]);

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error(t('ops.training.toast.noActiveCompany'));
      return;
    }

    if (!form.title.trim()) {
      toast.error(t('ops.training.toast.titleRequired'));
      return;
    }

    setSaving(true);
    try {
      if (isEditMode && id) {
        const payload: UpdateTrainingCoursePayload = {
          categoryId: form.categoryId || null,
          title: form.title.trim(),
          description: form.description.trim() || undefined,
          duration: form.duration ? Number(form.duration) : undefined,
          durationUnit: form.duration ? form.durationUnit : undefined,
          provider: form.provider.trim() || undefined,
          isMandatory: form.isMandatory,
          isActive: form.isActive,
        };
        const updated = await trainingService.updateCourse(id, payload);
        toast.success(t('ops.training.toast.updateSuccess'));
        navigate(`/lms/courses/${updated.id}`);
        return;
      }

      const payload: TrainingCoursePayload = {
        companyId,
        categoryId: form.categoryId || undefined,
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        duration: form.duration ? Number(form.duration) : undefined,
        durationUnit: form.duration ? form.durationUnit : undefined,
        provider: form.provider.trim() || undefined,
        isMandatory: form.isMandatory,
      };
      const created = await trainingService.createCourse(payload);
      toast.success(t('ops.training.toast.createSuccess'));
      navigate(`/lms/courses/${created.id}`);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('ops.training.toast.saveFailed')));
    } finally {
      setSaving(false);
    }
  }, [companyId, form, id, isEditMode, navigate, t]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={isEditMode ? t('ops.training.editCourse') : t('ops.training.newCourse')}
        description={isEditMode ? t('ops.training.form.editDescription', { title: course?.title || '' }) : t('ops.training.form.createDescription')}
        actions={(
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(isEditMode && id ? `/lms/courses/${id}` : '/lms')}
          >
            <ArrowLeft size={16} className="mr-2" />
            {t('ops.training.back')}
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.title')}</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder={t('ops.training.form.titlePlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.code')}</label>
            <Input
              value={isEditMode ? form.code : ''}
              placeholder={t('ops.training.form.codePlaceholder')}
              disabled
            />
            {!isEditMode ? <p className="text-xs text-muted-foreground">{t('ops.training.form.codeHint')}</p> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.category')}</label>
            <Select2
              value={form.categoryId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
              options={categoryOptions}
              placeholder={t('ops.training.form.categoryPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.provider')}</label>
            <Input
              value={form.provider}
              onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
              placeholder={t('ops.training.form.providerPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.duration')}</label>
            <Input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
              placeholder="8"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('ops.training.fields.durationUnit')}</label>
            <Select2
              value={form.durationUnit}
              onValueChange={(value) => setForm((prev) => ({ ...prev, durationUnit: value }))}
              options={durationUnitOptions}
              placeholder={t('ops.training.form.durationUnitPlaceholder')}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">{t('ops.training.fields.description')}</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder={t('ops.training.form.descriptionPlaceholder')}
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
            <input
              type="checkbox"
              checked={form.isMandatory}
              onChange={(e) => setForm((prev) => ({ ...prev, isMandatory: e.target.checked }))}
            />
            <div>
              <p className="text-sm font-medium">{t('ops.training.form.mandatoryLabel')}</p>
              <p className="text-xs text-muted-foreground">{t('ops.training.form.mandatoryHint')}</p>
            </div>
          </label>

          {isEditMode && (
            <label className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <div>
                <p className="text-sm font-medium">{t('ops.training.form.activeLabel')}</p>
                <p className="text-xs text-muted-foreground">{t('ops.training.form.activeHint')}</p>
              </div>
            </label>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(isEditMode && id ? `/lms/courses/${id}` : '/lms')}
          >
            {t('common.cancel')}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? t('ops.training.form.saving') : isEditMode ? t('ops.training.form.saveChanges') : t('ops.training.form.createCourse')}
          </Button>
        </div>
      </div>
    </div>
  );
}
