import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { onboardingService, type Resignation } from '@/services/onboarding.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { ArrowLeft, CheckCircle, XCircle, UserRound, Calendar, FileText, Flag } from 'lucide-react';
import { formatDate } from '@/utils/format';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const STATUS_STYLES: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
  COMPLETED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

const CLEARANCE_STYLES: Record<string, string> = {
  PENDING: 'bg-gray-50 text-gray-600 dark:bg-gray-900 dark:text-gray-400',
  CLEARED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
};

const STATUS_LABEL: Record<string, TranslationKey> = {
  SUBMITTED: 'ops.offboarding.status.submitted',
  APPROVED: 'ops.offboarding.status.approved',
  REJECTED: 'ops.offboarding.status.rejected',
  COMPLETED: 'ops.offboarding.status.completed',
};

const CLEARANCE_LABEL: Record<string, TranslationKey> = {
  PENDING: 'ops.offboarding.clearance.pending',
  CLEARED: 'ops.offboarding.clearance.cleared',
  REJECTED: 'ops.offboarding.clearance.rejected',
};

export function OffboardingDetail() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [resignation, setResignation] = useState<Resignation | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await onboardingService.getResignation(id);
      setResignation(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await onboardingService.approveResignation(id);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await onboardingService.rejectResignation(id);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    if (!window.confirm(t('ops.offboarding.detail.confirmComplete'))) return;
    setActionLoading(true);
    try {
      await onboardingService.completeResignation(id);
      await fetchData();
    } catch (e) {
      console.error(e);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateClearance = async (clearanceId: string, status: string) => {
    try {
      await onboardingService.updateClearance(clearanceId, status);
      await fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
      </div>
    );
  }

  if (!resignation) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <FileText size={48} className="text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">{t('ops.offboarding.detail.notFound')}</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/offboarding')}>
          <ArrowLeft size={16} className="mr-2" /> {t('ops.offboarding.detail.back')}
        </Button>
      </div>
    );
  }

  const { employee } = resignation;

  return (
    <div>
      <PageHeader
        title={t('ops.offboarding.detail.title')}
        description={t('ops.offboarding.detail.description', { id: resignation.id.slice(0, 8).toUpperCase() })}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate('/offboarding')}>
              <ArrowLeft size={16} className="mr-2" /> {t('ops.offboarding.detail.back')}
            </Button>
            {resignation.status === 'SUBMITTED' && (
              <>
                <Button size="sm" variant="outline" onClick={handleReject} disabled={actionLoading}>
                  <XCircle size={16} className="mr-2" /> {t('ops.offboarding.detail.reject')}
                </Button>
                <Button size="sm" onClick={handleApprove} disabled={actionLoading}>
                  <CheckCircle size={16} className="mr-2" /> {t('ops.offboarding.detail.approve')}
                </Button>
              </>
            )}
            {resignation.status === 'APPROVED' && (
              <Button size="sm" onClick={handleComplete} disabled={actionLoading}>
                <Flag size={16} className="mr-2" /> {t('ops.offboarding.detail.complete')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Employee Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium">{t('ops.offboarding.fields.employee')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <UserRound size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold">{employee?.fullName || t('ops.offboarding.detail.unknown')}</p>
                <p className="text-xs text-muted-foreground">{employee?.employeeNumber}</p>
              </div>
            </div>
            <div className="pt-2 space-y-1 text-sm">
              <p className="text-muted-foreground">
                {t('ops.offboarding.fields.department')}: <span className="font-medium text-foreground">{employee?.department?.name || '-'}</span>
              </p>
              <p className="text-muted-foreground">
                {t('ops.offboarding.fields.position')}: <span className="font-medium text-foreground">{employee?.position?.name || '-'}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Resignation Info */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium">{t('ops.offboarding.detail.resignationDetails')}</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{t('ops.offboarding.fields.resignDate')}:</span>
              <span className="font-medium">{formatDate(resignation.resignDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Calendar size={14} className="text-muted-foreground" />
              <span className="text-muted-foreground">{t('ops.offboarding.fields.lastWorkingDay')}:</span>
              <span className="font-medium">{formatDate(resignation.lastWorkingDate)}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">{t('ops.offboarding.fields.status')}:</span>{' '}
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[resignation.status] || ''}`}>{STATUS_LABEL[resignation.status] ? t(STATUS_LABEL[resignation.status]) : resignation.status}</span>
            </div>
            {resignation.reason && (
              <div className="text-sm">
                <span className="text-muted-foreground">{t('ops.offboarding.fields.reason')}:</span>
                <p className="mt-1 p-3 bg-muted/50 rounded-lg text-sm">{resignation.reason}</p>
              </div>
            )}
          </div>
        </div>

        {/* Clearance Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <h3 className="text-sm font-medium">{t('ops.offboarding.detail.clearanceProgress')}</h3>
          </div>
          {resignation.clearances && resignation.clearances.length > 0 ? (
            <div className="space-y-2">
              {resignation.clearances.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-xs font-medium">{c.department}</p>
                    <p className="text-xs text-muted-foreground">{c.checklistItem}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CLEARANCE_STYLES[c.status] || ''}`}>{CLEARANCE_LABEL[c.status] ? t(CLEARANCE_LABEL[c.status]) : c.status}</span>
                    {c.status === 'PENDING' && resignation.status === 'APPROVED' && (
                      <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => handleUpdateClearance(c.id, 'CLEARED')}>
                        {t('ops.offboarding.detail.clear')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-between pt-2 text-xs text-muted-foreground border-t">
                <span>{t('ops.offboarding.detail.progress')}:</span>
                <span className="font-medium">
                  {resignation.clearances.filter((c) => c.status === 'CLEARED').length}/{resignation.clearances.length}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t('ops.offboarding.detail.noClearances')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
