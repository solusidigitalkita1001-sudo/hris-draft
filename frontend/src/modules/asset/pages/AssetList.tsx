import { useState, useEffect, useCallback } from 'react';
import { assetService, type Asset } from '@/services/asset.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Search, RefreshCw, Plus, Package, UserRound } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import toast from 'react-hot-toast';

// ─── Status style map ────────────────────────────────────
const STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ASSIGNED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  MAINTENANCE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  DISPOSED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

const ASSET_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Available' },
  { value: 'ASSIGNED', label: 'Assigned' },
  { value: 'MAINTENANCE', label: 'Maintenance' },
  { value: 'DISPOSED', label: 'Disposed' },
];

// ─── Modal wrapper ────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
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

// ─── Asset Form ────────────────────────────────────────────
function AssetForm({ onSave, onClose }: {
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchaseValue, setPurchaseValue] = useState<number | ''>('');
  const [status, setStatus] = useState('AVAILABLE');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Asset name is required');
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        category: category.trim() || undefined,
        serialNumber: serialNumber.trim() || undefined,
        purchaseValue: purchaseValue === '' ? undefined : Number(purchaseValue),
        status,
      });
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Name *</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dell Latitude 5450" required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Asset Code</label>
        <Input value="" disabled placeholder="Akan dibuat otomatis oleh sistem" />
        <p className="mt-1 text-[11px] text-muted-foreground">Asset code digenerate sistem saat create.</p>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Category</label>
        <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Laptop, Furniture, Vehicle" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Serial Number</label>
        <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="e.g. SN-12345-XYZ" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Purchase Value</label>
        <Input type="number" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value === '' ? '' : Number(e.target.value))} placeholder="e.g. 15000000" min={0} />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
        <Select2 value={status} onValueChange={setStatus} options={ASSET_STATUS_OPTIONS} />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────
export function AssetList() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const cid = localStorage.getItem('companyId') || '';
      setAssets(await assetService.getAll(cid));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      const cid = localStorage.getItem('companyId') || '';
      await assetService.create({ ...data, companyId: cid });
      toast.success('Asset created successfully');
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create asset');
      throw err;
    }
  };

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.assetCode.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Asset Management" description="Manage company assets & assignments"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-2" />Add Asset</Button></>} />
      <div className="relative mb-4 max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search assets..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        : filtered.length === 0 ? <div className="col-span-full text-center py-12"><Package size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No assets found</p></div>
        : filtered.map((a) => (
          <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center"><Package size={20} className="text-muted-foreground" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{a.name}</p><p className="text-xs text-muted-foreground font-mono">{a.assetCode}</p></div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[a.status] || ''}`}>{a.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {a.currentValue && <span>{formatCurrency(Number(a.currentValue))}</span>}
              {a.assignments?.filter(as => !as.returnedAt).map(as => (
                <span key={as.id} className="flex items-center gap-1"><UserRound size={12} />{as.employee?.fullName}</span>
              ))}
            </div>
            {a.serialNumber && <p className="text-xs text-muted-foreground mt-2">SN: {a.serialNumber}</p>}
          </div>
        ))}
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Asset">
        <AssetForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
}
