import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import {
  employeeLoanService,
  type Loan,
  type WorkflowInstance,
  type LoanStatus,
  LOAN_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
} from '@/services/employee-loan.service';
import { Button } from '@/components/ui/button';
import { AppModal } from '@/components/shared/AppModal';
import { StatusChip, statusTone } from '@/components/shared/StatusChip';
import { useAuthStore } from '@/stores/auth.store';
import { apiErrorMessage } from '@/lib/errors';
import {
  ArrowLeft,
  RefreshCw,
  Banknote,
  CheckCircle2,
  XCircle,
  Clock,
  Gauge,
  AlertTriangle,
  UserRound,
} from 'lucide-react';

function LoanStatusChip({ status }: { status: string }) {
  return (
    <StatusChip tone={statusTone(status)}>
      {LOAN_STATUS_LABELS[status as LoanStatus] || status}
    </StatusChip>
  );
}

function getStepIcon(status: string, isCurrent: boolean) {
  if (status === 'APPROVED') return <CheckCircle2 size={15} />;
  if (status === 'REJECTED') return <XCircle size={15} />;
  if (status === 'ESCALATED') return <AlertTriangle size={15} />;
  if (isCurrent) return <Gauge size={15} className="animate-pulse" />;
  return <Clock size={15} />;
}

function getStepColor(status: string, isCurrent: boolean) {
  if (status === 'APPROVED') return 'bg-success-bg text-success';
  if (status === 'REJECTED') return 'bg-danger-bg text-danger';
  if (status === 'ESCALATED') return 'bg-warning-bg text-warning';
  if (isCurrent) return 'bg-accent text-primary';
  return 'bg-secondary text-muted-foreground';
}

