import { useState, useEffect } from 'react';
import { BookOpen, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { employeeService, type EmployeeTraining } from '@/services/employee.service';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { formatDate } from '@/utils/format';

interface TrainingTabProps {
  employeeId: string;
}

const TRAINING_TYPE_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'INTERNAL', labelKey: 'wf.training.type.internal' },
  { value: 'EXTERNAL', labelKey: 'wf.training.type.external' },
  { value: 'CERTIFICATION', labelKey: 'wf.training.type.certification' },
  { value: 'SEMINAR', labelKey: 'wf.training.type.seminar' },
  { value: 'WORKSHOP', labelKey: 'wf.training.type.workshop' },
  { value: 'OTHER', labelKey: 'wf.training.type.other' },
];

interface FormData {
  trainingName: string;
  organizer: string;
  trainingType: string;
  startDate: string;
  endDate: string;
  duration: string;
  description: string;
  certificateUrl: string;
  notes: string;
}

const INITIAL_FORM_DATA: FormData = {
  trainingName: '',
  organizer: '',
  trainingType: '',
  startDate: '',
  endDate: '',
  duration: '',
  description: '',
  certificateUrl: '',
  notes: '',
};

export default function TrainingTab({ employeeId }: TrainingTabProps) {
  const { t } = useI18n();
  const [data, setData] = useState<EmployeeTraining[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeTraining | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchData();
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  async function fetchData() {
    setLoading(true);
    try {
      const result = await employeeService.getTrainings(employeeId);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch trainings:', error);
      toast.error(t('wf.training.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
    setDialogOpen(true);
  }

  function handleOpenEdit(item: EmployeeTraining) {
    setEditingItem(item);
    setForm({
      trainingName: item.trainingName,
      organizer: item.organizer || '',
      trainingType: item.trainingType || '',
      startDate: item.startDate ? item.startDate.slice(0, 10) : '',
      endDate: item.endDate ? item.endDate.slice(0, 10) : '',
      duration: item.duration || '',
      description: item.description || '',
      certificateUrl: item.certificateUrl || '',
      notes: item.notes || '',
    });
    setDialogOpen(true);
  }

  function handleCloseDialog() {
    if (saving) return;
    setDialogOpen(false);
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
  }

  async function handleSave() {
    if (!form.trainingName.trim()) {
      toast.error(t('wf.training.validation.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EmployeeTraining> = {
        trainingName: form.trainingName.trim(),
        organizer: form.organizer.trim() || undefined,
        trainingType: form.trainingType || undefined,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        duration: form.duration.trim() || undefined,
        description: form.description.trim() || undefined,
        certificateUrl: form.certificateUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateTraining(employeeId, editingItem.id, payload);
        toast.success(t('wf.training.toast.updateSuccess'));
      } else {
        await employeeService.createTraining(employeeId, payload);
        toast.success(t('wf.training.toast.createSuccess'));
      }

      handleCloseDialog();
      await fetchData();
    } catch (error) {
      console.error('Failed to save training:', error);
      toast.error(t('wf.training.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeTraining) {
    const confirmed = await popup.confirm({
      title: t('wf.training.confirm.title'),
      description: t('wf.training.confirm.description', { name: item.trainingName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteTraining(employeeId, item.id);
      toast.success(t('wf.training.toast.deleteSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Failed to delete training:', error);
      toast.error(t('wf.training.toast.deleteFailed'));
    }
  }

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-4 h-6 w-48 animate-pulse rounded bg-muted" />
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="mb-4 rounded-lg border border-border p-4">
            <div className="mb-2 h-5 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div className="flex items-center gap-2">
          <BookOpen size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t('wf.training.title')}</h3>
        </div>
        <Button size="sm" onClick={handleOpenAdd}>
          <Plus size={16} className="mr-1" />
          {t('wf.common.add')}
        </Button>
      </div>

      {/* Content */}
      <div className="p-6">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <BookOpen size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('wf.training.empty.title')}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenAdd}>
              <Plus size={16} className="mr-1" />
              {t('wf.training.empty.add')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{item.trainingName}</p>
                    {item.trainingType && (
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                        {(() => {
                          const typeOption = TRAINING_TYPE_OPTIONS.find((o) => o.value === item.trainingType);
                          return typeOption ? t(typeOption.labelKey) : item.trainingType;
                        })()}
                      </span>
                    )}
                  </div>
                  {item.organizer && (
                    <p className="text-sm text-muted-foreground">{item.organizer}</p>
                  )}
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {item.startDate && (
                      <span>{t('wf.training.startedAt', { date: formatDate(item.startDate) })}</span>
                    )}
                    {item.endDate && (
                      <span>{t('wf.training.endedAt', { date: formatDate(item.endDate) })}</span>
                    )}
                    {item.duration && (
                      <span>{t('wf.training.durationValue', { duration: item.duration })}</span>
                    )}
                  </div>
                  {item.description && (
                    <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{item.description}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(item)}
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={16} className="text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Dialog Overlay */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            {/* Dialog Header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h4 className="text-base font-semibold text-foreground">
                {editingItem ? t('wf.training.dialog.editTitle') : t('wf.training.dialog.addTitle')}
              </h4>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog} disabled={saving}>
                &times;
              </Button>
            </div>

            {/* Dialog Body */}
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
              {/* trainingName */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t('wf.training.fields.name')} <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.trainingName}
                  onChange={(e) => setForm((prev) => ({ ...prev, trainingName: e.target.value }))}
                  placeholder={t('wf.training.fields.namePlaceholder')}
                />
              </div>

              {/* organizer */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.training.fields.organizer')}</label>
                <Input
                  value={form.organizer}
                  onChange={(e) => setForm((prev) => ({ ...prev, organizer: e.target.value }))}
                  placeholder={t('wf.training.fields.organizerPlaceholder')}
                />
              </div>

              {/* trainingType */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.training.fields.type')}</label>
                <Select2
                  value={form.trainingType}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, trainingType: value }))}
                  options={TRAINING_TYPE_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  placeholder={t('wf.training.fields.selectType')}
                />
              </div>

              {/* startDate / endDate */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('wf.common.startDate')}</label>
                  <Input
                    type="date"
                    value={form.startDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, startDate: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">{t('wf.common.endDate')}</label>
                  <Input
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* duration */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.training.fields.duration')}</label>
                <Input
                  value={form.duration}
                  onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                  placeholder={t('wf.training.fields.durationPlaceholder')}
                />
              </div>

              {/* description */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.common.description')}</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  placeholder={t('wf.training.fields.descriptionPlaceholder')}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>

              {/* certificateUrl */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.training.fields.certificateUrl')}</label>
                <Input
                  value={form.certificateUrl}
                  onChange={(e) => setForm((prev) => ({ ...prev, certificateUrl: e.target.value }))}
                  placeholder="https://example.com/sertifikat"
                />
              </div>

              {/* notes */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.common.notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder={t('wf.common.notesPlaceholder')}
                  rows={3}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>

            {/* Dialog Footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={handleCloseDialog} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 size={16} className="mr-1 animate-spin" />}
                {editingItem ? t('common.save') : t('wf.common.add')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
