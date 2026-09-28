import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Fingerprint, MapPin, ScanFace, Search, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { employeeService, type EmployeeAttendanceMethods } from '@/services/employee.service';
import { useCompanyStore } from '@/stores/company.store';
import { apiErrorMessage } from '@/lib/errors';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 20;

type MethodFlag = 'allowFingerprint' | 'allowFaceRecognition' | 'allowMobileGps';

const METHOD_COLUMNS: Array<{ flag: MethodFlag; labelKey: TranslationKey; icon: React.ReactNode }> = [
  { flag: 'allowFingerprint', labelKey: 'organization.branches.policy.method.fingerprint', icon: <Fingerprint size={13} /> },
  { flag: 'allowFaceRecognition', labelKey: 'organization.branches.policy.method.faceRecognition', icon: <ScanFace size={13} /> },
  { flag: 'allowMobileGps', labelKey: 'organization.branches.policy.method.mobileGps', icon: <MapPin size={13} /> },
];

function MethodToggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative mx-auto flex h-5 w-[34px] rounded-full transition-colors disabled:opacity-50',
        checked ? 'bg-primary' : 'bg-muted'
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-card transition-transform duration-200',
          checked ? 'translate-x-[15px]' : 'translate-x-0.5'
        )}
      />
    </button>
  );
}

/**
 * Matriks metode absensi per karyawan — khusus SUPER_ADMIN.
 * Menentukan metode absensi mana (fingerprint / face recognition / mobile GPS)
 * yang boleh dipakai tiap karyawan; server meng-intersect izin ini dengan
 * kebijakan absensi cabang saat check-in.
 */
export function AttendanceMethodMatrixPage() {
  const { t } = useI18n();
  const activeCompanyId = useCompanyStore((s) => s.activeCompanyId);
  const [rows, setRows] = useState<EmployeeAttendanceMethods[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const searchTimer = useRef<number | null>(null);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [search]);

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await employeeService.getAttendanceMethodMatrix({
        companyId: activeCompanyId,
        search: debouncedSearch || undefined,
        page,
        limit: PAGE_SIZE,
      });
      setRows(result.data);
      setTotal(result.total);
    } catch (err) {
      setError(apiErrorMessage(err, t('wf.org.attendanceMatrix.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, debouncedSearch, page, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleToggle = useCallback(
    async (row: EmployeeAttendanceMethods, flag: MethodFlag, next: boolean) => {
      // Optimistic: langsung ubah, rollback bila server menolak.
      setRows((current) => current.map((r) => (r.id === row.id ? { ...r, [flag]: next } : r)));
      setSavingIds((current) => new Set(current).add(row.id));
      try {
        await employeeService.updateAttendanceMethods(row.id, { [flag]: next });
      } catch (err) {
        setRows((current) => current.map((r) => (r.id === row.id ? { ...r, [flag]: !next } : r)));
        toast.error(apiErrorMessage(err, t('wf.org.attendanceMatrix.saveFailed')));
      } finally {
        setSavingIds((current) => {
          const nextSet = new Set(current);
          nextSet.delete(row.id);
          return nextSet;
        });
      }
    },
    [t]
  );

  return (
    <div>
      <PageHeader
        title={t('wf.org.attendanceMatrix.title')}
        description={t('wf.org.attendanceMatrix.description')}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
            placeholder={t('wf.org.attendanceMatrix.searchPlaceholder')}
          />
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-[10.5px] font-semibold text-primary">
          <ShieldCheck size={12} aria-hidden="true" /> {t('wf.org.attendanceMatrix.superAdminOnly')}
        </span>
      </div>

      {error && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card-sm bg-danger-bg px-4 py-3 text-xs text-danger">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="font-semibold underline underline-offset-2">
            {t('wf.org.attendanceMatrix.retry')}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50 text-left">
                <th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{t('wf.org.attendanceMatrix.table.nik')}</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{t('wf.common.name')}</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{t('employees.detail.fields.department')}</th>
                <th className="px-4 py-3 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">{t('wf.org.attendanceMatrix.table.position')}</th>
                {METHOD_COLUMNS.map((column) => (
                  <th
                    key={column.flag}
                    className="px-4 py-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground"
                  >
                    <span className="inline-flex items-center gap-1.5">
                      {column.icon}
                      {t(column.labelKey)}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {t('wf.org.attendanceMatrix.loading')}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    {debouncedSearch ? t('wf.org.attendanceMatrix.emptyFiltered') : t('wf.org.attendanceMatrix.emptyDefault')}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-border transition-colors last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 font-medium tabular-nums">{row.employeeNumber}</td>
                    <td className="px-4 py-3">{row.fullName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.departmentName ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.positionName ?? '—'}</td>
                    {METHOD_COLUMNS.map((column) => (
                      <td key={column.flag} className="px-4 py-3 text-center">
                        <MethodToggle
                          checked={row[column.flag]}
                          disabled={savingIds.has(row.id)}
                          label={t('wf.org.attendanceMatrix.toggleLabel', { method: t(column.labelKey), name: row.fullName })}
                          onChange={(next) => void handleToggle(row, column.flag, next)}
                        />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span>{t('wf.org.attendanceMatrix.pageSummary', { total, page, totalPages })}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)}>
              {t('wf.common.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('wf.common.next')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
