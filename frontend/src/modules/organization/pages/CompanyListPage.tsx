import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { organizationService, type Company } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Building, Pencil, Trash2 } from 'lucide-react';

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border"><h2 className="text-base font-semibold">{title}</h2>
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
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5"><h3 className="text-base font-semibold mb-2">{title}</h3><p className="text-sm text-muted-foreground">{message}</p></div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button>
        </div>
      </div>
    </div>
  );
}

function CompanyForm({ initial, groups, onSave, onClose }: {
  initial?: Partial<Company>; groups: { id: string; name: string }[];
  onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [groupId, setGroupId] = useState(initial?.groupId || (groups[0]?.id || ''));
  const [taxId, setTaxId] = useState(initial?.taxId || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !groupId) return toast.error('Name, code, and group are required');
    setSaving(true);
    try {
      await onSave({ name: name.trim(), code: code.trim().toUpperCase(), groupId, taxId: taxId.trim() || undefined });
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Group *</label>
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground" required>
          <option value="">Select group</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Company Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PT Maju Jaya" required /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. MJ" required /></div>
      </div>
      <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Tax ID (optional)</label>
        <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} /></div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

export function CompanyListPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [deleting, setDeleting] = useState<Company | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [companiesData, groupsData] = await Promise.all([
        organizationService.getCompanies(),
        organizationService.getGroups(),
      ]);
      setCompanies(companiesData);
      setGroups(groupsData.map((g) => ({ id: g.id, name: g.name })));
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try { await organizationService.createCompany(data); toast.success('Company created'); setShowCreate(false); fetchData(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to create'); throw err; }
  };
  const handleUpdate = async (data: any) => {
    if (!editing) return;
    try { await organizationService.updateCompany(editing.id, data); toast.success('Company updated'); setEditing(null); fetchData(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to update'); throw err; }
  };
  const handleDelete = async () => {
    if (!deleting) return;
    try { await organizationService.deleteCompany(deleting.id); toast.success('Company deleted'); setDeleting(null); fetchData(); }
    catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to delete'); }
  };

  const filtered = companies.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Companies" description="Manage companies within your organization groups"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-2" />Add Company</Button></>} />
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search companies..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 max-w-xs" /></div>
      <div className="table-container"><table className="w-full">
          <thead className="table-header"><tr>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Company Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Group</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Employees</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12">
                <div className="flex flex-col items-center gap-2"><Building size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{search ? 'No companies match your search' : 'No companies found'}</p></div></td></tr>
            : filtered.map((company) => (
                <tr key={company.id} className="table-row-hover">
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center"><Building size={16} className="text-primary" /></div>
                      <div><p className="text-sm font-medium">{company.name}</p><p className="text-xs text-muted-foreground">{company.timezone}</p></div></div></td>
                  <td className="px-4 py-3"><span className="text-sm font-mono text-muted-foreground">{company.code}</span></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{company.group?.name || '-'}</td>
                  <td className="px-4 py-3 text-center text-sm">{company._count?.employees ?? 0}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">{company.status}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex items-center justify-end gap-1">
                      <button onClick={() => setEditing(company)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit"><Pencil size={15} /></button>
                      <button onClick={() => setDeleting(company)} className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Delete"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table></div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Company">
        <CompanyForm groups={groups} onSave={handleCreate} onClose={() => setShowCreate(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Company">
        {editing && <CompanyForm initial={editing} groups={groups} onSave={handleUpdate} onClose={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete Company" message={`Delete "${deleting?.name}"?`} />
    </div>
  );
}
