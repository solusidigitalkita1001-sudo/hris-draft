import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Building2,
  Check,
  Globe2,
  MapPin,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  administrationService,
  RESOURCE_OPTIONS,
  SCOPE_TYPE_OPTIONS,
  type DataScopeType,
  type MyDataScopeResponse,
} from '@/services/administration.service';
import {
  organizationService,
  type Branch,
  type Department,
} from '@/services/organization.service';
import { rbacService, type Role } from '@/services/rbac.service';
import { useCompanyStore } from '@/stores/company.store';
import { cn } from '@/utils/cn';

interface ScopeEntity {
  id: string;
  name: string;
  code?: string;
}

function messageFromError(error: unknown, fallback: string) {
  return (error as { response?: { data?: { message?: string } } })?.response?.data?.message || fallback;
}

function scopeNeedsSelection(scopeType: DataScopeType) {
  return ['BRANCH_ONLY', 'DEPARTMENT_ONLY', 'SUB_DEPARTMENT_ONLY'].includes(scopeType);
}

function ScopeIcon({ type, size = 16 }: { type: DataScopeType; size?: number }) {
  switch (type) {
    case 'ALL': return <Globe2 size={size} />;
    case 'COMPANY_ONLY': return <Building2 size={size} />;
    case 'BRANCH_ONLY': return <MapPin size={size} />;
    case 'DEPARTMENT_ONLY':
    case 'SUB_DEPARTMENT_ONLY': return <Users size={size} />;
    case 'EMPLOYEE_SELF': return <UserCheck size={size} />;
    case 'MANAGER_TEAM': return <ShieldCheck size={size} />;
  }
}

