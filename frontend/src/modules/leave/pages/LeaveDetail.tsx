import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { leaveService, type LeaveRequest, type WorkflowInstance } from '@/services/leave.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/stores/auth.store';
import {
  ArrowLeft, CalendarDays, UserRound, FileText, CheckCircle2, XCircle,
  Clock, Gauge, AlertTriangle,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';
import { appConfig } from '@/config/app';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'ess.status.pending',
  APPROVED: 'ess.status.approved',
  REJECTED: 'ess.status.rejected',
  CANCELLED: 'ess.status.cancelled',
  WITHDRAWN: 'ess.status.withdrawn',
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
  const { t } = useI18n();
  const currentStep = workflow.steps.find((s) => s.isCurrent);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h3 className="text-sm font-semibold">{t('ess.leave.detail.workflow.title')}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('ess.common.status')}: <span className="font-medium text-foreground">{STATUS_LABEL_KEYS[workflow.status] ? t(STATUS_LABEL_KEYS[workflow.status]) : workflow.status}</span>
          </p>
        </div>
        {canAct && workflow.status === 'PENDING' && currentStep && (
          <div className="flex gap-2">
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onApprove}>
              <CheckCircle2 size={14} className="mr-1.5" /> {t('ess.actions.approve')}
            </Button>
            <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950" onClick={onReject}>
              <XCircle size={14} className="mr-1.5" /> {t('ess.actions.reject')}
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
                    {t('ess.leave.detail.workflow.level', { level: step.level })} &middot; {step.name}
                  </h4>
                  {step.isCurrent && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {t('ess.leave.detail.workflow.current')}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>
                    {t('ess.leave.detail.workflow.approver')}: <span className="font-medium text-foreground">{step.approverRoleCode || (step.approverId ? t('ess.leave.detail.workflow.userFallback') : '-')}</span>
                  </span>
                  {step.actedAt && (
                    <span>{t('ess.leave.detail.workflow.actedAt', { time: formatDateTime(step.actedAt) })}</span>
                  )}
                  {step.actedBy && (
                    <span>{t('ess.leave.detail.workflow.by')}: <span className="font-mono">{step.actedBy.slice(0, 8)}...</span></span>
                  )}
                </div>
                {step.comment && (
                  <div className="mt-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-900/60 border border-border text-xs text-muted-foreground whitespace-pre-wrap">
                    <span className="font-medium text-foreground">{t('ess.leave.detail.workflow.comment')}:</span> {step.comment}
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

export function LeaveDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const auth = useAuthStore();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
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
      const [reqData, wfData] = await Promise.all([
        leaveService.getRequest(id),
        leaveService.getWorkflow(id).catch(() => null),
      ]);
      setRequest(reqData);
      setWorkflow(wfData);
    } catch (error) {
      console.error('Failed to fetch leave request:', error);
      toast.error(apiErrorMessage(error, t('ess.common.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const currentStep = workflow?.steps.find((s) => s.isCurrent);
  const canActOnWorkflow =
    !!workflow &&
    !!currentStep &&
    auth.hasRole('SUPER_ADMIN') ||
    (!!currentStep?.approverRoleCode && auth.hasRole(currentStep.approverRoleCode)) ||
    false;

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading('APPROVE');
    try {
      await leaveService.submitWorkflowAction(id, 'APPROVE', approveComment || undefined);
      toast.success(t('ess.leave.toast.approved'));
      setShowApproveModal(false);
      setApproveComment('');
      await fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.leave.toast.approveFailed')));
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading('REJECT');
    try {
      await leaveService.submitWorkflowAction(id, 'REJECT', rejectReason || undefined);
      toast.success(t('ess.leave.toast.rejected'));
      setShowRejectModal(false);
      setRejectReason('');
      await fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.leave.toast.rejectFailed')));
    } finally {
      setActionLoading('');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!request) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{t('ess.leave.detail.notFound')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/leave')}>{t('ess.leave.detail.backToLeave')}</Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={t('ess.leave.detail.title')}
        description={t('ess.leave.detail.statusLine', { status: STATUS_LABEL_KEYS[request.status] ? t(STATUS_LABEL_KEYS[request.status]) : request.status })}
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/leave')}>
            <ArrowLeft size={16} className="mr-2" /> {t('ess.common.back')}
          </Button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays size={14} /> {t('ess.leave.detail.startDate')}
              </div>
              <p className="text-sm font-medium">{formatDate(request.startDate)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <CalendarDays size={14} /> {t('ess.leave.detail.endDate')}
              </div>
              <p className="text-sm font-medium">{formatDate(request.endDate)}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <Clock size={14} /> {t('ess.leave.detail.totalDays')}
              </div>
              <p className="text-sm font-medium">{t('ess.common.daysCount', { count: request.totalDays })}</p>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <FileText size={14} /> {t('ess.leave.table.leaveType')}
              </div>
              <p className="text-sm font-medium">{request.leaveType?.name || '-'}</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-3">{t('ess.leave.detail.employeeInfo')}</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <UserRound size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{request.employee?.fullName || '-'}</p>
                <p className="text-xs text-muted-foreground font-mono">{request.employee?.employeeNumber}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
            <h3 className="text-sm font-medium mb-2">{t('ess.common.reason')}</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{request.reason}</p>
          </div>

          {request.attachment && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">{t('ess.common.attachment')}</h3>
              <a href={`${appConfig.apiUrl}/private-files/leave-attachments/${request.id}`} target="_blank" rel="noopener noreferrer"
                className="text-sm text-primary hover:underline flex items-center gap-1">
                <FileText size={14} /> {t('ess.leave.detail.viewDocument')}
              </a>
            </div>
          )}

          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="bg-red-50 dark:bg-red-950/30 rounded-xl border border-red-200 dark:border-red-900 p-4">
              <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">{t('ess.leave.rejectModal.reasonLabel')}</h3>
              <p className="text-sm text-red-600 dark:text-red-400">{request.rejectionReason}</p>
            </div>
          )}

          {workflow && (
            <WorkflowTimelineCard
              workflow={workflow}
              onApprove={() => setShowApproveModal(true)}
              onReject={() => setShowRejectModal(true)}
              canAct={canActOnWorkflow}
            />
          )}
        </div>

        <div className="space-y-4">
          {request.status === 'PENDING' && !workflow && (
            <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl border border-amber-200 dark:border-amber-900 p-4">
              <h3 className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                <AlertTriangle size={14} /> {t('ess.leave.detail.workflow.notAvailableTitle')}
              </h3>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {t('ess.leave.detail.workflow.notAvailableBody')}
              </p>
            </div>
          )}

          {request.status === 'PENDING' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">
                {workflow ? t('ess.leave.detail.actions.legacy') : t('ess.leave.detail.actions.title')}
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
                  {actionLoading === 'APPROVE' ? t('ess.leave.approveModal.loading') : t('ess.actions.approve')}
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
                    {actionLoading === 'REJECT' ? t('ess.leave.rejectModal.loading') : t('ess.actions.reject')}
                  </Button>
                ) : (
                  <div className="space-y-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg">
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">{t('ess.leave.detail.rejectPrompt')}</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className="w-full h-20 text-xs p-2 rounded border border-border bg-background resize-none"
                      placeholder={t('ess.leave.rejectModal.reasonPlaceholder')}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || !rejectReason}>
                        {actionLoading === 'REJECT' ? t('ess.leave.rejectModal.loading') : t('ess.leave.rejectModal.confirm')}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowRejectModal(false); setRejectReason(''); }}>
                        {t('common.cancel')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {!workflow && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-3">{t('ess.leave.detail.timeline.title')}</h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText size={12} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium">{t('ess.leave.detail.timeline.submitted')}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(request.createdAt)}</p>
                  </div>
                </div>
                {request.approvedAt && (
                  <div className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center shrink-0 mt-0.5">
                      <CheckCircle2 size={12} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-xs font-medium">{t('ess.status.approved')}</p>
                      <p className="text-xs text-muted-foreground">{formatDateTime(request.approvedAt)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {request.leaveType && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
              <h3 className="text-sm font-medium mb-2">{t('ess.leave.detail.typeDetails.title')}</h3>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ess.common.type')}</span>
                  <span>{request.leaveType.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ess.leave.detail.typeDetails.paid')}</span>
                  <span>{request.leaveType.isPaid ? t('ess.common.yes') : t('ess.common.no')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('ess.leave.detail.typeDetails.code')}</span>
                  <span className="font-mono text-xs">{request.leaveType.code}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowApproveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="p-5">
              <h3 className="text-base font-semibold mb-2 flex items-center gap-2">
                <CheckCircle2 size={18} className="text-emerald-600" /> {t('ess.leave.approveModal.title')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('ess.leave.approveModal.description')}
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.leave.approveModal.commentLabel')}</label>
                <textarea
                  value={approveComment}
                  onChange={(e) => setApproveComment(e.target.value)}
                  placeholder={t('ess.leave.approveModal.commentPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowApproveModal(false)} disabled={actionLoading === 'APPROVE'}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApprove} disabled={actionLoading === 'APPROVE'}>
                {actionLoading === 'APPROVE' ? t('ess.leave.approveModal.loading') : t('ess.leave.approveModal.confirm')}
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
                <XCircle size={18} className="text-red-600" /> {t('ess.leave.rejectModal.title')}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('ess.leave.rejectModal.description')}
              </p>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ess.leave.rejectModal.reasonLabel')}</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('ess.leave.rejectModal.reasonPlaceholder')}
                  rows={3}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setShowRejectModal(false)} disabled={actionLoading === 'REJECT'}>
                {t('common.cancel')}
              </Button>
              <Button size="sm" variant="destructive" onClick={handleReject} disabled={actionLoading === 'REJECT' || !rejectReason}>
                {actionLoading === 'REJECT' ? t('ess.leave.rejectModal.loading') : t('ess.leave.rejectModal.confirm')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
