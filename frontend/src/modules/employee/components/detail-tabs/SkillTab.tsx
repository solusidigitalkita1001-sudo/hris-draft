import { useState, useEffect } from 'react';
import { Award, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { employeeService, type EmployeeSkill } from '@/services/employee.service';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

interface SkillTabProps {
  employeeId: string;
}

const CATEGORY_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'TECHNICAL', labelKey: 'wf.skill.category.technical' },
  { value: 'SOFT_SKILL', labelKey: 'wf.skill.category.softSkill' },
  { value: 'LANGUAGE', labelKey: 'wf.skill.category.language' },
  { value: 'MANAGEMENT', labelKey: 'wf.skill.category.management' },
  { value: 'OTHER', labelKey: 'wf.skill.category.other' },
];

const PROFICIENCY_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'BEGINNER', labelKey: 'wf.skill.proficiency.beginner' },
  { value: 'INTERMEDIATE', labelKey: 'wf.skill.proficiency.intermediate' },
  { value: 'ADVANCED', labelKey: 'wf.skill.proficiency.advanced' },
  { value: 'EXPERT', labelKey: 'wf.skill.proficiency.expert' },
];

const PROFICIENCY_COLORS: Record<string, string> = {
  BEGINNER: 'bg-blue-100 text-blue-700',
  INTERMEDIATE: 'bg-green-100 text-green-700',
  ADVANCED: 'bg-orange-100 text-orange-700',
  EXPERT: 'bg-purple-100 text-purple-700',
};

const YES_NO_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'true', labelKey: 'wf.common.yes' },
  { value: 'false', labelKey: 'wf.common.no' },
];

interface FormData {
  skillName: string;
  category: string;
  proficiencyLevel: string;
  yearsOfExperience: string;
  lastUsedDate: string;
  isCertified: string;
  notes: string;
}

const INITIAL_FORM_DATA: FormData = {
  skillName: '',
  category: '',
  proficiencyLevel: '',
  yearsOfExperience: '',
  lastUsedDate: '',
  isCertified: '',
  notes: '',
};

