import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { Paperclip, Pencil, Trash2, Plus, Loader2, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2, Select2Option } from '@/components/ui/select2';
import { employeeService, EmployeeAttachment } from '@/services/employee.service';
import { popup } from '@/stores/popup.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'FAMILY',
  'EDUCATION',
  'EMERGENCY_CONTACT',
  'TRAINING',
  'SKILL',
  'EXPERIENCE',
  'OTHER',
] as const;

const CATEGORY_LABEL_KEYS: Record<string, TranslationKey> = {
  FAMILY: 'wf.attachment.category.family',
  EDUCATION: 'wf.attachment.category.education',
  EMERGENCY_CONTACT: 'wf.attachment.category.emergencyContact',
  TRAINING: 'wf.attachment.category.training',
  SKILL: 'wf.attachment.category.skill',
  EXPERIENCE: 'wf.attachment.category.experience',
  OTHER: 'wf.attachment.category.other',
};

const CATEGORY_COLORS: Record<string, string> = {
  FAMILY: 'bg-blue-100 text-blue-800',
  EDUCATION: 'bg-green-100 text-green-800',
  EMERGENCY_CONTACT: 'bg-red-100 text-red-800',
  TRAINING: 'bg-purple-100 text-purple-800',
  SKILL: 'bg-amber-100 text-amber-800',
  EXPERIENCE: 'bg-cyan-100 text-cyan-800',
  OTHER: 'bg-slate-100 text-slate-800',
};

function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.OTHER;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null) return '-';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ---------------------------------------------------------------------------
// Empty form state
// ---------------------------------------------------------------------------

const EMPTY_FORM = {
  category: '',
  fileName: '',
  fileUrl: '',
  originalName: '',
  description: '',
};

type FormState = typeof EMPTY_FORM;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AttachmentTabProps {
  employeeId: string;
}

