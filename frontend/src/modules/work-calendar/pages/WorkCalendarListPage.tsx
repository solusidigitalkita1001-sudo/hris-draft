import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { workCalendarService, normalizeWorkDaysConfig, type WorkCalendar, type WorkDaysConfig, type WorkDayKey } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CalendarDays, Plus, RefreshCw, Copy, Pencil, Trash2,
  Search, ChevronRight,
} from 'lucide-react';

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

const DAY_LABELS: Record<WorkDayKey, string> = {
  mon: 'Senin', tue: 'Selasa', wed: 'Rabu', thu: 'Kamis', fri: 'Jumat',
  sat: 'Sabtu', sun: 'Minggu',
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
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-base font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button>
        </div>
      </div>
    </div>
  );
}

// ─── Calendar Form ──────────────────────────────────────
function CalendarForm({ initial, onSave, onClose }: {
  initial?: Partial<WorkCalendar>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [year, setYear] = useState(initial?.year || dayjs().year());
  const [description, setDescription] = useState(initial?.description || '');
  const [workDays, setWorkDays] = useState<WorkDaysConfig>(
    initial?.workDays ? normalizeWorkDaysConfig(initial.workDays) : DEFAULT_WORK_DAYS
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Calendar name is required');
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
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Calendar Name *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard Calendar" required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Year *</label>
        <Input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} min={2000} max={2100} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Work Days</label>
        <div className="space-y-2">
          {(Object.keys(DAY_LABELS) as WorkDayKey[]).map((day) => (
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
                {DAY_LABELS[day]}
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
          Cocok untuk HO, cabang, dan jadwal normal. Untuk shift bergilir, atur default di sini lalu override per tanggal di detail kalender.
        </p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Standard company-wide work calendar"
          rows={2}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

// ─── Copy Calendar Dialog ───────────────────────────────
function CopyDialog({ open, onClose, onCopy, calendar }: {
  open: boolean; onClose: () => void; onCopy: (targetYear: number, name?: string) => Promise<void>;
  calendar: WorkCalendar | null;
}) {
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
          <h2 className="text-base font-semibold">Copy Calendar</h2>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-muted-foreground">
            Copy <strong>{calendar.name}</strong> ({calendar.year}) to:
          </p>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Target Year *</label>
            <Input type="number" value={targetYear} onChange={(e) => setTargetYear(Number(e.target.value))} min={2000} max={2100} />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">New Name (optional)</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`Copy ${targetYear}`} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleCopy} disabled={saving}>{saving ? 'Copying...' : 'Copy'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export function WorkCalendarListPage() {
  const navigate = useNavigate();
  const [calendars, setCalendars] = useState<WorkCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const companyId = localStorage.getItem('companyId') || '';

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingCalendar, setEditingCalendar] = useState<WorkCalendar | null>(null);
  const [deletingCalendar, setDeletingCalendar] = useState<WorkCalendar | null>(null);
  const [copyingCalendar, setCopyingCalendar] = useState<WorkCalendar | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await workCalendarService.findAll(companyId);
      setCalendars(data);
    } catch (error) {
      console.error('Failed to fetch calendars:', error);
      toast.error('Failed to load work calendars');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await workCalendarService.create({ ...data, companyId });
      toast.success('Calendar created');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create calendar');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingCalendar) return;
    try {
      await workCalendarService.update(editingCalendar.id, data);
      toast.success('Calendar updated');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update calendar');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingCalendar) return;
    try {
      await workCalendarService.delete(deletingCalendar.id);
      toast.success('Calendar deleted');
      setDeletingCalendar(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete calendar');
    }
  };

  const handleCopy = async (targetYear: number, name?: string) => {
    if (!copyingCalendar) return;
    try {
      await workCalendarService.copyCalendar(copyingCalendar.id, targetYear, name);
      toast.success(`Calendar copied to ${targetYear}`);
      setCopyingCalendar(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to copy calendar');
      throw err;
    }
  };

  const filtered = calendars.filter(
    (c) => c.name.toLowerCase().includes(search.toLowerCase()) || String(c.year).includes(search)
  );

  return (
    <div>
      <PageHeader
        title="Work Calendar"
        description="Manage company work calendars, working days, and holidays"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> New Calendar
            </Button>
          </div>
        }
      />

      {/* Search */}
      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search calendars..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading calendars...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3">
          <CalendarDays size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No calendars match your search' : 'No work calendars yet'}
          </p>
          {!search && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> Create Calendar
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
                        <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-medium">Current</span>
                      )}
                    </h3>
                    <p className="text-2xl font-bold text-muted-foreground mt-1">{cal.year}</p>
                  </div>
                  <CalendarDays size={28} className="text-primary/30" />
                </div>

                {/* Work days summary */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(Object.keys(DAY_LABELS) as WorkDayKey[]).map((day) => {
                    const wd = normalizeWorkDaysConfig(cal.workDays);
                    return (
                      <span
                        key={day}
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          wd[day].enabled
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                            : 'bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500'
                        }`}
                        title={wd[day].enabled ? `${wd[day].workStart || '--:--'} - ${wd[day].workEnd || '--:--'}` : 'Libur'}
                      >
                        {DAY_LABELS[day].slice(0, 3)}
                      </span>
                    );
                  })}
                </div>

                {cal.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-1">{cal.description}</p>
                )}

                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{cal._count?.days ?? 0} days configured</span>
                  <span className="flex items-center gap-1 text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                    Details <ChevronRight size={14} />
                  </span>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={(e) => { e.stopPropagation(); setEditingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Edit"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCopyingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Copy to year"
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingCalendar(cal); }}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors ml-auto"
                    title="Delete"
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
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Work Calendar">
        <CalendarForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingCalendar} onClose={() => setEditingCalendar(null)} title="Edit Calendar">
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
        title="Delete Calendar"
        message={`Are you sure you want to delete "${deletingCalendar?.name}" (${deletingCalendar?.year})? This action cannot be undone.`}
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
