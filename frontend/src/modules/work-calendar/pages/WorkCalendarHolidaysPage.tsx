import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { workCalendarService, type Holiday } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, RefreshCw, Pencil, Trash2, Search, CalendarDays,
} from 'lucide-react';
import { formatDate } from '@/utils/format';

// ─── Modal ──────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
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

// ─── Holiday Form ───────────────────────────────────────
function HolidayForm({ initial, onSave, onClose }: {
  initial?: Partial<Holiday>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [date, setDate] = useState(initial?.date ? dayjs(initial.date).format('YYYY-MM-DD') : '');
  const [type, setType] = useState<'NH' | 'JL'>(initial?.type || 'NH');
  const [year, setYear] = useState(initial?.year || dayjs().year());
  const [source, setSource] = useState(initial?.source || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !date) return toast.error('Name and date are required');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), date, type, year, source: source.trim() || undefined });
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Holiday Name *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Independence Day" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Date *</label>
          <Input type="date" value={date} onChange={(e) => {
            setDate(e.target.value);
            if (e.target.value) setYear(dayjs(e.target.value).year());
          }} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as 'NH' | 'JL')}
            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
          >
            <option value="NH">National Holiday</option>
            <option value="JL">Joint Leave</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Source (optional)</label>
        <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Government regulation" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

// ─── Main Page ──────────────────────────────────────────
export function WorkCalendarHolidaysPage() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState(dayjs().year());
  const [typeFilter, setTypeFilter] = useState<'all' | 'NH' | 'JL'>('all');
  const companyId = localStorage.getItem('companyId') || '';

  // Modal states
  const [showCreate, setShowCreate] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState<Holiday | null>(null);
  const [deletingHoliday, setDeletingHoliday] = useState<Holiday | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await workCalendarService.findAllHolidays(companyId, yearFilter);
      setHolidays(data);
    } catch (error) {
      console.error('Failed to fetch holidays:', error);
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [companyId, yearFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await workCalendarService.createHoliday({ ...data, companyId });
      toast.success('Holiday created');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create holiday');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingHoliday) return;
    try {
      await workCalendarService.updateHoliday(editingHoliday.id, data);
      toast.success('Holiday updated');
      setEditingHoliday(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update holiday');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingHoliday) return;
    try {
      await workCalendarService.deleteHoliday(deletingHoliday.id);
      toast.success('Holiday deleted');
      setDeletingHoliday(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete holiday');
    }
  };

  const filtered = holidays.filter((h) => {
    const matchSearch = h.name.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || h.type === typeFilter;
    return matchSearch && matchType;
  });

  const years = Array.from({ length: 11 }, (_, i) => dayjs().year() - 5 + i);

  return (
    <div>
      <PageHeader
        title="National Holidays"
        description="Manage national holidays and joint leave"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> Add Holiday
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search holidays..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(Number(e.target.value))}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <div className="flex gap-1">
          {(['all', 'NH', 'JL'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                typeFilter === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {t === 'all' ? 'All' : t === 'NH' ? 'National' : 'Joint Leave'}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading holidays...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3">
          <CalendarDays size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || typeFilter !== 'all' ? 'No holidays match your filters' : 'No holidays added yet'}
          </p>
          {!search && typeFilter === 'all' && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> Add Holiday
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="table-container">
          <table className="w-full">
            <thead className="table-header">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Date</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Name</th>
                <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Year</th>
                <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Source</th>
                <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((h) => (
                <tr key={h.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm font-medium">{formatDate(h.date)}</td>
                  <td className="px-4 py-3 text-sm">{h.name}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                      h.type === 'NH'
                        ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                        : 'bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400'
                    }`}>
                      {h.type === 'NH' ? 'National Holiday' : 'Joint Leave'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{h.year}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{h.source || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setEditingHoliday(h)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        onClick={() => setDeletingHoliday(h)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Holiday">
        <HolidayForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingHoliday} onClose={() => setEditingHoliday(null)} title="Edit Holiday">
        {editingHoliday && (
          <HolidayForm
            initial={editingHoliday}
            onSave={handleUpdate}
            onClose={() => setEditingHoliday(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingHoliday}
        onClose={() => setDeletingHoliday(null)}
        onConfirm={handleDelete}
        title="Delete Holiday"
        message={`Are you sure you want to delete "${deletingHoliday?.name}"?`}
      />
    </div>
  );
}
