import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceAutomationSchedule,
  type PerformanceCalibrationSession,
  type PerformanceResultDashboard,
  type PerformanceResult,
} from '@/services/performance.service';
import { trainingService, type TrainingCourse } from '@/services/training.service';
import { documentManagementService } from '@/services/document-management.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { AlertCircle, BellRing, Calculator, CheckCircle2, Gauge, RefreshCw, RotateCcw, Send, Trophy } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

const RESULT_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  CALCULATED: 'perf.resultStatus.calculated',
  CALIBRATION_IN_PROGRESS: 'perf.resultStatus.calibrationInProgress',
  CALIBRATED: 'perf.resultStatus.calibrated',
  FINALIZED: 'perf.resultStatus.finalized',
  PUBLISHED: 'perf.resultStatus.published',
};

const SESSION_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  DRAFT: 'perf.sessionStatus.draft',
  OPEN: 'perf.sessionStatus.open',
  CLOSED: 'perf.sessionStatus.closed',
  FINALIZED: 'perf.sessionStatus.finalized',
};

const DISPUTE_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  OPEN: 'perf.disputeStatus.open',
  RESPONDED: 'perf.disputeStatus.responded',
  RESOLVED: 'perf.disputeStatus.resolved',
  REJECTED: 'perf.disputeStatus.rejected',
  CLOSED: 'perf.disputeStatus.closed',
};

const DEV_REC_STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'perf.devRecStatus.pending',
  ASSIGNED: 'perf.devRecStatus.assigned',
  ENROLLED: 'perf.devRecStatus.enrolled',
  COMPLETED: 'perf.devRecStatus.completed',
  DISMISSED: 'perf.devRecStatus.dismissed',
};

const DEV_REC_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  TRAINING: 'perf.devRecType.training',
  DEVELOPMENT_PLAN: 'perf.devRecType.developmentPlan',
  SUCCESSION: 'perf.devRecType.succession',
  COMPENSATION: 'perf.devRecType.compensation',
};

const REMINDER_TARGET_LABEL_KEYS: Record<string, TranslationKey> = {
  ALL: 'perf.reminderTarget.all',
  UNACKNOWLEDGED_RESULTS: 'perf.reminderTarget.unacknowledgedResults',
  OPEN_DISPUTES: 'perf.reminderTarget.openDisputes',
};

const VISIBILITY_LABEL_KEYS: Record<string, TranslationKey> = {
  INTERNAL: 'perf.visibility.internal',
  RESTRICTED: 'perf.visibility.restricted',
  PUBLIC: 'perf.visibility.public',
};

const RESULT_STATUS_STYLES: Record<string, string> = {
  CALCULATED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  CALIBRATION_IN_PROGRESS: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  CALIBRATED: 'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
  FINALIZED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  PUBLISHED: 'bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-400',
};

const SESSION_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  OPEN: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  CLOSED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  FINALIZED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
};

const DISPUTE_STATUS_STYLES: Record<string, string> = {
  OPEN: 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400',
  RESPONDED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  RESOLVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REJECTED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
  CLOSED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
};

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toNumber(value?: string | number | null) {
  if (value === null || value === undefined || value === '') return 0;
  return Number(value);
}

