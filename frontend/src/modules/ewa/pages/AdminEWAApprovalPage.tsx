import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDateTime, formatDate } from '@/utils/format';
import {
  ewaService,
  type EWARequest,
  type EWAStatus,
  EWA_STATUS_CLASSNAMES,
} from '@/services/ewa.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/ui/select2';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import {
  RefreshCw, CheckCircle, XCircle, Wallet, Eye, UserRound, Send,
} from 'lucide-react';

const STATUS_FILTERS: Array<{ value: EWAStatus | 'ALL'; labelKey: TranslationKey }> = [
  { value: 'ALL', labelKey: 'fin.ewa.filterAll' },
  { value: 'PENDING', labelKey: 'fin.ewa.filterPending' },
  { value: 'APPROVED', labelKey: 'fin.ewaAdmin.filterApproved' },
  { value: 'PAID', labelKey: 'fin.ewa.filterPaid' },
  { value: 'DEDUCTED', labelKey: 'fin.ewaAdmin.filterDeducted' },
  { value: 'REJECTED', labelKey: 'fin.status.rejected' },
  { value: 'CANCELLED', labelKey: 'fin.ewa.filterCancelled' },
];

/** Label status EWA; status di luar peta ditampilkan mentah dari server. */
const EWA_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'fin.ewa.filterPending',
  APPROVED: 'fin.common.approved',
  PAID: 'fin.ewa.filterPaid',
  DEDUCTED: 'fin.ewa.filterDeducted',
  REJECTED: 'fin.status.rejected',
  CANCELLED: 'fin.ewa.filterCancelled',
};

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

