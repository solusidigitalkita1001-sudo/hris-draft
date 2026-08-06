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

const DURATION_UNIT_OPTIONS = [
  { value: 'HOUR', label: 'Hour' },
  { value: 'DAY', label: 'Day' },
  { value: 'WEEK', label: 'Week' },
  { value: 'MONTH', label: 'Month' },
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
      { value: '', label: 'Tanpa kategori' },
      ...categories.map((category) => ({ value: category.id, label: `${category.name} • ${category.code}` })),
    ],
    [categories]
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
        toast.error('Gagal memuat kategori training');
      }
    };

    void loadCategories();
  }, [companyId]);

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
        toast.error('Gagal memuat detail course');
      } finally {
        setLoading(false);
      }
    };

    void loadCourse();
  }, [id]);

  const handleSubmit = useCallback(async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!form.title.trim()) {
      toast.error('Title course wajib diisi');
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
        toast.success('Course berhasil diperbarui');
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
      toast.success('Course berhasil dibuat');
      navigate(`/lms/courses/${created.id}`);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan course');
    } finally {
      setSaving(false);
    }
  }, [companyId, form, id, isEditMode, navigate]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title={isEditMode ? 'Edit Course' : 'New Course'}
        description={isEditMode ? `Perbarui detail course ${course?.title || ''}` : 'Buat course training baru untuk LMS perusahaan.'}
        actions={(
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(isEditMode && id ? `/lms/courses/${id}` : '/lms')}
          >
            <ArrowLeft size={16} className="mr-2" />
            Back
          </Button>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Leadership Essentials"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Code</label>
            <Input
              value={isEditMode ? form.code : ''}
              placeholder="Akan dibuat otomatis oleh sistem"
              disabled
            />
            {!isEditMode ? <p className="text-xs text-muted-foreground">Code course digenerate otomatis saat create.</p> : null}
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Category</label>
            <Select2
              value={form.categoryId}
              onValueChange={(value) => setForm((prev) => ({ ...prev, categoryId: value }))}
              options={categoryOptions}
              placeholder="Pilih kategori"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Provider</label>
            <Input
              value={form.provider}
              onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))}
              placeholder="Internal HR Academy"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration</label>
            <Input
              type="number"
              min={1}
              value={form.duration}
              onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
              placeholder="8"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Duration Unit</label>
            <Select2
              value={form.durationUnit}
              onValueChange={(value) => setForm((prev) => ({ ...prev, durationUnit: value }))}
              options={DURATION_UNIT_OPTIONS}
              placeholder="Pilih durasi"
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-32 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Deskripsi course, objective, dan ringkasan materi."
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
              <p className="text-sm font-medium">Mandatory course</p>
              <p className="text-xs text-muted-foreground">Tandai jika course wajib diikuti employee.</p>
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
                <p className="text-sm font-medium">Course active</p>
                <p className="text-xs text-muted-foreground">Nonaktifkan jika course sudah tidak dibuka.</p>
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
            Batal
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Menyimpan...' : isEditMode ? 'Simpan Perubahan' : 'Buat Course'}
          </Button>
        </div>
      </div>
    </div>
  );
}