function ScopeEntityPicker({
  entities,
  selectedIds,
  onChange,
  loading,
}: {
  entities: ScopeEntity[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  loading: boolean;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return entities;
    return entities.filter((entity) => (
      entity.name.toLocaleLowerCase().includes(query)
      || entity.code?.toLocaleLowerCase().includes(query)
    ));
  }, [entities, search]);

  const toggle = (id: string) => onChange(
    selectedIds.includes(id)
      ? selectedIds.filter((selectedId) => selectedId !== id)
      : [...selectedIds, id],
  );

  return (
    <div className="overflow-hidden rounded-xl bg-muted/35">
      <div className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative min-w-0 flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari nama atau kode"
            className="bg-background pl-9"
            aria-label="Cari unit organisasi"
          />
        </div>
        <span className="text-sm text-muted-foreground" aria-live="polite">
          {selectedIds.length} dipilih
        </span>
      </div>
      <div className="max-h-72 overflow-y-auto border-t border-border">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center gap-2 text-sm text-muted-foreground">
            <RefreshCw size={16} className="animate-spin" /> Memuat unit organisasi…
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Tidak ada unit yang cocok atau tersedia pada company ini.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((entity) => {
              const selected = selectedIds.includes(entity.id);
              return (
                <button
                  key={entity.id}
                  type="button"
                  onClick={() => toggle(entity.id)}
                  className="flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left outline-none transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40"
                  aria-pressed={selected}
                >
                  <span className={cn(
                    'inline-flex size-5 shrink-0 items-center justify-center rounded border',
                    selected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background',
                  )}>
                    {selected && <Check size={14} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entity.name}</span>
                    {entity.code && <span className="block truncate text-xs text-muted-foreground">{entity.code}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDataScopePage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';
  const [roles, setRoles] = useState<Role[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [roleCode, setRoleCode] = useState('');
  const [resource, setResource] = useState('ALL');
  const [scopeType, setScopeType] = useState<DataScopeType>('ALL');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState('ALL:');
  const [loadingContext, setLoadingContext] = useState(true);
  const [loadingScope, setLoadingScope] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [myScope, setMyScope] = useState<MyDataScopeResponse | null>(null);

  const roleOptions = useMemo(() => roles.map((role) => ({
    value: role.code,
    label: `${role.name} · ${role.scope}`,
  })), [roles]);

  const subDepartments = useMemo(() => {
    const unique = new Map<string, Department>();
    for (const department of departments) {
      for (const subDepartment of department.subDepartments ?? []) {
        unique.set(subDepartment.id, subDepartment);
      }
    }
    return Array.from(unique.values());
  }, [departments]);

  const scopeEntities = useMemo<ScopeEntity[]>(() => {
    if (scopeType === 'BRANCH_ONLY') return branches;
    if (scopeType === 'DEPARTMENT_ONLY') return departments;
    if (scopeType === 'SUB_DEPARTMENT_ONLY') return subDepartments;
    return [];
  }, [branches, departments, scopeType, subDepartments]);

  const currentSnapshot = `${scopeType}:${[...selectedIds].sort().join(',')}`;
  const isDirty = currentSnapshot !== savedSnapshot;

  const fetchContext = useCallback(async () => {
    if (!companyId) {
      setRoles([]);
      setBranches([]);
      setDepartments([]);
      setRoleCode('');
      setLoadingContext(false);
      return;
    }

    setLoadingContext(true);
    setLoadError('');
    try {
      const [roleData, branchData, departmentData] = await Promise.all([
        rbacService.findAll(companyId),
        organizationService.getBranches(companyId),
        organizationService.getDepartments(companyId),
      ]);
      const activeRoles = roleData.filter((role) => role.status === 'ACTIVE');
      setRoles(activeRoles);
      setBranches(branchData.filter((branch) => branch.status === 'ACTIVE'));
      setDepartments(departmentData.filter((department) => department.status === 'ACTIVE'));
      setRoleCode((current) => (
        activeRoles.some((role) => role.code === current)
          ? current
          : activeRoles[0]?.code || ''
      ));
    } catch (error) {
      setLoadError(messageFromError(error, 'Konteks role dan organisasi tidak dapat dimuat.'));
    } finally {
      setLoadingContext(false);
    }
  }, [companyId]);

  const fetchScope = useCallback(async () => {
    if (!companyId || !roleCode) return;
    setLoadingScope(true);
    setLoadError('');
    try {
      const data = await administrationService.listRoleDataScope(companyId, roleCode, resource);
      const record = Array.isArray(data)
        ? data.find((item) => item.resource === resource) ?? null
        : data;
      const nextType = (record?.scopeType ?? 'ALL') as DataScopeType;
      const nextIds = record?.scopeValue
        ? record.scopeValue.split(',').map((id) => id.trim()).filter(Boolean)
        : [];
      setScopeType(nextType);
      setSelectedIds(nextIds);
      setSavedSnapshot(`${nextType}:${[...nextIds].sort().join(',')}`);

      const effective = await administrationService.getMyDataScope({ companyId, resource });
      setMyScope(effective);
    } catch (error) {
      setLoadError(messageFromError(error, 'Data access tidak dapat dimuat. Perubahan belum dilakukan.'));
    } finally {
      setLoadingScope(false);
    }
  }, [companyId, resource, roleCode]);

  useEffect(() => { void fetchContext(); }, [fetchContext]);
  useEffect(() => { void fetchScope(); }, [fetchScope]);
  useEffect(() => {
    if (!isDirty) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [isDirty]);

  const confirmDiscard = () => !isDirty || window.confirm('Perubahan data access belum disimpan. Buang perubahan?');

  const handleRoleChange = (nextRole: string) => {
    if (confirmDiscard()) setRoleCode(nextRole);
  };

  const handleResourceChange = (nextResource: string) => {
    if (confirmDiscard()) setResource(nextResource);
  };

  const handleScopeTypeChange = (nextType: DataScopeType) => {
    if (nextType === scopeType) return;
    setScopeType(nextType);
    setSelectedIds([]);
  };

  const handleSave = async () => {
    if (!companyId || !roleCode || !isDirty) return;
    if (scopeNeedsSelection(scopeType) && selectedIds.length === 0) {
      toast.error('Pilih minimal satu unit organisasi untuk scope ini.');
      return;
    }

    setSaving(true);
    try {
      await administrationService.upsertRoleDataScope({
        companyId,
        roleCode,
        resource,
        scopeType,
        scopeValue: scopeNeedsSelection(scopeType) ? selectedIds.join(',') : undefined,
      });
      setSavedSnapshot(currentSnapshot);
      toast.success('Data access berhasil disimpan');
      setMyScope(await administrationService.getMyDataScope({ companyId, resource }));
    } catch (error) {
      toast.error(messageFromError(error, 'Data access gagal disimpan. Coba lagi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Access"
        description="Batasi baris data yang boleh dilihat setiap role berdasarkan company dan unit organisasi."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void fetchScope()} disabled={loadingScope || !roleCode}>
              <RefreshCw size={16} className={cn('mr-2', loadingScope && 'animate-spin')} /> Muat ulang
            </Button>
            <Button size="sm" onClick={() => void handleSave()} disabled={saving || loadingScope || !isDirty}>
              <Save size={16} className="mr-2" />
              {saving ? 'Menyimpan…' : isDirty ? 'Simpan perubahan' : 'Tersimpan'}
            </Button>
          </div>
        )}
      />

      {loadError && (
        <div role="alert" className="flex flex-col gap-3 rounded-xl bg-destructive/10 p-4 text-destructive sm:flex-row sm:items-center sm:justify-between">
          <span className="flex min-w-0 items-start gap-2 text-sm">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <span>{loadError}</span>
          </span>
          <Button variant="outline" size="sm" onClick={() => void fetchContext()}>Coba lagi</Button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <section className="min-w-0 overflow-hidden rounded-2xl bg-card shadow-sm" aria-labelledby="data-access-config">
          <div className="p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <ShieldCheck size={20} />
              </span>
              <div>
                <h2 id="data-access-config" className="text-lg font-semibold">Konfigurasi role</h2>
                <p className="mt-1 text-sm text-muted-foreground">Resource spesifik mengatur batas data untuk satu area aplikasi.</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Company</label>
                <Input value={activeCompany?.name || 'Belum ada company aktif'} disabled />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Role</label>
                <Select2
                  value={roleCode}
                  onValueChange={handleRoleChange}
                  options={roleOptions}
                  placeholder={loadingContext ? 'Memuat role…' : 'Pilih role'}
                  disabled={loadingContext || roleOptions.length === 0}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Resource</label>
                <Select2 value={resource} onValueChange={handleResourceChange} options={RESOURCE_OPTIONS} />
              </div>
            </div>
          </div>

          <div className="border-t border-border p-5 sm:p-6">
            <h3 className="font-semibold">Cakupan data</h3>
            <p className="mt-1 text-sm text-muted-foreground">Pilih batas paling sesuai untuk role dan resource ini.</p>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {SCOPE_TYPE_OPTIONS.map((option) => {
                const selected = scopeType === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleScopeTypeChange(option.value)}
                    aria-pressed={selected}
                    className={cn(
                      'min-h-24 rounded-xl p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40',
                      selected ? 'bg-primary/10 text-primary' : 'bg-muted/50 text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <ScopeIcon type={option.value} /> {option.label}
                    </span>
                    {option.description && (
                      <span className={cn('mt-1.5 block text-sm', selected ? 'text-primary/80' : 'text-muted-foreground')}>
                        {option.description}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {scopeNeedsSelection(scopeType) && (
              <div className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">Unit yang boleh diakses</h3>
                    <p className="text-sm text-muted-foreground">Pilihan disimpan sebagai ID, tetapi admin bekerja dengan nama unit.</p>
                  </div>
                  {selectedIds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={() => setSelectedIds([])}>Hapus pilihan</Button>
                  )}
                </div>
                <ScopeEntityPicker
                  entities={scopeEntities}
                  selectedIds={selectedIds}
                  onChange={setSelectedIds}
                  loading={loadingContext}
                />
              </div>
            )}
          </div>
        </section>

        <aside className="h-fit rounded-2xl bg-card p-5 shadow-sm" aria-labelledby="effective-scope-title">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <UserCheck size={18} />
            </span>
            <div>
              <h2 id="effective-scope-title" className="font-semibold">Akses efektif saya</h2>
              <p className="mt-1 text-sm text-muted-foreground">Preview hasil resolver untuk user yang sedang login.</p>
            </div>
          </div>

          {loadingScope ? (
            <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw size={16} className="animate-spin" /> Menghitung scope…
            </div>
          ) : myScope ? (
            <dl className="mt-5 space-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Role terpilih resolver</dt>
                <dd className="mt-1 font-medium">{myScope.roleCode ?? 'Tidak ada konfigurasi khusus'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Resource</dt>
                <dd className="mt-1 font-medium">{myScope.resource}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Scope efektif</dt>
                <dd className="mt-1 inline-flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5 font-medium">
                  <ScopeIcon type={myScope.scopeType} /> {myScope.scopeType}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Filter yang diterapkan</dt>
                <dd className="mt-1 break-words rounded-lg bg-muted p-3 text-xs">
                  {Object.keys(myScope.parsedFilter).length > 0
                    ? JSON.stringify(myScope.parsedFilter, null, 2)
                    : 'Tidak ada filter tambahan'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">Preview belum tersedia.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