export function AdminEWAApprovalPage() {
  const { t } = useI18n();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [requests, setRequests] = useState<EWARequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<EWAStatus | 'ALL'>('ALL');
  const [employeeSearch, setEmployeeSearch] = useState('');

  const [approveModal, setApproveModal] = useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [rejectModal, setRejectModal] = useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [paidModal, setPaidModal] = useState<{ id: string; open: boolean }>({ id: '', open: false });
  const [detailModal, setDetailModal] = useState<{ id: string; open: boolean; data?: EWARequest | null }>({ id: '', open: false, data: null });

  const [approveNotes, setApproveNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [paidRef, setPaidRef] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRequests = async () => {
    if (!companyId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await ewaService.findAll(companyId, {
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setRequests(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewaAdmin.loadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRequests(); }, [companyId, statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  const filteredRequests = useMemo(() => {
    if (!employeeSearch.trim()) return requests;
    const q = employeeSearch.trim().toLowerCase();
    return requests.filter((r) => {
      if (r.requestCode.toLowerCase().includes(q)) return true;
      if (r.reason?.toLowerCase().includes(q)) return true;
      const emp = r.employee;
      if (!emp) return false;
      return emp.fullName.toLowerCase().includes(q) || (emp.employeeNumber || '').toLowerCase().includes(q);
    });
  }, [requests, employeeSearch]);

  const summary = useMemo(() => {
    const pending = requests.filter((r) => r.status === 'PENDING').length;
    const approved = requests.filter((r) => r.status === 'APPROVED');
    const approvedAmt = approved.reduce((s, r) => s + Number(r.amountRequested), 0);
    const paidAmt = requests.filter((r) => r.status === 'PAID')
      .reduce((s, r) => s + Number(r.amountPaidOut ?? r.amountRequested), 0);
    const deductedAmt = requests.filter((r) => r.status === 'DEDUCTED')
      .reduce((s, r) => s + Number(r.amountDeductedPayroll ?? r.amountRequested), 0);
    return { pending, approvedAmt, paidAmt, deductedAmt };
  }, [requests]);

  const openDetail = async (id: string) => {
    setDetailModal({ id, open: true, data: null });
    try {
      const detail = await ewaService.findById(id);
      setDetailModal({ id, open: true, data: detail });
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewaAdmin.detailLoadFailed')));
    }
  };

  const handleApprove = async () => {
    if (!approveModal.id) return;
    setActionLoading(true);
    try {
      await ewaService.approve(approveModal.id, approveNotes.trim() || undefined);
      toast.success(t('fin.ewaAdmin.approvedToast'));
      setApproveModal({ id: '', open: false });
      setApproveNotes('');
      void fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewaAdmin.approveFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectModal.id) return;
    if (!rejectReason.trim() || rejectReason.trim().length < 3) {
      return toast.error(t('fin.ewaAdmin.errRejectMin'));
    }
    setActionLoading(true);
    try {
      await ewaService.reject(rejectModal.id, rejectReason.trim());
      toast.success(t('fin.ewaAdmin.rejectedToast'));
      setRejectModal({ id: '', open: false });
      setRejectReason('');
      void fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewaAdmin.rejectFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paidModal.id) return;
    const amt = Number(paidAmount);
    if (!Number.isFinite(amt) || amt <= 0) return toast.error(t('fin.ewaAdmin.errPaidAmount'));
    if (!paidRef.trim()) return toast.error(t('fin.ewaAdmin.errPaidRef'));
    setActionLoading(true);
    try {
      await ewaService.markPaid(paidModal.id, amt, paidRef.trim());
      toast.success(t('fin.ewaAdmin.markedPaid'));
      setPaidModal({ id: '', open: false });
      setPaidAmount('');
      setPaidRef('');
      void fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewaAdmin.markPaidFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const selectedRequest = (modalId: string) => requests.find((r) => r.id === modalId);

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex items-center justify-between">
        <PageHeader
          title={t('fin.ewaAdmin.title')}
          description={t('fin.ewaAdmin.description')}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void fetchRequests()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('fin.ewa.filterPending')}</div>
          <div className="text-2xl font-semibold mt-1 text-yellow-600 dark:text-yellow-300">{summary.pending}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.cardApproved')}</div>
          <div className="text-2xl font-semibold mt-1 text-blue-600 dark:text-blue-300">{formatCurrency(summary.approvedAmt)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.cardPaid')}</div>
          <div className="text-2xl font-semibold mt-1 text-purple-600 dark:text-purple-300">{formatCurrency(summary.paidAmt)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.cardDeducted')}</div>
          <div className="text-2xl font-semibold mt-1 text-emerald-600 dark:text-emerald-300">{formatCurrency(summary.deductedAmt)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-border">
          <h3 className="text-sm font-semibold">{t('fin.ewaAdmin.listTitle')}</h3>
          <div className="flex items-center gap-2">
            <div className="relative">
              <UserRound size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('fin.ewaAdmin.searchPlaceholder')}
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                className="pl-8 h-9 w-64"
              />
            </div>
            <Select2
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as EWAStatus | 'ALL')}
              options={STATUS_FILTERS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
              className="h-9 w-48"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('fin.common.code')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('fin.common.employee')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('fin.ewaAdmin.colSubmittedAt')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('fin.common.amount')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('fin.common.reason')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('fin.common.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('fin.common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('common.loading')}</td></tr>
              ) : filteredRequests.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('fin.ewaAdmin.empty')}</td></tr>
              ) : filteredRequests.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-xs">{r.requestCode}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.employee?.fullName || '-'}</div>
                    <div className="text-xs text-muted-foreground">{r.employee?.employeeNumber || ''}</div>
                  </td>
                  <td className="px-4 py-3">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(Number(r.amountRequested))}</td>
                  <td className="px-4 py-3 max-w-xs truncate text-muted-foreground">{r.reason || '-'}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EWA_STATUS_CLASSNAMES[r.status]}`}>
                      {EWA_STATUS_LABEL_KEYS[r.status] ? t(EWA_STATUS_LABEL_KEYS[r.status]) : r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1 justify-end">
                      <Button variant="ghost" size="sm" onClick={() => void openDetail(r.id)}>
                        <Eye size={14} className="mr-1" />{t('fin.ewaAdmin.detail')}
                      </Button>
                      {r.status === 'PENDING' && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20"
                            onClick={() => setApproveModal({ id: r.id, open: true })}
                          >
                            <CheckCircle size={14} className="mr-1" />{t('fin.common.approve')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => setRejectModal({ id: r.id, open: true })}
                          >
                            <XCircle size={14} className="mr-1" />{t('fin.common.reject')}
                          </Button>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20"
                          onClick={() => {
                            setPaidModal({ id: r.id, open: true });
                            setPaidAmount(String(r.amountRequested));
                          }}
                        >
                          <Wallet size={14} className="mr-1" />{t('fin.ewaAdmin.markPaid')}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={approveModal.open}
        onClose={() => !actionLoading && setApproveModal({ id: '', open: false })}
        title={t('fin.ewaAdmin.approveModalTitle')}
      >
        {(() => {
          const r = selectedRequest(approveModal.id);
          if (!r) return null;
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">{t('fin.common.employee')}:</span> <span className="font-medium">{r.employee?.fullName || '-'}</span></div>
                <div><span className="text-muted-foreground">{t('fin.common.amount')}:</span> <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(Number(r.amountRequested))}</span></div>
                <div><span className="text-muted-foreground">{t('fin.common.reason')}:</span> {r.reason || '-'}</div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.common.notesOptional')}</Label>
                <textarea
                  rows={3}
                  value={approveNotes}
                  onChange={(e) => setApproveNotes(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={t('fin.ewaAdmin.approveNotePlaceholder')}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setApproveModal({ id: '', open: false })} disabled={actionLoading}>{t('common.cancel')}</Button>
                <Button type="button" onClick={() => void handleApprove()} disabled={actionLoading}>
                  <CheckCircle size={16} className="mr-2" />
                  {actionLoading ? t('fin.common.processingShort') : t('fin.ewaAdmin.approveAction')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={rejectModal.open}
        onClose={() => !actionLoading && setRejectModal({ id: '', open: false })}
        title={t('fin.ewaAdmin.rejectModalTitle')}
      >
        {(() => {
          const r = selectedRequest(rejectModal.id);
          if (!r) return null;
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">{t('fin.common.employee')}:</span> <span className="font-medium">{r.employee?.fullName || '-'}</span></div>
                <div><span className="text-muted-foreground">{t('fin.common.amount')}:</span> <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(Number(r.amountRequested))}</span></div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewaAdmin.rejectReasonLabel')}</Label>
                <textarea
                  rows={3}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder={t('fin.ewaAdmin.rejectPlaceholder')}
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setRejectModal({ id: '', open: false })} disabled={actionLoading}>{t('common.cancel')}</Button>
                <Button type="button" variant="destructive" onClick={() => void handleReject()} disabled={actionLoading}>
                  <XCircle size={16} className="mr-2" />
                  {actionLoading ? t('fin.common.processingShort') : t('fin.ewaAdmin.rejectAction')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={paidModal.open}
        onClose={() => !actionLoading && setPaidModal({ id: '', open: false })}
        title={t('fin.ewaAdmin.paidModalTitle')}
      >
        {(() => {
          const r = selectedRequest(paidModal.id);
          if (!r) return null;
          return (
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40 space-y-1.5 text-sm">
                <div><span className="text-muted-foreground">{t('fin.common.employee')}:</span> <span className="font-medium">{r.employee?.fullName || '-'}</span></div>
                <div><span className="text-muted-foreground">{t('fin.ewaAdmin.requestAmountLabel')}:</span> <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(Number(r.amountRequested))}</span></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewaAdmin.paidAmountLabel')} *</Label>
                  <Input
                    type="number"
                    min={1}
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewaAdmin.paidRefLabel')} *</Label>
                  <Input
                    type="text"
                    value={paidRef}
                    onChange={(e) => setPaidRef(e.target.value)}
                    placeholder={t('fin.ewaAdmin.paidRefPlaceholder')}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setPaidModal({ id: '', open: false })} disabled={actionLoading}>{t('common.cancel')}</Button>
                <Button type="button" onClick={() => void handleMarkPaid()} disabled={actionLoading}>
                  <Send size={16} className="mr-2" />
                  {actionLoading ? t('fin.common.processingShort') : t('fin.ewaAdmin.markPaidAction')}
                </Button>
              </div>
            </div>
          );
        })()}
      </Modal>

      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ id: '', open: false, data: null })}
        title={t('fin.ewaAdmin.detailTitle')}
      >
        {!detailModal.data ? (
          <div className="py-8 text-center text-muted-foreground">{t('fin.ewaAdmin.loadingDetail')}</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><div className="text-xs text-muted-foreground">{t('fin.ewa.colCode')}</div><div className="font-mono font-medium">{detailModal.data.requestCode}</div></div>
              <div><div className="text-xs text-muted-foreground">{t('fin.common.status')}</div><div>
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EWA_STATUS_CLASSNAMES[detailModal.data.status]}`}>
                  {EWA_STATUS_LABEL_KEYS[detailModal.data.status] ? t(EWA_STATUS_LABEL_KEYS[detailModal.data.status]) : detailModal.data.status}
                </span>
              </div></div>
              <div><div className="text-xs text-muted-foreground">{t('fin.common.employee')}</div><div className="font-medium">{detailModal.data.employee?.fullName || '-'}</div></div>
              <div><div className="text-xs text-muted-foreground">{t('fin.common.nik')}</div><div>{detailModal.data.employee?.employeeNumber || '-'}</div></div>
              <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.requestedAmount')}</div><div className="font-semibold text-emerald-700 dark:text-emerald-400">{formatCurrency(Number(detailModal.data.amountRequested))}</div></div>
              <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.adminFee')}</div><div>{formatCurrency(Number(detailModal.data.adminFee ?? 0))}</div></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.salaryPeriod')}</div><div>{t('fin.ewaAdmin.periodRange', { start: formatDate(detailModal.data.periodStart), end: formatDate(detailModal.data.periodEnd) })}</div></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('fin.common.reason')}</div><div>{detailModal.data.reason || '-'}</div></div>
              {detailModal.data.approverNotes && (
                <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.approverNotes')}</div><div className="text-blue-700 dark:text-blue-300">{detailModal.data.approverNotes}</div></div>
              )}
              {detailModal.data.rejectReason && (
                <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.rejectedReason')}</div><div className="text-red-700 dark:text-red-300 italic">{detailModal.data.rejectReason}</div></div>
              )}
              {detailModal.data.status === 'PAID' && (
                <>
                  <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.paidAt')}</div><div>{formatDateTime(detailModal.data.paidOutAt)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.paidAmountLabel')}</div><div className="font-semibold">{formatCurrency(Number(detailModal.data.amountPaidOut ?? 0))}</div></div>
                  <div className="col-span-2"><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.paymentRef')}</div><div className="font-mono">{detailModal.data.disbursementReference || '-'}</div></div>
                </>
              )}
              {detailModal.data.status === 'DEDUCTED' && (
                <>
                  <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.deductedAt')}</div><div>{formatDateTime(detailModal.data.deductedAt)}</div></div>
                  <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.deductedAmount')}</div><div className="font-semibold">{formatCurrency(Number(detailModal.data.amountDeductedPayroll ?? 0))}</div></div>
                </>
              )}
              {detailModal.data.status === 'CANCELLED' && (
                <div><div className="text-xs text-muted-foreground">{t('fin.ewaAdmin.cancelledAt')}</div><div>{formatDateTime(detailModal.data.cancelledAt)}</div></div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
