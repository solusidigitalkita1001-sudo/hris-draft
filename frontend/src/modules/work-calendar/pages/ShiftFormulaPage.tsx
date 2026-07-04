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
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [code, setCode] = useState(initial?.code || '');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
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
    if (!code.trim() || !name.trim()) {
      toast.error('Code dan nama formula wajib diisi');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        companyId,
        code: code.trim(),
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
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
          <Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="SHIFT-3REGU" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nama Formula *</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="3 Regu Rotasi 8 Hari" required />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr,160px] gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Deskripsi</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
            placeholder="Contoh: 2 pagi, 2 sore, 2 malam, 2 off"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
          <Select2
            value={isActive ? 'ACTIVE' : 'INACTIVE'}
            onValueChange={(value) => setIsActive(value === 'ACTIVE')}
            options={[
              { value: 'ACTIVE', label: 'ACTIVE' },
              { value: 'INACTIVE', label: 'INACTIVE' },
            ]}
            className="h-10"
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Pola Rotasi</h3>
            <p className="text-xs text-muted-foreground">Urutan hari ini akan diputar berdasarkan `shift start date` milik employee.</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={handleAddDay}>
            <Plus size={14} className="mr-2" /> Add Day
          </Button>
        </div>

        <div className="space-y-3">
          {days.map((day) => {
            const isWorkingDay = ['WD', 'WS', 'OT'].includes(day.dayType);
            return (
              <div key={day.sequence} className="grid grid-cols-1 lg:grid-cols-[70px,1.4fr,1fr,1fr,1fr,160px,48px] gap-3 items-end rounded-xl border border-border p-3">
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Hari</label>
                  <Input value={String(day.sequence)} readOnly className="h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Label</label>
                  <Input value={day.label || ''} onChange={(event) => handleDayChange(day.sequence, { label: event.target.value })} className="h-9" />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Tipe Hari</label>
                  <Select2
                    value={day.dayType}
                    onValueChange={(value) => handleDayChange(day.sequence, { dayType: value as DayType })}
                    options={DAY_TYPES.map((item) => ({ value: item, label: item }))}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Jam Masuk</label>
                  <Input
                    type="time"
                    value={day.workStart || ''}
                    disabled={!isWorkingDay}
                    onChange={(event) => handleDayChange(day.sequence, { workStart: event.target.value || null })}
                    className="h-9"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-muted-foreground mb-1.5">Jam Pulang</label>
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
                  Cross midnight
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
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save Formula'}</Button>
      </div>
    </form>
  );
}

export function ShiftFormulaPage() {
  const companyId = localStorage.getItem('companyId') || '';
  const [formulas, setFormulas] = useState<ShiftFormula[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editingFormula, setEditingFormula] = useState<ShiftFormula | null>(null);
  const [deletingFormula, setDeletingFormula] = useState<ShiftFormula | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await workCalendarService.findAllShiftFormulas(companyId);
      setFormulas(data);
    } catch (error) {
      console.error('Failed to fetch shift formulas:', error);
      toast.error('Failed to load shift formulas');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (payload: {
    companyId: string;
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => {
    try {
      await workCalendarService.createShiftFormula(payload);
      toast.success('Shift formula created');
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to create shift formula');
      throw error;
    }
  };

  const handleUpdate = async (payload: {
    companyId: string;
    code: string;
    name: string;
    description?: string;
    isActive: boolean;
    days: ShiftFormulaDay[];
  }) => {
    if (!editingFormula) return;
    try {
      await workCalendarService.updateShiftFormula(editingFormula.id, payload);
      toast.success('Shift formula updated');
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to update shift formula');
      throw error;
    }
  };

  const handleDelete = async () => {
    if (!deletingFormula) return;
    try {
      await workCalendarService.deleteShiftFormula(deletingFormula.id);
      toast.success('Shift formula deleted');
      setDeletingFormula(null);
      fetchData();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete shift formula');
    }
  };

  const activeCount = useMemo(() => formulas.filter((formula) => formula.isActive).length, [formulas]);

  return (
    <div>
      <PageHeader
        title="Shift Formula"
        description="Kelola formula roster bergilir untuk pegawai pabrik dan operasional shift."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> New Formula
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">Total Formula</div>
          <div className="text-2xl font-semibold mt-2">{formulas.length}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">Formula Aktif</div>
          <div className="text-2xl font-semibold mt-2">{activeCount}</div>
        </div>
        <div className="rounded-2xl border border-border bg-white dark:bg-gray-900 p-4">
          <div className="text-xs text-muted-foreground">Terpasang ke Employee</div>
          <div className="text-2xl font-semibold mt-2">
            {formulas.reduce((sum, formula) => sum + (formula._count?.employees || 0), 0)}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading shift formulas...</div>
      ) : formulas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-white dark:bg-gray-900 p-10 text-center text-sm text-muted-foreground">
          Belum ada shift formula. Buat formula pertama untuk pekerja pabrik atau tim dengan roster bergilir.
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
                      {formula.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{formula.description || 'Tanpa deskripsi.'}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingFormula(formula)}>
                    <Pencil size={14} className="mr-2" /> Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setDeletingFormula(formula)}>
                    <Trash2 size={14} className="mr-2" /> Delete
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[220px,1fr] gap-4 mt-4">
                <div className="rounded-xl border border-border p-4">
                  <div className="text-xs text-muted-foreground">Cycle Length</div>
                  <div className="text-xl font-semibold mt-1">{formula.cycleLength} hari</div>
                  <div className="text-xs text-muted-foreground mt-3">Assigned Employees</div>
                  <div className="text-xl font-semibold mt-1">{formula._count?.employees || 0}</div>
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="grid grid-cols-[72px,1.3fr,90px,110px,110px,140px] gap-3 px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground">
                    <div>Hari</div>
                    <div>Label</div>
                    <div>Tipe</div>
                    <div>Masuk</div>
                    <div>Pulang</div>
                    <div>Catatan</div>
                  </div>
                  <div className="divide-y divide-border">
                    {formula.days.map((day) => (
                      <div key={`${formula.id}-${day.sequence}`} className="grid grid-cols-[72px,1.3fr,90px,110px,110px,140px] gap-3 px-4 py-3 text-sm">
                        <div>Day {day.sequence}</div>
                        <div>{day.label || '-'}</div>
                        <div>{day.dayType}</div>
                        <div>{day.workStart || '-'}</div>
                        <div>{day.workEnd || '-'}</div>
                        <div>{day.crossesMidnight ? 'Cross midnight' : '-'}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Shift Formula">
        <ShiftFormulaForm companyId={companyId} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingFormula} onClose={() => setEditingFormula(null)} title="Edit Shift Formula">
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
              <h3 className="text-base font-semibold mb-2">Delete Shift Formula</h3>
              <p className="text-sm text-muted-foreground">
                Hapus formula <strong>{deletingFormula.name}</strong>? Employee yang masih memakai formula ini akan kehilangan pola shift aktifnya.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setDeletingFormula(null)}>Cancel</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
