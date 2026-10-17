import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  payrollService, type BuktiPotongVIIIResult, type BuktiPotongVIIResult,
  type PayrollPeriod, type SeverancePayment,
} from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Select2 } from '@/components/ui/select2';
import { Download, FileText, Loader2, RefreshCw } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';

/**
 * Bahan e-Bupot (GAP-33): 1721-VIII bulanan per periode dan 1721-VII final
 * pesangon. Angkanya DIBEKUKAN dari payslip/pembayaran — halaman ini hanya
 * membaca; CSV adalah bahan rekonsiliasi tim pajak, bukan berkas impor DJP.
 */
export function BuktiPotongPage() {
  const { t } = useI18n();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';

  const [periods, setPeriods] = useState<PayrollPeriod[]>([]);
  const [periodId, setPeriodId] = useState('');
  const [viii, setViii] = useState<BuktiPotongVIIIResult | null>(null);
  const [loadingViii, setLoadingViii] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const [severances, setSeverances] = useState<SeverancePayment[]>([]);
  const [vii, setVii] = useState<BuktiPotongVIIResult | null>(null);
  const [loadingViiId, setLoadingViiId] = useState<string | null>(null);

  useEffect(() => {
    if (!companyId) return;
    payrollService.getPayrollPeriods(companyId)
      .then(setPeriods)
      .catch((err) => toast.error(apiErrorMessage(err, t('fin.period.loadFailed'))));
    payrollService.getSeverancePayments()
      .then(setSeverances)
      .catch(() => setSeverances([]));
  }, [companyId, t]);

  const loadViii = useCallback(async (id: string) => {
    setLoadingViii(true);
    setViii(null);
    try {
      setViii(await payrollService.getBuktiPotongVIII(id));
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.bukti.loadFailed')));
    } finally {
      setLoadingViii(false);
    }
  }, [t]);

  useEffect(() => { if (periodId) void loadViii(periodId); }, [periodId, loadViii]);

  const handleDownloadCsv = async () => {
    if (!periodId || !viii) return;
    setDownloading(true);
    try {
      const blob = await payrollService.downloadBuktiPotongVIIICsv(periodId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `bukti-potong-1721-viii-${viii.period.code}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.bukti.downloadFailed')));
    } finally {
      setDownloading(false);
    }
  };

  const handleViewVii = async (severancePaymentId: string) => {
    setLoadingViiId(severancePaymentId);
    try {
      setVii(await payrollService.getBuktiPotongVII(severancePaymentId));
    } catch (err) {
      // Gerbang backend bicara sendiri: belum APPLIED, atau run-nya belum
      // di-approve — pesan errornya menjelaskan kenapa bukti belum boleh terbit.
      toast.error(apiErrorMessage(err, t('fin.bukti.viiFailed')));
    } finally {
      setLoadingViiId(null);
    }
  };

  const totals = useMemo(() => (viii
    ? viii.rows.reduce((sum, row) => ({
        bruto: sum.bruto + row.form.bruto,
        pph: sum.pph + row.form.pphDipotong,
      }), { bruto: 0, pph: 0 })
    : { bruto: 0, pph: 0 }), [viii]);

  return (
    <div>
      <PageHeader
        title={t('fin.bukti.title')}
        description={t('fin.bukti.description')}
        actions={
          <Button variant="outline" size="sm" onClick={() => periodId && loadViii(periodId)} disabled={!periodId}>
            <RefreshCw size={16} className="mr-2" />{t('common.refresh')}
          </Button>
        }
      />

      {/* ── 1721-VIII bulanan ───────────────────────────── */}
      <section className="rounded-xl border border-border bg-white p-5 dark:bg-gray-800">
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <div className="space-y-2 min-w-64">
            <label className="text-sm font-medium">{t('fin.bukti.periodLabel')}</label>
            <Select2
              value={periodId}
              onValueChange={setPeriodId}
              options={[
                { value: '', label: t('fin.runCreate.selectPeriod') },
                ...periods.map((p) => ({
                  value: p.id,
                  label: `${p.name} • ${dayjs(p.startDate).format('MMM YYYY')} • ${p.status}`,
                })),
              ]}
            />
          </div>
          <Button size="sm" onClick={handleDownloadCsv} disabled={!viii || viii.rows.length === 0 || downloading}>
            {downloading ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Download size={16} className="mr-2" />}
            {t('fin.bukti.downloadCsv')}
          </Button>
        </div>

        {loadingViii ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : !viii ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('fin.bukti.pickPeriod')}</p>
        ) : viii.rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{t('fin.bukti.emptyViii')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3">{t('fin.bukti.colEmployee')}</th>
                  <th className="py-2 pr-3">NPWP</th>
                  <th className="py-2 pr-3">{t('fin.bukti.colMasa')}</th>
                  <th className="py-2 pr-3 text-right">{t('fin.bukti.colBruto')}</th>
                  <th className="py-2 pr-3 text-right">DPP</th>
                  <th className="py-2 pr-3 text-right">{t('fin.bukti.colTarif')}</th>
                  <th className="py-2 text-right">{t('fin.bukti.colPph')}</th>
                </tr>
              </thead>
              <tbody>
                {viii.rows.map((row) => (
                  <tr key={row.employee.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <p className="font-medium">{row.employee.fullName}</p>
                      <p className="text-xs text-muted-foreground font-mono">{row.employee.employeeNumber}</p>
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {row.employee.npwp ?? <span className="text-amber-600 dark:text-amber-400">{t('fin.bukti.noNpwp')}</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{row.form.masaPajak}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(row.form.bruto)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(row.form.dasarPengenaanPajak)}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{row.form.tarifPercent}%</td>
                    <td className="py-2 text-right tabular-nums font-medium">{formatCurrency(row.form.pphDipotong)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-3" colSpan={3}>{t('fin.bukti.total', { count: String(viii.rows.length) })}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatCurrency(totals.bruto)}</td>
                  <td className="py-2 pr-3" />
                  <td className="py-2 pr-3" />
                  <td className="py-2 text-right tabular-nums">{formatCurrency(totals.pph)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      {/* ── 1721-VII pesangon ───────────────────────────── */}
      <section className="mt-6 rounded-xl border border-border bg-white p-5 dark:bg-gray-800">
        <h2 className="text-sm font-semibold mb-1">{t('fin.bukti.viiTitle')}</h2>
        <p className="text-xs text-muted-foreground mb-4">{t('fin.bukti.viiDescription')}</p>
        {severances.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t('fin.bukti.emptyVii')}</p>
        ) : (
          <ul className="space-y-2">
            {severances.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-3 py-2">
                <div className="flex-1 min-w-48">
                  <p className="text-sm font-medium">{row.employee?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.employee?.employeeNumber} · {t('fin.bukti.gross')} {formatCurrency(Number(row.grossAmount))} · {t('fin.bukti.tax')} {formatCurrency(Number(row.taxAmount))}
                  </p>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  row.status === 'APPLIED' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                  : row.status === 'PENDING' ? 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                  : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                }`}>{row.status}</span>
                <Button variant="outline" size="sm" onClick={() => handleViewVii(row.id)} disabled={loadingViiId === row.id}>
                  {loadingViiId === row.id ? <Loader2 size={14} className="mr-1 animate-spin" /> : <FileText size={14} className="mr-1" />}
                  {t('fin.bukti.viewVii')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── Detail 1721-VII ─────────────────────────────── */}
      {vii && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setVii(null)}>
          <div className="w-full max-w-md mx-4 rounded-xl border border-border bg-white p-5 shadow-xl dark:bg-gray-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-3">1721-VII · {vii.employee.fullName}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t('fin.bukti.colMasa')}</dt>
              <dd className="font-mono">{vii.form.masaPajak}</dd>
              <dt className="text-muted-foreground">{t('fin.bukti.objectCode')}</dt>
              <dd className="font-mono">{vii.form.taxObjectCode}</dd>
              <dt className="text-muted-foreground">NPWP</dt>
              <dd className="font-mono">{vii.employee.npwp ?? '—'}</dd>
              <dt className="text-muted-foreground">{t('fin.bukti.colBruto')}</dt>
              <dd className="tabular-nums">{formatCurrency(vii.form.bruto)}</dd>
              <dt className="text-muted-foreground">{t('fin.bukti.colTarif')}</dt>
              <dd className="tabular-nums">{vii.form.tarifPercent}%</dd>
              <dt className="text-muted-foreground">{t('fin.bukti.colPph')}</dt>
              <dd className="tabular-nums font-medium">{formatCurrency(vii.form.pphDipotong)}</dd>
            </dl>
            <div className="mt-4 flex justify-end">
              <Button size="sm" variant="outline" onClick={() => setVii(null)}>{t('common.close')}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