export function AttachmentTab({ employeeId }: AttachmentTabProps) {
  const { t } = useI18n();
  const [data, setData] = useState<EmployeeAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeAttachment | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  const categoryOptions: Select2Option[] = CATEGORIES.map((category) => ({
    value: category,
    label: t(CATEGORY_LABEL_KEYS[category]),
  }));

  const categoryFilterOptions: Select2Option[] = [
    { value: '', label: t('wf.attachment.allCategories') },
    ...categoryOptions,
  ];

  function getCategoryLabel(category: string): string {
    const labelKey = CATEGORY_LABEL_KEYS[category];
    return labelKey ? t(labelKey) : category.replace(/_/g, ' ');
  }

  // -----------------------------------------------------------------------
  // Data fetching
  // -----------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await employeeService.getAttachments(
        employeeId,
        filterCategory || undefined,
      );
      setData(result);
    } catch {
      toast.error(t('wf.attachment.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, filterCategory, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Form helpers
  // -----------------------------------------------------------------------

  function resetForm() {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditingItem(null);
  }

  function openAddDialog() {
    resetForm();
    setDialogOpen(true);
  }

  function openEditDialog(item: EmployeeAttachment) {
    setEditingItem(item);
    setForm({
      category: item.category,
      fileName: item.fileName,
      fileUrl: item.fileUrl,
      originalName: item.originalName || '',
      description: item.description || '',
    });
    setFormErrors({});
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    resetForm();
  }

  function handleFormChange(
    field: keyof FormState,
    value: string,
  ) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateForm(): boolean {
    const errors: Partial<Record<keyof FormState, string>> = {};
    if (!form.category) errors.category = t('wf.attachment.validation.categoryRequired');
    if (!form.fileName.trim()) errors.fileName = t('wf.attachment.validation.fileNameRequired');
    if (!form.fileUrl.trim()) {
      errors.fileUrl = t('wf.attachment.validation.fileUrlRequired');
    } else if (!/^https?:\/\/.+/.test(form.fileUrl.trim())) {
      errors.fileUrl = t('wf.attachment.validation.fileUrlInvalid');
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  // -----------------------------------------------------------------------
  // CRUD actions
  // -----------------------------------------------------------------------

  async function handleSave() {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const payload = {
        category: form.category,
        fileName: form.fileName.trim(),
        fileUrl: form.fileUrl.trim(),
        originalName: form.originalName.trim() || undefined,
        description: form.description.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateAttachment(employeeId, editingItem.id, payload);
        toast.success(t('wf.attachment.toast.updateSuccess'));
      } else {
        await employeeService.createAttachment(employeeId, payload);
        toast.success(t('wf.attachment.toast.createSuccess'));
      }

      closeDialog();
      await fetchData();
    } catch {
      toast.error(editingItem ? t('wf.attachment.toast.updateFailed') : t('wf.attachment.toast.createFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeAttachment) {
    const confirmed = await popup.confirm({
      title: t('wf.attachment.confirm.title'),
      description: t('wf.attachment.confirm.description', { name: item.fileName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteAttachment(employeeId, item.id);
      toast.success(t('wf.attachment.toast.deleteSuccess'));
      await fetchData();
    } catch {
      toast.error(t('wf.attachment.toast.deleteFailed'));
    }
  }

  // -----------------------------------------------------------------------
  // Render: skeleton
  // -----------------------------------------------------------------------

  if (loading) {
    return (
      <section className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="h-5 w-32 animate-pulse rounded bg-muted" />
          <div className="h-9 w-28 animate-pulse rounded-lg bg-muted" />
        </div>
        <div className="space-y-4 p-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </section>
    );
  }

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <>
      <section className="rounded-xl border border-border bg-card shadow-sm">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <h3 className="text-base font-semibold text-foreground">{t('wf.attachment.title')}</h3>
            <div className="w-44">
              <Select2
                value={filterCategory}
                onValueChange={setFilterCategory}
                options={categoryFilterOptions}
                placeholder={t('wf.attachment.filterPlaceholder')}
              />
            </div>
          </div>
          <Button onClick={openAddDialog} size="sm">
            <Plus size={16} className="mr-1.5" />
            {t('wf.attachment.add')}
          </Button>
        </div>

        {/* Body */}
        <div className="p-6">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Paperclip size={40} className="mb-3 opacity-40" />
              <p className="text-sm">{t('wf.attachment.empty')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-lg border border-border bg-background p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  {/* Left: info */}
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <FileText size={16} className="shrink-0 text-muted-foreground" />
                      <span className="truncate text-sm font-medium text-foreground">
                        {item.fileName}
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                          getCategoryColor(item.category),
                        )}
                      >
                        {getCategoryLabel(item.category)}
                      </span>
                    </div>

                    {item.originalName && (
                      <p className="truncate text-xs text-muted-foreground">
                        {t('wf.attachment.originalName', { name: item.originalName })}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{t('wf.attachment.size', { size: formatFileSize(item.fileSize) })}</span>
                      {item.createdAt && (
                        <span>{t('wf.attachment.addedAt', { date: formatDate(item.createdAt) })}</span>
                      )}
                    </div>

                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>

                  {/* Right: actions */}
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('wf.attachment.download')}
                      onClick={() => window.open(item.fileUrl, '_blank', 'noopener,noreferrer')}
                    >
                      <Download size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('common.edit')}
                      onClick={() => openEditDialog(item)}
                    >
                      <Pencil size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={t('common.delete')}
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
      </section>

      {/* ----------------------------------------------------------------- */}
      {/* Modal / Dialog for Add / Edit                                       */}
      {/* ----------------------------------------------------------------- */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h4 className="text-base font-semibold text-foreground">
                {editingItem ? t('wf.attachment.dialog.editTitle') : t('wf.attachment.dialog.addTitle')}
              </h4>
              <button
                type="button"
                onClick={closeDialog}
                disabled={saving}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              >
                <span className="sr-only">{t('wf.common.close')}</span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* Modal body */}
            <div className="space-y-4 px-6 py-4">
              {/* Category */}
              <div className="space-y-1.5">
                <Label htmlFor="attachment-category">
                  {t('wf.common.category')} <span className="text-destructive">*</span>
                </Label>
                <Select2
                  value={form.category}
                  onValueChange={(val) => handleFormChange('category', val)}
                  options={categoryOptions}
                  placeholder={t('wf.common.selectCategory')}
                />
                {formErrors.category && (
                  <p className="text-xs text-destructive">{formErrors.category}</p>
                )}
              </div>

              {/* fileName */}
              <div className="space-y-1.5">
                <Label htmlFor="attachment-filename">
                  {t('wf.attachment.fields.fileName')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="attachment-filename"
                  value={form.fileName}
                  onChange={(e) => handleFormChange('fileName', e.target.value)}
                  placeholder={t('wf.attachment.fields.fileNamePlaceholder')}
                />
                {formErrors.fileName && (
                  <p className="text-xs text-destructive">{formErrors.fileName}</p>
                )}
              </div>

              {/* fileUrl */}
              <div className="space-y-1.5">
                <Label htmlFor="attachment-fileurl">
                  {t('wf.attachment.fields.fileUrl')} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="attachment-fileurl"
                  type="url"
                  value={form.fileUrl}
                  onChange={(e) => handleFormChange('fileUrl', e.target.value)}
                  placeholder="https://example.com/storage/file.pdf"
                />
                {formErrors.fileUrl && (
                  <p className="text-xs text-destructive">{formErrors.fileUrl}</p>
                )}
              </div>

              {/* originalName */}
              <div className="space-y-1.5">
                <Label htmlFor="attachment-originalname">{t('wf.attachment.fields.originalName')}</Label>
                <Input
                  id="attachment-originalname"
                  value={form.originalName}
                  onChange={(e) => handleFormChange('originalName', e.target.value)}
                  placeholder={t('wf.attachment.fields.originalNamePlaceholder')}
                />
              </div>

              {/* description */}
              <div className="space-y-1.5">
                <Label htmlFor="attachment-description">{t('wf.common.description')}</Label>
                <textarea
                  id="attachment-description"
                  value={form.description}
                  onChange={(e) => handleFormChange('description', e.target.value)}
                  placeholder={t('wf.attachment.fields.descriptionPlaceholder')}
                  rows={3}
                  className={cn(
                    'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors',
                    'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                  )}
                />
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={closeDialog} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 size={16} className="mr-1.5 animate-spin" />}
                {editingItem ? t('wf.common.saveChanges') : t('wf.common.add')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
