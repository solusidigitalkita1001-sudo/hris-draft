import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
import { employeeLoanService, type Loan, type LoanType, type LoanStatus, LOAN_STATUS_LABELS } from '@/services/employee-loan.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { AppModal } from '@/components/shared/AppModal';
import { StatTile } from '@/components/shared/StatTile';
import { StatusChip, FilterChip, statusTone } from '@/components/shared/StatusChip';
import { TableShell, useTableControls } from '@/components/shared/TableShell';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { Plus, RefreshCw, Banknote, ChevronRight } from 'lucide-react';

// ─── Loan Form ──────────────────────────────────────────
function LoanForm({ onClose }: { onClose: () => void }) {
  const [loanTypes, setLoanTypes] = useState<LoanType[]>([]);
  const [selectedType, setSelectedType] = useState('');
  const [amount, setAmount] = useState('');
  const [installments, setInstallments] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
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
    if (!companyId || !employeeId) return toast.error('Profil employee atau company belum tersedia. Silakan login ulang');
    if (!selectedType || !reason.trim()) return toast.error('Lengkapi semua field');

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return toast.error('Jumlah pinjaman harus > 0');

    if (!Number.isFinite(installments) || installments <= 0) return toast.error('Jumlah cicilan tidak valid');

    if (selectedLoanType && installments > Number(selectedLoanType.maxInstallments)) {
      return toast.error(`Maksimal cicilan ${selectedLoanType.maxInstallments}x`);
    }

    if (selectedLoanType && parsedAmount > Number(selectedLoanType.maxAmount)) {
      return toast.error(`Maksimal pinjaman ${formatCurrency(Number(selectedLoanType.maxAmount))}`);
    }
    setSaving(true);
    try {
      await employeeLoanService.create({
        loanTypeId: selectedType,
        amount: parsedAmount,
        totalInstallments: installments,
        installmentAmount: Math.round(installmentAmount * 100) / 100,
        reason: reason.trim(),
      });
      toast.success('Pengajuan pinjaman berhasil dikirim');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengajukan pinjaman'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Jenis Pinjaman *</label>
        <Select2
          value={selectedType}
          onValueChange={setSelectedType}
          options={[
            { value: '', label: 'Pilih jenis pinjaman' },
            ...loanTypes.map((t) => ({
              value: t.id,
              label: `${t.name} (Maks: ${formatCurrency(Number(t.maxAmount))}, ${t.maxInstallments}x cicilan)`,
            })),
          ]}
          placeholder="Pilih jenis pinjaman"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Jumlah Pinjaman *</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min={1} required />
        </div>
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Cicilan (bulan) *</label>
          <Input type="number" value={installments} onChange={(e) => setInstallments(Number(e.target.value))} min={1}
            max={selectedLoanType?.maxInstallments || 60} required />
        </div>
      </div>

      {installmentAmount > 0 && (
        <div className="flex items-center gap-2.5 rounded-field bg-accent px-4 py-3 text-sm">
          <span className="h-2 w-2 flex-none rounded-full bg-primary" />
          <span className="text-muted-foreground">Estimasi cicilan per bulan:</span>
          <span className="font-semibold text-foreground">{formatCurrency(Math.round(installmentAmount * 100) / 100)}</span>
        </div>
      )}

      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Alasan Pinjaman *</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
          className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground" required />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Mengirim...' : 'Ajukan Pinjaman'}</Button>
      </div>
    </form>
  );
}

function LoanStatusChip({ status }: { status: string }) {
  return (
    <StatusChip tone={statusTone(status)}>
      {LOAN_STATUS_LABELS[status as LoanStatus] || status}
    </StatusChip>
  );
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'PAID', label: 'Lunas' },
  { value: 'REJECTED', label: 'Ditolak' },
];

