import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { formatCurrency, formatDate } from '@/utils/format';
import { employeeLoanService, type Loan, LOAN_STATUS_LABELS, INSTALLMENT_STATUS_LABELS } from '@/services/employee-loan.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, RefreshCw, Banknote } from 'lucide-react';

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  PAID: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

const INSTALLMENT_COLORS: Record<string, string> = {
  PENDING: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30',
  PAID: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30',
  OVERDUE: 'text-red-600 bg-red-50 dark:bg-red-950/30',
  SKIPPED: 'text-gray-400 bg-gray-50 dark:bg-gray-800',
};

export function EmployeeLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await employeeLoanService.findById(id);
      setLoan(data);
    } catch { toast.error('Gagal memuat detail pinjaman'); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const progress = loan
    ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100)
    : 0;

  return (
    <div>
      <PageHeader
        title={loading ? 'Loading...' : 'Detail Pinjaman'}
        description={loan?.loanType?.name || ''}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/employee-loans')}>
              <ArrowLeft size={16} className="mr-2" /> Kembali
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
          </div>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </div>
      )}

      {!loading && !loan && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Banknote size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">Pinjaman tidak ditemukan</p>
          <Button size="sm" onClick={() => navigate('/employee-loans')}>Kembali</Button>
        </div>
      )}

      {!loading && loan && (
        <div className="space-y-6">
          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Jumlah Pinjaman</p>
              <p className="text-xl font-bold">{formatCurrency(loan.amount)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Sisa Pinjaman</p>
              <p className="text-xl font-bold text-amber-600">{formatCurrency(loan.remainingBalance)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Cicilan per Bulan</p>
              <p className="text-xl font-bold">{formatCurrency(loan.installmentAmount)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <p className="text-xs text-muted-foreground mb-1">Status</p>
              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[loan.status] || ''}`}>
                {LOAN_STATUS_LABELS[loan.status as keyof typeof LOAN_STATUS_LABELS] || loan.status}
              </span>
            </div>
          </div>

          {/* Progress */}
          {loan.status === 'ACTIVE' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">Progress Pembayaran</span>
                <span className="text-xs font-medium">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                <div className="bg-emerald-500 h-2.5 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {loan.installments?.filter((i) => i.status === 'PAID').length || 0} dari {loan.totalInstallments} cicilan dibayar
              </p>
            </div>
          )}

          {/* Info Detail */}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Informasi Pinjaman</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Jenis:</span> <span className="font-medium ml-1">{loan.loanType?.name || '-'}</span></div>
              <div><span className="text-muted-foreground">Total Cicilan:</span> <span className="font-medium ml-1">{loan.totalInstallments} bulan</span></div>
              <div className="col-span-2"><span className="text-muted-foreground">Alasan:</span> <span className="ml-1">{loan.reason}</span></div>
              <div><span className="text-muted-foreground">Diajukan:</span> <span className="font-medium ml-1">{formatDate(loan.createdAt)}</span></div>
              <div><span className="text-muted-foreground">Disetujui:</span> <span className="font-medium ml-1">{loan.approvedAt ? formatDate(loan.approvedAt) : '-'}</span></div>
              {loan.employee && (
                <>
                  <div><span className="text-muted-foreground">Karyawan:</span> <span className="font-medium ml-1">{loan.employee.fullName}</span></div>
                  <div><span className="text-muted-foreground">NIK:</span> <span className="font-medium ml-1">{loan.employee.employeeNumber}</span></div>
                </>
              )}
            </div>
          </div>

          {/* Installment Table */}
          {loan.installments && loan.installments.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Jadwal Cicilan</h3>
              <div className="table-container">
                <table className="w-full text-sm">
                  <thead className="table-header">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">#</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Jatuh Tempo</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Jumlah</th>
                      <th className="text-center px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Dibayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {loan.installments.map((inst, i) => (
                      <tr key={inst.id} className="table-row-hover">
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2.5">{dayjs(inst.dueDate).format('DD MMM YYYY')}</td>
                        <td className="px-3 py-2.5 text-right font-medium">{formatCurrency(inst.amount)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${INSTALLMENT_COLORS[inst.status] || ''}`}>
                            {INSTALLMENT_STATUS_LABELS[inst.status as keyof typeof INSTALLMENT_STATUS_LABELS] || inst.status}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground">
                          {inst.paidDate ? dayjs(inst.paidDate).format('DD MMM YYYY') : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
