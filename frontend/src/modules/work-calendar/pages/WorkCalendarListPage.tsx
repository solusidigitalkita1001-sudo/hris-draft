import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { workCalendarService, normalizeWorkDaysConfig, type WorkCalendar, type WorkDaysConfig, type WorkDayKey } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import {
  CalendarDays, Plus, RefreshCw, Copy, Pencil, Trash2,
  Search, ChevronRight,
} from 'lucide-react';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

// ─── Default work days: Mon–Fri ─────────────────────────
const DEFAULT_WORK_DAYS: WorkDaysConfig = {
  mon: { enabled: true, workStart: '08:30', workEnd: '17:30' },
  tue: { enabled: true, workStart: '08:30', workEnd: '17:30' },
  wed: { enabled: true, workStart: '08:30', workEnd: '17:30' },
  thu: { enabled: true, workStart: '08:30', workEnd: '17:30' },
  fri: { enabled: true, workStart: '08:30', workEnd: '17:30' },
  sat: { enabled: false, workStart: null, workEnd: null },
  sun: { enabled: false, workStart: null, workEnd: null },
};

const DAY_LABEL_KEYS: Record<WorkDayKey, TranslationKey> = {
  mon: 'adm.day.mon', tue: 'adm.day.tue', wed: 'adm.day.wed', thu: 'adm.day.thu', fri: 'adm.day.fri',
  sat: 'adm.day.sat', sun: 'adm.day.sun',
};

