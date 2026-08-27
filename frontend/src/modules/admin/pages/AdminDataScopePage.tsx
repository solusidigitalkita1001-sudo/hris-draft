import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select2 } from '@/components/ui/select2';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCompanyStore } from '@/stores/company.store';
import {
  administrationService,
  type DataScopeType,
  type MyDataScopeResponse,
  ROLE_OPTIONS,
  RESOURCE_OPTIONS,
  SCOPE_TYPE_OPTIONS,
} from '@/services/administration.service';
import {
  Save,
  RefreshCw,
  ShieldCheck,
  Info,
  Building2,
  MapPin,
  Users,
  UserCheck,
  Globe2,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

export function AdminDataScopePage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [roleCode, setRoleCode] = useState<string>('EMPLOYEE');
  const [resource, setResource] = useState<string>('ALL');
  const [scopeType, setScopeType] = useState<DataScopeType>('ALL');
  const [scopeValue, setScopeValue] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [myScope, setMyScope] = useState<MyDataScopeResponse | null>(null);
  const [myScopeLoading, setMyScopeLoading] = useState(false);

  const fetchCurrentScope = useCallback(async () => {
    if (!companyId || !roleCode) {
      setScopeType('ALL');
      setScopeValue('');
      return;
    }
    setLoading(true);
    try {
      const data = (await administrationService.listRoleDataScope(
        companyId,
        roleCode,
        resource
      )) as any;
      if (Array.isArray(data)) {
        const specific = data.find((d: any) => d.resource === resource);
        if (specific) {
          setScopeType(specific.scopeType as DataScopeType);
          setScopeValue(specific.scopeValue || '');
        } else {
          setScopeType('ALL');
          setScopeValue('');
        }
      } else if (data) {
        setScopeType(data.scopeType as DataScopeType);
        setScopeValue(data.scopeValue || '');
      } else {
        setScopeType('ALL');
        setScopeValue('');
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat data scope');
    } finally {
      setLoading(false);
    }
  }, [companyId, roleCode, resource]);

  useEffect(() => {
    fetchCurrentScope();
  }, [fetchCurrentScope]);

  const fetchMyScope = useCallback(async () => {
    if (!companyId) return;
    setMyScopeLoading(true);
    try {
      const res = await administrationService.getMyDataScope({
        companyId,
        resource: 'employee',
      });
      setMyScope(res);
    } catch (e) {
      console.error(e);
    } finally {
      setMyScopeLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    fetchMyScope();
  }, [fetchMyScope]);

  const handleSave = async () => {
    if (!companyId || !roleCode) {
      toast.error('Company / Role belum dipilih');
      return;
    }
    const needValue = [
      'BRANCH_ONLY',
      'DEPARTMENT_ONLY',
      'SUB_DEPARTMENT_ONLY',
    ].includes(scopeType);
    if (needValue && !scopeValue.trim()) {
      toast.error(
        'scopeValue (comma-separated UUIDs) wajib diisi untuk scope level BRANCH/DEPARTMENT/SUB_DEPARTMENT'
      );
      return;
    }
    setSaving(true);
    try {
      await administrationService.upsertRoleDataScope({
        companyId,
        roleCode,
        resource,
        scopeType,
        scopeValue: scopeValue.trim() || undefined,
      });
      toast.success('Data scope berhasil disimpan');
      fetchMyScope();
    } catch (e: any) {
      console.error(e);
      toast.error(
        e?.response?.data?.message || 'Gagal menyimpan data scope'
      );
    } finally {
      setSaving(false);
    }
  };

  const needScopeValue = [
    'BRANCH_ONLY',
    'DEPARTMENT_ONLY',
    'SUB_DEPARTMENT_ONLY',
  ].includes(scopeType);

  const scopeIcon = (type: DataScopeType) => {
    switch (type) {
      case 'ALL':
        return <Globe2 size={14} />;
      case 'COMPANY_ONLY':
        return <Building2 size={14} />;
      case 'BRANCH_ONLY':
        return <MapPin size={14} />;
      case 'DEPARTMENT_ONLY':
      case 'SUB_DEPARTMENT_ONLY':
        return <Users size={14} />;
      case 'EMPLOYEE_SELF':
        return <UserCheck size={14} />;
      case 'MANAGER_TEAM':
        return <ShieldCheck size={14} />;
    }
  };

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Data Access Scope per Role"
        description="Batasi cakupan data yang bisa diakses user per role. Berlaku untuk list API (middleware inject filter ke query)."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-4 shadow-sm">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <ShieldCheck size={18} className="text-primary" />
              Konfigurasi Scope
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Company</Label>
                <Input
                  value={activeCompany?.name || '—'}
                  disabled
                  placeholder="No active company"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Role</Label>
                <Select2
                  value={roleCode}
                  onValueChange={(v) => setRoleCode(v)}
                  options={ROLE_OPTIONS}
                  placeholder="Pilih role"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>Resource</Label>
                <Select2
                  value={resource}
                  onValueChange={(v) => setResource(v)}
                  options={RESOURCE_OPTIONS}
                  placeholder="Pilih resource"
                  className="mt-1.5"
                />
              </div>
            </div>

            <div className="pt-2">
              <Label className="mb-2 block">Scope Type</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SCOPE_TYPE_OPTIONS.map((opt) => (
                  <label
                    key={opt.value}
                    className={cn(
                      'relative flex flex-col gap-1 px-4 py-3 rounded-xl border cursor-pointer transition-all',
                      scopeType === opt.value
                        ? 'bg-primary/5 border-primary ring-2 ring-primary/20'
                        : 'bg-transparent border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="scopeType"
                        value={opt.value}
                        checked={scopeType === opt.value}
                        onChange={() =>
                          setScopeType(opt.value as DataScopeType)
                        }
                        className="accent-primary"
                      />
                      <span
                        className={cn(
                          'flex items-center gap-1.5 text-sm font-medium',
                          scopeType === opt.value
                            ? 'text-primary'
                            : 'text-slate-700 dark:text-slate-200'
                        )}
                      >
                        {scopeIcon(opt.value)}
                        {opt.label}
                      </span>
                    </div>
                    {opt.description && (
                      <span className="text-xs text-slate-500 dark:text-slate-400 pl-6">
                        {opt.description}
                      </span>
                    )}
                  </label>
                ))}
              </div>
            </div>

            {needScopeValue && (
              <div className="pt-2">
                <Label htmlFor="scopeValue">
                  Scope Value (comma-separated UUIDs)
                </Label>
                <textarea
                  id="scopeValue"
                  value={scopeValue}
                  onChange={(e) => setScopeValue(e.target.value)}
                  rows={4}
                  placeholder={
                    'Contoh untuk DEPARTMENT_ONLY:\nuuid-dept-1,uuid-dept-2,uuid-dept-3'
                  }
                  className="mt-1.5 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-y"
                />
                <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 flex items-start gap-1.5">
                  <Info size={12} className="mt-0.5 shrink-0" />
                  Pisahkan dengan koma. Untuk batch ini input manual UUID.
                  Nanti bisa diganti multi-select picker.
                </p>
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="secondary"
                onClick={fetchCurrentScope}
                disabled={loading}
              >
                <RefreshCw
                  size={16}
                  className={cn('mr-2', loading && 'animate-spin')}
                />
                Refresh
              </Button>
              <Button
                variant="default"
                onClick={handleSave}
                disabled={saving || loading}
              >
                <Save size={16} className="mr-2" />
                {saving ? 'Saving...' : 'Save Scope'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white dark:bg-slate-900 border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-600" />
                My Data Scope (Current User)
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchMyScope}
                disabled={myScopeLoading}
              >
                <RefreshCw
                  size={14}
                  className={cn('mr-1.5', myScopeLoading && 'animate-spin')}
                />
                Reload
              </Button>
            </div>
            {myScopeLoading && (
              <div className="text-sm text-slate-400 py-4 text-center">
                Loading current user scope...
              </div>
            )}
            {!myScopeLoading && myScope && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Role
                  </span>
                  <span className="font-medium">{myScope.roleCode ?? '—'}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Resource
                  </span>
                  <span className="font-medium font-mono text-xs">
                    {myScope.resource}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Scope Type
                  </span>
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 font-medium px-2 py-0.5 rounded',
                      myScope.scopeType === 'ALL' &&
                        'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
                      myScope.scopeType === 'EMPLOYEE_SELF' &&
                        'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
                      myScope.scopeType === 'DEPARTMENT_ONLY' &&
                        'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    )}
                  >
                    {scopeIcon(myScope.scopeType)}
                    {myScope.scopeType}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-slate-500 dark:text-slate-400">
                    Scope Value
                  </span>
                  <span className="font-mono text-xs max-w-[160px] truncate text-right">
                    {myScope.scopeValue ?? '—'}
                  </span>
                </div>
                <div className="pt-2">
                  <span className="text-slate-500 dark:text-slate-400 block mb-1.5">
                    Applied Filter (parsed)
                  </span>
                  <pre className="p-3 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono overflow-x-auto">
{JSON.stringify(myScope.parsedFilter, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm">
            <div className="flex items-start gap-2">
              <Info size={16} className="text-amber-600 mt-0.5 shrink-0" />
              <div className="space-y-1.5 text-amber-800 dark:text-amber-200">
                <p className="font-semibold">Catatan Scope Resolve</p>
                <ul className="list-disc list-inside space-y-0.5 text-xs">
                  <li>Resource ALL = fallback, resource spesifik override ALL</li>
                  <li>Paling restrictive menang (SELF {'>'} DEPT {'>'} BRANCH {'>'} COMPANY {'>'} ALL)</li>
                  <li>MANAGER_TEAM = placeholder (belum apply filter)</li>
                  <li>Filter di-inject middleware ke req.query GET list endpoints</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
