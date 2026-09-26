import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { payrollService, type MyPayslipSummary } from '@/services/payroll.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw, Receipt, Lock, CalendarDays } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';

const STATUS_STYLES: Record<string, string> = {
  PAID: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  DISBURSED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  APPROVED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  DRAFT: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
};

/**
 * Daftar slip gaji milik sendiri (self-service).
 * Backend (GET /payroll/payslips) hanya mengirim ringkasan periode tanpa angka
 * finansial dan menandai setiap item locked: true — detail finansial memerlukan
 * payroll unlock token, jadi halaman ini sengaja TIDAK memanggil endpoint detail
 * yang pasti ditolak untuk karyawan biasa.
 */
export function MyPayslipsPage() {
  const [payslips, setPayslips] = useState<MyPayslipSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await payrollService.getMyPayslips();
      setPayslips(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat slip gaji'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <PageHeader
        title="Slip Gaji Saya"
        description="Daftar slip gaji Anda per periode payroll"
        actions={
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        }
      />

      <div className="mb-4 rounded-xl border border-border bg-muted/30 p-3 flex items-start gap-2">
        <Lock size={14} className="mt-0.5 text-muted-foreground shrink-0" />
        <p className="text-xs text-muted-foreground">
          Untuk keamanan, rincian angka gaji tidak ditampilkan di sini. Silakan hubungi HR bila Anda
          membutuhkan salinan resmi slip gaji.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Memuat slip gaji...</p>
        </div>
      ) : payslips.length === 0 ? (
        <div className="flex flex-col items-center py-20 gap-3">
          <Receipt size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Belum ada slip gaji yang diterbitkan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.map((p) => (
            <div key={p.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[p.status] || 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400'}`}>
                      {p.status}
                    </span>
                    {p.locked && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400 border border-border">
                        <Lock size={11} /> Detail terkunci
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold">
                    {p.payrollRun?.period?.name || p.payrollRun?.name || 'Periode payroll'}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                    {p.payrollRun?.period && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays size={12} />
                        {formatDate(p.payrollRun.period.startDate)} — {formatDate(p.payrollRun.period.endDate)}
                      </span>
                    )}
                    {p.payrollRun?.period?.payDate && (
                      <span>Tanggal bayar: {formatDate(p.payrollRun.period.payDate)}</span>
                    )}
                    {p.payrollRun && (
                      <span>Run #{p.payrollRun.runNumber} · {p.payrollRun.status}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
