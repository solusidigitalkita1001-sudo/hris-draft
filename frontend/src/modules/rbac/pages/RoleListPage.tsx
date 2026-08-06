import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { rbacService, type Role, type Permission } from '@/services/rbac.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useCompanyStore } from '@/stores/company.store';
import {
  Shield, Plus, RefreshCw, Pencil, Trash2, Search,
  Users, CheckCircle, XCircle, Globe,
  Building2, Building, Lock,
} from 'lucide-react';

// ─── Modal ──────────────────────────────────────────────
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

// ─── Role Form ──────────────────────────────────────────
function RoleForm({ initial, onSave, onClose }: {
  initial?: Partial<Role>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [scope, setScope] = useState(initial?.scope || 'COMPANY');
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [saving, setSaving] = useState(false);
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const isEditing = Boolean(initial?.id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error('Role name is required');
    if (!companyId) return toast.error('Company belum aktif');

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || undefined,
      priority,
    };

    if (!isEditing) {
      payload.scope = 'COMPANY';
      payload.companyId = companyId;
    }

    setSaving(true);
    try {
      await onSave(payload);
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Role Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. HR Manager" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code</label>
          <Input
            value={initial?.code || ''}
            placeholder="Akan dibuat otomatis oleh sistem"
            disabled
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Code role digenerate sistem dan tidak bisa diedit manual.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Scope</label>
          <Select2
            value={scope}
            onValueChange={(value) => setScope(value as 'GLOBAL' | 'GROUP' | 'COMPANY')}
            options={[{ value: 'COMPANY', label: 'Company' }]}
            className="h-9"
            disabled
          />
          <p className="mt-1 text-[11px] text-muted-foreground">Custom role dari halaman ini hanya boleh scope `COMPANY`.</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
          <Input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} min={0} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. Manages HR operations and employee data"
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

// ─── Permission Manager Modal ───────────────────────────
function PermissionManager({ role, open, onClose }: {
  role: Role | null;
  open: boolean;
  onClose: () => void;
}) {
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [moduleFilter, setModuleFilter] = useState('');

  const fetchPermissions = useCallback(async () => {
    if (!role) return;
    setLoading(true);
    try {
      const [allPerms, rolePerms] = await Promise.all([
        rbacService.getAllPermissions(moduleFilter || undefined),
        rbacService.getPermissions(role.id),
      ]);
      setAllPermissions(allPerms);
      setRolePermissions(new Set(rolePerms.map((p) => p.id)));
    } catch {
      toast.error('Failed to load permissions');
    } finally {
      setLoading(false);
    }
  }, [role, moduleFilter]);

  useEffect(() => { if (open) fetchPermissions(); }, [open, fetchPermissions]);

  const togglePermission = (permId: string) => {
    setRolePermissions((prev) => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!role) return;
    setSaving(true);
    try {
      await rbacService.assignPermissions(role.id, Array.from(rolePermissions));
      toast.success('Permissions updated');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  // Group permissions by module
  const grouped = allPermissions.reduce(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {} as Record<string, Permission[]>
  );

  const modules = Object.keys(grouped).sort();

  if (!open || !role) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold">Permissions — {role.name}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Toggle permissions to assign or revoke</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>

        <div className="px-5 py-3 border-b border-border">
          <Select2
            value={moduleFilter}
            onValueChange={setModuleFilter}
            options={[
              { value: '', label: 'All Modules' },
              ...modules.map((m) => ({ value: m, label: m })),
            ]}
            className="w-full max-w-xs h-9"
          />
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-muted-foreground">Loading permissions...</div>
            </div>
          ) : modules.length === 0 ? (
            <div className="flex flex-col items-center py-12">
              <Lock size={36} className="text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No permissions found</p>
            </div>
          ) : (
            <div className="space-y-5">
              {modules.map((mod) => (
                <div key={mod}>
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{mod}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {grouped[mod].map((perm) => (
                      <label
                        key={perm.id}
                        className={`flex items-center gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors ${
                          rolePermissions.has(perm.id)
                            ? 'bg-primary/5 border-primary/30'
                            : 'bg-background border-border hover:border-muted-foreground/30'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={rolePermissions.has(perm.id)}
                          onChange={() => togglePermission(perm.id)}
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{perm.name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono truncate">{perm.code}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-between items-center px-5 py-3 border-t border-border">
          <span className="text-xs text-muted-foreground">{rolePermissions.size} of {allPermissions.length} selected</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Permissions'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ──────────────────────────────────────────
export function RoleListPage() {
  const { activeCompany } = useCompanyStore();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [permissionRole, setPermissionRole] = useState<Role | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [deletingRole, setDeletingRole] = useState<Role | null>(null);
  const companyId = activeCompany?.id || '';

  const fetchData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await rbacService.findAll(companyId);
      setRoles(data);
    } catch {
      toast.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await rbacService.create(data);
      toast.success('Role created');
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create role');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editingRole) return;
    try {
      await rbacService.update(editingRole.id, data);
      toast.success('Role updated');
      setEditingRole(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update role');
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deletingRole) return;
    try {
      await rbacService.delete(deletingRole.id);
      toast.success('Role deleted');
      setDeletingRole(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to delete role');
    }
  };

  const SCOPE_ICONS: Record<string, React.ReactNode> = {
    GLOBAL: <Globe size={14} />,
    GROUP: <Building2 size={14} />,
    COMPANY: <Building size={14} />,
  };

  const filtered = roles.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Role Management"
        description="Create and manage roles with granular permissions"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> New Role
            </Button>
          </div>
        }
      />

      <div className="relative max-w-xs mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search roles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      <div className="mb-4 rounded-xl border border-border bg-card p-4 text-sm">
        <p className="font-medium">Ketentuan RBAC</p>
        <div className="mt-2 grid gap-1 text-muted-foreground">
          <p>System role: hanya bisa dilihat, tidak bisa edit, delete, atau update permissions.</p>
          <p>Custom role: bisa update `name`, `code`, `description`, `priority`, dan permissions.</p>
          <p>Scope binding (`scope`, `companyId`, `groupId`) tidak boleh diubah setelah role dibuat.</p>
          <p>Custom role dari halaman ini dibuat sebagai role `COMPANY` pada company aktif.</p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Loading roles...</div>
        </div>
      )}

      {/* Empty */}
      {!loading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Shield size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search ? 'No roles match your search' : 'No roles defined yet'}
          </p>
          {!search && (
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> Create Role
            </Button>
          )}
        </div>
      )}

      {/* Role Cards */}
      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((role) => (
            <div
              key={role.id}
              className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    role.isSystem
                      ? 'bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <Shield size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold flex items-center gap-1.5">
                      {role.name}
                      {role.isSystem && (
                        <span className="text-[10px] bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">System</span>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground font-mono">{role.code}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  {SCOPE_ICONS[role.scope] || <Building size={14} />}
                  {role.scope}
                </span>
                <span className="flex items-center gap-1">
                  <Users size={14} />
                  {role._count?.userRoles ?? 0} users
                </span>
              </div>

              {role.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{role.description}</p>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1">
                  <Lock size={12} />
                  {role._count?.rolePermissions ?? 0} permissions
                </span>
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                  role.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {role.status === 'ACTIVE' ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {role.status}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 pt-3 border-t border-border">
                <button
                  onClick={() => setPermissionRole(role)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={role.isSystem}
                >
                  <Lock size={13} /> Permissions
                </button>
                <button
                  onClick={() => setEditingRole(role)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                  disabled={role.isSystem}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeletingRole(role)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors ml-auto"
                  title="Delete"
                  disabled={role.isSystem}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Role">
        <RoleForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editingRole} onClose={() => setEditingRole(null)} title="Edit Role">
        {editingRole && (
          <RoleForm initial={editingRole} onSave={handleUpdate} onClose={() => setEditingRole(null)} />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deletingRole}
        onClose={() => setDeletingRole(null)}
        onConfirm={handleDelete}
        title="Delete Role"
        message={`Are you sure you want to delete "${deletingRole?.name}"? This action cannot be undone.`}
      />

      <PermissionManager
        role={permissionRole}
        open={!!permissionRole}
        onClose={() => { setPermissionRole(null); fetchData(); }}
      />
    </div>
  );
}