// ─── Modal Wrapper ──────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────
function ConfirmDialog({ open, onClose, onConfirm, title, message }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
}) {
  const { t } = useI18n();

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-base font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">{t('common.delete')}</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Form ──────────────────────────────────────
function CalendarForm({ initial, onSave, onClose }: {
  initial?: Partial<WorkCalendar>;
  onSave: (data: Partial<WorkCalendar>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name || '');
  const [year, setYear] = useState(initial?.year || dayjs().year());
  const [description, setDescription] = useState(initial?.description || '');
  const [workDays, setWorkDays] = useState<WorkDaysConfig>(
    initial?.workDays ? normalizeWorkDaysConfig(initial.workDays) : DEFAULT_WORK_DAYS
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t('adm.calendar.form.nameRequired'));
    setSaving(true);
    try {
      await onSave({ name: name.trim(), year, description: description.trim() || undefined, workDays });
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: WorkDayKey) => {
    setWorkDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        enabled: !prev[day].enabled,
      },
    }));
  };

  const changeDayTime = (day: WorkDayKey, field: 'workStart' | 'workEnd', value: string) => {
    setWorkDays((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value || null,
      },
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.calendar.form.name')}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('adm.calendar.form.namePlaceholder')} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.calendar.form.year')}</label>
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2000} max={2100} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.calendar.form.workDays')}</label>
        <div className="space-y-2">
          {(Object.keys(DAY_LABEL_KEYS) as WorkDayKey[]).map((day) => (
            <div key={day} className="grid grid-cols-[110px,1fr,1fr] gap-2 items-center rounded-lg border border-border p-2.5">
              <button
                type="button"
                onClick={() => toggleDay(day)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  workDays[day].enabled
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {t(DAY_LABEL_KEYS[day])}
              </button>
              <Input
                type="time"
                value={workDays[day].workStart || ''}
                onChange={(e) => changeDayTime(day, 'workStart', e.target.value)}
                disabled={!workDays[day].enabled}
              />
              <Input
                type="time"
                value={workDays[day].workEnd || ''}
                onChange={(e) => changeDayTime(day, 'workEnd', e.target.value)}
                disabled={!workDays[day].enabled}
              />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          {t('adm.calendar.form.workDaysHint')}
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('adm.calendar.form.description')}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('adm.calendar.form.descriptionPlaceholder')}
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('adm.common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

// ─── Copy Calendar Dialog ───────────────────────────────
function CopyDialog({ open, onClose, onCopy, calendar }: {
  open: boolean; onClose: () => void; onCopy: (targetYear: number, name?: string) => Promise<void>;
  calendar: WorkCalendar | null;
}) {
  const { t } = useI18n();
  const [targetYear, setTargetYear] = useState(dayjs().year() + 1);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!calendar) return;
    setTargetYear(calendar.year + 1);
    setName('');
  }, [calendar]);

  if (!open || !calendar) return null;

  const handleCopy = async () => {
    setSaving(true);
    try {
      await onCopy(targetYear, name || undefined);
      onClose();
    } catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{t('adm.calendar.copy.title')}</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            {t('adm.calendar.copy.promptPrefix')} <strong>{calendar.name}</strong> ({calendar.year}) {t('adm.calendar.copy.promptSuffix')}
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('adm.calendar.copy.targetYear')}</label>
            <Input type="number" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} min={2000} max={2100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">{t('adm.calendar.copy.newName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('adm.calendar.copy.namePlaceholder', { year: targetYear })} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleCopy} disabled={saving}>{saving ? t('adm.calendar.copy.copying') : t('adm.calendar.copy.copy')}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export function WorkCalendarListPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<WorkCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<WorkCalendar | null>(null);
  const [deletingCalendar, setDeletingCalendar] = useState<WorkCalendar | null>(null);
  const [copyingCalendar, setCopyingCalendar] = useState<WorkCalendar | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setCalendars([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await workCalendarService.findAll(companyId);
      setCalendars(data);
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      toast.error(t('adm.calendar.loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t hanya untuk pesan error; fetch mengikuti company aktif
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: Partial<WorkCalendar>) => {
    try {
      await workCalendarService.create({ ...data, companyId });
      toast.success(t('adm.calendar.created'));
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('adm.calendar.createFailed')));
      throw err;
    }
  };

  const handleUpdate = async (data: Partial<WorkCalendar>) => {
    if (!editingCalendar) return;
    try {
      await workCalendarService.update(editingCalendar.id, data);
      toast.success(t('adm.calendar.updated'));
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('adm.calendar.updateFailed')));
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingCalendar) return;
    try {
      await workCalendarService.delete(deletingCalendar.id);
      toast.success(t('adm.calendar.deleted'));
      setDeletingCalendar(null);
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('adm.calendar.deleteFailed')));
    }
  };

  const handleCopy = async (targetYear: number, name?: string) => {
    if (!copyingCalendar) return;
    try {
      await workCalendarService.copyCalendar(copyingCalendar.id, targetYear, name);
      toast.success(t('adm.calendar.copiedTo', { year: targetYear }));
      setCopyingCalendar(null);
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('adm.calendar.copyFailed')));
      throw err;
    }
  };

  const filtered = calendars.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || String(c.year).includes(search)
  );

  return (
    <div>
      <PageHeader
        title={t('adm.calendar.title')}
        description={t('adm.calendar.description')}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> {t('adm.calendar.newCalendar')}
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('adm.calendar.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">{t('adm.calendar.loading')}</div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3">
          <CalendarDays size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? t('adm.calendar.emptySearch') : t('adm.calendar.emptyNone')}
          </p>
          {!search && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> {t('adm.calendar.createCalendar')}
            </Button>
          )}
        </div>
      )}

      {/* Calendar Grid */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((cal) => {
            const isCurrentYear = cal.year === dayjs().year();
            return (
              <div
                key={cal.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5 hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => navigate(`/work-calendar/${cal.id}?year=${cal.year}`)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-2">
                      {cal.name}
                      {isCurrentYear && (
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">{t('adm.calendar.currentBadge')}</span>
                      )}
                    </h3>
                    <p className="text-2xl font-bold text-muted-foreground mt-1">{cal.year}</p>
                  </div>
                  <CalendarDays size={28} className="text-primary/30" />
                </div>

                {/* Work days summary */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(Object.keys(DAY_LABEL_KEYS) as WorkDayKey[]).map((day) => {
                    const wd = normalizeWorkDaysConfig(cal.workDays);
                    return (
                      <span
                        key={day}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          wd[day].enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                        }`}
                        title={wd[day].enabled ? `${wd[day].workStart || '--:--'} - ${wd[day].workEnd || '--:--'}` : t('adm.calendar.offDay')}
                      >
                        {t(DAY_LABEL_KEYS[day]).slice(0, 3)}
                      </span>
                    );
                  })}
                </div>

                {cal.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{cal.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{t('adm.calendar.daysConfigured', { count: cal._count?.days ?? 0 })}</span>
                  <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    {t('adm.calendar.details')} <ChevronRight size={14} />
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={t('common.edit')}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCopyingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title={t('adm.calendar.copyToYear')}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors ml-auto"
                    title={t('common.delete')}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('adm.calendar.modal.createTitle')}>
        <CalendarForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingCalendar} onClose={() => setEditingCalendar(null)} title={t('adm.calendar.modal.editTitle')}>
        {editingCalendar && (
          <CalendarForm
            initial={editingCalendar}
            onSave={handleUpdate}
            onClose={() => setEditingCalendar(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingCalendar}
        onClose={() => setDeletingCalendar(null)}
        onConfirm={handleDelete}
        title={t('adm.calendar.modal.deleteTitle')}
        message={t('adm.calendar.modal.deleteMessage', { name: deletingCalendar?.name ?? '', year: deletingCalendar?.year ?? '' })}
      />

      <CopyDialog
        open={!!copyingCalendar}
        onClose={() => setCopyingCalendar(null)}
        onCopy={handleCopy}
        calendar={copyingCalendar}
      />
    </div>
  );
}