export default function SkillTab({ employeeId }: SkillTabProps) {
  const { t } = useI18n();
  const [data, setData] = useState<EmployeeSkill[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeSkill | null>(null);
  const [form, setForm] = useState<FormData>(INITIAL_FORM_DATA);

  useEffect(() => {
    fetchData();
  }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  async function fetchData() {
    setLoading(true);
    try {
      const result = await employeeService.getSkills(employeeId);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch skills:', error);
      toast.error(t('wf.skill.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }

  function handleOpenAdd() {
    setEditingItem(null);
    setForm(INITIAL_FORM_DATA);
    setDialogOpen(true);
  }

  function handleOpenEdit(item: EmployeeSkill) {
    setEditingItem(item);
    setForm({
      skillName: item.skillName,
      category: item.category || '',
      proficiencyLevel: item.proficiencyLevel || '',
      yearsOfExperience: item.yearsOfExperience != null ? String(item.yearsOfExperience) : '',
      lastUsedDate: item.lastUsedDate ? item.lastUsedDate.slice(0, 10) : '',
      isCertified: item.isCertified != null ? String(item.isCertified) : '',
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
    if (!form.skillName.trim()) {
      toast.error(t('wf.skill.validation.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload: Partial<EmployeeSkill> = {
        skillName: form.skillName.trim(),
        category: form.category || undefined,
        proficiencyLevel: form.proficiencyLevel || undefined,
        yearsOfExperience: form.yearsOfExperience ? parseFloat(form.yearsOfExperience) : undefined,
        lastUsedDate: form.lastUsedDate || undefined,
        isCertified: form.isCertified ? form.isCertified === 'true' : undefined,
        notes: form.notes.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateSkill(employeeId, editingItem.id, payload);
        toast.success(t('wf.skill.toast.updateSuccess'));
      } else {
        await employeeService.createSkill(employeeId, payload);
        toast.success(t('wf.skill.toast.createSuccess'));
      }

      handleCloseDialog();
      await fetchData();
    } catch (error) {
      console.error('Failed to save skill:', error);
      toast.error(t('wf.skill.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeSkill) {
    const confirmed = await popup.confirm({
      title: t('wf.skill.confirm.title'),
      description: t('wf.skill.confirm.description', { name: item.skillName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteSkill(employeeId, item.id);
      toast.success(t('wf.skill.toast.deleteSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Failed to delete skill:', error);
      toast.error(t('wf.skill.toast.deleteFailed'));
    }
  }

  function getProficiencyBadge(level?: string) {
    if (!level) return null;
    const colorClass = PROFICIENCY_COLORS[level] || 'bg-gray-100 text-gray-700';
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}>
        {(() => {
          const option = PROFICIENCY_OPTIONS.find((o) => o.value === level);
          return option ? t(option.labelKey) : level;
        })()}
      </span>
    );
  }

  function getCategoryBadge(category?: string) {
    if (!category) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
        {(() => {
          const option = CATEGORY_OPTIONS.find((o) => o.value === category);
          return option ? t(option.labelKey) : category;
        })()}
      </span>
    );
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
          <Award size={20} className="text-primary" />
          <h3 className="text-base font-semibold text-foreground">{t('wf.skill.title')}</h3>
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
              <Award size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t('wf.skill.empty.title')}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={handleOpenAdd}>
              <Plus size={16} className="mr-1" />
              {t('wf.skill.empty.add')}
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
                    <p className="font-medium text-foreground">{item.skillName}</p>
                    {getCategoryBadge(item.category)}
                    {getProficiencyBadge(item.proficiencyLevel)}
                  </div>
                  {item.yearsOfExperience != null && (
                    <p className="text-sm text-muted-foreground">
                      {t('wf.skill.experienceYears', { years: item.yearsOfExperience })}
                    </p>
                  )}
                  {item.isCertified != null && (
                    <p className="text-xs text-muted-foreground">
                      {t('wf.skill.certified')}: {item.isCertified ? t('wf.common.yes') : t('wf.common.no')}
                    </p>
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
                {editingItem ? t('wf.skill.dialog.editTitle') : t('wf.skill.dialog.addTitle')}
              </h4>
              <Button variant="ghost" size="icon" onClick={handleCloseDialog} disabled={saving}>
                &times;
              </Button>
            </div>

            {/* Dialog Body */}
            <div className="max-h-[70vh] space-y-4 overflow-y-auto px-6 py-4">
              {/* skillName */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  {t('wf.skill.fields.name')} <span className="text-destructive">*</span>
                </label>
                <Input
                  value={form.skillName}
                  onChange={(e) => setForm((prev) => ({ ...prev, skillName: e.target.value }))}
                  placeholder={t('wf.skill.fields.namePlaceholder')}
                />
              </div>

              {/* category */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.common.category')}</label>
                <Select2
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                  options={CATEGORY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  placeholder={t('wf.common.selectCategory')}
                />
              </div>

              {/* proficiencyLevel */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.skill.fields.proficiency')}</label>
                <Select2
                  value={form.proficiencyLevel}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, proficiencyLevel: value }))}
                  options={PROFICIENCY_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  placeholder={t('wf.skill.fields.selectProficiency')}
                />
              </div>

              {/* yearsOfExperience */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.skill.fields.years')}</label>
                <Input
                  type="number"
                  step="0.5"
                  value={form.yearsOfExperience}
                  onChange={(e) => setForm((prev) => ({ ...prev, yearsOfExperience: e.target.value }))}
                  placeholder={t('wf.skill.fields.yearsPlaceholder')}
                />
              </div>

              {/* lastUsedDate */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.skill.fields.lastUsed')}</label>
                <Input
                  type="date"
                  value={form.lastUsedDate}
                  onChange={(e) => setForm((prev) => ({ ...prev, lastUsedDate: e.target.value }))}
                />
              </div>

              {/* isCertified */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{t('wf.skill.certified')}</label>
                <Select2
                  value={form.isCertified}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, isCertified: value }))}
                  options={YES_NO_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                  placeholder={t('wf.common.select')}
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