function WorkflowTimelineCard({
  workflow,
  onApprove,
  onReject,
  canAct,
}: {
  workflow: WorkflowInstance;
  onApprove: () => void;
  onReject: () => void;
  canAct: boolean;
}) {
  const currentStep = workflow.steps.find((s) => s.isCurrent);
  return (
    <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.3px]">Alur Persetujuan</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Status: <span className="font-medium text-foreground">{workflow.status}</span>
          </p>
        </div>
        {canAct && workflow.status === 'PENDING' && currentStep && (
          <div className="flex gap-2">
            <Button size="sm" onClick={onApprove}>
              <CheckCircle2 size={14} className="mr-1.5" /> Setujui
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-danger/25 text-danger hover:bg-danger-bg"
              onClick={onReject}
            >
              <XCircle size={14} className="mr-1.5" /> Tolak
            </Button>
          </div>
        )}
      </div>
      <div className="p-5 pl-7">
        <ol className="relative ml-2 border-l border-border">
          {workflow.steps.map((step, idx) => (
            <li key={step.id} className="mb-5 ml-6 last:mb-0">
              <span className={`absolute -left-3.5 flex h-7 w-7 items-center justify-center rounded-full ${getStepColor(step.status, !!step.isCurrent)}`}>
                {getStepIcon(step.status, !!step.isCurrent)}
              </span>
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">
                    Level {step.level} &middot; {step.name}
                  </h4>
                  {step.isCurrent && (
                    <StatusChip tone="accent" className="uppercase tracking-[0.4px]">Saat ini</StatusChip>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Approver: <span className="font-medium text-foreground">{step.approverRoleCode || (step.approverId ? 'User' : '-')}</span>
                  </span>
                  {step.actedAt && (
                    <span>Diproses: {formatDateTime(step.actedAt)}</span>
                  )}
                  {step.actedBy && (
                    <span>Oleh: <span className="font-mono">{step.actedBy.slice(0, 8)}...</span></span>
                  )}
                </div>
                {step.comment && (
                  <div className="mt-2 whitespace-pre-wrap rounded-field border border-border bg-muted/20 p-2.5 text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Catatan:</span> {step.comment}
                  </div>
                )}
              </div>
              {idx < workflow.steps.length - 1 && <div className="h-4" />}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

export function EmployeeLoanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuthStore();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'' | 'APPROVE' | 'REJECT'>('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [approveComment, setApproveComment] = useState('');

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [loanData, wfData] = await Promise.all([
        employeeLoanService.findById(id),
        employeeLoanService.getWorkflow(id).catch(() => null),
      ]);
      setLoan(loanData);
      setWorkflow(wfData);
    } catch (err) { toast.error(apiErrorMessage(err, 'Gagal memuat detail pinjaman')); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const progress = loan
    ? Math.round(((loan.amount - loan.remainingBalance) / loan.amount) * 100)
    : 0;

  const currentStep = workflow?.steps.find((s) => s.isCurrent);
  const canActOnWorkflow =
    !!workflow &&
    !!currentStep &&
    (auth.hasRole('SUPER_ADMIN') ||
      (!!currentStep?.approverRoleCode && auth.hasRole(currentStep.approverRoleCode)) ||
      false);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('APPROVE');
    try {
      await employeeLoanService.submitWorkflowAction(id, 'APPROVE', approveComment || undefined);
      toast.success('Pinjaman disetujui via workflow');
      setShowApproveModal(false);
      setApproveComment('');
      await fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menyetujui pinjaman'));
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading('REJECT');
    try {
      await employeeLoanService.submitWorkflowAction(id, 'REJECT', rejectReason || undefined);
      toast.success('Pinjaman ditolak via workflow');
      setShowRejectModal(false);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal menolak pinjaman'));
    } finally {
      setActionLoading('');
    }
  };

  const paidInstallments = loan?.installments?.filter((i) => i.status === 'PAID').length || 0;

  return (
    <div>
      {/* Header halaman */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">
            {loading ? 'Memuat…' : 'Detail Pinjaman'}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {loan?.loanType?.name || 'Rincian pengajuan, alur persetujuan, dan jadwal cicilan'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => navigate('/employee-loans')}>
            <ArrowLeft size={15} className="mr-2" /> Kembali
          </Button>
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw size={15} className="mr-2" /> Refresh
          </Button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </div>
      )}

      {!loading && !loan && (
        <div className="mt-5 flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
            <Banknote size={24} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Pinjaman tidak ditemukan</p>
          <Button size="sm" className="rounded-[14px]" onClick={() => navigate('/employee-loans')}>Kembali</Button>
        </div>
      )}

      {!loading && loan && (
        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,170px),1fr))] gap-3.5">
              <div className="rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                <p className="text-[11.5px] text-muted-foreground">Jumlah Pinjaman</p>
                <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.8px] text-foreground">{formatCurrency(loan.amount)}</p>
              </div>
              <div className="rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                <p className="text-[11.5px] text-muted-foreground">Sisa Pinjaman</p>
                <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.8px] text-warning">{formatCurrency(loan.remainingBalance)}</p>
              </div>
              <div className="rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                <p className="text-[11.5px] text-muted-foreground">Cicilan per Bulan</p>
                <p className="mt-2.5 text-[22px] font-semibold leading-none tracking-[-0.8px] text-foreground">{formatCurrency(loan.installmentAmount)}</p>
              </div>
              <div className="rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                <p className="text-[11.5px] text-muted-foreground">Status</p>
                <div className="mt-2.5"><LoanStatusChip status={loan.status} /></div>
              </div>
            </div>

            {loan.status === 'ACTIVE' && (
              <div className="rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11.5px] text-muted-foreground">Progress Pembayaran</span>
                  <span className="text-xs font-semibold">{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${progress}%` }} />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {paidInstallments} dari {loan.totalInstallments} cicilan dibayar
                </p>
              </div>
            )}

            <div className="rounded-card border border-border bg-card p-5 shadow-card">
              <h3 className="mb-4 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Informasi Pinjaman</h3>
              <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Jenis:</span> <span className="ml-1 font-medium">{loan.loanType?.name || '-'}</span></div>
                <div><span className="text-muted-foreground">Total Cicilan:</span> <span className="ml-1 font-medium">{loan.totalInstallments} bulan</span></div>
                <div className="sm:col-span-2"><span className="text-muted-foreground">Alasan:</span> <span className="ml-1">{loan.reason}</span></div>
                <div><span className="text-muted-foreground">Diajukan:</span> <span className="ml-1 font-medium">{formatDate(loan.createdAt)}</span></div>
                <div><span className="text-muted-foreground">Disetujui:</span> <span className="ml-1 font-medium">{loan.approvedAt ? formatDate(loan.approvedAt) : '-'}</span></div>
                {loan.employee && (
                  <>
                    <div>
                      <span className="text-muted-foreground">Karyawan:</span>{' '}
                      <span className="ml-1 inline-flex items-center gap-1.5 font-medium">
                        <UserRound size={14} className="text-muted-foreground" /> {loan.employee.fullName}
                      </span>
                    </div>
                    <div><span className="text-muted-foreground">NIK:</span> <span className="ml-1 font-medium">{loan.employee.employeeNumber}</span></div>
                  </>
                )}
              </div>
            </div>

            {workflow && (
              <WorkflowTimelineCard
                workflow={workflow}
                onApprove={() => setShowApproveModal(true)}
                onReject={() => setShowRejectModal(true)}
                canAct={canActOnWorkflow}
              />
            )}

            {loan.installments && loan.installments.length > 0 && (
              <div className="overflow-hidden rounded-card border border-border bg-card shadow-card">
                <div className="border-b border-border px-5 py-4">
                  <h3 className="text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Jadwal Cicilan (Amortisasi)</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="bg-secondary/70">
                        <th className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">#</th>
                        <th className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">Jatuh Tempo</th>
                        <th className="px-5 py-3 text-right text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">Jumlah</th>
                        <th className="px-5 py-3 text-center text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">Status</th>
                        <th className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">Dibayar</th>
                        <th className="px-5 py-3 text-left text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">Catatan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loan.installments.map((inst, i) => (
                        <tr key={inst.id} className="border-t border-border transition-colors hover:bg-muted/30">
                          <td className="px-5 py-3 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="px-5 py-3 text-xs">{dayjs(inst.dueDate).format('DD MMM YYYY')}</td>
                          <td className="px-5 py-3 text-right text-xs font-semibold tracking-[-0.2px]">{formatCurrency(inst.amount)}</td>
                          <td className="px-5 py-3 text-center">
                            <StatusChip tone={statusTone(inst.status)}>
                              {INSTALLMENT_STATUS_LABELS[inst.status] || inst.status}
                            </StatusChip>
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {inst.paidDate ? dayjs(inst.paidDate).format('DD MMM YYYY') : '-'}
                          </td>
                          <td className="px-5 py-3 text-xs text-muted-foreground">
                            {inst.notes || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {(!loan.installments || loan.installments.length === 0) && (
              <div className="rounded-card border border-border bg-card p-5 shadow-card">
                <h3 className="mb-3 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Jadwal Cicilan</h3>
                <p className="text-sm text-muted-foreground">
                  {loan.status === 'PENDING'
                    ? 'Jadwal cicilan akan dibuat setelah pengajuan pinjaman disetujui.'
                    : loan.status === 'REJECTED' || loan.status === 'CANCELLED'
                      ? 'Pengajuan ini tidak memiliki jadwal cicilan karena tidak aktif.'
                      : 'Belum ada jadwal cicilan untuk pinjaman ini.'}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {loan.status === 'PENDING' && !workflow && (
              <div className="rounded-card-sm border border-warning/30 bg-warning-bg p-4">
                <h3 className="mb-1 flex items-center gap-1.5 text-sm font-medium text-warning">
                  <AlertTriangle size={14} /> Workflow tidak tersedia
                </h3>
                <p className="text-xs text-warning/90">
                  Belum ada workflow instance untuk pengajuan ini. Aksi legacy masih tersedia di bawah.
                </p>
              </div>
            )}

            {loan.status === 'PENDING' && (
              <div className="rounded-card-sm border border-border bg-card p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold">
                  {workflow ? 'Aksi Legacy (deprecated)' : 'Aksi'}
                </h3>
                <div className="space-y-3">
                  <Button
                    className={`w-full ${workflow ? 'opacity-50' : ''}`}
                    size="sm"
                    variant={workflow ? 'outline' : 'default'}
                    onClick={() => setShowApproveModal(true)}
                    disabled={actionLoading === 'APPROVE' || !!workflow}
                  >
                    <CheckCircle2 size={16} className="mr-2" />
                    {actionLoading === 'APPROVE' ? 'Menyetujui...' : 'Setujui'}
                  </Button>

                  {!showRejectModal ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className={`w-full ${workflow ? 'opacity-50' : ''}`}
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading === 'REJECT' || !!workflow}
                    >
                      <XCircle size={16} className="mr-2" />
                      Tolak
                    </Button>
                  ) : (
                    <div className="space-y-2 rounded-field bg-danger-bg p-3">
                      <p className="text-xs font-medium text-danger">Alasan penolakan:</p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="h-20 w-full resize-none rounded-field border border-border bg-background p-2.5 text-xs"
                        placeholder="Tulis alasan penolakan..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || (!workflow && !rejectReason)}>
                          {actionLoading === 'REJECT' ? 'Menolak...' : 'Konfirmasi Tolak'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                          Batal
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!workflow && (
              <div className="rounded-card-sm border border-border bg-card p-4 shadow-card">
                <h3 className="mb-3 text-sm font-semibold">Linimasa</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                      <Banknote size={13} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Diajukan</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(loan.createdAt)}</p>
                    </div>
                  </div>
                  {loan.approvedAt && (
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success-bg">
                        <CheckCircle2 size={13} className="text-success" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Disetujui</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(loan.approvedAt)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <AppModal
        open={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        title="Setujui Pengajuan Pinjaman"
        description="Pengajuan akan diteruskan ke tahap berikutnya setelah disetujui"
        maxWidth="max-w-sm"
      >
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Catatan (opsional)</label>
          <textarea
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            placeholder="Tulis catatan persetujuan..."
            rows={3}
            className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)} disabled={actionLoading === 'APPROVE'}>
            Batal
          </Button>
          <Button size="sm" onClick={handleApprove} disabled={actionLoading === 'APPROVE'}>
            <CheckCircle2 size={14} className="mr-1.5" />
            {actionLoading === 'APPROVE' ? 'Menyetujui...' : 'Konfirmasi Setujui'}
          </Button>
        </div>
      </AppModal>

      <AppModal
        open={showRejectModal && !!workflow}
        onClose={() => setShowRejectModal(false)}
        title="Tolak Pengajuan Pinjaman"
        description="Berikan alasan penolakan pengajuan pinjaman ini"
        maxWidth="max-w-sm"
      >
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Alasan Penolakan</label>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Tulis alasan penolakan..."
            rows={3}
            className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
          />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)} disabled={actionLoading === 'REJECT'}>
            Batal
          </Button>
          <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || !rejectReason}>
            {actionLoading === 'REJECT' ? 'Menolak...' : 'Konfirmasi Tolak'}
          </Button>
        </div>
      </AppModal>
    </div>
  );
}
