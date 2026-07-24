import { useState, useEffect, useCallback, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {
  userService,
  type CreateUserPayload,
  type UpdateUserPayload,
  type UserData,
} from '@/services/user.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { employeeService, type Employee } from '@/services/employee.service';
import { rbacService, type Role } from '@/services/rbac.service';
import { useCompanyStore } from '@/stores/company.store';
import {
  Search,
  RefreshCw,
  Plus,
  Shield,
  UserRound,
  Pencil,
  Trash2,
  X,
  KeyRound,
} from 'lucide-react';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

type FormMode = 'create' | 'edit';

export function AdminUsersPage() {
  const { activeCompany } = useCompanyStore();
  const [users, setUsers] = useState<UserData[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const companyId = activeCompany?.id || '';
  const [form, setForm] = useState({
    email: '',
    password: '',
    employeeId: '',
    status: 'ACTIVE' as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
    roleIds: [] as string[],
  });

  const employeeRoleId = useMemo(
    () => roles.find((role) => role.code === 'EMPLOYEE')?.id || '',
    [roles]
  );

  const resetForm = useCallback(() => {
    setForm({
      email: '',
      password: '',
      employeeId: '',
      status: 'ACTIVE',
      roleIds: [],
    });
    setEditingUserId(null);
    setFormMode('create');
  }, []);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setUsers([]);
      setEmployees([]);
      setRoles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [userData, roleData, employeeData] = await Promise.all([
        userService.getAll(companyId),
        rbacService.findAll(companyId),
        employeeService.getEmployees({ companyId, limit: 100, page: 1 }),
      ]);
      setUsers(userData);
      setRoles(roleData);
      setEmployees(employeeData.data);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => users.filter((u) =>
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    u.employee?.fullName?.toLowerCase().includes(search.toLowerCase()) ||
    u.employee?.employeeNumber?.toLowerCase().includes(search.toLowerCase())
  ), [search, users]);

  const handleAddUser = () => {
    resetForm();
    setFormMode('create');
    setFormOpen(true);
  };

  const handleEditUser = (user: UserData) => {
    setForm({
      email: user.email,
      password: '',
      employeeId: user.employee?.id || '',
      status: (user.status as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED') || 'ACTIVE',
      roleIds: user.userRoles?.map((item) => item.role.id) || [],
    });
    setEditingUserId(user.id);
    setFormMode('edit');
    setFormOpen(true);
  };

  const toggleRole = (roleId: string) => {
    setForm((prev) => ({
      ...prev,
      roleIds: prev.roleIds.includes(roleId)
        ? prev.roleIds.filter((id) => id !== roleId)
        : [...prev.roleIds, roleId],
    }));
  };

  const handleSubmit = async () => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    if (!form.email.trim()) {
      toast.error('Email wajib diisi');
      return;
    }

    if (formMode === 'create' && !form.password.trim()) {
      toast.error('Password wajib diisi saat create user');
      return;
    }

    if (formMode === 'edit' && !form.roleIds.length) {
      toast.error('Minimal pilih satu role');
      return;
    }

    if (formMode === 'create' && !employeeRoleId) {
      toast.error('Role EMPLOYEE tidak ditemukan. Pastikan roles sudah diseed.');
      return;
    }

    setSubmitting(true);
    try {
      if (formMode === 'create') {
        const payload: CreateUserPayload = {
          email: form.email.trim(),
          password: form.password,
          employeeId: form.employeeId || undefined,
        };
        const createdUser = await userService.create(payload);
        await userService.assignRoles(createdUser.id, {
          roleIds: [employeeRoleId],
          companyId,
          scopeType: 'COMPANY',
        });
        toast.success('User berhasil dibuat');
      } else if (editingUserId) {
        const payload: UpdateUserPayload = {
          email: form.email.trim(),
          status: form.status,
          employeeId: form.employeeId || null,
        };
        await userService.update(editingUserId, payload);
        await userService.assignRoles(editingUserId, {
          roleIds: form.roleIds,
          companyId,
          scopeType: 'COMPANY',
        });
        toast.success('User berhasil diperbarui');
      }

      resetForm();
      setFormOpen(false);
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    const confirmed = window.confirm(`Hapus user ${user.email}?`);
    if (!confirmed) return;

    try {
      await userService.delete(user.id);
      toast.success('User berhasil dihapus');
      if (editingUserId === user.id) {
        resetForm();
        setFormOpen(false);
      }
      await fetchData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menghapus user');
    }
  };

  return (
    <div>
      <PageHeader title="User Management" description="Manage system users and their roles"
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
          <Button size="sm" onClick={handleAddUser}><Plus size={16} className="mr-2" />Add User</Button></>} />
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
      </div>
      <Dialog.Root
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setFormOpen(open);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm" />
          <Dialog.Content
            className={cn(
              'fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl',
              'focus:outline-none'
            )}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <Dialog.Title className="text-base font-semibold">
                  {formMode === 'create' ? 'Tambah User' : 'Edit User'}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {formMode === 'create'
                    ? 'Sambungkan user ke employee (opsional).'
                    : 'Sambungkan user ke employee dan update role sesuai kebutuhan.'}
                </Dialog.Description>
              </div>
              <button
                type="button"
                className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                onClick={() => setFormOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-5 px-5 py-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Email</label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="name@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Password
                    {formMode === 'edit' && <span className="ml-2 text-xs text-muted-foreground">Kosongkan, password tidak diubah di flow ini</span>}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={formMode === 'create' ? 'Minimal 8 karakter' : 'Tidak diubah'}
                    disabled={formMode === 'edit'}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Employee</label>
                  <Select2
                    value={form.employeeId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, employeeId: value }))}
                    options={[
                      { value: '', label: 'Tanpa employee link' },
                      ...employees.map((employee) => ({
                        value: employee.id,
                        label: `${employee.fullName} • ${employee.employeeNumber}`,
                      })),
                    ]}
                    placeholder="Pilih employee"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select2
                    value={form.status}
                    onValueChange={(value) => setForm((prev) => ({
                      ...prev,
                      status: value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
                    }))}
                    options={[
                      { value: 'ACTIVE', label: 'ACTIVE' },
                      { value: 'INACTIVE', label: 'INACTIVE' },
                      { value: 'SUSPENDED', label: 'SUSPENDED' },
                    ]}
                    placeholder="Pilih status"
                  />
                </div>
              </div>

              {formMode === 'edit' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound size={16} className="text-muted-foreground" />
                    <h4 className="text-sm font-medium">Roles</h4>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {roles.map((role) => {
                      const checked = form.roleIds.includes(role.id);
                      return (
                        <label
                          key={role.id}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                            checked ? 'border-primary bg-primary/5' : 'border-border bg-background'
                          }`}
                        >
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={() => toggleRole(role.id)}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{role.name}</p>
                            <p className="text-xs text-muted-foreground">{role.code} • {role.scope}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setFormOpen(false)} disabled={submitting}>
                Batal
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Menyimpan...' : formMode === 'create' ? 'Buat User' : 'Simpan Perubahan'}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">User</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Email</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Roles</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Last Login</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">Loading...</td></tr>
            : filtered.length === 0
              ? <tr><td colSpan={6} className="text-center py-12"><Shield size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">No users found</p></td></tr>
              : filtered.map((u) => (
                  <tr key={u.id} className="table-row-hover">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <UserRound size={16} className="text-muted-foreground shrink-0" />
                        <span className="text-sm font-medium">{u.employee?.fullName || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">{u.email}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {u.userRoles?.map((ur) => (
                          <span key={ur.role.id} className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">{ur.role.name}</span>
                        )) || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-600'
                      }`}>{u.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(u)}>
                          <Pencil size={14} className="mr-2" />
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteUser(u)}>
                          <Trash2 size={14} className="mr-2" />
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