export function EmployeeLoanPage() {
  const navigate = useNavigate();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const employeeId = localStorage.getItem('employeeId') || '';
  const isEmployee = !!employeeId;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = isEmployee
        ? await employeeLoanService.findMyLoans(statusFilter || undefined)
        : await employeeLoanService.findAll(companyId, statusFilter || undefined);
      setLoans(data);
    } catch (err) { toast.error(apiErrorMessage(err, 'Gagal memuat data pinjaman')); }
    finally { setLoading(false); }
  }, [companyId, employeeId, isEmployee, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  useEffect(() => { fetchData(); }, [fetchData]);

  const activeLoans = loans.filter((l) => l.status === 'ACTIVE');
  const outstanding = activeLoans.reduce((sum, l) => sum + Number(l.remainingBalance || 0), 0);
  const pendingCount = loans.filter((l) => l.status === 'PENDING').length;
  const paidCount = loans.filter((l) => l.status === 'PAID').length;

  const table = useTableControls(loans, (loan, q) =>
    [loan.loanType?.name, LOAN_STATUS_LABELS[loan.status] || loan.status, loan.reason, loan.employee?.fullName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
      .includes(q));

  return (
    <div>
      {/* Header halaman ala handoff */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">Employee Loan</h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Pinjaman karyawan — pengajuan, cicilan, dan status pembayaran
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw size={15} className="mr-2" /> Refresh
          </Button>
          {isEmployee && (
            <Button size="sm" className="rounded-[14px]" onClick={() => setShowForm(true)}>
              <Plus size={15} className="mr-2" /> Ajukan Pinjaman
            </Button>
          )}
        </div>
      </div>

      {/* Kartu ringkasan */}
      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-3.5">
        <StatTile
          label="Sisa Pinjaman Berjalan"
          value={<span className="text-[22px] tracking-[-0.8px]">{formatCurrency(outstanding)}</span>}
          note={activeLoans.length > 0 ? `${activeLoans.length} pinjaman aktif` : 'Tidak ada pinjaman aktif'}
        />
        <StatTile label="Pinjaman Aktif" value={activeLoans.length} valueClassName="text-success" />
        <StatTile label="Menunggu Persetujuan" value={pendingCount} valueClassName="text-warning" />
        <StatTile label="Lunas" value={paidCount} valueClassName="text-primary" />
      </div>

      {/* Chip filter status */}
      <div className="mt-3.5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <FilterChip key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(s.value)}>
            {s.label}
          </FilterChip>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </div>
      )}

      {!loading && loans.length === 0 && (
        <div className="mt-3.5 flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
            <Banknote size={24} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {statusFilter ? 'Tidak ada pinjaman dengan status ini' : 'Belum ada pinjaman'}
          </p>
          <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
            Pengajuan pinjaman Anda akan tampil di sini beserta jadwal cicilannya.
          </p>
          {isEmployee && !statusFilter && (
            <Button size="sm" className="rounded-[14px]" onClick={() => setShowForm(true)}>
              <Plus size={15} className="mr-2" /> Ajukan Pinjaman
            </Button>
          )}
        </div>
      )}

      {!loading && loans.length > 0 && (
        <div className="mt-3.5">
          <TableShell
            search={table.search}
            setSearch={table.setSearch}
            pageSize={table.pageSize}
            setPageSize={table.setPageSize}
            page={table.page}
            setPage={table.setPage}
            totalPages={table.totalPages}
            totalItems={table.filtered.length}
            searchPlaceholder="Cari pinjaman…"
          >
            <table className="w-full min-w-[820px] text-left">
              <thead>
                <tr className="bg-secondary/70">
                  {['Jenis', 'Jumlah', 'Cicilan', 'Sisa', 'Progres', 'Diajukan', 'Status', ''].map((h, i) => (
                    <th key={i} className="px-5 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.paged.map((loan) => {
                  const progress = loan.amount > 0
                    ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100)
                    : 0;
                  return (
                    <tr
                      key={loan.id}
                      onClick={() => navigate(`/employee-loans/${loan.id}`)}
                      className="cursor-pointer border-t border-border transition-colors hover:bg-muted/30"
                    >
                      <td className="px-5 py-3.5">
                        <p className="text-xs font-medium text-foreground">{loan.loanType?.name || '-'}</p>
                        {loan.employee && (
                          <p className="mt-0.5 text-[10.5px] text-muted-foreground">{loan.employee.fullName}</p>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs font-semibold tracking-[-0.2px] text-foreground">{formatCurrency(loan.amount)}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{loan.totalInstallments}x @ {formatCurrency(loan.installmentAmount)}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatCurrency(loan.remainingBalance)}</td>
                      <td className="px-5 py-3.5">
                        {loan.status === 'ACTIVE' || loan.status === 'PAID' ? (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-success" style={{ width: `${loan.status === 'PAID' ? 100 : progress}%` }} />
                            </div>
                            <span className="text-[10.5px] font-medium text-muted-foreground">{loan.status === 'PAID' ? 100 : progress}%</span>
                          </div>
                        ) : (
                          <span className="text-[10.5px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(loan.createdAt)}</td>
                      <td className="px-5 py-3.5"><LoanStatusChip status={loan.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        <ChevronRight size={14} className="ml-auto text-muted-foreground" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableShell>
        </div>
      )}

      <AppModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Ajukan Pinjaman"
        description="Pengajuan diproses melalui workflow persetujuan pinjaman"
      >
        <LoanForm onClose={() => { setShowForm(false); fetchData(); }} />
      </AppModal>
    </div>
  );
}
