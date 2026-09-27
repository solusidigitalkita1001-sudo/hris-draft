import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatCurrency, formatDate } from '@/utils/format';
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
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import {
  Wallet, ArrowDownToLine, RefreshCw, XCircle, Send, CheckCircle2, Clock,
} from 'lucide-react';

const STATUS_FILTERS: Array<{ value: EWAStatus | 'ALL'; labelKey: TranslationKey }> = [
  { value: 'ALL', labelKey: 'fin.ewa.filterAll' },
  { value: 'PENDING', labelKey: 'fin.ewa.filterPending' },
  { value: 'APPROVED', labelKey: 'fin.common.approved' },
  { value: 'PAID', labelKey: 'fin.ewa.filterPaid' },
  { value: 'DEDUCTED', labelKey: 'fin.ewa.filterDeducted' },
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

function RequestForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { t } = useI18n();
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
    breakdown: {
      baseSalary: number;
      presentDays: number;
      workDaysInPeriod: number;
      overtimePay: number;
    } | null;
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
    } catch (e) {
      setLimitError(apiErrorMessage(e, t('fin.ewa.limitLoadFailed')));
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
    if (!Number.isFinite(amt) || amt <= 0) return toast.error(t('fin.ewa.errAmount'));
    if (limitInfo && amt > limitInfo.remaining) {
      return toast.error(t('fin.ewa.errOverLimit', { amount: formatCurrency(limitInfo.remaining) }));
    }

    setLoading(true);
    try {
      await ewaService.createRequest({
        amountRequested: amt,
        adminFee: fee,
        reason: reason.trim() || undefined,
      });
      toast.success(t('fin.ewa.submitted'));
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewa.submitFailed')));
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
            {t('fin.ewa.limitTitle')}
          </h3>
          <Button type="button" variant="ghost" size="sm" onClick={() => void computeLimit()} disabled={fetchingLimit}>
            <RefreshCw size={14} className={`mr-1 ${fetchingLimit ? 'animate-spin' : ''}`} />
            {fetchingLimit ? t('common.loading') : t('common.refresh')}
          </Button>
        </div>

        {limitError && (
          <div className="text-xs bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-md p-3 border border-red-100">
            <strong>{t('fin.ewa.attention')}</strong> {limitError}
            <div className="mt-1 text-[11px] text-red-600">
              {t('fin.ewa.limitErrorHint')}
            </div>
          </div>
        )}

        {!limitError && limitInfo && (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-white dark:bg-gray-800 rounded-md p-3 border border-indigo-100">
              <div className="text-muted-foreground mb-1">{t('fin.ewa.earnedToDate')}</div>
              <div className="text-lg font-bold text-foreground">{formatCurrency(limitInfo.earnedGrossToDate)}</div>
              {limitInfo.breakdown && (
                <div className="mt-1 text-[11px] text-muted-foreground space-y-0.5">
                  <div>{t('fin.ewa.breakdownBase', { amount: formatCurrency(limitInfo.breakdown.baseSalary) })}</div>
                  <div>{t('fin.ewa.breakdownPresent', { present: limitInfo.breakdown.presentDays, total: limitInfo.breakdown.workDaysInPeriod })}</div>
                  <div>{t('fin.ewa.breakdownOvertime', { amount: formatCurrency(limitInfo.breakdown.overtimePay) })}</div>
                </div>
              )}
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-900/15 rounded-md p-3 border border-emerald-100">
              <div className="text-muted-foreground mb-1">{t('fin.ewa.maxWithdraw')}</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{formatCurrency(limitInfo.maxAllowed)}</div>
              <div className="mt-2 pt-2 border-t border-emerald-100 space-y-0.5 text-[11px]">
                <div className="text-muted-foreground">{t('fin.ewa.reservedLabel')}</div>
                <div className="font-semibold text-amber-700 dark:text-amber-400">{formatCurrency(limitInfo.totalReserved)}</div>
                <div className="text-muted-foreground mt-1">{t('fin.ewa.remainingLabel')}</div>
                <div className="text-base font-black text-emerald-700 dark:text-emerald-300">{formatCurrency(limitInfo.remaining)}</div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewa.amountLabel')} *</Label>
          <Input
            type="number"
            min={1}
            value={amountRequested}
            onChange={(e) => setAmountRequested(e.target.value)}
            required
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewa.adminFeeLabel')}</Label>
          <Input type="number" min={0} value={adminFee} onChange={(e) => setAdminFee(e.target.value)} />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('fin.ewa.reasonLabel')}</Label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('fin.ewa.reasonPlaceholder')}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={loading || !limitInfo}>
          {loading ? t('fin.common.sending') : (<><Send size={16} className="mr-2" />{t('fin.ewa.submitNow')}</>)}
        </Button>
      </div>
    </form>
  );
}

export function EmployeeEWADashboardPage() {
  const { t } = useI18n();
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
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewa.listLoadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetchRequests(); }, [statusFilter]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  const handleCancel = async (id: string) => {
    if (!confirm(t('fin.ewa.cancelConfirm'))) return;
    setCancellingId(id);
    try {
      await ewaService.cancel(id);
      toast.success(t('fin.ewa.cancelledToast'));
      void fetchRequests();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.ewa.cancelFailed')));
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
          title={t('fin.ewa.title')}
          description={t('fin.ewa.description')}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void fetchRequests()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <ArrowDownToLine size={16} className="mr-2" />
            {t('fin.ewa.apply')}
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
              <div className="text-xs text-muted-foreground">{t('fin.ewa.filterPending')}</div>
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
              <div className="text-xs text-muted-foreground">{t('fin.ewa.approvedNotPaid')}</div>
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
              <div className="text-xs text-muted-foreground">{t('fin.ewa.disbursed')}</div>
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
              <div className="text-xs text-muted-foreground">{t('fin.ewa.filterDeducted')}</div>
              <div className="text-2xl font-semibold mt-0.5">{formatCurrency(summaryCards.deducted)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold">{t('fin.ewa.myHistory')}</h3>
          <Select2
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as EWAStatus | 'ALL')}
            options={STATUS_FILTERS.map((s) => ({ value: s.value, label: t(s.labelKey) }))}
            className="h-9 w-48"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/40 text-xs text-muted-foreground uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-medium">{t('fin.ewa.colCode')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('fin.common.date')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('fin.common.amount')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('fin.ewa.colAdminFee')}</th>
                <th className="px-4 py-3 text-left font-medium">{t('fin.common.reason')}</th>
                <th className="px-4 py-3 text-center font-medium">{t('fin.common.status')}</th>
                <th className="px-4 py-3 text-right font-medium">{t('fin.common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('common.loading')}</td></tr>
              ) : requests.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">{t('fin.ewa.empty')}</td></tr>
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
                      {EWA_STATUS_LABEL_KEYS[r.status] ? t(EWA_STATUS_LABEL_KEYS[r.status]) : r.status}
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
                        {cancellingId === r.id ? t('fin.common.processingShort') : t('fin.ewa.cancelAction')}
                      </Button>
                    ) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('fin.ewa.applyTitle')}>
        <RequestForm onClose={() => setFormOpen(false)} onSubmitted={() => void fetchRequests()} />
      </Modal>
    </div>
  );
}
