import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { employeeService, type EmployeeFamily } from '@/services/employee.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  UserRound,
  Hash,
  MapPin,
  CalendarDays,
  Phone,
  BookOpen,
  Briefcase,
  Home,
  Heart,
  ShieldCheck,
  GraduationCap,
  HeartHandshake,
} from 'lucide-react';
import { formatDate } from '@/utils/format';

const RELATIONSHIP_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'SPOUSE', labelKey: 'wf.family.relationship.spouse' },
  { value: 'CHILD', labelKey: 'wf.family.relationship.child' },
  { value: 'PARENT', labelKey: 'wf.family.relationship.parent' },
  { value: 'SIBLING', labelKey: 'wf.family.relationship.sibling' },
  { value: 'OTHER', labelKey: 'wf.family.relationship.other' },
];

const GENDER_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'MALE', labelKey: 'wf.common.gender.male' },
  { value: 'FEMALE', labelKey: 'wf.common.gender.female' },
];

const YES_NO_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'yes', labelKey: 'wf.common.yes' },
  { value: 'no', labelKey: 'wf.common.no' },
];

const MARITAL_STATUS_OPTIONS: Array<{ value: string; labelKey: TranslationKey }> = [
  { value: 'MARRIED', labelKey: 'wf.common.marital.married' },
  { value: 'SINGLE', labelKey: 'wf.common.marital.single' },
  { value: 'DIVORCED', labelKey: 'wf.common.marital.divorced' },
  { value: 'WIDOWED', labelKey: 'wf.common.marital.widowed' },
];

const EDUCATION_LEVEL_OPTIONS = [
  { value: 'SD', label: 'SD' },
  { value: 'SMP', label: 'SMP' },
  { value: 'SMA', label: 'SMA/SMK' },
  { value: 'D1', label: 'D1' },
  { value: 'D2', label: 'D2' },
  { value: 'D3', label: 'D3' },
  { value: 'S1', label: 'S1' },
  { value: 'S2', label: 'S2' },
  { value: 'S3', label: 'S3' },
];

interface FamilyFormData {
  fullName: string;
  relationship: string;
  idNumber: string;
  placeOfBirth: string;
  dateOfBirth: string;
  gender: string;
  religion: string;
  occupation: string;
  phone: string;
  address: string;
  isEmergencyContact: string;
  isDependent: string;
  maritalStatus: string;
  educationLevel: string;
}

const EMPTY_FORM: FamilyFormData = {
  fullName: '',
  relationship: '',
  idNumber: '',
  placeOfBirth: '',
  dateOfBirth: '',
  gender: '',
  religion: '',
  occupation: '',
  phone: '',
  address: '',
  isEmergencyContact: 'no',
  isDependent: 'no',
  maritalStatus: '',
  educationLevel: '',
};

function familyToForm(family: EmployeeFamily): FamilyFormData {
  return {
    fullName: family.fullName,
    relationship: family.relationship,
    idNumber: family.idNumber || '',
    placeOfBirth: family.placeOfBirth || '',
    dateOfBirth: family.dateOfBirth ? family.dateOfBirth.split('T')[0] : '',
    gender: family.gender || '',
    religion: family.religion || '',
    occupation: family.occupation || '',
    phone: family.phone || '',
    address: family.address || '',
    isEmergencyContact: family.isEmergencyContact ? 'yes' : 'no',
    isDependent: family.isDependent ? 'yes' : 'no',
    maritalStatus: family.maritalStatus || '',
    educationLevel: family.educationLevel || '',
  };
}

function formToPayload(form: FamilyFormData): Partial<EmployeeFamily> {
  return {
    fullName: form.fullName,
    relationship: form.relationship,
    idNumber: form.idNumber || undefined,
    placeOfBirth: form.placeOfBirth || undefined,
    dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : undefined,
    gender: form.gender || undefined,
    religion: form.religion || undefined,
    occupation: form.occupation || undefined,
    phone: form.phone || undefined,
    address: form.address || undefined,
    isEmergencyContact: form.isEmergencyContact === 'yes',
    isDependent: form.isDependent === 'yes',
    maritalStatus: form.maritalStatus || undefined,
    educationLevel: form.educationLevel || undefined,
  };
}

// ──────────────────────────────────────────────────
// Skeleton loading
// ──────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-xl border border-border bg-white p-4 dark:bg-gray-800">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-2">
          <div className="h-4 w-32 rounded bg-muted" />
          <div className="h-3 w-48 rounded bg-muted" />
          <div className="h-3 w-24 rounded bg-muted" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted" />
          <div className="h-8 w-8 rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <SkeletonRow />
      <SkeletonRow />
    </div>
  );
}

// ──────────────────────────────────────────────────
// Main Component
// ──────────────────────────────────────────────────
interface FamilyTabProps {
  employeeId: string;
}

