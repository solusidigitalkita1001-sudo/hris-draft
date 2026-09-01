import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  ewaService,
  type EWARequest,
  type EWAStatus,
  EWA_STATUS_LABELS,
  EWA_STATUS_CLASSNAMES,
} from '@/services/ewa.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/ui/select2';
import {
  Wallet, ArrowDownToLine, RefreshCw, XCircle, Send, CheckCircle2, Clock,
} from 'lucide-react';

const STATUS_FILTERS: Array<{ value: EWAStatus | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Semua Status' },
  { value: 'PENDING', label: 'Menunggu Approval' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'PAID', label: 'Sudah Dibayar' },
  { value: 'DEDUCTED', label: 'Terpotong di Gaji' },
  { value: 'REJECTED', label: 'Ditolak' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <XCircle size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function RequestForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const [amountRequested, setAmountRequested] = useState('');
  const [adminFee, setAdminFee] = useState('0');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingLimit, setFetchingLimit] = useState(false);
  const [limitInfo, setLimitInfo] = useState<{
    maxAllowed: number;
    remaining: number;
    earnedGrossToDate: number;
    totalReserved: number;
    breakdown: any;
  } | null>(null);
  const [limitError, setLimitError] = useState<string | null>(null);

  const computeLimit = async () => {
    setFetchingLimit(true);
    setLimitError(null);
    try {
      const info = await ewaService.getMyLimit();
      const maxAllowed = typeof info.max === 'number' ? info.max : (info.maxAllowedAmount ?? 0);
      const remaining = typeof info.remaining === 'number' ? info.remaining : (info.remainingAllowed ?? 0);
      setLimitInfo({
        maxAllowed,
        remaining,
        earnedGrossToDate: info.earnedGrossToDate ?? (info.earnedGross ?? 0),
        totalReserved: typeof info.totalReserved === 'number'
          ? info.totalReserved
          : (typeof info.totalApproved === 'number' ? info.totalApproved : (info.existingApproved ?? 0)),
        breakdown: info.breakdown ?? null,
      });
    } catch (e: any) {
      setLimitError(e?.response?.data?.message || 'Gagal memuat limit EWA dari server');
      setLimitInfo(null);
    } finally {
      setFetchingLimit(false);
    }
  };

  useEffect(() => { void computeLimit(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amountRequested);
    const fee = Number(adminFee) || 0;
    if (!Number.isFinite(amt) || amt <= 0) return toast.error('Masukkan jumlah yang ingin ditarik');
    if (limitInfo && amt > limitInfo.remaining) {
      return toast.error(`Maksimal sisa pencairan: ${formatCurrency(limitInfo.remaining)}`);
    }

    setLoading(true);
    try {
      await ewaService.createRequest({
        amountRequested: amt,
        adminFee: fee,
        reason: reason.trim() || undefined,
      });
      toast.success('Pengajuan Tarik Gaji Awal berhasil dikirim');
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengajukan EWA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 dark:bg-indigo-900/10 p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-2">
            <Wallet size={16} className="text-indigo-600" />
            Limit EWA Bulan Ini (Server-Side Verified)
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => void computeLimit()} disabled={fetchingLimit}>
            <RefreshCw size={14} className={`mr-1 ${fetchingLimit ? 'animate-spin' : ''}`} />
            {fetchingLimit ? 'Memuat...' : 'Refresh'}
          </Button>
        </div>

        {limitError && (
          <div className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md p-3 border border-red-100">
            <strong>Perhatian:</strong> {limitError}
            <div className="mt-1 text-[11px] text-red-600">
              Jika masalah berlanjut, hubungi HR untuk memastikan Employee Salary dan data attendance periode ini sudah tercatat.
            </div>
          </div>
        )}

        {!limitError && limitInfo && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-indigo-100">
              <div className="text-muted-foreground mb-1">Pendapatan Aktual Sejauh Ini</div>
              <div className="text-lg font-bold text-foreground">{formatCurrency(limitInfo.earnedGrossToDate)}</div>
              {limitInfo.breakdown && (
                <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                  <div>Base Salary: {formatCurrency(limitInfo.breakdown.baseSalary)}</div>
                  <div>Hari Hadir: {limitInfo.breakdown.presentDays} / {limitInfo.breakdown.workDaysInPeriod}</div>
                  <div>Overtime Approved: {formatCurrency(limitInfo.breakdown.overtimePay)}</div>
                </div>
              )}
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/15 rounded-md p-3 border border-emerald-100">
              <div className="text-muted-foreground mb-1">Maksimal Tarik (50%)</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(limitInfo.maxAllowed)}</div>
              <div className="mt-2 pt-2 border-t border-emerald-100 space-y-0.5 text-[11px]">
                <div className="text-muted-foreground">Pending/Disetujui/Dibayar periode ini:</div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(limitInfo.totalReserved)}</div>
                <div className="text-muted-foreground mt-1">Sisa Bisa Ditarik:</div>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(limitInfo.remaining)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Jumlah Ditarik (Rp) *</Label>
          <Input
            type="number"
            min={1}
            value={amountRequested}
            onChange={(e) => setAmountRequested(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Admin Fee (Rp)</Label>
          <Input type="number" min={0} value={adminFee} onChange={(e) => setAdminFee(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Alasan (minimal 3 karakter)</Label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Contoh: Kebutuhan mendesak biaya pengobatan keluarga"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
        <Button type="submit" disabled={loading || !limitInfo}>
          {loading ? 'Mengirim...' : (<><Send size={16} className="mr-2" />Ajukan Sekarang</>)}
        </Button>
      </div>
    </form>
  );
}

export function EmployeeEWADashboardPage() {
  const [requests, setRequests] = useState<EWARequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EWAStatus | 'ALL'>('ALL');
  const [formOpen, setFormOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const data = await ewaService.getMyRequests(statusFilter === 'ALL' ? undefined : statusFilter);
      setRequests(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat daftar request EWA');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRequests(); }, [statusFilter]);

  const handleCancel = async (id: string) => {
    if (!confirm('Batalkan request EWA ini?')) return;
    setCancellingId(id);
    try {
      await ewaService.cancel(id);
      toast.success('Request EWA dibatalkan');
      void fetchRequests();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal membatalkan');
    } finally {
      setCancellingId(null);
    }
  };

  const summaryCards = useMemo(() => {
    const approved = requests.filter((r) => r.status === 'APPROVED').reduce((s, r) => s + Number(r.amountRequested), 0);
    const paid = requests.filter((r) => r.status === 'PAID').reduce((s, r) => s + Number(r.amountPaidOut ?? r.amountRequested), 0);
    const deducted = requests.filter((r) => r.status === 'DEDUCTED').reduce((s, r) => s + Number(r.amountDeductedPayroll ?? r.amountRequested), 0);
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    return { approved, paid, deducted, pending };
  }, [requests]);

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title="Tarik Gaji Awal (EWA)"
          description="Cairkan sebagian gaji Anda sebelum tanggal gajian"
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void fetchRequests()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <ArrowDownToLine size={16} className="mr-2" />
            Ajukan Tarik Gaji
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-yellow-50 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-300 p-2">
              <Clock size={20} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Menunggu Approval</div>
              <div className="text-2xl font-semibold mt-0.5">{summaryCards.pending}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 p-2">
              <CheckCircle2 size={20} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Disetujui Belum Cair</div>
              <div className="text-2xl font-semibold mt-0.5">{formatCurrency(summaryCards.approved)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 p-2">
              <Wallet size={20} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Sudah Dicairkan</div>
              <div className="text-2xl font-semibold mt-0.5">{formatCurrency(summaryCards.paid)}</div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 p-2">
              <ArrowDownToLine size={20} />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Terpotong di Gaji</div>
              <div className="text-2xl font-semibold mt-0.5">{formatCurrency(summaryCards.deducted)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">Riwayat Pengajuan Saya</h3>
          <Select2
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as EWAStatus | 'ALL')}
            options={STATUS_FILTERS}
            className="h-9 w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Kode Request</th>
                <th className="px-4 py-3 text-left font-medium">Tanggal</th>
                <th className="px-4 py-3 text-right font-medium">Jumlah</th>
                <th className="px-4 py-3 text-right font-medium">Fee Admin</th>
                <th className="px-4 py-3 text-left font-medium">Alasan</th>
                <th className="px-4 py-3 text-center font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Memuat...</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Belum ada pengajuan EWA</td></tr>
              ) : requests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.requestCode}</td>
                  <td className="px-4 py-3">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-medium text-emerald-700 dark:text-emerald-400">
                    {formatCurrency(Number(r.amountRequested))}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatCurrency(Number(r.adminFee ?? 0))}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{r.reason || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EWA_STATUS_CLASSNAMES[r.status]}`}>
                      {EWA_STATUS_LABELS[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.status === 'PENDING' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        onClick={() => void handleCancel(r.id)}
                        disabled={cancellingId === r.id}
                      >
                        <XCircle size={14} className="mr-1" />
                        {cancellingId === r.id ? 'Proses...' : 'Batalkan'}
                      </Button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Ajukan Tarik Gaji Awal (EWA)">
        <RequestForm onClose={() => setFormOpen(false)} onSubmitted={() => void fetchRequests()} />
      </Modal>
    </div>
  );
}
