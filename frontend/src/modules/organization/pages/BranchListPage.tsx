import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { organizationService, type Branch, type Company } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, MapPin, Pencil, Trash2, Building2, Globe, Phone, Mail, Map } from 'lucide-react';

// ─── Extended Branch type (backend supports these fields) ─────
interface BranchExtended extends Branch {
  address?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  company?: { id: string; name: string; code: string };
}

// ─── Modal ──────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
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

function BranchForm({ initial, companies, onSave, onClose }: {
  initial?: Partial<BranchExtended>;
  companies: Company[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [companyId, setCompanyId] = useState(initial?.companyId || '');
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [timezone, setTimezone] = useState(initial?.timezone || 'Asia/Jakarta');
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error('Company is required');
    if (!name.trim() || !code.trim()) return toast.error('Name and code are required');
    setSaving(true);
    try {
      await onSave({
        companyId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        timezone,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Company *</label>
        <Select2
          value={companyId}
          onValueChange={setCompanyId}
          options={companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
          placeholder="Select company..."
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Branch Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Jakarta HQ" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. JKT-HQ" required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Address</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. Jl. Sudirman No. 1"
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Phone</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +62 21 12345678" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Email</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="e.g. branch@company.com" type="email" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Timezone</label>
        <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. Asia/Jakarta" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Latitude</label>
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="e.g. -6.2088" type="number" step="any" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Longitude</label>
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="e.g. 106.8456" type="number" step="any" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];

export function BranchListPage() {
  const [branches, setBranches] = useState<BranchExtended[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BranchExtended | null>(null);
  const [deleting, setDeleting] = useState<BranchExtended | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchData, companyData] = await Promise.all([
        organizationService.findBranches(),
        organizationService.getCompanies(),
      ]);
      setBranches(branchData as BranchExtended[]);
      setCompanies(companyData);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      toast.error('Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await organizationService.createBranch(data);
      toast.success('Branch created');
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create branch');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    try {
      await organizationService.updateBranch(editing.id, data);
      toast.success('Branch updated');
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update branch');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await organizationService.deleteBranch(deleting.id);
      toast.success('Branch deleted');
      setDeleting(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete branch');
    }
  };

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(search.toLowerCase())) ||
      (b.phone && b.phone.includes(search));
    const matchesStatus = !statusFilter || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader
        title="Branches"
        description="Manage branch offices and locations"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> Add Branch
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search branches..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="w-40">
          <Select2
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder="All Status"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MapPin size={40} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter ? 'No branches match your filters' : 'No branches found'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{branch.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{branch.code}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    branch.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {branch.status}
                  </span>
                </div>

                {branch.company && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                    <Building2 size={13} />
                    <span>{branch.company.name}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {branch.address && (
                    <div className="flex items-start gap-1.5">
                      <Map size={13} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} className="shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail size={13} className="shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="shrink-0" />
                    <span>{branch.timezone}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 px-4 py-2.5 border-t border-border bg-muted/30 rounded-b-xl">
                <button
                  onClick={() => setEditing(branch)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleting(branch)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Branch">
        <BranchForm companies={companies} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Branch">
        {editing && <BranchForm initial={editing} companies={companies} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title="Delete Branch"
        message={`Delete "${deleting?.name}"? This action cannot be undone.`}
      />
    </div>
  );
}
