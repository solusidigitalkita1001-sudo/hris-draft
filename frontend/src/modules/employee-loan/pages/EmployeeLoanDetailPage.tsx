import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import {
  employeeLoanService,
  type Loan,
  type WorkflowInstance,
  LOAN_STATUS_LABELS,
  INSTALLMENT_STATUS_LABELS,
} from '@/services/employee-loan.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
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

function getStepIcon(status: string, isCurrent: boolean) {
  if (status === 'APPROVED') {
    return <CheckCircle2 size={16} className="text-white" />;
  }
  if (status === 'REJECTED') {
    return <XCircle size={16} className="text-white" />;
  }
  if (status === 'ESCALATED') {
    return <AlertTriangle size={16} className="text-white" />;
  }
  if (isCurrent) {
    return <Gauge size={16} className="text-white animate-pulse" />;
  }
  return <Clock size={16} className="text-white" />;
}

function getStepColor(status: string, isCurrent: boolean) {
  if (status === 'APPROVED') return 'bg-emerald-500 ring-2 ring-emerald-200 dark:ring-emerald-900';
  if (status === 'REJECTED') return 'bg-red-500 ring-2 ring-red-200 dark:ring-red-900';
  if (status === 'ESCALATED') return 'bg-amber-500 ring-2 ring-amber-200 dark:ring-amber-900';
  if (isCurrent) return 'bg-blue-500 ring-2 ring-blue-200 dark:ring-blue-900';
  return 'bg-gray-400 dark:bg-gray-600 ring-2 ring-gray-200 dark:ring-gray-700';
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
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">Approval Workflow Timeline</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Status: <span className="font-medium text-foreground">{workflow.status}</span>
          </p>
        </div>
        {canAct && workflow.status === 'PENDING' && currentStep && (
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApprove}>
              <CheckCircle2 size={14} className="mr-1.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950" onClick={onReject}>
              <XCircle size={14} className="mr-1.5" /> Reject
            </Button>
          </div>
        )}
      </div>
      <div className="p-4 pl-6">
        <ol className="relative border-l border-border ml-2">
          {workflow.steps.map((step, idx) => (
            <li key={step.id} className="mb-5 ml-6 last:mb-0">
              <span className={`absolute -left-3.5 flex items-center justify-center w-7 h-7 rounded-full ${getStepColor(step.status, !!step.isCurrent)}`}>
                {getStepIcon(step.status, !!step.isCurrent)}
              </span>
              <div className="pt-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold">
                    Level {step.level} &middot; {step.name}
                  </h4>
                  {step.isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      CURRENT
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    Approver: <span className="font-medium text-foreground">{step.approverRoleCode || (step.approverId ? 'User' : '-')}</span>
                  </span>
                  {step.actedAt && (
                    <span>Acted: {formatDateTime(step.actedAt)}</span>
                  )}
                  {step.actedBy && (
                    <span>By: <span className="font-mono">{step.actedBy.slice(0, 8)}...</span></span>
                  )}
                </div>
                {step.comment && (
                  <div className="mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-border text-xs text-muted-foreground whitespace-pre-wrap">
                    <span className="font-medium text-foreground">Comment:</span> {step.comment}
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
    } catch { toast.error('Gagal memuat detail pinjaman'); }
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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyetujui pinjaman');
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
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menolak pinjaman');
    } finally {
      setActionLoading('');
    }
  };

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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
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
                    <div>
                      <span className="text-muted-foreground">Karyawan:</span>{' '}
                      <span className="font-medium ml-1 flex items-center gap-1.5 inline-flex">
                        <UserRound size={14} className="text-muted-foreground" /> {loan.employee.fullName}
                      </span>
                    </div>
                    <div><span className="text-muted-foreground">NIK:</span> <span className="font-medium ml-1">{loan.employee.employeeNumber}</span></div>
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
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Catatan</th>
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
                          <td className="px-3 py-2.5 text-xs text-muted-foreground">
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
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Jadwal Cicilan</h3>
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
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 p-4">
                <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                  <AlertTriangle size={14} /> Workflow not available
                </h3>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No workflow instance attached. Legacy actions still available below.
                </p>
              </div>
            )}

            {loan.status === 'PENDING' && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium mb-3">
                  {workflow ? 'Legacy Actions (deprecated)' : 'Actions'}
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
                    {actionLoading === 'APPROVE' ? 'Approving...' : 'Approve'}
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
                      Reject
                    </Button>
                  ) : (
                    <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                      <p className="text-xs font-medium text-red-700 dark:text-red-400">Reason for rejection:</p>
                      <textarea
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        className="w-full h-20 text-xs p-2 rounded border border-border bg-background resize-none"
                        placeholder="Enter rejection reason..."
                      />
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || (!workflow && !rejectReason)}>
                          {actionLoading === 'REJECT' ? 'Rejecting...' : 'Confirm Reject'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {!workflow && (
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
                <h3 className="text-sm font-medium mb-3">Timeline</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                      <Banknote size={12} className="text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">Submitted</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(loan.createdAt)}</p>
                    </div>
                  </div>
                  {loan.approvedAt && (
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium">Approved</p>
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

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowApproveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" /> Approve Loan Request
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Are you sure you want to approve this loan request? You can add an optional comment below.
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comment (optional)</label>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder="Enter approval comment..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)} disabled={actionLoading === 'APPROVE'}>
                Cancel
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} disabled={actionLoading === 'APPROVE'}>
                {actionLoading === 'APPROVE' ? 'Approving...' : 'Confirm Approve'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {showRejectModal && workflow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRejectModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                <XCircle size={18} className="text-red-600" /> Reject Loan Request
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Provide a reason for rejecting this loan request.
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Rejection Reason</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Enter rejection reason..."
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)} disabled={actionLoading === 'REJECT'}>
                Cancel
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || !rejectReason}>
                {actionLoading === 'REJECT' ? 'Rejecting...' : 'Confirm Reject'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
