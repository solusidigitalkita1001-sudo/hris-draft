import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  administrationService,
  MENU_ITEMS,
  type MenuAccessType,
  type MenuCatalogItem,
} from '@/services/administration.service';
import { rbacService, type Role } from '@/services/rbac.service';
import { useCompanyStore } from '@/stores/company.store';
import { cn } from '@/utils/cn';

type MenuRowState = Record<string, MenuAccessType>;

const defaultMenuState = (): MenuRowState => Object.fromEntries(
  MENU_ITEMS.map((item) => [item.path, 'ALLOW' as const]),
);

function messageFromError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

export function AdminMenuAccessPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleCode, setRoleCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [rowState, setRowState] = useState<MenuRowState>(defaultMenuState);
  const [savedState, setSavedState] = useState<MenuRowState>(defaultMenuState);

  const roleOptions = useMemo(() => roles.map((role) => ({
    value: role.code,
    label: `${role.name} · ${role.scope}`,
  })), [roles]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.code === roleCode) ?? null,
    [roleCode, roles],
  );

  const isDirty = useMemo(
    () => MENU_ITEMS.some((item) => rowState[item.path] !== savedState[item.path]),
    [rowState, savedState],
  );

  const fetchRoles = useCallback(async () => {
    if (!companyId) {
      setRoles([]);
      setRoleCode('');
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError('');
    try {
      const data = await rbacService.findAll(companyId);
      const activeRoles = data.filter((role) => role.status === 'ACTIVE');
      setRoles(activeRoles);
      setRoleCode((current) => (
        activeRoles.some((role) => role.code === current)
          ? current
          : activeRoles[0]?.code || ''
      ));
    } catch (error) {
      setRoles([]);
      setRoleCode('');
      setLoadError(messageFromError(error, 'Role tidak dapat dimuat. Periksa koneksi lalu coba lagi.'));
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  const fetchAccess = useCallback(async () => {
    if (!companyId || !roleCode) return;
    setLoading(true);
    setLoadError('');
    try {
      const list = await administrationService.listRoleMenuAccess(companyId, roleCode);
      const next = defaultMenuState();
      for (const item of list) {
        if (item.menuPath in next) next[item.menuPath] = item.accessType;
      }
      setRowState(next);
      setSavedState(next);
    } catch (error) {
      setLoadError(messageFromError(error, 'Menu access tidak dapat dimuat. Perubahan belum dilakukan.'));
    } finally {
      setLoading(false);
    }
  }, [companyId, roleCode]);

  useEffect(() => { void fetchRoles(); }, [fetchRoles]);
  useEffect(() => { void fetchAccess(); }, [fetchAccess]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const handleRoleChange = (nextRole: string) => {
    if (isDirty && !window.confirm('Perubahan menu belum disimpan. Pindah role dan buang perubahan?')) return;
    setRoleCode(nextRole);
  };

  const handleSave = async () => {
    if (!companyId || !roleCode || !isDirty) return;
    setSaving(true);
    try {
      const items = MENU_ITEMS.map(({ path }) => ({
        menuPath: path,
        accessType: rowState[path] ?? 'ALLOW',
      }));
      await administrationService.bulkUpsertRoleMenuAccess({ companyId, roleCode, items });
      setSavedState({ ...rowState });
      toast.success(`Menu access ${selectedRole?.name ?? roleCode} berhasil disimpan`);
    } catch (error) {
      toast.error(messageFromError(error, 'Menu access gagal disimpan. Coba lagi.'));
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return MENU_ITEMS;
    return MENU_ITEMS.filter((item) => (
      item.label.toLocaleLowerCase().includes(query)
      || item.path.toLocaleLowerCase().includes(query)
      || item.group.toLocaleLowerCase().includes(query)
    ));
  }, [search]);

  const groupedItems = useMemo(() => filteredItems.reduce<Record<string, MenuCatalogItem[]>>(
    (groups, item) => ({ ...groups, [item.group]: [...(groups[item.group] ?? []), item] }),
    {},
  ), [filteredItems]);

  const stats = useMemo(() => {
    const access = MENU_ITEMS.map((item) => rowState[item.path] ?? 'ALLOW');
    return {
      visible: access.filter((value) => value === 'ALLOW').length,
      hidden: access.filter((value) => value === 'DENY').length,
    };
  }, [rowState]);

  const setGroupAccess = (items: MenuCatalogItem[], accessType: MenuAccessType) => {
    setRowState((current) => ({
      ...current,
      ...Object.fromEntries(items.map((item) => [item.path, accessType])),
    }));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Menu Access"
        description="Atur menu yang terlihat untuk setiap role pada company aktif. Permission API tetap menjadi lapisan otorisasi utama."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchAccess()} disabled={loading || !roleCode}>
              <RefreshCw size={16} className={cn('mr-2', loading && 'animate-spin')} />
              Muat ulang
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || loading || !isDirty}>
              <Save size={16} className="mr-2" />
              {saving ? 'Menyimpan…' : isDirty ? 'Simpan perubahan' : 'Tersimpan'}
            </Button>
          </div>
        )}
      />

      <section className="rounded-2xl bg-card p-5 shadow-sm" aria-labelledby="menu-access-context">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="min-w-0">
            <label id="menu-access-context" className="mb-1.5 block text-sm font-medium">Role</label>
            <Select2
              value={roleCode}
              onValueChange={handleRoleChange}
              options={roleOptions}
              placeholder={loading ? 'Memuat role…' : 'Pilih role'}
              disabled={loading || roleOptions.length === 0}
            />
            <p className="mt-1.5 text-sm text-muted-foreground">
              {selectedRole?.description || 'Role aktif dari konfigurasi RBAC company ini.'}
            </p>
          </div>
          <div className="min-w-0">
            <label htmlFor="menu-access-search" className="mb-1.5 block text-sm font-medium">Cari menu</label>
            <div className="relative">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="menu-access-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nama, kelompok, atau path"
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex min-h-10 items-center gap-4 text-sm" aria-live="polite">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <Eye size={16} /> {stats.visible} terlihat
            </span>
            <span className="inline-flex items-center gap-1.5 text-rose-700 dark:text-rose-300">
              <EyeOff size={16} /> {stats.hidden} disembunyikan
            </span>
          </div>
        </div>
      </section>

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex min-w-0 items-start gap-2 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => void fetchRoles()}>Coba lagi</Button>
        </div>
      )}

      {!loadError && !loading && roles.length === 0 && (
        <div className="rounded-2xl bg-card px-6 py-12 text-center shadow-sm">
          <ShieldCheck className="mx-auto mb-3 text-muted-foreground" size={28} />
          <h2 className="text-lg font-semibold">Belum ada role aktif</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
            Buat role pada halaman Roles & Permissions sebelum mengatur visibilitas menu.
          </p>
        </div>
      )}

      {!loadError && roles.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-card shadow-sm">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
              <RefreshCw size={17} className="animate-spin" /> Memuat konfigurasi menu…
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Search className="mx-auto mb-3 text-muted-foreground" size={26} />
              <h2 className="font-semibold">Menu tidak ditemukan</h2>
              <p className="mt-1 text-sm text-muted-foreground">Coba kata kunci lain atau hapus pencarian.</p>
            </div>
          ) : (
            Object.entries(groupedItems).map(([group, items]) => (
              <section key={group} aria-labelledby={`menu-group-${group}`} className="border-b border-border last:border-0">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/45 px-4 py-3 sm:px-5">
                  <div>
                    <h2 id={`menu-group-${group}`} className="font-semibold">{group}</h2>
                    <p className="text-sm text-muted-foreground">{items.length} menu pada kelompok ini</p>
                  </div>
                  <div className="flex items-center gap-1" aria-label={`Aksi massal ${group}`}>
                    <Button variant="ghost" size="sm" onClick={() => setGroupAccess(items, 'ALLOW')}>Tampilkan semua</Button>
                    <Button variant="ghost" size="sm" onClick={() => setGroupAccess(items, 'DENY')}>Sembunyikan semua</Button>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {items.map((item) => {
                    const access = rowState[item.path] ?? 'ALLOW';
                    return (
                      <div key={item.path} className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-5">
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{item.label}</p>
                          <code className="mt-1 block truncate text-xs text-muted-foreground">{item.path}</code>
                        </div>
                        <div role="radiogroup" aria-label={`Visibilitas ${item.label}`} className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            role="radio"
                            aria-checked={access === 'ALLOW'}
                            onClick={() => setRowState((current) => ({ ...current, [item.path]: 'ALLOW' }))}
                            className={cn(
                              'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
                              access === 'ALLOW'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/45 dark:text-emerald-200'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <CheckCircle2 size={16} /> Terlihat
                          </button>
                          <button
                            type="button"
                            role="radio"
                            aria-checked={access === 'DENY'}
                            onClick={() => setRowState((current) => ({ ...current, [item.path]: 'DENY' }))}
                            className={cn(
                              'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
                              access === 'DENY'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-900/45 dark:text-rose-200'
                                : 'bg-muted text-muted-foreground hover:text-foreground',
                            )}
                          >
                            <EyeOff size={16} /> Disembunyikan
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      )}
    </div>
  );
}
