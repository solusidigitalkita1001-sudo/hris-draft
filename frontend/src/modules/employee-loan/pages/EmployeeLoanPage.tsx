import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { employeeLoanService, type Loan, type LoanType, LOAN_STATUS_LABELS } from '@/services/employee-loan.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, RefreshCw, Banknote, Eye,
} from 'lucide-react';

// ─── Modal ──────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Loan Form ──────────────────────────────────────────
function LoanForm({ onClose }: { onClose: () => void }) {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const companyId = localStorage.getItem('companyId') || '';
  const employeeId = localStorage.getItem('employeeId') || '';

  useEffect(() => {
    if (companyId) {
      employeeLoanService.findLoanTypes(companyId).then(setLoanTypes).catch(() => {});
    }
  }, [companyId]);

  const selectedLoanType = loanTypes.find((t) => t.id === selectedType);
  const installmentAmount = selectedLoanType && amount
    ? (Number(amount) / installments) * (1 + Number(selectedLoanType.interestRate) / 100)
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType || !amount || !reason.trim()) return toast.error('Lengkapi semua field');
    if (selectedLoanType && Number(amount) > Number(selectedLoanType.maxAmount)) {
      return toast.error(`Maksimal pinjaman ${formatCurrency(Number(selectedLoanType.maxAmount))}`);
    }
    setSaving(true);
    try {
      await employeeLoanService.create({
        loanTypeId: selectedType,
        amount: Number(amount),
        totalInstallments: installments,
        installmentAmount: Math.round(installmentAmount * 100) / 100,
        reason: reason.trim(),
        employeeId,
        companyId,
      } as any);
      toast.success('Pengajuan pinjaman berhasil dikirim');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengajukan pinjaman');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Jenis Pinjaman *</label>
        <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-background text-foreground" required>
          <option value="">Pilih jenis pinjaman</option>
          {loanTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} (Maks: {formatCurrency(Number(t.maxAmount))}, {t.maxInstallments}x cicilan)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Jumlah Pinjaman *</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cicilan (bulan) *</label>
          <Input type="number" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} min={1}
            max={selectedLoanType?.maxInstallments || 60} required />
        </div>
      </div>

      {installmentAmount > 0 && (
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
          <span className="text-muted-foreground">Estimasi cicilan per bulan: </span>
          <span className="font-semibold">{formatCurrency(Math.round(installmentAmount * 100) / 100)}</span>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Alasan Pinjaman *</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Mengirim...' : 'Ajukan Pinjaman'}</Button>
      </div>
    </form>
  );
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  ACTIVE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  PAID: 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400',
};

export function EmployeeLoanPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const companyId = localStorage.getItem('companyId') || '';
  const employeeId = localStorage.getItem('employeeId') || '';
  const isEmployee = !!employeeId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = isEmployee
        ? await employeeLoanService.findMyLoans(employeeId, statusFilter || undefined)
        : await employeeLoanService.findAll(companyId, statusFilter || undefined);
      setLoans(data);
    } catch { toast.error('Gagal memuat data pinjaman'); }
    finally { setLoading(false); }
  }, [companyId, employeeId, isEmployee, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div>
      <PageHeader
        title="Employee Loan"
        description="Pinjaman karyawan — pengajuan, cicilan, dan status"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />Refresh</Button>
            {isEmployee && <Button size="sm" onClick={() => setShowForm(true)}><Plus size={16} className="mr-2" />Ajukan Pinjaman</Button>}
          </div>
        }
      />

      <div className="flex gap-1 mb-4 flex-wrap">
        {['', 'PENDING', 'ACTIVE', 'PAID', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
              statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'
            }`}>
            {s || 'Semua'}
          </button>
        ))}
      </div>

      {loading && <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Memuat data...</div></div>}

      {!loading && loans.length === 0 && (
        <div className="flex flex-col items-center py-20 gap-3">
          <Banknote size={48} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">{statusFilter ? 'Tidak ada pinjaman dengan status ini' : 'Belum ada pinjaman'}</p>
          {isEmployee && !statusFilter && <Button size="sm" onClick={() => setShowForm(true)}><Plus size={16} className="mr-2" />Ajukan Pinjaman</Button>}
        </div>
      )}

      {!loading && loans.length > 0 && (
        <div className="space-y-3">
          {loans.map((loan) => {
            const progress = loan.totalInstallments > 0
              ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100)
              : 0;
            return (
              <div key={loan.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/employee-loans/${loan.id}`)}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[loan.status] || ''}`}>
                        {LOAN_STATUS_LABELS[loan.status as keyof typeof LOAN_STATUS_LABELS] || loan.status}
                      </span>
                      <span className="text-xs font-medium text-muted-foreground">{loan.loanType?.name || '-'}</span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-lg font-bold">{formatCurrency(loan.amount)}</span>
                      <span className="text-xs text-muted-foreground">{loan.totalInstallments}x cicilan @ {formatCurrency(loan.installmentAmount)}</span>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span>Sisa: {formatCurrency(loan.remainingBalance)}</span>
                      <span>Diajukan: {formatDate(loan.createdAt)}</span>
                      {loan._count && <span>{loan._count.installments} cicilan</span>}
                    </div>
                    {loan.status === 'ACTIVE' && (
                      <div className="mt-2 w-full max-w-xs bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                        <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <button className="shrink-0 p-1.5 rounded-lg hover:bg-muted text-muted-foreground" title="Detail">
                    <Eye size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="Ajukan Pinjaman">
        <LoanForm onClose={() => { setShowForm(false); fetchData(); }} />
      </Modal>
    </div>
  );
}
