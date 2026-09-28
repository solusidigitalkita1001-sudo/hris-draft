import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leaveService, type LeaveRequest } from '@/services/leave.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw, Plus, CalendarDays, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useAuthStore } from '@/stores/auth.store';
import { popup } from '@/stores/popup.store';
import { LeaveRequestForm } from '@/modules/leave/components/LeaveRequestForm';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock size={14} className="text-amber-500" />,
  APPROVED: <CheckCircle2 size={14} className="text-emerald-500" />,
  REJECTED: <XCircle size={14} className="text-red-500" />,
  CANCELLED: <AlertCircle size={14} className="text-gray-500" />,
  WITHDRAWN: <AlertCircle size={14} className="text-gray-500" />,
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
  WITHDRAWN: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'ess.status.pending',
  APPROVED: 'ess.status.approved',
  REJECTED: 'ess.status.rejected',
  CANCELLED: 'ess.status.cancelled',
  WITHDRAWN: 'ess.status.withdrawn',
};

export function LeaveList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const { user } = useAuthStore();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showNewRequest, setShowNewRequest] = useState(false);

  const [approvAction, setApprovAction] = useState<{ type: 'APPROVE' | 'REJECT'; id: string } | null>(null);
  const [actionComment, setActionComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setRequests([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const reqData = await leaveService.getRequests(companyId, Object.keys(params).length ? params : undefined);
      setRequests(reqData);
    } catch (error) {
      console.error('Failed to fetch leave requests:', error);
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const executeAction = async () => {
    if (!approvAction) return;
    setActionLoading(true);
    try {
      await leaveService.submitWorkflowAction(
        approvAction.id,
        approvAction.type,
        actionComment.trim() || undefined
      );
      toast.success(
        approvAction.type === 'APPROVE'
          ? t('ess.leave.toast.approved')
          : t('ess.leave.toast.rejected')
      );
      setApprovAction(null);
      setActionComment('');
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, approvAction.type === 'APPROVE' ? t('ess.leave.toast.approveFailed') : t('ess.leave.toast.rejectFailed')));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelOwn = async (id: string) => {
    const confirmed = await popup.confirm({
      title: t('ess.leave.confirmCancel.title'),
      description: t('ess.leave.confirmCancel.description'),
      confirmText: t('ess.common.confirmYesCancel'),
      cancelText: t('ess.common.back'),
      intent: 'destructive',
    });
    if (!confirmed) return;
    try {
      await leaveService.cancelRequest(id);
      toast.success(t('ess.leave.toast.cancelSuccess'));
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.leave.toast.cancelFailed')));
    }
  };

  const filtered = requests.filter(
    (r) => r.employee?.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;
  const approvedCount = requests.filter((r) => r.status === 'APPROVED').length;

  return (
    <div>
      <PageHeader
        title={t('ess.leave.list.title')}
        description={t('ess.leave.list.description')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (!user?.employeeId) {
                  toast.error(t('ess.leave.toast.notLinked'));
                  return;
                }
                setShowNewRequest(true);
              }}
            >
              <Plus size={16} className="mr-2" />
              {t('ess.leave.list.newRequest')}
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <Clock size={14} className="text-amber-500" /> {t('ess.status.pending')}
          </div>
          <p className="text-xl font-semibold">{pendingCount}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" /> {t('ess.status.approved')}
          </div>
          <p className="text-xl font-semibold">{approvedCount}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={t('ess.common.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
        <div className="flex gap-1">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${statusFilter === s ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-muted-foreground border-border hover:border-primary/50'}`}>
              {s ? (STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s) : t('ess.common.all')}
            </button>
          ))}
        </div>
      </div>

      <div className="table-container">
        <table className="w-full">
          <thead className="table-header">
            <tr>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.common.employee')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.leave.table.leaveType')}</th>
              <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.common.period')}</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.leave.table.days')}</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.common.status')}</th>
              <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.leave.table.submitted')}</th>
              <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-4 py-3">{t('ess.common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12">
                <div className="flex flex-col items-center gap-2">
                  <CalendarDays size={32} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">{t('ess.leave.empty')}</p>
                </div>
              </td></tr>
            ) : (
              filtered.map((r) => (
                <tr key={r.id} className="table-row-hover cursor-pointer" onClick={() => navigate(`/leave/${r.id}`)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">{STATUS_ICONS[r.status]}</div>
                      <p className="text-sm font-medium">{r.employee?.fullName || '-'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{r.leaveType?.name || '-'}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(r.startDate)} - {formatDate(r.endDate)}</td>
                  <td className="px-4 py-3 text-center text-sm font-medium">{r.totalDays}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] || ''}`}>{STATUS_LABEL_KEYS[r.status] ? t(STATUS_LABEL_KEYS[r.status]) : r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
                  <td className="px-4 py-3 text-center">
                    {r.status === 'PENDING' && (
                      <div className="flex items-center justify-center gap-1.5">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            setApprovAction({ type: 'APPROVE', id: r.id });
                            setActionComment('');
                          }}
                        >
                          <CheckCircle2 size={12} className="mr-1" />
                          {t('ess.actions.approve')}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2.5 text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950"
                          onClick={(e) => {
                            e.stopPropagation();
                            setApprovAction({ type: 'REJECT', id: r.id });
                            setActionComment('');
                          }}
                        >
                          <XCircle size={12} className="mr-1" />
                          {t('ess.actions.reject')}
                        </Button>
                        {user?.employeeId && r.employeeId === user.employeeId && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2.5 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleCancelOwn(r.id);
                            }}
                          >
                            <AlertCircle size={12} className="mr-1" />
                            {t('ess.actions.cancel')}
                          </Button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showNewRequest && user?.employeeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowNewRequest(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold">{t('ess.leave.form.title')}</h2>
              <button onClick={() => setShowNewRequest(false)} className="text-muted-foreground hover:text-foreground p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5">
              <LeaveRequestForm
                companyId={companyId}
                employeeId={user.employeeId}
                onSuccess={fetchData}
                onClose={() => setShowNewRequest(false)}
              />
            </div>
          </div>
        </div>
      )}

      {approvAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setApprovAction(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-semibold flex items-center gap-2">
                {approvAction.type === 'APPROVE' ? (
                  <><CheckCircle2 size={18} className="text-emerald-600" /> {t('ess.leave.approveModal.title')}</>
                ) : (
                  <><XCircle size={18} className="text-red-600" /> {t('ess.leave.rejectModal.title')}</>
                )}
              </h2>
              <button onClick={() => setApprovAction(null)} className="text-muted-foreground hover:text-foreground p-1">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-muted-foreground">
                {approvAction.type === 'APPROVE'
                  ? t('ess.leave.approveModal.description')
                  : t('ess.leave.rejectModal.description')}
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  {approvAction.type === 'APPROVE' ? t('ess.leave.approveModal.commentLabel') : t('ess.leave.rejectModal.reasonLabel')}
                </label>
                <textarea
                  value={actionComment}
                  onChange={(e) => setActionComment(e.target.value)}
                  placeholder={approvAction.type === 'APPROVE' ? t('ess.leave.approveModal.commentPlaceholder') : t('ess.leave.rejectModal.reasonPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setApprovAction(null)} disabled={actionLoading}>
                {t('common.cancel')}
              </Button>
              {approvAction.type === 'APPROVE' ? (
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={executeAction} disabled={actionLoading}>
                  {actionLoading ? t('ess.leave.approveModal.loading') : t('ess.leave.approveModal.confirm')}
                </Button>
              ) : (
                <Button size="sm" variant="destructive" onClick={executeAction} disabled={actionLoading || !actionComment.trim()}>
                  {actionLoading ? t('ess.leave.rejectModal.loading') : t('ess.leave.rejectModal.confirm')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
