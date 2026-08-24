import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { payrollService, type SalaryComponent } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, Wallet, Percent, Pencil, Trash2 } from 'lucide-react';

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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
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
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
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
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button>
        </div>
      </div>
    </div>
  );
}

function SalaryComponentForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: SalaryComponent | null;
  onSave: (data: Partial<SalaryComponent>) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState<SalaryComponent['type']>(initial?.type || 'ALLOWANCE');
  const [calculationMethod, setCalculationMethod] = useState<string>(initial?.calculationMethod || 'FIXED');
  const [amount, setAmount] = useState(initial?.amount !== undefined && initial?.amount !== null ? String(initial.amount) : '');
  const [ratePercent, setRatePercent] = useState(initial?.ratePercent !== undefined && initial?.ratePercent !== null ? String(initial.ratePercent) : '');
  const [isTaxable, setIsTaxable] = useState(Boolean(initial?.isTaxable ?? true));
  const [isProrated, setIsProrated] = useState(Boolean(initial?.isProrated ?? false));
  const [isActive, setIsActive] = useState(Boolean(initial?.isActive ?? true));
  const [description, setDescription] = useState(initial?.description || '');
  const [sortOrder, setSortOrder] = useState<number>(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const trimmedName = name.trim();
    if (!trimmedName) {
      toast.error('Name wajib diisi');
      return;
    }

    const parsedAmount = amount.trim() ? Number(amount) : undefined;
    const parsedRate = ratePercent.trim() ? Number(ratePercent) : undefined;

    if (calculationMethod === 'FIXED') {
      if (parsedAmount === undefined || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
        toast.error('Amount harus > 0 untuk FIXED');
        return;
      }
    }

    if (calculationMethod === 'PERCENTAGE') {
      if (parsedRate === undefined || Number.isNaN(parsedRate) || parsedRate < 0 || parsedRate > 100) {
        toast.error('Rate percent harus 0 - 100 untuk PERCENTAGE');
        return;
      }
    }

    setSaving(true);
    try {
      await onSave({
        name: trimmedName,
        type,
        calculationMethod,
        amount: calculationMethod === 'FIXED' ? parsedAmount : undefined,
        ratePercent: calculationMethod === 'PERCENTAGE' ? parsedRate : undefined,
        isTaxable,
        isProrated,
        isActive,
        description: description.trim() || undefined,
        sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
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
          <Input
            value={initial?.code || ''}
            disabled
            placeholder="Akan dibuat otomatis oleh sistem"
          />
          <p className="text-xs text-muted-foreground">Code salary component digenerate sistem dan tidak bisa diedit manual.</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Type *</label>
          <Select2
            value={type}
            onValueChange={(value) => setType(value as SalaryComponent['type'])}
            options={[
              { value: 'ALLOWANCE', label: 'ALLOWANCE' },
              { value: 'DEDUCTION', label: 'DEDUCTION' },
            ]}
            className="h-9"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Calculation Method *</label>
          <Select2
            value={calculationMethod}
            onValueChange={setCalculationMethod}
            options={[
              { value: 'FIXED', label: 'FIXED' },
              { value: 'PERCENTAGE', label: 'PERCENTAGE' },
            ]}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">
            Formula method coming soon. Gunakan FIXED untuk nominal pasti atau PERCENTAGE untuk persentase gaji.
          </p>
        </div>
      </div>

      {calculationMethod === 'FIXED' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Amount *</label>
          <Input type="number" min={0} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
        </div>
      )}

      {calculationMethod === 'PERCENTAGE' && (
        <div className="space-y-2">
          <label className="text-sm font-medium">Rate Percent *</label>
          <Input type="number" min={0} max={100} step="0.01" value={ratePercent} onChange={(event) => setRatePercent(event.target.value)} required />
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isTaxable} onChange={(event) => setIsTaxable(event.target.checked)} />
          Taxable
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isProrated} onChange={(event) => setIsProrated(event.target.checked)} />
          Prorated
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
          Active
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium">Sort Order</label>
          <Input type="number" value={String(sortOrder)} onChange={(event) => setSortOrder(Number(event.target.value))} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Description</label>
          <Input value={description} onChange={(event) => setDescription(event.target.value)} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

export function SalaryComponentList() {
  const [components, setComponents] = useState<SalaryComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SalaryComponent | null>(null);
  const [deleting, setDeleting] = useState<SalaryComponent | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await payrollService.getSalaryComponents(companyId);
      setComponents(data);
    } catch (error) {
      console.error('Failed to fetch salary components:', error);
      toast.error('Gagal memuat salary components');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = components.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: Partial<SalaryComponent>) => {
    const companyId = localStorage.getItem('companyId') || '';
    if (!companyId) {
      toast.error('companyId tidak tersedia. Silakan login ulang.');
      throw new Error('companyId missing');
    }

    try {
      await payrollService.createSalaryComponent({ ...data, companyId });
      toast.success('Salary component created');
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal membuat salary component');
      throw err;
    }
  };

  const handleUpdate = async (data: Partial<SalaryComponent>) => {
    if (!editing) return;
    try {
      await payrollService.updateSalaryComponent(editing.id, data);
      toast.success('Salary component updated');
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal update salary component');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await payrollService.deleteSalaryComponent(deleting.id);
      toast.success('Salary component deleted');
      setDeleting(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal delete salary component');
    }
  };

  return (
    <div>
      <PageHeader
        title="Salary Components"
        description="Manage salary components such as allowances, deductions, and benefits"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" />
              Add Component
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search components..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Component</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Type</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Method</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Amount/Rate</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Taxable</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Active</th>
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
                    <Wallet size={32} className="text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No salary components found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((comp) => (
                <tr key={comp.id} className="table-row-hover">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                        {comp.type === 'ALLOWANCE' ? (
                          <Wallet size={16} className="text-primary" />
                        ) : (
                          <Percent size={16} className="text-destructive" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{comp.name}</p>
                        <p className="text-xs text-muted-foreground">{comp.description || comp.calculationMethod}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-muted-foreground">{comp.code}</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.type === 'ALLOWANCE'
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400'
                    }`}>
                      {comp.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-muted-foreground">{comp.calculationMethod}</td>
                  <td className="px-4 py-3 text-right text-sm">
                    {comp.calculationMethod === 'PERCENTAGE'
                      ? `${comp.ratePercent}%`
                      : comp.amount
                        ? `Rp ${Number(comp.amount).toLocaleString()}`
                        : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.isTaxable
                        ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                    }`}>
                      {comp.isTaxable ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      comp.isActive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                    }`}>
                      {comp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setEditing(comp)}
                        className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Edit"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleting(comp)}
                        className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                        title="Delete"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Salary Component">
        <SalaryComponentForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Salary Component">
        {editing && <SalaryComponentForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Salary Component"
        message={`Delete "${deleting?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
