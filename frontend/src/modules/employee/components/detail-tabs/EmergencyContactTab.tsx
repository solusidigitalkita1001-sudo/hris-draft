import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { employeeService, type EmployeeEmergencyContact } from '@/services/employee.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import { useI18n } from '@/i18n/provider';
import { formatDateTime } from '@/utils/format';
import { PhoneCall, Pencil, Trash2, Plus, Loader2 } from 'lucide-react';

const defaultForm = {
  fullName: '',
  relationship: '',
  phone: '',
  alternativePhone: '',
  address: '',
  isPrimary: 'false',
  notes: '',
};

interface EmergencyContactTabProps {
  employeeId: string;
}

export function EmergencyContactTab({ employeeId }: EmergencyContactTabProps) {
  const { t } = useI18n();
  const [contacts, setContacts] = useState<EmployeeEmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EmployeeEmergencyContact | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const requestedRef = useRef(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await employeeService.getEmergencyContacts(employeeId);
      setContacts(data);
    } catch (error) {
      console.error('Failed to fetch emergency contacts:', error);
      toast.error(t('wf.emergency.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, t]);

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    fetchData();
  }, [fetchData]);

  function openCreateDialog() {
    setEditingItem(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }

  function openEditDialog(contact: EmployeeEmergencyContact) {
    setEditingItem(contact);
    setForm({
      fullName: contact.fullName,
      relationship: contact.relationship,
      phone: contact.phone,
      alternativePhone: contact.alternativePhone || '',
      address: contact.address || '',
      isPrimary: contact.isPrimary ? 'true' : 'false',
      notes: contact.notes || '',
    });
    setDialogOpen(true);
  }

  function handleFieldChange(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!form.fullName.trim() || !form.relationship.trim() || !form.phone.trim()) {
      toast.error(t('wf.emergency.validation.required'));
      return;
    }

    try {
      setSaving(true);
      const payload = {
        fullName: form.fullName.trim(),
        relationship: form.relationship.trim(),
        phone: form.phone.trim(),
        alternativePhone: form.alternativePhone.trim() || undefined,
        address: form.address.trim() || undefined,
        isPrimary: form.isPrimary === 'true',
        notes: form.notes.trim() || undefined,
      };

      if (editingItem) {
        await employeeService.updateEmergencyContact(employeeId, editingItem.id, payload);
        toast.success(t('wf.emergency.toast.updateSuccess'));
      } else {
        await employeeService.createEmergencyContact(employeeId, payload);
        toast.success(t('wf.emergency.toast.createSuccess'));
      }

      setDialogOpen(false);
      await fetchData();
    } catch (error) {
      console.error('Failed to save emergency contact:', error);
      toast.error(t('wf.emergency.toast.saveFailed'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(contact: EmployeeEmergencyContact) {
    const confirmed = await popup.confirm({
      title: t('wf.emergency.confirm.title'),
      description: t('wf.emergency.confirm.description', { name: contact.fullName }),
      confirmText: t('common.delete'),
      cancelText: t('common.cancel'),
      intent: 'destructive',
    });
    if (!confirmed) return;

    try {
      await employeeService.deleteEmergencyContact(employeeId, contact.id);
      toast.success(t('wf.emergency.toast.deleteSuccess'));
      await fetchData();
    } catch (error) {
      console.error('Failed to delete emergency contact:', error);
      toast.error(t('wf.emergency.toast.deleteFailed'));
    }
  }

  // --- Loading Skeleton ---
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
        <div className="mb-4">
          <div className="h-4 w-36 animate-pulse rounded bg-muted" />
          <div className="mt-1 h-3 w-56 animate-pulse rounded bg-muted" />
        </div>
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">{t('employees.detail.tabs.emergency.label')}</h3>
          <p className="text-xs text-muted-foreground">
            {t('wf.emergency.subtitle')}
          </p>
        </div>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus size={16} className="mr-2" />
          {t('wf.common.add')}
        </Button>
      </div>

      {/* Empty State */}
      {contacts.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center">
          <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/50 text-muted-foreground">
            <PhoneCall size={24} />
          </div>
          <p className="text-sm text-muted-foreground">{t('wf.emergency.empty.title')}</p>
          <p className="mt-1 text-xs text-muted-foreground/60">
            {t('wf.emergency.empty.hint')}
          </p>
        </div>
      )}

      {/* Data List */}
      {contacts.length > 0 && (
        <div className="space-y-3">
          {contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <PhoneCall size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{contact.fullName}</p>
                    {contact.isPrimary && (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        {t('wf.emergency.primary')}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{contact.relationship}</p>
                  <p className="mt-0.5 text-xs">{contact.phone}</p>
                  {contact.alternativePhone && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t('wf.emergency.altPhone', { phone: contact.alternativePhone })}
                    </p>
                  )}
                  {contact.address && (
                    <p className="mt-0.5 text-xs text-muted-foreground line-clamp-1">
                      {contact.address}
                    </p>
                  )}
                  {contact.notes && (
                    <p className="mt-1 rounded bg-muted/30 px-2 py-1 text-[11px] text-muted-foreground">
                      {contact.notes}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-muted-foreground/50">
                    {t('wf.emergency.updatedAt', { date: formatDateTime(contact.updatedAt) })}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => openEditDialog(contact)}
                  title={t('common.edit')}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => handleDelete(contact)}
                  title={t('common.delete')}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-border bg-background shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('employees.detail.tabs.emergency.label')}
                </p>
                <h3 className="mt-1 text-lg font-semibold">
                  {editingItem ? t('wf.emergency.dialog.editTitle') : t('wf.emergency.dialog.addTitle')}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {editingItem
                    ? t('wf.emergency.dialog.editSubtitle')
                    : t('wf.emergency.dialog.addSubtitle')}
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                {t('wf.common.close')}
              </Button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="p-5">
              <div className="grid gap-4 md:grid-cols-2">
                {/* fullName */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.fullName')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.fullName}
                    onChange={(e) => handleFieldChange('fullName', e.target.value)}
                    placeholder={t('wf.emergency.fields.fullNamePlaceholder')}
                    required
                    className="h-10"
                  />
                </div>

                {/* relationship */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.relationship')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.relationship}
                    onChange={(e) => handleFieldChange('relationship', e.target.value)}
                    placeholder={t('wf.emergency.fields.relationshipPlaceholder')}
                    required
                    className="h-10"
                  />
                </div>

                {/* phone */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.phoneNumber')} <span className="text-destructive">*</span>
                  </label>
                  <Input
                    value={form.phone}
                    onChange={(e) => handleFieldChange('phone', e.target.value)}
                    placeholder="08123456789"
                    required
                    className="h-10"
                  />
                </div>

                {/* alternativePhone */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.emergency.fields.altPhone')}
                  </label>
                  <Input
                    value={form.alternativePhone}
                    onChange={(e) => handleFieldChange('alternativePhone', e.target.value)}
                    placeholder="087654321"
                    className="h-10"
                  />
                </div>

                {/* isPrimary */}
                <div>
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.emergency.fields.isPrimary')}
                  </label>
                  <Select2
                    value={form.isPrimary}
                    onValueChange={(value) => handleFieldChange('isPrimary', value)}
                    options={[
                      { value: 'false', label: t('wf.common.no') },
                      { value: 'true', label: t('wf.common.yes') },
                    ]}
                    placeholder={t('wf.common.select')}
                  />
                </div>

                {/* address - full width */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('employees.detail.cards.address.title')}
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) => handleFieldChange('address', e.target.value)}
                    className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder={t('wf.emergency.fields.addressPlaceholder')}
                  />
                </div>

                {/* notes - full width */}
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    {t('wf.common.notes')}
                  </label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => handleFieldChange('notes', e.target.value)}
                    className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder={t('wf.emergency.fields.notesPlaceholder')}
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 size={16} className="mr-2 animate-spin" />
                  ) : (
                    <Plus size={16} className="mr-2" />
                  )}
                  {saving
                    ? t('wf.common.saving')
                    : editingItem
                      ? t('wf.common.update')
                      : t('wf.common.add')}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
