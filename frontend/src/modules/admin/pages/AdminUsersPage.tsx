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
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import { statusLabel } from '@/components/shared/StatusChip';

type FormMode = 'create' | 'edit';

export function AdminUsersPage() {
  const { t } = useI18n();
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
      toast.error(t('adm.users.loadFailed'));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- t hanya untuk pesan error; fetch mengikuti company aktif
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
      toast.error(t('adm.common.noActiveCompany'));
      return;
    }

    if (!form.email.trim()) {
      toast.error(t('adm.users.validation.emailRequired'));
      return;
    }

    if (formMode === 'create' && !form.password.trim()) {
      toast.error(t('adm.users.validation.passwordRequired'));
      return;
    }

    if (formMode === 'edit' && !form.roleIds.length) {
      toast.error(t('adm.users.validation.roleRequired'));
      return;
    }

    if (formMode === 'create' && !employeeRoleId) {
      toast.error(t('adm.users.validation.employeeRoleMissing'));
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
        toast.success(t('adm.users.createSuccess'));
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
        toast.success(t('adm.users.updateSuccess'));
      }

      resetForm();
      setFormOpen(false);
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('adm.users.saveFailed')));
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    const confirmed = window.confirm(t('adm.users.deleteConfirm', { email: user.email }));
    if (!confirmed) return;

    try {
      await userService.delete(user.id);
      toast.success(t('adm.users.deleteSuccess'));
      if (editingUserId === user.id) {
        resetForm();
        setFormOpen(false);
      }
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('adm.users.deleteFailed')));
    }
  };

  return (
    <div>
      <PageHeader title={t('adm.users.title')} description={t('adm.users.description')}
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />{t('common.refresh')}</Button>
          <Button size="sm" onClick={handleAddUser}><Plus size={16} className="mr-2" />{t('adm.users.addUser')}</Button></>} />
      <div className="relative mb-4 max-w-xs">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder={t('adm.users.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
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
                  {formMode === 'create' ? t('adm.users.form.createTitle') : t('adm.users.form.editTitle')}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {formMode === 'create'
                    ? t('adm.users.form.createDescription')
                    : t('adm.users.form.editDescription')}
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
                  <label className="text-sm font-medium">{t('adm.users.form.email')}</label>
                  <Input
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="name@company.com"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t('adm.users.form.password')}
                    {formMode === 'edit' && <span className="ml-2 text-xs text-muted-foreground">{t('adm.users.form.passwordEditHint')}</span>}
                  </label>
                  <Input
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={formMode === 'create' ? t('adm.users.form.passwordCreatePlaceholder') : t('adm.users.form.passwordEditPlaceholder')}
                    disabled={formMode === 'edit'}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adm.users.form.employee')}</label>
                  <Select2
                    value={form.employeeId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, employeeId: value }))}
                    options={[
                      { value: '', label: t('adm.users.form.noEmployeeLink') },
                      ...employees.map((employee) => ({
                        value: employee.id,
                        label: `${employee.fullName} • ${employee.employeeNumber}`,
                      })),
                    ]}
                    placeholder={t('adm.users.form.selectEmployee')}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adm.common.status')}</label>
                  <Select2
                    value={form.status}
                    onValueChange={(value) => setForm((prev) => ({
                      ...prev,
                      status: value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
                    }))}
                    options={[
                      { value: 'ACTIVE', label: t('adm.status.active') },
                      { value: 'INACTIVE', label: t('adm.status.inactive') },
                      { value: 'SUSPENDED', label: t('adm.status.suspended') },
                    ]}
                    placeholder={t('adm.users.form.selectStatus')}
                  />
                </div>
              </div>

              {formMode === 'edit' && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <KeyRound size={16} className="text-muted-foreground" />
                    <h4 className="text-sm font-medium">{t('adm.users.form.roles')}</h4>
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
                {t('common.cancel')}
              </Button>
              <Button size="sm" onClick={handleSubmit} disabled={submitting}>
                {submitting ? t('adm.common.saving') : formMode === 'create' ? t('adm.users.form.createUser') : t('adm.users.form.saveChanges')}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.users.th.user')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.users.th.email')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.users.th.roles')}</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.common.status')}</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.users.th.lastLogin')}</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('adm.common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? <tr><td colSpan={6} className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            : filtered.length === 0
              ? <tr><td colSpan={6} className="text-center py-12"><Shield size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">{t('adm.users.empty')}</p></td></tr>
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
                      }`}>{statusLabel(u.status, t)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{u.lastLoginAt ? formatDate(u.lastLoginAt) : t('adm.users.never')}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditUser(u)}>
                          <Pencil size={14} className="mr-2" />
                          {t('common.edit')}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleDeleteUser(u)}>
                          <Trash2 size={14} className="mr-2" />
                          {t('common.delete')}
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
