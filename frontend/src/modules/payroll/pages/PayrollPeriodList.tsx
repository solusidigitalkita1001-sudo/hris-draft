import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { payrollService, type PayrollPeriod } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, CalendarDays, Pencil, Lock, X } from 'lucide-react';
import { formatDate } from '@/utils/format';

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmText,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-base font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm}>{confirmText}</Button>
        </div>
      </div>
    </div>
  );
}

function toIsoNoon(date: string) {
  return dayjs(date).hour(12).minute(0).second(0).millisecond(0).toISOString();
}

function PeriodForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: PayrollPeriod | null;
  onSave: (data: Partial<PayrollPeriod>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name || '');
  const [frequency, setFrequency] = useState<string>(initial?.frequency || 'MONTHLY');
  const [startDate, setStartDate] = useState(initial?.startDate ? dayjs(initial.startDate).format('YYYY-MM-DD') : dayjs().startOf('month').format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(initial?.endDate ? dayjs(initial.endDate).format('YYYY-MM-DD') : dayjs().endOf('month').format('YYYY-MM-DD'));
  const [payDate, setPayDate] = useState(initial?.payDate ? dayjs(initial.payDate).format('YYYY-MM-DD') : dayjs().endOf('month').format('YYYY-MM-DD'));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) return toast.error('Nama period wajib diisi');

    if (!startDate || !endDate || !payDate) return toast.error('Tanggal wajib lengkap');
    if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) return toast.error('End date tidak boleh lebih kecil dari start date');
    if (dayjs(payDate).isBefore(dayjs(endDate), 'day')) return toast.error('Pay date tidak boleh lebih kecil dari end date');

    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        ...(isEdit ? {} : { frequency, startDate: toIsoNoon(startDate), endDate: toIsoNoon(endDate), payDate: toIsoNoon(payDate) }),
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch {
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Name *</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Code</label>
          <Input value={initial?.code || ''} disabled placeholder="Akan dibuat otomatis oleh sistem" />
          <p className="text-xs text-muted-foreground">Code payroll period digenerate sistem saat create.</p>
        </div>
      </div>

      {!isEdit && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Frequency *</label>
            <Select2
              value={frequency}
              onValueChange={setFrequency}
              options={[
                { value: 'MONTHLY', label: 'MONTHLY' },
                { value: 'BIWEEKLY', label: 'BIWEEKLY' },
                { value: 'WEEKLY', label: 'WEEKLY' },
              ]}
              className="h-9"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Pay Date *</label>
            <Input type="date" value={payDate} onChange={(event) => setPayDate(event.target.value)} required />
          </div>
        </div>
      )}

      {!isEdit && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Start Date *</label>
            <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">End Date *</label>
            <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} required />
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-sm font-medium">Notes</label>
        <textarea
          rows={3}
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

export function PayrollPeriodList() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<PayrollPeriod | null>(null);
  const [closing, setClosing] = useState<PayrollPeriod | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getPayrollPeriods(companyId);
      setPeriods(data);
    } catch (error) {
      console.error('Failed to fetch periods:', error);
      toast.error('Gagal memuat payroll periods');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = periods.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: Partial<PayrollPeriod>) => {
    const companyId = localStorage.getItem('companyId') || '';
    if (!companyId) {
      toast.error('companyId tidak tersedia. Silakan login ulang.');
      throw new Error('companyId missing');
    }

    try {
      await payrollService.createPayrollPeriod({ ...data, companyId });
      toast.success('Payroll period created');
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal membuat payroll period');
      throw err;
    }
  };

  const handleUpdate = async (data: Partial<PayrollPeriod>) => {
    if (!editing) return;
    try {
      await payrollService.updatePayrollPeriod(editing.id, data);
      toast.success('Payroll period updated');
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal update payroll period');
      throw err;
    }
  };

  const handleClose = async () => {
    if (!closing) return;
    try {
      await payrollService.closePayrollPeriod(closing.id);
      toast.success('Payroll period closed');
      setClosing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal close payroll period');
    }
  };

  return (
    <div>
      <PageHeader
        title="Payroll Periods"
        description="Manage payroll periods and schedule"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" />
              Add Period
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search periods..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Period Name</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Frequency</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Start Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">End Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Pay Date</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-sm text-muted-foreground">Loading...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <CalendarDays size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No payroll periods found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((period) => (
                <tr key={period.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium">{period.name}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{period.code}</span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{period.frequency}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.startDate)}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.endDate)}</td>
                  <td className="px-4 py-3 text-center text-sm">{formatDate(period.payDate)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      period.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : period.status === 'CLOSED'
                          ? 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400'
                          : 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                    }`}>
                      {period.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(period)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={period.status === 'CLOSED'}
                        onClick={() => setClosing(period)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                        title="Close Period"
                      >
                        <Lock size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Payroll Period">
        <PeriodForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Payroll Period">
        {editing && <PeriodForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!closing}
        onClose={() => setClosing(null)}
        onConfirm={handleClose}
        title="Close Payroll Period"
        message={`Close "${closing?.name}"? Setelah ditutup, payroll run baru tidak bisa dibuat untuk period ini.`}
        confirmText="Close"
      />
    </div>
  );
}