export function FamilyTab({ employeeId }: FamilyTabProps) {
  const { t } = useI18n();
  const [data, setData] = useState<EmployeeFamily[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeFamily | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FamilyFormData>(EMPTY_FORM);

  const fetchData = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const result = await employeeService.getFamilies(employeeId);
      setData(result);
    } catch (error) {
      console.error('Failed to fetch families:', error);
      toast.error(t('wf.family.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function openAddDialog() {
    setEditingItem(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEditDialog(item: EmployeeFamily) {
    setEditingItem(item);
    setForm(familyToForm(item));
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingItem(null);
    setForm(EMPTY_FORM);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!employeeId) return;

    if (!form.fullName.trim()) {
      toast.error(t('wf.family.validation.nameRequired'));
      return;
    }
    if (!form.relationship) {
      toast.error(t('wf.family.validation.relationshipRequired'));
      return;
    }

    setSaving(true);
    try {
      const payload = formToPayload(form);
      if (editingItem) {
        await employeeService.updateFamily(employeeId, editingItem.id, payload);
        toast.success(t('wf.family.toast.updateSuccess'));
      } else {
        await employeeService.createFamily(employeeId, payload);
        toast.success(t('wf.family.toast.createSuccess'));
      }
      closeDialog();
      await fetchData();
    } catch (error) {
      console.error('Failed to save family:', error);
      toast.error(t('wf.family.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item: EmployeeFamily) {
    if (!employeeId) return;
    const confirmed = await popup.confirm({
      title: t('wf.family.confirm.title'),
      description: t('wf.family.confirm.description', { name: item.fullName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteFamily(employeeId, item.id);
      toast.success(t('wf.family.toast.deleteSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Failed to delete family:', error);
      toast.error(t('wf.family.toast.deleteFailed'));
    }
  }

  // ────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────
  return (
    <div className="rounded-xl border border-border bg-white dark:bg-gray-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-medium">{t('wf.family.title')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('wf.family.subtitle')}
          </p>
        </div>
        <Button size="sm" onClick={openAddDialog}>
          <Plus size={16} className="mr-2" />
          {t('wf.common.add')}
        </Button>
      </div>

      {/* Content */}
      <div className="p-5">
        {loading ? (
          <LoadingSkeleton />
        ) : data.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/20 px-4 py-12 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Users size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{t('wf.family.empty.title')}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t('wf.family.empty.hint')}
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={openAddDialog}>
              <Plus size={16} className="mr-2" />
              {t('wf.family.empty.add')}
            </Button>
          </div>
        ) : (
          /* Data List */
          <div className="space-y-3">
            {data.map((item) => (
              <div
                key={item.id}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
              >
                <div className="min-w-0 flex-1 space-y-2">
                  {/* Name & Relationship */}
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                      <UserRound size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.fullName}</p>
                      <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                        {(() => {
                          const relationshipOption = RELATIONSHIP_OPTIONS.find((o) => o.value === item.relationship);
                          return relationshipOption ? t(relationshipOption.labelKey) : item.relationship;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Fields grid */}
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 pt-1 text-xs sm:grid-cols-2 lg:grid-cols-3">
                    {item.idNumber && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Hash size={12} />
                        <span>{item.idNumber}</span>
                      </div>
                    )}
                    {item.gender && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <UserRound size={12} />
                        <span>{(() => {
                          const genderOption = GENDER_OPTIONS.find((o) => o.value === item.gender);
                          return genderOption ? t(genderOption.labelKey) : item.gender;
                        })()}</span>
                      </div>
                    )}
                    {item.placeOfBirth && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin size={12} />
                        <span>{item.placeOfBirth}</span>
                      </div>
                    )}
                    {item.dateOfBirth && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarDays size={12} />
                        <span>{formatDate(item.dateOfBirth)}</span>
                      </div>
                    )}
                    {item.religion && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <BookOpen size={12} />
                        <span>{item.religion}</span>
                      </div>
                    )}
                    {item.occupation && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Briefcase size={12} />
                        <span>{item.occupation}</span>
                      </div>
                    )}
                    {item.phone && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Phone size={12} />
                        <span>{item.phone}</span>
                      </div>
                    )}
                    {item.maritalStatus && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Heart size={12} />
                        <span>{(() => {
                          const maritalOption = MARITAL_STATUS_OPTIONS.find((o) => o.value === item.maritalStatus);
                          return maritalOption ? t(maritalOption.labelKey) : item.maritalStatus;
                        })()}</span>
                      </div>
                    )}
                    {item.educationLevel && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <GraduationCap size={12} />
                        <span>{EDUCATION_LEVEL_OPTIONS.find((o) => o.value === item.educationLevel)?.label || item.educationLevel}</span>
                      </div>
                    )}
                    {item.isEmergencyContact && (
                      <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                        <ShieldCheck size={12} />
                        <span>{t('employees.detail.tabs.emergency.label')}</span>
                      </div>
                    )}
                    {item.isDependent && (
                      <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <HeartHandshake size={12} />
                        <span>{t('wf.family.dependent')}</span>
                      </div>
                    )}
                  </div>

                  {item.address && (
                    <div className="flex items-start gap-1.5 pt-0.5 text-xs text-muted-foreground">
                      <Home size={12} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{item.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-primary"
                    onClick={() => openEditDialog(item)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Dialog / Modal ── */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={closeDialog}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Dialog Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {editingItem ? t('wf.family.dialog.editBadge') : t('wf.family.dialog.addBadge')}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {editingItem ? t('wf.family.dialog.editTitle', { name: editingItem.fullName }) : t('wf.family.dialog.newTitle')}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t('wf.family.dialog.subtitle')}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={closeDialog}>
                {t('wf.common.close')}
              </Button>
            </div>

            {/* Dialog Form */}
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {/* fullName */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.fullName')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
                    placeholder={t('wf.family.fields.fullNamePlaceholder')}
                    required
                    className="h-10"
                  />
                </div>

                {/* relationship */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.relationship')} <span className="text-destructive">*</span>
                  </label>
                  <Select2
                    value={form.relationship}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, relationship: value }))}
                    options={RELATIONSHIP_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t('wf.family.fields.selectRelationship')}
                  />
                </div>

                {/* idNumber */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.idNumber')}</label>
                  <Input
                    value={form.idNumber}
                    onChange={(e) => setForm((prev) => ({ ...prev, idNumber: e.target.value }))}
                    placeholder={t('wf.family.fields.idNumberPlaceholder')}
                    className="h-10"
                  />
                </div>

                {/* placeOfBirth */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.placeOfBirth')}</label>
                  <Input
                    value={form.placeOfBirth}
                    onChange={(e) => setForm((prev) => ({ ...prev, placeOfBirth: e.target.value }))}
                    placeholder={t('wf.family.fields.placeOfBirthPlaceholder')}
                    className="h-10"
                  />
                </div>

                {/* dateOfBirth */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.dateOfBirth')}</label>
                  <Input
                    type="date"
                    value={form.dateOfBirth}
                    onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
                    className="h-10"
                  />
                </div>

                {/* gender */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.gender')}</label>
                  <Select2
                    value={form.gender}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, gender: value }))}
                    options={GENDER_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t('wf.family.fields.selectGender')}
                  />
                </div>

                {/* religion */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.fields.religion')}</label>
                  <Input
                    value={form.religion}
                    onChange={(e) => setForm((prev) => ({ ...prev, religion: e.target.value }))}
                    placeholder={t('wf.family.fields.religionPlaceholder')}
                    className="h-10"
                  />
                </div>

                {/* occupation */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.occupation')}</label>
                  <Input
                    value={form.occupation}
                    onChange={(e) => setForm((prev) => ({ ...prev, occupation: e.target.value }))}
                    placeholder={t('wf.family.fields.occupationPlaceholder')}
                    className="h-10"
                  />
                </div>

                {/* phone */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.common.phoneNumber')}</label>
                  <Input
                    value={form.phone}
                    onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="08xxxxxxxxxx"
                    className="h-10"
                  />
                </div>

                {/* maritalStatus */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.maritalStatus')}</label>
                  <Select2
                    value={form.maritalStatus}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, maritalStatus: value }))}
                    options={MARITAL_STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t('wf.family.fields.selectMarital')}
                  />
                </div>

                {/* educationLevel */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.fields.education')}</label>
                  <Select2
                    value={form.educationLevel}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, educationLevel: value }))}
                    options={EDUCATION_LEVEL_OPTIONS}
                    placeholder={t('wf.family.fields.selectEducation')}
                  />
                </div>

                {/* address */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.cards.address.title')}</label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                    className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                    placeholder={t('wf.family.fields.addressPlaceholder')}
                  />
                </div>

                {/* isEmergencyContact */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.tabs.emergency.label')}</label>
                  <Select2
                    value={form.isEmergencyContact}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, isEmergencyContact: value }))}
                    options={YES_NO_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t('wf.common.select')}
                  />
                </div>

                {/* isDependent */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('wf.family.dependent')}</label>
                  <Select2
                    value={form.isDependent}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, isDependent: value }))}
                    options={YES_NO_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) }))}
                    placeholder={t('wf.common.select')}
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={closeDialog}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : editingItem ? (
                    <Pencil size={16} className="mr-2" />
                  ) : (
                    <Plus size={16} className="mr-2" />
                  )}
                  {saving ? t('wf.common.saving') : editingItem ? t('wf.common.update') : t('common.save')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
