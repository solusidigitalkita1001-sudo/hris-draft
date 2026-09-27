import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  workCalendarService,
  type ShiftFormula,
  type ShiftFormulaDay,
  type DayType,
} from '@/services/work-calendar.service';
import { Plus, RefreshCw, Pencil, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';

const DAY_TYPES: DayType[] = ['WD', 'WS', 'WE', 'NH', 'JL', 'CH', 'RH', 'OT'];

function emptyDay(sequence: number): ShiftFormulaDay {
  return {
    sequence,
    label: `Day ${sequence}`,
    dayType: 'WS',
    workStart: '07:00',
    workEnd: '15:00',
    crossesMidnight: false,
  };
}

function defaultDays(): ShiftFormulaDay[] {
  return [
    { sequence: 1, label: 'Pagi A', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
    { sequence: 2, label: 'Pagi B', dayType: 'WS', workStart: '07:00', workEnd: '15:00', crossesMidnight: false },
    { sequence: 3, label: 'Sore A', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
    { sequence: 4, label: 'Sore B', dayType: 'WS', workStart: '15:00', workEnd: '23:00', crossesMidnight: false },
    { sequence: 5, label: 'Malam A', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
    { sequence: 6, label: 'Malam B', dayType: 'WS', workStart: '23:00', workEnd: '07:00', crossesMidnight: true },
    { sequence: 7, label: 'Off 1', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
    { sequence: 8, label: 'Off 2', dayType: 'WE', workStart: null, workEnd: null, crossesMidnight: false },
  ];
}

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-5xl mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ShiftFormulaForm({
  initial,
  companyId,
  onSave,
  onClose,
}: {
  initial?: ShiftFormula | null;
  companyId: string;
  onSave: (payload: {
    companyId: string;
    code?: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const { t } = useI18n();
  const [days, setDays] = useState<ShiftFormulaDay[]>(initial?.days?.length ? initial.days : defaultDays());
  const [saving, setSaving] = useState(false);

  const handleDayChange = (sequence: number, patch: Partial<ShiftFormulaDay>) => {
    setDays((prev) =>
      prev.map((day) => {
        if (day.sequence !== sequence) return day;
        const nextDay = { ...day, ...patch };
        if (!['WD', 'WS', 'OT'].includes(nextDay.dayType)) {
          nextDay.workStart = null;
          nextDay.workEnd = null;
          nextDay.crossesMidnight = false;
        }
        return nextDay;
      })
    );
  };

  const handleAddDay = () => {
    setDays((prev) => [...prev, emptyDay(prev.length + 1)]);
  };

  const handleRemoveDay = (sequence: number) => {
    setDays((prev) =>
      prev
        .filter((day) => day.sequence !== sequence)
        .map((day, index) => ({ ...day, sequence: index + 1, label: day.label || `Day ${index + 1}` }))
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toast.error(t('adm.shift.form.nameRequired'));
      return;
    }

    setSaving(true);
    try {
      await onSave({
        companyId,
        name: name.trim(),
        description: description.trim() || undefined,
        isActive,
        days: days.map((day) => ({
          sequence: day.sequence,
          label: day.label?.trim() || `Day ${day.sequence}`,
          dayType: day.dayType,
          workStart: day.workStart || null,
          workEnd: day.workEnd || null,
          crossesMidnight: Boolean(day.crossesMidnight),
        })),
      });
      onClose();
    } catch {
      // handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.code')}</label>
          <Input value={initial?.code || ''} disabled placeholder={t('adm.common.autoCode')} />
          <p className="mt-1 text-[11px] text-muted-foreground">{t('adm.shift.form.codeHint')}</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.name')}</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('adm.shift.form.namePlaceholder')} required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,160px] gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.description')}</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
            placeholder={t('adm.shift.form.descriptionPlaceholder')}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.common.status')}</label>
          <Select2
            value={isActive ? 'ACTIVE' : 'INACTIVE'}
            onValueChange={(value) => setIsActive(value === 'ACTIVE')}
            options={[
              { value: 'ACTIVE', label: t('adm.status.active') },
              { value: 'INACTIVE', label: t('adm.status.inactive') },
            ]}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">{t('adm.shift.form.rotationPattern')}</h3>
            <p className="text-xs text-muted-foreground">{t('adm.shift.form.rotationHint')}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddDay}>
            <Plus size={14} className="mr-2" /> {t('adm.shift.form.addDay')}
          </Button>
        </div>

        <div className="space-y-3">
          {days.map((day) => {
            const isWorkingDay = ['WD', 'WS', 'OT'].includes(day.dayType);
            return (
              <div key={day.sequence} className="grid grid-cols-1 lg:grid-cols-[70px,1.4fr,1fr,1fr,1fr,160px,48px] gap-3 items-end rounded-xl border border-border p-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.day')}</label>
                  <Input value={String(day.sequence)} readOnly className="h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.label')}</label>
                  <Input value={day.label || ''} onChange={(event) => handleDayChange(day.sequence, { label: event.target.value })} className="h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.dayType')}</label>
                  <Select2
                    value={day.dayType}
                    onValueChange={(value) => handleDayChange(day.sequence, { dayType: value as DayType })}
                    options={DAY_TYPES.map((item) => ({ value: item, label: item }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.workStart')}</label>
                  <Input
                    type="time"
                    value={day.workStart || ''}
                    disabled={!isWorkingDay}
                    onChange={(event) => handleDayChange(day.sequence, { workStart: event.target.value || null })}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">{t('adm.shift.form.workEnd')}</label>
                  <Input
                    type="time"
                    value={day.workEnd || ''}
                    disabled={!isWorkingDay}
                    onChange={(event) => handleDayChange(day.sequence, { workEnd: event.target.value || null })}
                    className="h-9"
                  />
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-border px-3 h-9 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(day.crossesMidnight)}
                    disabled={!isWorkingDay}
                    onChange={(event) => handleDayChange(day.sequence, { crossesMidnight: event.target.checked })}
                  />
                  {t('adm.shift.crossMidnight')}
                </label>
                <Button type="button" variant="outline" size="icon" onClick={() => handleRemoveDay(day.sequence)} disabled={days.length <= 1}>
                  <Trash2 size={16} />
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('adm.common.saving') : t('adm.shift.form.save')}</Button>
      </div>
    </form>
  );
}

export function ShiftFormulaPage() {
  const { t } = useI18n();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [formulas, setFormulas] = useState<ShiftFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ShiftFormula | null>(null);
  const [deletingFormula, setDeletingFormula] = useState<ShiftFormula | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setFormulas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await workCalendarService.findAllShiftFormulas(companyId);
      setFormulas(data);
    } catch (error) {
      console.error('Failed to fetch shift formulas:', error);
      toast.error(t('adm.shift.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (payload: {
    companyId: string;
    code?: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => {
    try {
      await workCalendarService.createShiftFormula(payload);
      toast.success(t('adm.shift.created'));
      fetchData();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('adm.shift.createFailed')));
      throw error;
    }
  };

  const handleUpdate = async (payload: {
    companyId: string;
    code?: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => {
    if (!editingFormula) return;
    try {
      await workCalendarService.updateShiftFormula(editingFormula.id, payload);
      toast.success(t('adm.shift.updated'));
      fetchData();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('adm.shift.updateFailed')));
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deletingFormula) return;
    try {
      await workCalendarService.deleteShiftFormula(deletingFormula.id);
      toast.success(t('adm.shift.deleted'));
      setDeletingFormula(null);
      fetchData();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('adm.shift.deleteFailed')));
    }
  };

  const activeCount = useMemo(() => formulas.filter((formula) => formula.isActive).length, [formulas]);

  return (
    <div>
      <PageHeader
        title={t('adm.shift.title')}
        description={t('adm.shift.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> {t('adm.shift.newFormula')}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">{t('adm.shift.stats.total')}</div>
          <div className="text-2xl font-semibold mt-2">{formulas.length}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">{t('adm.shift.stats.active')}</div>
          <div className="text-2xl font-semibold mt-2">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">{t('adm.shift.stats.assigned')}</div>
          <div className="text-2xl font-semibold mt-2">
            {formulas.reduce((sum, formula) => sum + (formula._count?.employees || 0), 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">{t('adm.shift.loading')}</div>
      ) : formulas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white dark:bg-gray-900 p-10 text-center text-sm text-muted-foreground">
          {t('adm.shift.empty')}
        </div>
      ) : (
        <div className="space-y-4">
          {formulas.map((formula) => (
            <div key={formula.id} className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-lg font-semibold">{formula.name}</h3>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">{formula.code}</span>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${formula.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                      {formula.isActive ? t('adm.status.active') : t('adm.status.inactive')}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{formula.description || t('adm.shift.noDescription')}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingFormula(formula)}>
                    <Pencil size={14} className="mr-2" /> {t('common.edit')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeletingFormula(formula)}>
                    <Trash2 size={14} className="mr-2" /> {t('common.delete')}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[220px,1fr] gap-4 mt-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">{t('adm.shift.cycleLength')}</div>
                  <div className="text-xl font-semibold mt-1">{t('adm.shift.cycleDays', { count: formula.cycleLength })}</div>
                  <div className="text-xs text-muted-foreground mt-3">{t('adm.shift.assignedEmployees')}</div>
                  <div className="text-xl font-semibold mt-1">{formula._count?.employees || 0}</div>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-[72px,1.3fr,90px,110px,110px,140px] gap-3 px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground">
                    <div>{t('adm.shift.th.day')}</div>
                    <div>{t('adm.shift.th.label')}</div>
                    <div>{t('adm.shift.th.type')}</div>
                    <div>{t('adm.shift.th.start')}</div>
                    <div>{t('adm.shift.th.end')}</div>
                    <div>{t('adm.shift.th.notes')}</div>
                  </div>
                  <div className="divide-y divide-border">
                    {formula.days.map((day) => (
                      <div key={`${formula.id}-${day.sequence}`} className="grid grid-cols-[72px,1.3fr,90px,110px,110px,140px] gap-3 px-4 py-3 text-sm">
                        <div>{t('adm.shift.daySeq', { n: day.sequence })}</div>
                        <div>{day.label || '-'}</div>
                        <div>{day.dayType}</div>
                        <div>{day.workStart || '-'}</div>
                        <div>{day.workEnd || '-'}</div>
                        <div>{day.crossesMidnight ? t('adm.shift.crossMidnight') : '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('adm.shift.modal.createTitle')}>
        <ShiftFormulaForm companyId={companyId} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingFormula} onClose={() => setEditingFormula(null)} title={t('adm.shift.modal.editTitle')}>
        <ShiftFormulaForm
          initial={editingFormula}
          companyId={companyId}
          onSave={handleUpdate}
          onClose={() => setEditingFormula(null)}
        />
      </Modal>

      {deletingFormula && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setDeletingFormula(null)}>
          <div
            className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="p-5">
              <h3 className="text-base font-semibold mb-2">{t('adm.shift.modal.deleteTitle')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('adm.shift.modal.deletePrefix')} <strong>{deletingFormula.name}</strong>{t('adm.shift.modal.deleteSuffix')}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setDeletingFormula(null)}>{t('common.cancel')}</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>{t('common.delete')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