export function PerformanceResultsPage() {
  const { t } = useI18n();
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [periods, setPeriods] = useState<Array<{ id: string; name: string; code: string; planningPublishedAt?: string | null }>>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [results, setResults] = useState<PerformanceResult[]>([]);
  const [sessions, setSessions] = useState<PerformanceCalibrationSession[]>([]);
  const [dashboard, setDashboard] = useState<PerformanceResultDashboard | null>(null);
  const [schedules, setSchedules] = useState<PerformanceAutomationSchedule[]>([]);
  const [courses, setCourses] = useState<TrainingCourse[]>([]);
  const [selectedResultId, setSelectedResultId] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedParticipantId, setSelectedParticipantId] = useState('');
  const [selectedDisputeId, setSelectedDisputeId] = useState('');
  const [selectedRecommendationId, setSelectedRecommendationId] = useState('');
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [approving, setApproving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [syncingRecommendations, setSyncingRecommendations] = useState(false);
  const [assigningRecommendation, setAssigningRecommendation] = useState(false);
  const [uploadingResultAttachment, setUploadingResultAttachment] = useState(false);
  const [uploadingDisputeAttachment, setUploadingDisputeAttachment] = useState(false);
  const [creatingSchedule, setCreatingSchedule] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [actingSession, setActingSession] = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [respondingDispute, setRespondingDispute] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [publishForm, setPublishForm] = useState({
    showCalculation: true,
    showRecommendations: true,
    showCalibrationHistory: false,
    disputeWindowDays: '14',
    notes: '',
  });
  const [sessionForm, setSessionForm] = useState({
    name: '',
    code: '',
    forcedDistribution: '',
    notes: '',
  });
  const [decisionForm, setDecisionForm] = useState({
    finalScore: '',
    reason: '',
  });
  const [disputeResponseForm, setDisputeResponseForm] = useState({
    response: '',
    status: 'RESPONDED' as 'RESPONDED' | 'RESOLVED' | 'REJECTED' | 'CLOSED',
  });
  const [approvalNotes, setApprovalNotes] = useState('');
  const [reopenReason, setReopenReason] = useState('');
  const [reminderTarget, setReminderTarget] = useState<'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL'>('ALL');
  const [reminderNotes, setReminderNotes] = useState('');
  const [recommendationCourseId, setRecommendationCourseId] = useState('');
  const [recommendationNotes, setRecommendationNotes] = useState('');
  const [resultAttachmentFile, setResultAttachmentFile] = useState<File | null>(null);
  const [disputeAttachmentFile, setDisputeAttachmentFile] = useState<File | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    name: '',
    reminderTarget: 'ALL' as 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL',
    cadenceHours: '24',
    notes: '',
  });

  const periodOptions = useMemo(
    () => periods.map((period) => ({ value: period.id, label: `${period.name} • ${period.code}` })),
    [periods]
  );

  const reminderTargetOptions = useMemo(
    () => (['ALL', 'UNACKNOWLEDGED_RESULTS', 'OPEN_DISPUTES'] as const).map((value) => ({
      value,
      label: t(REMINDER_TARGET_LABEL_KEYS[value]),
    })),
    [t]
  );

  const disputeStatusOptions = useMemo(
    () => (['RESPONDED', 'RESOLVED', 'REJECTED', 'CLOSED'] as const).map((value) => ({
      value,
      label: t(DISPUTE_STATUS_LABEL_KEYS[value]),
    })),
    [t]
  );

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedResultId) ?? null,
    [results, selectedResultId]
  );

  const selectedSession = useMemo(
    () => sessions.find((session) => session.id === selectedSessionId) ?? null,
    [sessions, selectedSessionId]
  );

  const selectedParticipant = useMemo(
    () => selectedSession?.participants.find((participant) => participant.id === selectedParticipantId) ?? null,
    [selectedParticipantId, selectedSession]
  );

  const selectedDispute = useMemo(
    () => selectedResult?.disputes?.find((dispute) => dispute.id === selectedDisputeId) ?? null,
    [selectedDisputeId, selectedResult]
  );

  const selectedRecommendation = useMemo(
    () => selectedResult?.developmentRecommendations?.find((recommendation) => recommendation.id === selectedRecommendationId) ?? null,
    [selectedRecommendationId, selectedResult]
  );

  const loadWorkspace = useCallback(async (periodId: string) => {
    if (!periodId) {
      setResults([]);
      setSessions([]);
      setDashboard(null);
      setSchedules([]);
      setSelectedResultId('');
      setSelectedSessionId('');
      setSelectedParticipantId('');
      setSelectedDisputeId('');
      setSelectedRecommendationId('');
      return;
    }

    setWorkspaceLoading(true);
    try {
      const [resultData, sessionData, dashboardData, scheduleData] = await Promise.all([
        performanceService.getPerformanceResults(periodId),
        performanceService.getCalibrationSessions(periodId),
        performanceService.getPerformanceResultDashboard(periodId),
        performanceService.getAutomationSchedules(periodId),
      ]);
      setResults(resultData);
      setSessions(sessionData);
      setDashboard(dashboardData);
      setSchedules(scheduleData);

      const nextResultId = selectedResultId && resultData.some((result) => result.id === selectedResultId)
        ? selectedResultId
        : resultData[0]?.id || '';
      const nextSessionId = selectedSessionId && sessionData.some((session) => session.id === selectedSessionId)
        ? selectedSessionId
        : sessionData[0]?.id || '';
      setSelectedResultId(nextResultId);
      setSelectedSessionId(nextSessionId);

      const nextParticipant = sessionData.find((session) => session.id === nextSessionId)?.participants[0]?.id || '';
      setSelectedParticipantId(nextParticipant);
      const nextDisputeId = resultData.find((result) => result.id === nextResultId)?.disputes?.[0]?.id || '';
      setSelectedDisputeId(nextDisputeId);
      const nextRecommendationId = resultData.find((result) => result.id === nextResultId)?.developmentRecommendations?.[0]?.id || '';
      setSelectedRecommendationId(nextRecommendationId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.loadWorkspaceFailed')));
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedResultId, selectedSessionId, t]);

  const loadBootstrap = useCallback(async () => {
    if (!companyId) {
      setPeriods([]);
      setSelectedPeriodId('');
      setResults([]);
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [periodData, courseData] = await Promise.all([
        performanceService.getPeriods(companyId, { status: 'PUBLISHED' }),
        trainingService.getCourses(companyId),
      ]);
      const readyPeriods = periodData.filter((period) => period.planningPublishedAt);
      setCourses(courseData);
      setPeriods(readyPeriods.map((period) => ({
        id: period.id,
        name: period.name,
        code: period.code,
        planningPublishedAt: period.planningPublishedAt,
      })));

      const nextPeriodId =
        selectedPeriodId && readyPeriods.some((period) => period.id === selectedPeriodId)
          ? selectedPeriodId
          : readyPeriods[0]?.id || '';
      setSelectedPeriodId(nextPeriodId);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedPeriodId, t]);

  useEffect(() => {
    void loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    void loadWorkspace(selectedPeriodId);
  }, [loadWorkspace, selectedPeriodId]);

  useEffect(() => {
    if (!selectedSession) {
      setSelectedParticipantId('');
      return;
    }

    const nextParticipantId =
      selectedSession.participants.find((participant) => participant.id === selectedParticipantId)?.id
      || selectedSession.participants[0]?.id
      || '';
    setSelectedParticipantId(nextParticipantId);
  }, [selectedParticipantId, selectedSession]);

  useEffect(() => {
    if (!selectedParticipant) {
      setDecisionForm({ finalScore: '', reason: '' });
      return;
    }

    setDecisionForm({
      finalScore: selectedParticipant.afterScore ? String(selectedParticipant.afterScore) : String(selectedParticipant.result?.finalScore ?? ''),
      reason: selectedParticipant.reason || '',
    });
  }, [selectedParticipant]);

  useEffect(() => {
    if (!selectedResult) {
      setSelectedDisputeId('');
      setSelectedRecommendationId('');
      setDisputeResponseForm({ response: '', status: 'RESPONDED' });
      setRecommendationCourseId('');
      setRecommendationNotes('');
      return;
    }

    const nextDisputeId =
      selectedResult.disputes?.find((dispute) => dispute.id === selectedDisputeId)?.id
      || selectedResult.disputes?.[0]?.id
      || '';
    setSelectedDisputeId(nextDisputeId);

    const nextRecommendationId =
      selectedResult.developmentRecommendations?.find((recommendation) => recommendation.id === selectedRecommendationId)?.id
      || selectedResult.developmentRecommendations?.[0]?.id
      || '';
    setSelectedRecommendationId(nextRecommendationId);
  }, [selectedDisputeId, selectedResult]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  useEffect(() => {
    if (!selectedDispute) {
      setDisputeResponseForm({ response: '', status: 'RESPONDED' });
      return;
    }

    setDisputeResponseForm({
      response: selectedDispute.responseMessage || '',
      status: selectedDispute.status === 'OPEN' ? 'RESPONDED' : selectedDispute.status,
    });
  }, [selectedDispute]);

  useEffect(() => {
    if (!selectedRecommendation) {
      setRecommendationCourseId('');
      setRecommendationNotes('');
      return;
    }

    setRecommendationCourseId(selectedRecommendation.courseId || '');
    setRecommendationNotes(selectedRecommendation.notes || '');
  }, [selectedRecommendation]);

  const refreshWorkspace = useCallback(async () => {
    await loadWorkspace(selectedPeriodId);
  }, [loadWorkspace, selectedPeriodId]);

  const handleCalculate = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    setCalculating(true);
    try {
      const data = await performanceService.calculatePerformanceResults(selectedPeriodId);
      setResults(data);
      setSelectedResultId(data[0]?.id || '');
      toast.success(t('perf.results.calculateSuccess'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.calculateFailed')));
    } finally {
      setCalculating(false);
    }
  }, [refreshWorkspace, selectedPeriodId, t]);

  const handleCreateSession = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }
    if (!sessionForm.name.trim()) {
      toast.error(t('perf.results.sessionNameRequired'));
      return;
    }

    setCreatingSession(true);
    try {
      const rawForcedDistribution = sessionForm.forcedDistribution.trim();
      let forcedDistribution: Record<string, unknown> | undefined = undefined;
      if (rawForcedDistribution) {
        try {
          forcedDistribution = JSON.parse(rawForcedDistribution);
        } catch {
          toast.error(t('perf.results.forcedDistributionInvalid'));
          setCreatingSession(false);
          return;
        }
      }

      const created = await performanceService.createCalibrationSession(selectedPeriodId, {
        name: sessionForm.name.trim(),
        forcedDistribution,
        notes: sessionForm.notes.trim() || undefined,
      });
      setSessionForm({ name: '', code: '', forcedDistribution: '', notes: '' });
      setSelectedSessionId(created.id);
      toast.success(t('perf.results.sessionCreated'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.sessionCreateFailed')));
    } finally {
      setCreatingSession(false);
    }
  }, [refreshWorkspace, selectedPeriodId, sessionForm, t]);

  const handlePublishResults = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    setPublishing(true);
    try {
      const data = await performanceService.publishPerformanceResults(selectedPeriodId, {
        visibilityPolicy: {
          showCalculation: publishForm.showCalculation,
          showRecommendations: publishForm.showRecommendations,
          showCalibrationHistory: publishForm.showCalibrationHistory,
        },
        disputeWindowDays: Number(publishForm.disputeWindowDays || 14),
        notes: publishForm.notes.trim() || undefined,
      });
      setResults(data);
      setSelectedResultId(data[0]?.id || '');
      toast.success(t('perf.results.publishSuccess'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.publishFailed')));
    } finally {
      setPublishing(false);
    }
  }, [publishForm, refreshWorkspace, selectedPeriodId, t]);

  const handleApproveResults = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    setApproving(true);
    try {
      const data = await performanceService.approvePerformanceResults(selectedPeriodId, {
        notes: approvalNotes.trim() || undefined,
      });
      setResults(data);
      setSelectedResultId(data[0]?.id || '');
      toast.success(t('perf.results.approveSuccess'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.approveFailed')));
    } finally {
      setApproving(false);
    }
  }, [approvalNotes, refreshWorkspace, selectedPeriodId, t]);

  const handleSessionAction = useCallback(async (action: 'open' | 'close' | 'finalize') => {
    if (!selectedSession) {
      toast.error(t('perf.results.selectSessionFirst'));
      return;
    }

    setActingSession(true);
    try {
      if (action === 'open') await performanceService.openCalibrationSession(selectedSession.id);
      if (action === 'close') await performanceService.closeCalibrationSession(selectedSession.id);
      if (action === 'finalize') await performanceService.finalizeCalibrationSession(selectedSession.id);
      toast.success(
        action === 'open'
          ? t('perf.results.sessionOpened')
          : action === 'close'
            ? t('perf.results.sessionClosed')
            : t('perf.results.sessionFinalized')
      );
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.sessionActionFailed')));
    } finally {
      setActingSession(false);
    }
  }, [refreshWorkspace, selectedSession, t]);

  const handleApplyDecision = useCallback(async () => {
    if (!selectedParticipant) {
      toast.error(t('perf.results.selectParticipantFirst'));
      return;
    }

    if (!decisionForm.finalScore.trim() || !decisionForm.reason.trim()) {
      toast.error(t('perf.results.decisionValidation'));
      return;
    }

    setSavingDecision(true);
    try {
      await performanceService.applyCalibrationDecision(selectedParticipant.id, {
        finalScore: Number(decisionForm.finalScore),
        reason: decisionForm.reason.trim(),
      });
      toast.success(t('perf.results.decisionSaved'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.decisionSaveFailed')));
    } finally {
      setSavingDecision(false);
    }
  }, [decisionForm, refreshWorkspace, selectedParticipant, t]);

  const handleRespondDispute = useCallback(async () => {
    if (!selectedDispute) {
      toast.error(t('perf.results.selectDisputeFirst'));
      return;
    }

    if (!disputeResponseForm.response.trim()) {
      toast.error(t('perf.results.responseRequired'));
      return;
    }

    setRespondingDispute(true);
    try {
      await performanceService.respondPerformanceResultDispute(selectedDispute.id, {
        response: disputeResponseForm.response.trim(),
        status: disputeResponseForm.status,
      });
      toast.success(t('perf.results.responseSaved'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.responseSaveFailed')));
    } finally {
      setRespondingDispute(false);
    }
  }, [disputeResponseForm, refreshWorkspace, selectedDispute, t]);

  const handleReopenResult = useCallback(async () => {
    if (!selectedResult) {
      toast.error(t('perf.results.selectResultFirst'));
      return;
    }

    if (!reopenReason.trim()) {
      toast.error(t('perf.results.reopenReasonRequired'));
      return;
    }

    setReopening(true);
    try {
      await performanceService.reopenPerformanceResult(selectedResult.id, {
        reason: reopenReason.trim(),
      });
      toast.success(t('perf.results.reopenSuccess'));
      setReopenReason('');
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.reopenFailed')));
    } finally {
      setReopening(false);
    }
  }, [refreshWorkspace, reopenReason, selectedResult, t]);

  const handleSendReminders = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    setSendingReminders(true);
    try {
      const summary = await performanceService.sendPerformanceResultReminders(selectedPeriodId, {
        target: reminderTarget,
        notes: reminderNotes.trim() || undefined,
      });
      toast.success(t('perf.results.remindersSent', { count: summary.notificationCount }));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.remindersFailed')));
    } finally {
      setSendingReminders(false);
    }
  }, [refreshWorkspace, reminderNotes, reminderTarget, selectedPeriodId, t]);

  const handleSyncRecommendations = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    setSyncingRecommendations(true);
    try {
      await performanceService.syncDevelopmentRecommendations(selectedPeriodId, {
        strategy: 'UPSERT_MISSING',
      });
      toast.success(t('perf.results.recommendationsSynced'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.recommendationsSyncFailed')));
    } finally {
      setSyncingRecommendations(false);
    }
  }, [refreshWorkspace, selectedPeriodId, t]);

  const handleAssignRecommendation = useCallback(async () => {
    if (!selectedRecommendation) {
      toast.error(t('perf.results.selectRecommendationFirst'));
      return;
    }

    if (!recommendationCourseId) {
      toast.error(t('perf.results.selectCourse'));
      return;
    }

    setAssigningRecommendation(true);
    try {
      await performanceService.assignDevelopmentRecommendation(selectedRecommendation.id, {
        courseId: recommendationCourseId,
        notes: recommendationNotes.trim() || undefined,
      });
      toast.success(t('perf.results.recommendationAssigned'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.recommendationAssignFailed')));
    } finally {
      setAssigningRecommendation(false);
    }
  }, [recommendationCourseId, recommendationNotes, refreshWorkspace, selectedRecommendation, t]);

  const handleUploadResultAttachment = useCallback(async () => {
    if (!selectedResult) {
      toast.error(t('perf.results.selectResultFirst'));
      return;
    }
    if (!resultAttachmentFile) {
      toast.error(t('perf.results.selectAttachmentFile'));
      return;
    }

    setUploadingResultAttachment(true);
    try {
      await performanceService.uploadPerformanceResultAttachment(selectedResult.id, {
        file: resultAttachmentFile,
        title: resultAttachmentFile.name,
        visibility: 'RESTRICTED',
      });
      setResultAttachmentFile(null);
      toast.success(t('perf.results.resultAttachmentUploaded'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.resultAttachmentFailed')));
    } finally {
      setUploadingResultAttachment(false);
    }
  }, [refreshWorkspace, resultAttachmentFile, selectedResult, t]);

  const handleUploadDisputeAttachment = useCallback(async () => {
    if (!selectedDispute) {
      toast.error(t('perf.results.selectDisputeFirst'));
      return;
    }
    if (!disputeAttachmentFile) {
      toast.error(t('perf.results.selectAttachmentFile'));
      return;
    }

    setUploadingDisputeAttachment(true);
    try {
      await performanceService.uploadPerformanceDisputeAttachment(selectedDispute.id, {
        file: disputeAttachmentFile,
        title: disputeAttachmentFile.name,
        visibility: 'RESTRICTED',
      });
      setDisputeAttachmentFile(null);
      toast.success(t('perf.results.disputeAttachmentUploaded'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.disputeAttachmentFailed')));
    } finally {
      setUploadingDisputeAttachment(false);
    }
  }, [disputeAttachmentFile, refreshWorkspace, selectedDispute, t]);

  const handleCreateSchedule = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error(t('perf.results.selectPeriodFirst'));
      return;
    }

    if (!scheduleForm.name.trim()) {
      toast.error(t('perf.results.scheduleNameRequired'));
      return;
    }

    setCreatingSchedule(true);
    try {
      await performanceService.createAutomationSchedule(selectedPeriodId, {
        name: scheduleForm.name.trim(),
        reminderTarget: scheduleForm.reminderTarget,
        cadenceHours: Number(scheduleForm.cadenceHours),
        notes: scheduleForm.notes.trim() || undefined,
      });
      setScheduleForm({
        name: '',
        reminderTarget: 'ALL',
        cadenceHours: '24',
        notes: '',
      });
      toast.success(t('perf.results.scheduleCreated'));
      await refreshWorkspace();
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.scheduleCreateFailed')));
    } finally {
      setCreatingSchedule(false);
    }
  }, [refreshWorkspace, scheduleForm, selectedPeriodId, t]);

  const handleDownloadAttachment = useCallback(async (documentId: string, fileName: string) => {
    try {
      await documentManagementService.download(documentId, fileName);
    } catch (error) {
      console.error(error);
      toast.error(apiErrorMessage(error, t('perf.results.downloadFailed')));
    }
  }, [t]);

  const avgScore = String(dashboard?.widgets.averageScore ?? (results.length
    ? Number((results.reduce((sum, result) => sum + toNumber(result.finalScore), 0) / results.length).toFixed(2))
    : 0));

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  return (
    <div>
      <PageHeader
        title={t('perf.results.title')}
        description={t('perf.results.description')}
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap()}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => void handleCalculate()} disabled={calculating || !selectedPeriodId}>
              <Calculator size={16} className="mr-2" />
              {calculating ? t('perf.results.calculating') : t('perf.results.calculateResults')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handlePublishResults()} disabled={publishing || !results.length}>
              <Send size={16} className="mr-2" />
              {publishing ? t('perf.results.publishing') : t('perf.results.publishResults')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleApproveResults()} disabled={approving || !results.length}>
              <CheckCircle2 size={16} className="mr-2" />
              {approving ? t('perf.results.approving') : t('perf.results.finalApprove')}
            </Button>
          </div>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('perf.results.periodLabel')}</label>
            <Select2
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              options={periodOptions}
              placeholder={t('perf.results.periodPlaceholder')}
            />
          </div>
          <StatCard label={t('perf.results.stats.results')} value={dashboard?.widgets.resultCount ?? results.length} icon={<Trophy size={16} />} />
          <StatCard label={t('perf.results.stats.avgFinalScore')} value={avgScore} icon={<Gauge size={16} />} />
          <StatCard label={t('perf.results.stats.publishedResults')} value={dashboard?.widgets.publishedResultCount ?? results.filter((result) => result.status === 'PUBLISHED').length} icon={<CheckCircle2 size={16} />} />
          <StatCard label={t('perf.results.stats.openDisputes')} value={dashboard?.widgets.openDisputeCount ?? 0} icon={<AlertCircle size={16} />} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.results.calculatedResults')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.results.calculatedResultsHint')}</p>
              </div>
              <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: results.length })}</span>
            </div>
            <div className="space-y-3">
              {workspaceLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.results.loadingWorkspace')}
                </div>
              ) : !results.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.results.emptyResults')}
                </div>
              ) : (
                results.map((result) => (
                  <button
                    key={result.id}
                    type="button"
                    onClick={() => setSelectedResultId(result.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      result.id === selectedResultId
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{result.employee?.fullName || t('perf.results.noEmployee')}</p>
                        <p className="text-xs text-muted-foreground">{result.employee?.employeeNumber || '-'}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${RESULT_STATUS_STYLES[result.status] || RESULT_STATUS_STYLES.CALCULATED}`}>
                        {RESULT_STATUS_LABEL_KEYS[result.status] ? t(RESULT_STATUS_LABEL_KEYS[result.status]) : result.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>{t('perf.results.finalScoreLabel', { value: result.finalScore ?? '-' })}</p>
                      <p>{t('perf.results.gradeLabel', { value: result.gradeLabel || '-' })}</p>
                      <p>{t('perf.results.calculatedLabel', { value: formatDateTime(result.calculatedAt) })}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.approvalReminderTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.approvalReminderHint')}</p>
            </div>
            <div className="space-y-3">
              <Input
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                placeholder={t('perf.results.approvalNotesPlaceholder')}
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleApproveResults()} disabled={approving || !results.length}>
                <CheckCircle2 size={16} className="mr-2" />
                {approving ? t('perf.results.approving') : t('perf.results.finalApproveResults')}
              </Button>
              <Select2
                value={reminderTarget}
                onValueChange={(value) => setReminderTarget(value as 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL')}
                options={reminderTargetOptions}
                placeholder={t('perf.results.reminderTargetPlaceholder')}
              />
              <textarea
                value={reminderNotes}
                onChange={(event) => setReminderNotes(event.target.value)}
                placeholder={t('perf.results.reminderNotesPlaceholder')}
                className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleSendReminders()} disabled={sendingReminders || !results.length}>
                <BellRing size={16} className="mr-2" />
                {sendingReminders ? t('perf.common.sending') : t('perf.results.sendReminders')}
              </Button>
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleSyncRecommendations()} disabled={syncingRecommendations || !results.length}>
                <RefreshCw size={16} className="mr-2" />
                {syncingRecommendations ? t('perf.results.syncing') : t('perf.results.syncRecommendations')}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.automationTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.automationHint')}</p>
            </div>
            <div className="space-y-3">
              <Input
                value={scheduleForm.name}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('perf.results.scheduleNamePlaceholder')}
              />
              <Select2
                value={scheduleForm.reminderTarget}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, reminderTarget: value as 'UNACKNOWLEDGED_RESULTS' | 'OPEN_DISPUTES' | 'ALL' }))}
                options={reminderTargetOptions}
                placeholder={t('perf.results.automationTargetPlaceholder')}
              />
              <Input
                type="number"
                min={1}
                max={168}
                value={scheduleForm.cadenceHours}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, cadenceHours: event.target.value }))}
                placeholder={t('perf.results.cadencePlaceholder')}
              />
              <textarea
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t('perf.results.automationNotesPlaceholder')}
                className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleCreateSchedule()} disabled={creatingSchedule || !selectedPeriodId}>
                <BellRing size={16} className="mr-2" />
                {creatingSchedule ? t('perf.results.creating') : t('perf.results.createSchedule')}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {!schedules.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  {t('perf.results.emptySchedules')}
                </div>
              ) : schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-lg border border-border px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('perf.results.scheduleCadence', {
                          target: REMINDER_TARGET_LABEL_KEYS[schedule.reminderTarget]
                            ? t(REMINDER_TARGET_LABEL_KEYS[schedule.reminderTarget])
                            : schedule.reminderTarget,
                          hours: schedule.cadenceHours,
                        })}
                      </p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${schedule.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400'}`}>
                      {schedule.isActive ? t('perf.common.activeUpper') : t('perf.common.inactiveUpper')}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t('perf.results.scheduleRuns', { last: formatDateTime(schedule.lastRunAt), next: formatDateTime(schedule.nextRunAt) })}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.publishPolicyTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.publishPolicyHint')}</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showCalculation}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showCalculation: event.target.checked }))}
                />
                {t('perf.results.showCalculation')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showRecommendations}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showRecommendations: event.target.checked }))}
                />
                {t('perf.results.showRecommendations')}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showCalibrationHistory}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showCalibrationHistory: event.target.checked }))}
                />
                {t('perf.results.showCalibrationHistory')}
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={publishForm.disputeWindowDays}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, disputeWindowDays: event.target.value }))}
                placeholder={t('perf.results.disputeWindowPlaceholder')}
              />
              <textarea
                value={publishForm.notes}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t('perf.results.publishNotesPlaceholder')}
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.sessionBuilderTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.sessionBuilderHint')}</p>
            </div>
            <div className="space-y-3">
              <Input
                value={sessionForm.name}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder={t('perf.results.sessionNamePlaceholder')}
              />
              <Input
                value=""
                placeholder={t('perf.results.autoCodePlaceholder')}
                disabled
              />
              <p className="text-xs text-muted-foreground">{t('perf.results.sessionCodeHint')}</p>
              <textarea
                value={sessionForm.forcedDistribution}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, forcedDistribution: event.target.value }))}
                placeholder={`${t('perf.results.forcedDistributionPlaceholder')}\n{"mode":"COUNT","buckets":{"A":3,"B":5,"C":2},"tolerance":0}`}
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={sessionForm.notes}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder={t('perf.results.sessionNotesPlaceholder')}
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" onClick={() => void handleCreateSession()} disabled={creatingSession || !results.length}>
                {creatingSession ? t('perf.results.creating') : t('perf.results.createSession')}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.detailTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.detailHint')}</p>
            </div>
            {!selectedResult ? (
              <p className="text-sm text-muted-foreground">{t('perf.results.selectResultLeft')}</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedResult.employee?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('perf.results.scoreGradeInline', { score: selectedResult.finalScore ?? '-', grade: selectedResult.gradeLabel || '-' })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('perf.results.publishedDisputeInline', { published: formatDateTime(selectedResult.publishedAt), deadline: formatDateTime(selectedResult.disputeDeadline) })}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t('perf.results.approvedReminderInline', { approved: formatDateTime(selectedResult.finalApprovedAt), count: selectedResult.reminderCount ?? 0 })}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <MiniStat label={t('perf.results.rawScore')} value={selectedResult.rawScore ?? '-'} />
                  <MiniStat label={t('perf.results.normalized')} value={selectedResult.normalizedScore ?? '-'} />
                  <MiniStat label={t('perf.results.weighted')} value={selectedResult.weightedScore ?? '-'} />
                  <MiniStat label={t('perf.results.calculationVersion')} value={selectedResult.calculationVersion} />
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">{t('perf.results.recommendation')}</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedResult.recommendationSummary || t('perf.results.emptyRecommendation')}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{t('perf.results.devRecTitle')}</p>
                      <p className="text-xs text-muted-foreground">{t('perf.results.devRecHint')}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: selectedResult.developmentRecommendations?.length || 0 })}</span>
                  </div>
                  {!selectedResult.developmentRecommendations?.length ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                      {t('perf.results.emptyDevRec')}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {selectedResult.developmentRecommendations.map((recommendation) => (
                        <button
                          key={recommendation.id}
                          type="button"
                          onClick={() => setSelectedRecommendationId(recommendation.id)}
                          className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                            recommendation.id === selectedRecommendationId
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-card hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium">{recommendation.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {recommendation.sourceRuleLabel
                                  || (DEV_REC_TYPE_LABEL_KEYS[recommendation.type] ? t(DEV_REC_TYPE_LABEL_KEYS[recommendation.type]) : recommendation.type)}
                              </p>
                            </div>
                            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                              {DEV_REC_STATUS_LABEL_KEYS[recommendation.status] ? t(DEV_REC_STATUS_LABEL_KEYS[recommendation.status]) : recommendation.status}
                            </span>
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">{recommendation.description || recommendation.notes || '-'}</p>
                        </button>
                      ))}

                      {selectedRecommendation && (
                        <div className="rounded-lg border border-border p-3">
                          <Select2
                            value={recommendationCourseId}
                            onValueChange={setRecommendationCourseId}
                            options={courses.map((course) => ({
                              value: course.id,
                              label: `${course.title} • ${course.code}`,
                            }))}
                            placeholder={t('perf.results.coursePlaceholder')}
                          />
                          <textarea
                            value={recommendationNotes}
                            onChange={(event) => setRecommendationNotes(event.target.value)}
                            placeholder={t('perf.results.assignmentNotesPlaceholder')}
                            className="mt-3 min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <Button size="sm" className="mt-3 w-full" onClick={() => void handleAssignRecommendation()} disabled={assigningRecommendation}>
                            <Send size={16} className="mr-2" />
                            {assigningRecommendation ? t('perf.results.assigning') : t('perf.results.assignToTraining')}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">{t('perf.results.attachmentsTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('perf.results.attachmentsHint')}</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      className="block w-full text-sm"
                      onChange={(event) => setResultAttachmentFile(event.target.files?.[0] || null)}
                    />
                    <Button size="sm" variant="outline" onClick={() => void handleUploadResultAttachment()} disabled={uploadingResultAttachment || !selectedResult}>
                      {uploadingResultAttachment ? t('perf.common.uploading') : t('perf.common.upload')}
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {!selectedResult.attachments?.length ? (
                      <p className="text-xs text-muted-foreground">{t('perf.results.emptyAttachments')}</p>
                    ) : selectedResult.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{attachment.document.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {attachment.document.fileName} • {VISIBILITY_LABEL_KEYS[attachment.document.visibility] ? t(VISIBILITY_LABEL_KEYS[attachment.document.visibility]) : attachment.document.visibility}
                            </p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                            {t('perf.common.download')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">{t('perf.results.widgets')}</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <MiniStat label={t('perf.results.completionRate')} value={`${dashboard?.widgets.completionRate ?? 0}%`} />
                    <MiniStat label={t('perf.results.stats.publishedResults')} value={dashboard?.widgets.publishedResultCount ?? 0} />
                    <MiniStat label={t('perf.results.stats.openDisputes')} value={dashboard?.widgets.openDisputeCount ?? 0} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">{t('perf.results.advancedAnalytics')}</p>
                  <div className="mt-3 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{t('perf.results.pendingFinalApproval')}</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.pendingFinalApprovalCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{t('perf.results.pendingAcknowledgment')}</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.pendingAcknowledgmentCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">{t('perf.results.reminderPending')}</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.reminderPendingCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">{t('perf.results.departmentComparison')}</p>
                      <div className="mt-2 space-y-2">
                        {(dashboard?.departmentComparison || []).slice(0, 5).map((item) => (
                          <div key={item.departmentName} className="rounded-lg border border-border px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span>{item.departmentName}</span>
                              <span className="font-medium">{item.averageScore}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{t('perf.results.employeeCount', { count: item.employeeCount })}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('perf.results.topPerformers')}</p>
                        <div className="mt-2 space-y-2">
                          {(dashboard?.topPerformers || []).slice(0, 3).map((item) => (
                            <div key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span>{item.employeeName}</span>
                                <span className="font-medium">{item.finalScore}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{item.departmentName} • {item.gradeLabel}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{t('perf.results.bottomPerformers')}</p>
                        <div className="mt-2 space-y-2">
                          {(dashboard?.bottomPerformers || []).slice(0, 3).map((item) => (
                            <div key={item.id} className="rounded-lg border border-border px-3 py-2 text-sm">
                              <div className="flex items-center justify-between gap-3">
                                <span>{item.employeeName}</span>
                                <span className="font-medium">{item.finalScore}</span>
                              </div>
                              <p className="mt-1 text-xs text-muted-foreground">{item.departmentName} • {item.gradeLabel}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">{t('perf.results.calculationSnapshot')}</p>
                  <pre className="mt-3 overflow-auto rounded-lg bg-slate-950 p-3 text-xs text-slate-100">
                    {JSON.stringify(selectedResult.calculationSnapshot || {}, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">{t('perf.results.sessionsTitle')}</h3>
                <p className="text-xs text-muted-foreground">{t('perf.results.sessionsHint')}</p>
              </div>
              <span className="text-xs text-muted-foreground">{t('perf.common.itemCount', { count: sessions.length })}</span>
            </div>

            <div className="space-y-3">
              {!sessions.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  {t('perf.results.emptySessions')}
                </div>
              ) : (
                sessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => setSelectedSessionId(session.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      session.id === selectedSessionId
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{session.name}</p>
                        <p className="text-xs text-muted-foreground">{session.code}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${SESSION_STATUS_STYLES[session.status] || SESSION_STATUS_STYLES.DRAFT}`}>
                        {SESSION_STATUS_LABEL_KEYS[session.status] ? t(SESSION_STATUS_LABEL_KEYS[session.status]) : session.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>{t('perf.results.participantCount', { count: session.participants.length })}</p>
                      <p>{t('perf.results.createdLabel', { value: formatDateTime(session.createdAt) })}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedSession && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('open')} disabled={actingSession}>
                  {t('perf.results.openSession')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('close')} disabled={actingSession}>
                  {t('perf.results.closeSession')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('finalize')} disabled={actingSession}>
                  {t('perf.results.finalizeSession')}
                </Button>
              </div>
            )}

            {selectedSession && (
              <div className="mt-4 rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{t('perf.results.distributionTitle')}</p>
                    <p className="text-xs text-muted-foreground">{t('perf.results.distributionHint')}</p>
                  </div>
                  {selectedSession.distributionAnalysis ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        selectedSession.distributionAnalysis.isCompliant
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {selectedSession.distributionAnalysis.isCompliant ? t('perf.results.compliant') : t('perf.results.violation')}
                    </span>
                  ) : selectedSession.forcedDistribution ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      {t('perf.results.invalidConfig')}
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      {t('perf.results.none')}
                    </span>
                  )}
                </div>

                {!selectedSession.distributionAnalysis ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedSession.forcedDistribution
                      ? t('perf.results.distributionUnparsed')
                      : t('perf.results.noForcedDistribution')}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {Array.from(new Set([
                      ...Object.keys(selectedSession.distributionAnalysis.target || {}),
                      ...Object.keys(selectedSession.distributionAnalysis.actual || {}),
                    ])).map((key) => (
                      <div key={key} className="grid grid-cols-4 gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                        <span className="font-medium">{key}</span>
                        <span className="text-muted-foreground">{t('perf.results.targetValue', { value: selectedSession.distributionAnalysis?.target?.[key] ?? 0 })}</span>
                        <span className="text-muted-foreground">{t('perf.results.actualValue', { value: selectedSession.distributionAnalysis?.actual?.[key] ?? 0 })}</span>
                        <span className="text-muted-foreground">Δ {selectedSession.distributionAnalysis?.delta?.[key] ?? 0}</span>
                      </div>
                    ))}

                    {selectedSession.distributionAnalysis.violations?.length ? (
                      <div className="rounded-lg border border-border bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        <p className="font-medium">{t('perf.results.violations')}</p>
                        <p className="mt-1">{selectedSession.distributionAnalysis.violations.join(', ')}</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">{t('perf.results.calibrationDisputeTitle')}</h3>
              <p className="text-xs text-muted-foreground">{t('perf.results.calibrationDisputeHint')}</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-4">
                {!selectedSession ? (
                  <p className="text-sm text-muted-foreground">{t('perf.results.selectSessionHint')}</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSession.participants.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        {t('perf.results.emptyParticipants')}
                      </div>
                    ) : (
                      selectedSession.participants.map((participant) => (
                        <button
                          key={participant.id}
                          type="button"
                          onClick={() => setSelectedParticipantId(participant.id)}
                          className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                            participant.id === selectedParticipantId
                              ? 'border-primary bg-primary/5'
                              : 'border-border bg-background hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold">{participant.result?.employee?.fullName || t('perf.results.noEmployee')}</p>
                              <p className="text-xs text-muted-foreground">
                                {t('perf.results.beforeAfterInline', {
                                  before: participant.beforeScore ?? participant.result?.finalScore ?? '-',
                                  after: participant.afterScore ?? '-',
                                })}
                              </p>
                            </div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${SESSION_STATUS_STYLES[participant.status] || SESSION_STATUS_STYLES.DRAFT}`}>
                              {SESSION_STATUS_LABEL_KEYS[participant.status] ? t(SESSION_STATUS_LABEL_KEYS[participant.status]) : participant.status}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}

                {selectedParticipant && (
                  <div className="rounded-xl border border-border bg-background p-4">
                    <p className="text-sm font-medium">{selectedParticipant.result?.employee?.fullName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('perf.results.currentGradeInline', {
                        grade: selectedParticipant.result?.gradeLabel || '-',
                        score: selectedParticipant.result?.finalScore ?? '-',
                      })}
                    </p>
                    <div className="mt-4 space-y-3">
                      <Input
                        type="number"
                        value={decisionForm.finalScore}
                        onChange={(event) => setDecisionForm((prev) => ({ ...prev, finalScore: event.target.value }))}
                        placeholder={t('perf.results.finalScorePlaceholder')}
                      />
                      <textarea
                        value={decisionForm.reason}
                        onChange={(event) => setDecisionForm((prev) => ({ ...prev, reason: event.target.value }))}
                        placeholder={t('perf.results.reasonPlaceholder')}
                        className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <Button size="sm" className="w-full" onClick={() => void handleApplyDecision()} disabled={savingDecision || selectedSession?.status !== 'OPEN'}>
                        <CheckCircle2 size={16} className="mr-2" />
                        {savingDecision ? t('perf.common.saving') : t('perf.results.saveDecision')}
                      </Button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {(selectedParticipant.decisions || []).map((decision) => (
                        <div key={decision.id} className="rounded-lg border border-border px-3 py-2">
                          <p className="text-xs font-medium">
                            {decision.beforeScore ?? '-'} {'->'} {decision.afterScore ?? '-'} {'•'} {decision.afterGradeLabel || '-'}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{decision.reason}</p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {decision.changedBy?.fullName || '-'} • {formatDateTime(decision.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium">{t('perf.results.disputesTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('perf.results.disputesHint')}</p>
                </div>
                {!selectedResult ? (
                  <p className="text-sm text-muted-foreground">{t('perf.results.selectResultHint')}</p>
                ) : !selectedResult.disputes?.length ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    {t('perf.results.emptyDisputes')}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedResult.disputes.map((dispute) => (
                      <button
                        key={dispute.id}
                        type="button"
                        onClick={() => setSelectedDisputeId(dispute.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          dispute.id === selectedDisputeId
                            ? 'border-primary bg-primary/5'
                            : 'border-border bg-background hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{dispute.title}</p>
                            <p className="text-xs text-muted-foreground">{dispute.employee?.fullName || '-'} • {formatDateTime(dispute.createdAt)}</p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${DISPUTE_STATUS_STYLES[dispute.status] || DISPUTE_STATUS_STYLES.OPEN}`}>
                            {DISPUTE_STATUS_LABEL_KEYS[dispute.status] ? t(DISPUTE_STATUS_LABEL_KEYS[dispute.status]) : dispute.status}
                          </span>
                        </div>
                      </button>
                    ))}

                    {selectedDispute && (
                      <div className="rounded-xl border border-border p-4">
                        <p className="text-sm font-medium">{selectedDispute.title}</p>
                        <p className="mt-2 text-sm text-muted-foreground">{selectedDispute.message}</p>
                        <div className="mt-4 space-y-3">
                          <Select2
                            value={disputeResponseForm.status}
                            onValueChange={(value) => setDisputeResponseForm((prev) => ({ ...prev, status: value as 'RESPONDED' | 'RESOLVED' | 'REJECTED' | 'CLOSED' }))}
                            options={disputeStatusOptions}
                            placeholder={t('perf.results.responseStatusPlaceholder')}
                          />
                          <textarea
                            value={disputeResponseForm.response}
                            onChange={(event) => setDisputeResponseForm((prev) => ({ ...prev, response: event.target.value }))}
                            placeholder={t('perf.results.responsePlaceholder')}
                            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <Button size="sm" className="w-full" onClick={() => void handleRespondDispute()} disabled={respondingDispute}>
                            <Send size={16} className="mr-2" />
                            {respondingDispute ? t('perf.common.saving') : t('perf.results.saveResponse')}
                          </Button>
                          <div className="rounded-lg border border-border p-3">
                            <p className="text-xs font-medium text-muted-foreground">{t('perf.results.disputeAttachments')}</p>
                            <div className="mt-3 flex gap-2">
                              <input
                                type="file"
                                className="block w-full text-sm"
                                onChange={(event) => setDisputeAttachmentFile(event.target.files?.[0] || null)}
                              />
                              <Button size="sm" variant="outline" onClick={() => void handleUploadDisputeAttachment()} disabled={uploadingDisputeAttachment}>
                                {uploadingDisputeAttachment ? t('perf.common.uploading') : t('perf.common.upload')}
                              </Button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {!selectedDispute.attachments?.length ? (
                                <p className="text-xs text-muted-foreground">{t('perf.results.emptyDisputeAttachments')}</p>
                              ) : selectedDispute.attachments.map((attachment) => (
                                <div key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium">{attachment.document.title}</p>
                                      <p className="text-xs text-muted-foreground">{attachment.document.fileName}</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                                      {t('perf.common.download')}
                                    </Button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border bg-background p-4">
                <div className="mb-3">
                  <p className="text-sm font-medium">{t('perf.results.reopenTitle')}</p>
                  <p className="text-xs text-muted-foreground">{t('perf.results.reopenHint')}</p>
                </div>
                {!selectedResult ? (
                  <p className="text-sm text-muted-foreground">{t('perf.results.selectResultHint')}</p>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      placeholder={t('perf.results.reopenReasonPlaceholder')}
                      className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button size="sm" className="w-full" variant="outline" onClick={() => void handleReopenResult()} disabled={reopening}>
                      <RotateCcw size={16} className="mr-2" />
                      {reopening ? t('perf.results.reopening') : t('perf.results.reopenResult')}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      {t('perf.results.reopenInfo', { value: formatDateTime(selectedResult.reopenedAt), count: selectedResult.reopenCount ?? 0 })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
