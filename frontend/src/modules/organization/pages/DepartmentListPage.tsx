import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { organizationService, type Department } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Building2, Pencil, Trash2 } from 'lucide-react';

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border"><h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button></div>
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
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">Delete</Button></div>
      </div>
    </div>
  );
}
function DeptForm({ initial, onSave, onClose }: {
  initial?: Partial<Department>; onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const companyId = localStorage.getItem('companyId') || '';
  const [name, setName] = useState(initial?.name || '');
  const [costCenter, setCostCenter] = useState(initial?.costCenter || '');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Name is required');
    setSaving(true);
    try { await onSave({ name: name.trim(), companyId, costCenter: costCenter.trim() || undefined }); onClose(); }
    catch { /* handled */ }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Department Name *</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Human Resources" required /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Code</label><Input value={isEdit ? initial?.code || '' : ''} disabled placeholder="Akan dibuat otomatis oleh sistem" /></div>
      </div>
      <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Cost Center (optional)</label><Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} placeholder="e.g. CC-HR-001" /></div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
    </form>
  );
}

export function DepartmentListPage() {
  const [items, setItems] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState<Department | null>(null);
  const companyId = localStorage.getItem('companyId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { setItems(await organizationService.getDepartments(companyId)); }
    catch { toast.error('Failed to load departments'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (companyId) fetchData(); }, [fetchData, companyId]);

  const handleCreate = async (data: any) => { try { await organizationService.createDepartment(data); toast.success('Department created'); setShowCreate(false); fetchData(); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to create'); throw err; } };
  const handleUpdate = async (data: any) => { if (!editing) return; try { await organizationService.updateDepartment(editing.id, data); toast.success('Updated'); setEditing(null); fetchData(); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to update'); throw err; } };
  const handleDelete = async () => { if (!deleting) return; try { await organizationService.deleteDepartment(deleting.id); toast.success('Deleted'); setDeleting(null); fetchData(); } catch { toast.error('Failed to delete'); } };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Departments" description="Manage departments"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button><Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-2" />Add Department</Button></>} />
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 max-w-xs" /></div>
      <div className="table-container"><table className="w-full">
          <thead className="table-header"><tr>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Name</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Cost Center</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Sub-Depts</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Positions</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={6} className="text-center py-12"><Building2 size={32} className="text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{search ? 'No match' : 'No departments'}</p></td></tr>
            : filtered.map((d) => (
                <tr key={d.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm font-medium">{d.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{d.code}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{d.costCenter || '-'}</td>
                  <td className="px-4 py-3 text-center text-sm">{d._count?.children || 0}</td>
                  <td className="px-4 py-3 text-center text-sm">{d._count?.positions || 0}</td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(d)} className="p-1.5 rounded-lg hover:bg-muted"><Pencil size={15} /></button>
                      <button onClick={() => setDeleting(d)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table></div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Department"><DeptForm onSave={handleCreate} onClose={() => setShowCreate(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Department">{editing && <DeptForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete" message={`Delete "${deleting?.name}"?`} />
    </div>
  );
}
