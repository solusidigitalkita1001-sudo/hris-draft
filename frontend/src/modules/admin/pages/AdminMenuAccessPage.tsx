import { useState, useEffect, useCallback, useMemo } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select2 } from '@/components/ui/select2';
import { Input } from '@/components/ui/input';
import { useCompanyStore } from '@/stores/company.store';
import {
  administrationService,
  type MenuAccessType,
  type RoleMenuAccess,
  ROLE_OPTIONS,
  MENU_ITEMS,
} from '@/services/administration.service';
import { Save, RefreshCw, CheckCircle2, XCircle, Search } from 'lucide-react';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

type MenuRowState = Record<string, MenuAccessType>;

export function AdminMenuAccessPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [roleCode, setRoleCode] = useState<string>('EMPLOYEE');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [rowState, setRowState] = useState<MenuRowState>({});

  const fetchAccess = useCallback(async () => {
    if (!companyId || !roleCode) {
      setRowState({});
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const list = await administrationService.listRoleMenuAccess(
        companyId,
        roleCode
      );
      const state: MenuRowState = {};
      for (const item of list) {
        state[item.menuPath] = item.accessType;
      }
      for (const mi of MENU_ITEMS) {
        if (!state[mi.path]) {
          state[mi.path] = 'ALLOW';
        }
      }
      setRowState(state);
    } catch (e) {
      console.error(e);
      toast.error('Gagal memuat menu access');
    } finally {
      setLoading(false);
    }
  }, [companyId, roleCode]);

  useEffect(() => {
    fetchAccess();
  }, [fetchAccess]);

  const handleChange = (path: string, value: MenuAccessType) => {
    setRowState((prev) => ({ ...prev, [path]: value }));
  };

  const handleSave = async () => {
    if (!companyId || !roleCode) {
      toast.error('Company / Role belum dipilih');
      return;
    }
    setSaving(true);
    try {
      const items = Object.entries(rowState).map(([menuPath, accessType]) => ({
        menuPath,
        accessType,
      }));
      await administrationService.bulkUpsertRoleMenuAccess({
        companyId,
        roleCode,
        items,
      });
      toast.success('Menu access berhasil disimpan');
    } catch (e) {
      console.error(e);
      toast.error('Gagal menyimpan menu access');
    } finally {
      setSaving(false);
    }
  };

  const filteredMenuItems = useMemo(() => {
    if (!search.trim()) return MENU_ITEMS;
    const q = search.toLowerCase();
    return MENU_ITEMS.filter(
      (mi) =>
        mi.label.toLowerCase().includes(q) ||
        mi.path.toLowerCase().includes(q)
    );
  }, [search]);

  const stats = useMemo(() => {
    const rows = Object.values(rowState);
    const allow = rows.filter((r) => r === 'ALLOW').length;
    const deny = rows.filter((r) => r === 'DENY').length;
    return { allow, deny, total: rows.length };
  }, [rowState]);

  return (
    <div className="space-y-6 p-6">
      <PageHeader
        title="Role Menu Access Matrix"
        description="Kelompok visibility menu per role. DENY = menu disembunyikan dari sidebar user."
      />

      <div className="bg-white dark:bg-slate-900 border rounded-xl p-5 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Company</label>
            <Input
              value={activeCompany?.name || '—'}
              disabled
              placeholder="No active company"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">Role</label>
            <Select2
              value={roleCode}
              onChange={(val) => setRoleCode(val as string)}
              options={ROLE_OPTIONS}
              placeholder="Select role"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1.5">
              Search Menu
            </label>
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari path / label..."
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              onClick={fetchAccess}
              disabled={loading}
              icon={<RefreshCw size={16} className={cn(loading && 'animate-spin')} />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || loading}
              icon={<Save size={16} />}
            >
              {saving ? 'Saving...' : 'Save Bulk'}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <span className="text-slate-600 dark:text-slate-300">
              ALLOW: <strong className="text-emerald-600">{stats.allow}</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <XCircle size={16} className="text-rose-600" />
            <span className="text-slate-600 dark:text-slate-300">
              DENY: <strong className="text-rose-600">{stats.deny}</strong>
            </span>
          </div>
          <div className="text-slate-400">
            Total: {stats.total} menu paths
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b">
              <tr>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-300 w-16">
                  #
                </th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Path
                </th>
                <th className="text-left px-5 py-3 font-medium text-slate-600 dark:text-slate-300">
                  Label
                </th>
                <th className="text-center px-5 py-3 font-medium text-slate-600 dark:text-slate-300 w-80">
                  Access Type
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    Loading menu access...
                  </td>
                </tr>
              )}
              {!loading &&
                filteredMenuItems.map((item, idx) => (
                  <tr
                    key={item.path}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-5 py-3 text-slate-400">{idx + 1}</td>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 dark:text-slate-300">
                      {item.path}
                    </td>
                    <td className="px-5 py-3 text-slate-700 dark:text-slate-200">
                      {item.label}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-center gap-2">
                        <label
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all',
                            rowState[item.path] === 'ALLOW'
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-700 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-300'
                              : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                          )}
                        >
                          <input
                            type="radio"
                            name={`access-${item.path}`}
                            value="ALLOW"
                            checked={rowState[item.path] === 'ALLOW'}
                            onChange={() => handleChange(item.path, 'ALLOW')}
                            className="accent-emerald-600"
                          />
                          <CheckCircle2 size={14} />
                          <span className="text-xs font-medium">ALLOW</span>
                        </label>
                        <label
                          className={cn(
                            'flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-all',
                            rowState[item.path] === 'DENY'
                              ? 'bg-rose-50 border-rose-300 text-rose-700 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-300'
                              : 'bg-transparent border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                          )}
                        >
                          <input
                            type="radio"
                            name={`access-${item.path}`}
                            value="DENY"
                            checked={rowState[item.path] === 'DENY'}
                            onChange={() => handleChange(item.path, 'DENY')}
                            className="accent-rose-600"
                          />
                          <XCircle size={14} />
                          <span className="text-xs font-medium">DENY</span>
                        </label>
                      </div>
                    </td>
                  </tr>
                ))}
              {!loading && filteredMenuItems.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    Tidak ada menu yang cocok dengan pencarian.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
