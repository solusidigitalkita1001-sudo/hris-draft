import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { organizationService, type Position } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, RefreshCw, Briefcase, Pencil, Trash2 } from 'lucide-react';

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
function PositionForm({ initial, onSave, onClose }: {
  initial?: Partial<Position>; onSave: (data: any) => Promise<void>; onClose: () => void;
}) {
  const companyId = localStorage.getItem('companyId') || '';
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [gradeLevel, setGradeLevel] = useState(initial?.gradeLevel || 1);
  const [saving, setSaving] = useState(false);
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return toast.error('Name and code are required');
    setSaving(true);
    try { await onSave({ name: name.trim(), code: code.trim().toUpperCase(), companyId, gradeLevel }); onClose(); }
    catch { /* handled */ }
    finally { setSaving(false); }
  };
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Position Title *</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Software Engineer" required /></div>
        <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label><Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. SE" required /></div>
      </div>
      <div><label className="block text-xs font-medium text-muted-foreground mb-1.5">Grade Level</label><Input type="number" value={gradeLevel} onChange={(e) => setGradeLevel(Number(e.target.value))} min={1} /></div>
      <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button><Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button></div>
    </form>
  );
}

export function PositionListPage() {
  const [items, setItems] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Position | null>(null);
  const [deleting, setDeleting] = useState<Position | null>(null);
  const companyId = localStorage.getItem('companyId') || '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try { setItems(await organizationService.getPositions(companyId)); }
    catch { toast.error('Failed to load positions'); }
    finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { if (companyId) fetchData(); }, [fetchData, companyId]);

  const handleCreate = async (data: any) => { try { await organizationService.createPosition(data); toast.success('Position created'); setShowCreate(false); fetchData(); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to create'); throw err; } };
  const handleUpdate = async (data: any) => { if (!editing) return; try { await organizationService.updatePosition(editing.id, data); toast.success('Updated'); setEditing(null); fetchData(); } catch (err: any) { toast.error(err?.response?.data?.message || 'Failed to update'); throw err; } };
  const handleDelete = async () => { if (!deleting) return; try { await organizationService.deletePosition(deleting.id); toast.success('Deleted'); setDeleting(null); fetchData(); } catch { toast.error('Failed to delete'); } };

  const filtered = items.filter((i) => i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title="Positions" description="Manage job positions"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button><Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-2" />Add Position</Button></>} />
      <div className="relative mb-4"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9 max-w-xs" /></div>
      <div className="table-container"><table className="w-full">
          <thead className="table-header"><tr>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Title</th>
            <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Code</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Grade</th>
            <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
            <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
          </tr></thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={5} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            : filtered.length === 0 ? <tr><td colSpan={5} className="text-center py-12"><Briefcase size={32} className="text-muted-foreground/40 mx-auto mb-2" /><p className="text-sm text-muted-foreground">{search ? 'No match' : 'No positions'}</p></td></tr>
            : filtered.map((p) => (
                <tr key={p.id} className="table-row-hover">
                  <td className="px-4 py-3 text-sm font-medium">{p.name}</td>
                  <td className="px-4 py-3 text-sm font-mono text-muted-foreground">{p.code}</td>
                  <td className="px-4 py-3 text-center text-sm">{p.gradeLevel || '-'}</td>
                  <td className="px-4 py-3 text-center"><span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">{p.status}</span></td>
                  <td className="px-4 py-3 text-right"><div className="flex justify-end gap-1">
                      <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-muted"><Pencil size={15} /></button>
                      <button onClick={() => setDeleting(p)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"><Trash2 size={15} /></button></div></td>
                </tr>
              ))}
          </tbody>
        </table></div>
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Position"><PositionForm onSave={handleCreate} onClose={() => setShowCreate(false)} /></Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Position">{editing && <PositionForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={handleDelete} title="Delete" message={`Delete "${deleting?.name}"?`} />
    </div>
  );
}
