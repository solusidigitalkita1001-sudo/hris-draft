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
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memuat result workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedResultId, selectedSessionId]);

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
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memuat data performance result');
    } finally {
      setLoading(false);
    }
  }, [companyId, selectedPeriodId]);

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
  }, [selectedDisputeId, selectedResult]);

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
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    setCalculating(true);
    try {
      const data = await performanceService.calculatePerformanceResults(selectedPeriodId);
      setResults(data);
      setSelectedResultId(data[0]?.id || '');
      toast.success('Performance result berhasil dihitung');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menghitung performance result');
    } finally {
      setCalculating(false);
    }
  }, [refreshWorkspace, selectedPeriodId]);

  const handleCreateSession = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }
    if (!sessionForm.name.trim()) {
      toast.error('Nama session wajib diisi');
      return;
    }

    setCreatingSession(true);
    try {
      const rawForcedDistribution = sessionForm.forcedDistribution.trim();
      let forcedDistribution: any = undefined;
      if (rawForcedDistribution) {
        try {
          forcedDistribution = JSON.parse(rawForcedDistribution);
        } catch {
          toast.error('Forced distribution harus valid JSON');
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
      toast.success('Calibration session berhasil dibuat');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat calibration session');
    } finally {
      setCreatingSession(false);
    }
  }, [refreshWorkspace, selectedPeriodId, sessionForm]);

  const handlePublishResults = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
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
      toast.success('Performance result berhasil dipublish');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal publish performance result');
    } finally {
      setPublishing(false);
    }
  }, [publishForm, refreshWorkspace, selectedPeriodId]);

  const handleApproveResults = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    setApproving(true);
    try {
      const data = await performanceService.approvePerformanceResults(selectedPeriodId, {
        notes: approvalNotes.trim() || undefined,
      });
      setResults(data);
      setSelectedResultId(data[0]?.id || '');
      toast.success('Performance result berhasil final approved');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal final approve performance result');
    } finally {
      setApproving(false);
    }
  }, [approvalNotes, refreshWorkspace, selectedPeriodId]);

  const handleSessionAction = useCallback(async (action: 'open' | 'close' | 'finalize') => {
    if (!selectedSession) {
      toast.error('Pilih calibration session terlebih dahulu');
      return;
    }

    setActingSession(true);
    try {
      if (action === 'open') await performanceService.openCalibrationSession(selectedSession.id);
      if (action === 'close') await performanceService.closeCalibrationSession(selectedSession.id);
      if (action === 'finalize') await performanceService.finalizeCalibrationSession(selectedSession.id);
      toast.success(`Calibration session berhasil di-${action}`);
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memproses calibration session');
    } finally {
      setActingSession(false);
    }
  }, [refreshWorkspace, selectedSession]);

  const handleApplyDecision = useCallback(async () => {
    if (!selectedParticipant) {
      toast.error('Pilih participant calibration terlebih dahulu');
      return;
    }

    if (!decisionForm.finalScore.trim() || !decisionForm.reason.trim()) {
      toast.error('Final score dan reason wajib diisi');
      return;
    }

    setSavingDecision(true);
    try {
      await performanceService.applyCalibrationDecision(selectedParticipant.id, {
        finalScore: Number(decisionForm.finalScore),
        reason: decisionForm.reason.trim(),
      });
      toast.success('Calibration decision berhasil disimpan');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan calibration decision');
    } finally {
      setSavingDecision(false);
    }
  }, [decisionForm, refreshWorkspace, selectedParticipant]);

  const handleRespondDispute = useCallback(async () => {
    if (!selectedDispute) {
      toast.error('Pilih dispute terlebih dahulu');
      return;
    }

    if (!disputeResponseForm.response.trim()) {
      toast.error('Response dispute wajib diisi');
      return;
    }

    setRespondingDispute(true);
    try {
      await performanceService.respondPerformanceResultDispute(selectedDispute.id, {
        response: disputeResponseForm.response.trim(),
        status: disputeResponseForm.status,
      });
      toast.success('Response dispute berhasil disimpan');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan response dispute');
    } finally {
      setRespondingDispute(false);
    }
  }, [disputeResponseForm, refreshWorkspace, selectedDispute]);

  const handleReopenResult = useCallback(async () => {
    if (!selectedResult) {
      toast.error('Pilih result terlebih dahulu');
      return;
    }

    if (!reopenReason.trim()) {
      toast.error('Reason reopen wajib diisi');
      return;
    }

    setReopening(true);
    try {
      await performanceService.reopenPerformanceResult(selectedResult.id, {
        reason: reopenReason.trim(),
      });
      toast.success('Performance result berhasil dibuka ulang');
      setReopenReason('');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal reopen performance result');
    } finally {
      setReopening(false);
    }
  }, [refreshWorkspace, reopenReason, selectedResult]);

  const handleSendReminders = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    setSendingReminders(true);
    try {
      const summary = await performanceService.sendPerformanceResultReminders(selectedPeriodId, {
        target: reminderTarget,
        notes: reminderNotes.trim() || undefined,
      });
      toast.success(`Reminder terkirim ke ${summary.notificationCount} notifikasi`);
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal mengirim reminder');
    } finally {
      setSendingReminders(false);
    }
  }, [refreshWorkspace, reminderNotes, reminderTarget, selectedPeriodId]);

  const handleSyncRecommendations = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    setSyncingRecommendations(true);
    try {
      await performanceService.syncDevelopmentRecommendations(selectedPeriodId, {
        strategy: 'UPSERT_MISSING',
      });
      toast.success('Development recommendation berhasil disinkronkan');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal sinkronisasi recommendation');
    } finally {
      setSyncingRecommendations(false);
    }
  }, [refreshWorkspace, selectedPeriodId]);

  const handleAssignRecommendation = useCallback(async () => {
    if (!selectedRecommendation) {
      toast.error('Pilih recommendation terlebih dahulu');
      return;
    }

    if (!recommendationCourseId) {
      toast.error('Pilih course training');
      return;
    }

    setAssigningRecommendation(true);
    try {
      await performanceService.assignDevelopmentRecommendation(selectedRecommendation.id, {
        courseId: recommendationCourseId,
        notes: recommendationNotes.trim() || undefined,
      });
      toast.success('Recommendation berhasil di-assign ke training');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal assign recommendation');
    } finally {
      setAssigningRecommendation(false);
    }
  }, [recommendationCourseId, recommendationNotes, refreshWorkspace, selectedRecommendation]);

  const handleUploadResultAttachment = useCallback(async () => {
    if (!selectedResult) {
      toast.error('Pilih result terlebih dahulu');
      return;
    }
    if (!resultAttachmentFile) {
      toast.error('Pilih file attachment');
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
      toast.success('Attachment result berhasil diupload');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal upload attachment result');
    } finally {
      setUploadingResultAttachment(false);
    }
  }, [refreshWorkspace, resultAttachmentFile, selectedResult]);

  const handleUploadDisputeAttachment = useCallback(async () => {
    if (!selectedDispute) {
      toast.error('Pilih dispute terlebih dahulu');
      return;
    }
    if (!disputeAttachmentFile) {
      toast.error('Pilih file attachment');
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
      toast.success('Attachment dispute berhasil diupload');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal upload attachment dispute');
    } finally {
      setUploadingDisputeAttachment(false);
    }
  }, [disputeAttachmentFile, refreshWorkspace, selectedDispute]);

  const handleCreateSchedule = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    if (!scheduleForm.name.trim()) {
      toast.error('Nama schedule wajib diisi');
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
      toast.success('Automation schedule berhasil dibuat');
      await refreshWorkspace();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat automation schedule');
    } finally {
      setCreatingSchedule(false);
    }
  }, [refreshWorkspace, scheduleForm, selectedPeriodId]);

  const handleDownloadAttachment = useCallback(async (documentId: string, fileName: string) => {
    try {
      await documentManagementService.download(documentId, fileName);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal download attachment');
    }
  }, []);

  const avgScore = String(dashboard?.widgets.averageScore ?? (results.length
    ? Number((results.reduce((sum, result) => sum + toNumber(result.finalScore), 0) / results.length).toFixed(2))
    : 0));

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Performance Results"
        description="Workspace Phase 6-7 untuk final approval, reopen result, publish, reminder notification, dispute response, dan analytics advanced."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap()}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void handleCalculate()} disabled={calculating || !selectedPeriodId}>
              <Calculator size={16} className="mr-2" />
              {calculating ? 'Calculating...' : 'Calculate Results'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handlePublishResults()} disabled={publishing || !results.length}>
              <Send size={16} className="mr-2" />
              {publishing ? 'Publishing...' : 'Publish Results'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleApproveResults()} disabled={approving || !results.length}>
              <CheckCircle2 size={16} className="mr-2" />
              {approving ? 'Approving...' : 'Final Approve'}
            </Button>
          </div>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Result Period</label>
            <Select2
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              options={periodOptions}
              placeholder="Pilih period result"
            />
          </div>
          <StatCard label="Results" value={dashboard?.widgets.resultCount ?? results.length} icon={<Trophy size={16} />} />
          <StatCard label="Avg Final Score" value={avgScore} icon={<Gauge size={16} />} />
          <StatCard label="Published Results" value={dashboard?.widgets.publishedResultCount ?? results.filter((result) => result.status === 'PUBLISHED').length} icon={<CheckCircle2 size={16} />} />
          <StatCard label="Open Disputes" value={dashboard?.widgets.openDisputeCount ?? 0} icon={<AlertCircle size={16} />} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Calculated Results</h3>
                <p className="text-xs text-muted-foreground">Daftar hasil score, grade, dan recommendation per employee.</p>
              </div>
              <span className="text-xs text-muted-foreground">{results.length} item</span>
            </div>
            <div className="space-y-3">
              {workspaceLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading result workspace...
                </div>
              ) : !results.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada hasil. Jalankan calculate result dulu.
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
                        <p className="text-sm font-semibold">{result.employee?.fullName || 'Tanpa employee'}</p>
                        <p className="text-xs text-muted-foreground">{result.employee?.employeeNumber || '-'}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${RESULT_STATUS_STYLES[result.status] || RESULT_STATUS_STYLES.CALCULATED}`}>
                        {result.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>Final Score: {result.finalScore ?? '-'}</p>
                      <p>Grade: {result.gradeLabel || '-'}</p>
                      <p>Calculated: {formatDateTime(result.calculatedAt)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Final Approval & Reminder</h3>
              <p className="text-xs text-muted-foreground">Lock hasil sebelum publish dan kirim reminder in-app untuk follow-up inti.</p>
            </div>
            <div className="space-y-3">
              <Input
                value={approvalNotes}
                onChange={(event) => setApprovalNotes(event.target.value)}
                placeholder="Catatan final approval"
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleApproveResults()} disabled={approving || !results.length}>
                <CheckCircle2 size={16} className="mr-2" />
                {approving ? 'Approving...' : 'Final Approve Results'}
              </Button>
              <Select2
                value={reminderTarget}
                onValueChange={(value) => setReminderTarget(value as any)}
                options={[
                  { value: 'ALL', label: 'All Pending' },
                  { value: 'UNACKNOWLEDGED_RESULTS', label: 'Unacknowledged Results' },
                  { value: 'OPEN_DISPUTES', label: 'Open Disputes' },
                ]}
                placeholder="Pilih target reminder"
              />
              <textarea
                value={reminderNotes}
                onChange={(event) => setReminderNotes(event.target.value)}
                placeholder="Catatan reminder"
                className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleSendReminders()} disabled={sendingReminders || !results.length}>
                <BellRing size={16} className="mr-2" />
                {sendingReminders ? 'Mengirim...' : 'Send Reminders'}
              </Button>
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleSyncRecommendations()} disabled={syncingRecommendations || !results.length}>
                <RefreshCw size={16} className="mr-2" />
                {syncingRecommendations ? 'Syncing...' : 'Sync Development Recommendations'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Automation Schedule</h3>
              <p className="text-xs text-muted-foreground">Cadence reminder otomatis via queue worker untuk result period ini.</p>
            </div>
            <div className="space-y-3">
              <Input
                value={scheduleForm.name}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nama schedule"
              />
              <Select2
                value={scheduleForm.reminderTarget}
                onValueChange={(value) => setScheduleForm((prev) => ({ ...prev, reminderTarget: value as any }))}
                options={[
                  { value: 'ALL', label: 'All Pending' },
                  { value: 'UNACKNOWLEDGED_RESULTS', label: 'Unacknowledged Results' },
                  { value: 'OPEN_DISPUTES', label: 'Open Disputes' },
                ]}
                placeholder="Pilih target automation"
              />
              <Input
                type="number"
                min={1}
                max={168}
                value={scheduleForm.cadenceHours}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, cadenceHours: event.target.value }))}
                placeholder="Cadence (jam)"
              />
              <textarea
                value={scheduleForm.notes}
                onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Catatan automation"
                className="min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" variant="outline" onClick={() => void handleCreateSchedule()} disabled={creatingSchedule || !selectedPeriodId}>
                <BellRing size={16} className="mr-2" />
                {creatingSchedule ? 'Membuat...' : 'Buat Automation Schedule'}
              </Button>
            </div>
            <div className="mt-4 space-y-2">
              {!schedules.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                  Belum ada automation schedule.
                </div>
              ) : schedules.map((schedule) => (
                <div key={schedule.id} className="rounded-lg border border-border px-3 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">{schedule.name}</p>
                      <p className="text-xs text-muted-foreground">{schedule.reminderTarget} • tiap {schedule.cadenceHours} jam</p>
                    </div>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${schedule.isActive ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400'}`}>
                      {schedule.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last Run {formatDateTime(schedule.lastRunAt)} • Next Run {formatDateTime(schedule.nextRunAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Publish Policy</h3>
              <p className="text-xs text-muted-foreground">Atur visibility policy employee dan dispute window saat publish result.</p>
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showCalculation}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showCalculation: event.target.checked }))}
                />
                Tampilkan detail calculation ke employee
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showRecommendations}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showRecommendations: event.target.checked }))}
                />
                Tampilkan recommendation ke employee
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={publishForm.showCalibrationHistory}
                  onChange={(event) => setPublishForm((prev) => ({ ...prev, showCalibrationHistory: event.target.checked }))}
                />
                Tampilkan calibration history ke employee
              </label>
              <Input
                type="number"
                min={1}
                max={90}
                value={publishForm.disputeWindowDays}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, disputeWindowDays: event.target.value }))}
                placeholder="Dispute window (hari)"
              />
              <textarea
                value={publishForm.notes}
                onChange={(event) => setPublishForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Catatan publish"
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Calibration Session Builder</h3>
              <p className="text-xs text-muted-foreground">Buat session calibration dari result period yang sudah dihitung.</p>
            </div>
            <div className="space-y-3">
              <Input
                value={sessionForm.name}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Nama session calibration"
              />
              <Input
                value=""
                placeholder="Akan dibuat otomatis oleh sistem"
                disabled
              />
              <p className="text-xs text-muted-foreground">Code calibration session digenerate otomatis saat create.</p>
              <textarea
                value={sessionForm.forcedDistribution}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, forcedDistribution: event.target.value }))}
                placeholder={'Forced distribution (JSON)\n{"mode":"COUNT","buckets":{"A":3,"B":5,"C":2},"tolerance":0}'}
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <textarea
                value={sessionForm.notes}
                onChange={(event) => setSessionForm((prev) => ({ ...prev, notes: event.target.value }))}
                placeholder="Catatan session"
                className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button size="sm" className="w-full" onClick={() => void handleCreateSession()} disabled={creatingSession || !results.length}>
                {creatingSession ? 'Membuat...' : 'Buat Calibration Session'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Result Detail</h3>
              <p className="text-xs text-muted-foreground">Breakdown score, grade, dan recommendation dari result terpilih.</p>
            </div>
            {!selectedResult ? (
              <p className="text-sm text-muted-foreground">Pilih result dari panel kiri.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedResult.employee?.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    Final Score {selectedResult.finalScore ?? '-'} • Grade {selectedResult.gradeLabel || '-'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Published {formatDateTime(selectedResult.publishedAt)} • Dispute Deadline {formatDateTime(selectedResult.disputeDeadline)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Final Approved {formatDateTime(selectedResult.finalApprovedAt)} • Reminder #{selectedResult.reminderCount ?? 0}
                  </p>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <MiniStat label="Raw Score" value={selectedResult.rawScore ?? '-'} />
                  <MiniStat label="Normalized" value={selectedResult.normalizedScore ?? '-'} />
                  <MiniStat label="Weighted" value={selectedResult.weightedScore ?? '-'} />
                  <MiniStat label="Calculation Ver." value={selectedResult.calculationVersion} />
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Recommendation</p>
                  <p className="mt-2 text-sm text-muted-foreground">{selectedResult.recommendationSummary || 'Belum ada recommendation yang match.'}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Development Recommendations</p>
                      <p className="text-xs text-muted-foreground">Sinkronkan recommendation ke training course dan enrollment nyata.</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{selectedResult.developmentRecommendations?.length || 0} item</span>
                  </div>
                  {!selectedResult.developmentRecommendations?.length ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
                      Belum ada development recommendation untuk result ini.
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
                              <p className="text-xs text-muted-foreground">{recommendation.sourceRuleLabel || recommendation.type}</p>
                            </div>
                            <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                              {recommendation.status}
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
                            placeholder="Pilih training course"
                          />
                          <textarea
                            value={recommendationNotes}
                            onChange={(event) => setRecommendationNotes(event.target.value)}
                            placeholder="Catatan assignment"
                            className="mt-3 min-h-[84px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <Button size="sm" className="mt-3 w-full" onClick={() => void handleAssignRecommendation()} disabled={assigningRecommendation}>
                            <Send size={16} className="mr-2" />
                            {assigningRecommendation ? 'Assigning...' : 'Assign to Training'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <div className="mb-3">
                    <p className="text-sm font-medium">Result Attachments</p>
                    <p className="text-xs text-muted-foreground">Dokumen resmi result yang tersimpan ke document management.</p>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="file"
                      className="block w-full text-sm"
                      onChange={(event) => setResultAttachmentFile(event.target.files?.[0] || null)}
                    />
                    <Button size="sm" variant="outline" onClick={() => void handleUploadResultAttachment()} disabled={uploadingResultAttachment || !selectedResult}>
                      {uploadingResultAttachment ? 'Uploading...' : 'Upload'}
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {!selectedResult.attachments?.length ? (
                      <p className="text-xs text-muted-foreground">Belum ada attachment result.</p>
                    ) : selectedResult.attachments.map((attachment) => (
                      <div key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium">{attachment.document.title}</p>
                            <p className="text-xs text-muted-foreground">{attachment.document.fileName} • {attachment.document.visibility}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Widgets</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <MiniStat label="Completion Rate" value={`${dashboard?.widgets.completionRate ?? 0}%`} />
                    <MiniStat label="Published Results" value={dashboard?.widgets.publishedResultCount ?? 0} />
                    <MiniStat label="Open Disputes" value={dashboard?.widgets.openDisputeCount ?? 0} />
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-background p-4">
                  <p className="text-sm font-medium">Advanced Analytics</p>
                  <div className="mt-3 grid gap-4 lg:grid-cols-3">
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Pending Final Approval</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.pendingFinalApprovalCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Pending Acknowledgment</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.pendingAcknowledgmentCount ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-border p-3">
                      <p className="text-xs text-muted-foreground">Reminder Pending</p>
                      <p className="mt-2 text-sm font-semibold">{dashboard?.widgets.reminderPendingCount ?? 0}</p>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground">Department Comparison</p>
                      <div className="mt-2 space-y-2">
                        {(dashboard?.departmentComparison || []).slice(0, 5).map((item) => (
                          <div key={item.departmentName} className="rounded-lg border border-border px-3 py-2 text-sm">
                            <div className="flex items-center justify-between gap-3">
                              <span>{item.departmentName}</span>
                              <span className="font-medium">{item.averageScore}</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">{item.employeeCount} employee</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Top Performers</p>
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
                        <p className="text-xs font-medium text-muted-foreground">Bottom Performers</p>
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
                  <p className="text-sm font-medium">Calculation Snapshot</p>
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
                <h3 className="text-sm font-semibold">Calibration Sessions</h3>
                <p className="text-xs text-muted-foreground">Buka session, review participant, lalu finalize hasil calibration.</p>
              </div>
              <span className="text-xs text-muted-foreground">{sessions.length} item</span>
            </div>

            <div className="space-y-3">
              {!sessions.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada calibration session.
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
                        {session.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>Participants: {session.participants.length}</p>
                      <p>Created: {formatDateTime(session.createdAt)}</p>
                    </div>
                  </button>
                ))
              )}
            </div>

            {selectedSession && (
              <div className="mt-4 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('open')} disabled={actingSession}>
                  Open
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('close')} disabled={actingSession}>
                  Close
                </Button>
                <Button size="sm" variant="outline" onClick={() => void handleSessionAction('finalize')} disabled={actingSession}>
                  Finalize
                </Button>
              </div>
            )}

            {selectedSession && (
              <div className="mt-4 rounded-xl border border-border bg-background p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Distribution Analysis</p>
                    <p className="text-xs text-muted-foreground">Target vs actual distribution untuk calibration session.</p>
                  </div>
                  {selectedSession.distributionAnalysis ? (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        selectedSession.distributionAnalysis.isCompliant
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-400'
                      }`}
                    >
                      {selectedSession.distributionAnalysis.isCompliant ? 'COMPLIANT' : 'VIOLATION'}
                    </span>
                  ) : selectedSession.forcedDistribution ? (
                    <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                      INVALID CONFIG
                    </span>
                  ) : (
                    <span className="inline-flex rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-slate-950 dark:text-slate-400">
                      NONE
                    </span>
                  )}
                </div>

                {!selectedSession.distributionAnalysis ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {selectedSession.forcedDistribution
                      ? 'Forced distribution ada, tapi formatnya belum bisa dianalisis. Pakai format {"mode":"COUNT","buckets":{...},"tolerance":0}.'
                      : 'Session ini tidak memakai forced distribution.'}
                  </p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {Array.from(new Set([
                      ...Object.keys(selectedSession.distributionAnalysis.target || {}),
                      ...Object.keys(selectedSession.distributionAnalysis.actual || {}),
                    ])).map((key) => (
                      <div key={key} className="grid grid-cols-4 gap-2 rounded-lg border border-border px-3 py-2 text-xs">
                        <span className="font-medium">{key}</span>
                        <span className="text-muted-foreground">Target {selectedSession.distributionAnalysis?.target?.[key] ?? 0}</span>
                        <span className="text-muted-foreground">Actual {selectedSession.distributionAnalysis?.actual?.[key] ?? 0}</span>
                        <span className="text-muted-foreground">Δ {selectedSession.distributionAnalysis?.delta?.[key] ?? 0}</span>
                      </div>
                    ))}

                    {selectedSession.distributionAnalysis.violations?.length ? (
                      <div className="rounded-lg border border-border bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                        <p className="font-medium">Violations</p>
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
              <h3 className="text-sm font-semibold">Calibration & Dispute</h3>
              <p className="text-xs text-muted-foreground">Kelola override calibration dan response dispute hasil employee.</p>
            </div>
            <div className="space-y-6">
              <div className="space-y-4">
                {!selectedSession ? (
                  <p className="text-sm text-muted-foreground">Pilih calibration session terlebih dahulu.</p>
                ) : (
                  <div className="space-y-3">
                    {selectedSession.participants.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                        Belum ada participant di session ini.
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
                              <p className="text-sm font-semibold">{participant.result?.employee?.fullName || 'Tanpa employee'}</p>
                              <p className="text-xs text-muted-foreground">
                                Before {participant.beforeScore ?? participant.result?.finalScore ?? '-'} • After {participant.afterScore ?? '-'}
                              </p>
                            </div>
                            <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${SESSION_STATUS_STYLES[participant.status] || SESSION_STATUS_STYLES.DRAFT}`}>
                              {participant.status}
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
                      Current Grade {selectedParticipant.result?.gradeLabel || '-'} • Final Score {selectedParticipant.result?.finalScore ?? '-'}
                    </p>
                    <div className="mt-4 space-y-3">
                      <Input
                        type="number"
                        value={decisionForm.finalScore}
                        onChange={(event) => setDecisionForm((prev) => ({ ...prev, finalScore: event.target.value }))}
                        placeholder="Final score override"
                      />
                      <textarea
                        value={decisionForm.reason}
                        onChange={(event) => setDecisionForm((prev) => ({ ...prev, reason: event.target.value }))}
                        placeholder="Reason wajib"
                        className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                      <Button size="sm" className="w-full" onClick={() => void handleApplyDecision()} disabled={savingDecision || selectedSession?.status !== 'OPEN'}>
                        <CheckCircle2 size={16} className="mr-2" />
                        {savingDecision ? 'Menyimpan...' : 'Simpan Calibration Decision'}
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
                  <p className="text-sm font-medium">Result Disputes</p>
                  <p className="text-xs text-muted-foreground">Response dispute employee dari result yang sedang dipilih.</p>
                </div>
                {!selectedResult ? (
                  <p className="text-sm text-muted-foreground">Pilih result terlebih dahulu.</p>
                ) : !selectedResult.disputes?.length ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    Belum ada dispute untuk result ini.
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
                            {dispute.status}
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
                            onValueChange={(value) => setDisputeResponseForm((prev) => ({ ...prev, status: value as any }))}
                            options={[
                              { value: 'RESPONDED', label: 'Responded' },
                              { value: 'RESOLVED', label: 'Resolved' },
                              { value: 'REJECTED', label: 'Rejected' },
                              { value: 'CLOSED', label: 'Closed' },
                            ]}
                            placeholder="Pilih status response"
                          />
                          <textarea
                            value={disputeResponseForm.response}
                            onChange={(event) => setDisputeResponseForm((prev) => ({ ...prev, response: event.target.value }))}
                            placeholder="Response dispute"
                            className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                          <Button size="sm" className="w-full" onClick={() => void handleRespondDispute()} disabled={respondingDispute}>
                            <Send size={16} className="mr-2" />
                            {respondingDispute ? 'Menyimpan...' : 'Simpan Response Dispute'}
                          </Button>
                          <div className="rounded-lg border border-border p-3">
                            <p className="text-xs font-medium text-muted-foreground">Dispute Attachments</p>
                            <div className="mt-3 flex gap-2">
                              <input
                                type="file"
                                className="block w-full text-sm"
                                onChange={(event) => setDisputeAttachmentFile(event.target.files?.[0] || null)}
                              />
                              <Button size="sm" variant="outline" onClick={() => void handleUploadDisputeAttachment()} disabled={uploadingDisputeAttachment}>
                                {uploadingDisputeAttachment ? 'Uploading...' : 'Upload'}
                              </Button>
                            </div>
                            <div className="mt-3 space-y-2">
                              {!selectedDispute.attachments?.length ? (
                                <p className="text-xs text-muted-foreground">Belum ada attachment dispute.</p>
                              ) : selectedDispute.attachments.map((attachment) => (
                                <div key={attachment.id} className="rounded-lg border border-border px-3 py-2">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-medium">{attachment.document.title}</p>
                                      <p className="text-xs text-muted-foreground">{attachment.document.fileName}</p>
                                    </div>
                                    <Button size="sm" variant="outline" onClick={() => void handleDownloadAttachment(attachment.document.id, attachment.document.fileName)}>
                                      Download
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
                  <p className="text-sm font-medium">Reopen Result</p>
                  <p className="text-xs text-muted-foreground">Jalur resmi untuk membuka ulang hasil final/published dengan audit trail.</p>
                </div>
                {!selectedResult ? (
                  <p className="text-sm text-muted-foreground">Pilih result terlebih dahulu.</p>
                ) : (
                  <div className="space-y-3">
                    <textarea
                      value={reopenReason}
                      onChange={(event) => setReopenReason(event.target.value)}
                      placeholder="Reason reopen result"
                      className="min-h-[96px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <Button size="sm" className="w-full" variant="outline" onClick={() => void handleReopenResult()} disabled={reopening}>
                      <RotateCcw size={16} className="mr-2" />
                      {reopening ? 'Membuka ulang...' : 'Reopen Result'}
                    </Button>
                    <p className="text-xs text-muted-foreground">
                      Last reopen {formatDateTime(selectedResult.reopenedAt)} • Count {selectedResult.reopenCount ?? 0}
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
