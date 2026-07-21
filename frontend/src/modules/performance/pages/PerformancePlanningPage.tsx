import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformancePlanningWorkspace,
  type PerformancePlanningAssignment,
  type PerformancePlanningTarget,
  type PerformancePlanningAssignmentPayload,
  type PerformancePlanningTargetPayload,
} from '@/services/performance.service';
import { employeeService, type Employee } from '@/services/employee.service';
import { useCompanyStore } from '@/stores/company.store';
import toast from 'react-hot-toast';
import { ClipboardCheck, Plus, RefreshCw, Rocket, Target, Trash2, Users } from 'lucide-react';

const ASSIGNMENT_STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-gray-50 text-gray-700 dark:bg-gray-900 dark:text-gray-400',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  REASSIGNED: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  ARCHIVED: 'bg-slate-50 text-slate-700 dark:bg-slate-950 dark:text-slate-400',
};

const FREQUENCY_OPTIONS = ['ONCE', 'MONTHLY', 'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'CUSTOM'] as const;
const ASSIGNMENT_SOURCE_OPTIONS = ['MANUAL', 'AUTO_FROM_ORG'] as const;

function safeNumber(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

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

export function PerformancePlanningPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [periods, setPeriods] = useState<Array<{ id: string; name: string; code: string; planningPublishedAt?: string | null }>>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [indicators, setIndicators] = useState(awaitableEmptyIndicators());
  const [selectedPeriodId, setSelectedPeriodId] = useState('');
  const [selectedAssignmentId, setSelectedAssignmentId] = useState('');
  const [workspace, setWorkspace] = useState<PerformancePlanningWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<PerformancePlanningAssignmentPayload>({
    employeeId: '',
    reviewerId: '',
    approverId: '',
    assignmentSource: 'MANUAL',
  });
  const [assignmentEditForm, setAssignmentEditForm] = useState({
    reviewerId: '',
    approverId: '',
    assignmentSource: 'MANUAL' as 'MANUAL' | 'AUTO_FROM_ORG',
  });
  const [reassignReason, setReassignReason] = useState('');
  const [editingTargetId, setEditingTargetId] = useState('');
  const [targetForm, setTargetForm] = useState({
    componentId: '',
    indicatorId: '',
    reviewerId: '',
    approverId: '',
    name: '',
    description: '',
    targetValue: '',
    targetText: '',
    weight: '',
    frequency: 'ONCE' as PerformancePlanningTargetPayload['frequency'],
    evidenceRequired: false,
  });

  const selectedAssignment = useMemo(
    () => workspace?.planningAssignments.find((assignment) => assignment.id === selectedAssignmentId) ?? null,
    [workspace, selectedAssignmentId]
  );

  const periodOptions = useMemo(
    () => periods.map((period) => ({ value: period.id, label: `${period.name} • ${period.code}` })),
    [periods]
  );

  const employeeOptions = useMemo(
    () => employees.map((employee) => ({ value: employee.id, label: `${employee.fullName} • ${employee.employeeNumber}` })),
    [employees]
  );

  const componentOptions = useMemo(
    () =>
      (workspace?.methodVersion.components ?? []).map((component) => ({
        value: component.id,
        label: `${component.name} • ${component.weight}%`,
      })),
    [workspace?.methodVersion.components]
  );

  const indicatorOptions = useMemo(
    () => indicators.map((indicator) => ({ value: indicator.id, label: `${indicator.name} • ${indicator.code}` })),
    [indicators]
  );

  const selectedTarget = useMemo(
    () => selectedAssignment?.targets.find((target) => target.id === editingTargetId) ?? null,
    [editingTargetId, selectedAssignment]
  );

  const loadWorkspace = useCallback(async (periodId: string) => {
    if (!periodId) {
      setWorkspace(null);
      setSelectedAssignmentId('');
      return;
    }

    setWorkspaceLoading(true);
    try {
      const data = await performanceService.getPlanningWorkspace(periodId);
      setWorkspace(data);
      const nextAssignmentId = selectedAssignmentId && data.planningAssignments.some((assignment) => assignment.id === selectedAssignmentId)
        ? selectedAssignmentId
        : data.planningAssignments[0]?.id || '';
      setSelectedAssignmentId(nextAssignmentId);
    } catch (error: any) {
      console.error(error);
      setWorkspace(null);
      toast.error(error?.response?.data?.message || 'Gagal memuat planning workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  }, [selectedAssignmentId]);

  const loadBootstrap = useCallback(async () => {
    if (!companyId) {
      setPeriods([]);
      setEmployees([]);
      setIndicators(awaitableEmptyIndicators());
      setWorkspace(null);
      setSelectedPeriodId('');
      setSelectedAssignmentId('');
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [periodData, employeeData, indicatorData] = await Promise.all([
        performanceService.getPeriods(companyId, { status: 'PUBLISHED' }),
        employeeService.getEmployees({ companyId, page: 1, limit: 500 }),
        performanceService.getIndicators(companyId),
      ]);

      setPeriods(periodData.map((period) => ({
        id: period.id,
        name: period.name,
        code: period.code,
        planningPublishedAt: period.planningPublishedAt,
      })));
      setEmployees(employeeData.data);
      setIndicators(indicatorData);

      const nextPeriodId = selectedPeriodId && periodData.some((period) => period.id === selectedPeriodId)
        ? selectedPeriodId
        : periodData[0]?.id || '';
      setSelectedPeriodId(nextPeriodId);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat data planning performance');
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
    if (!selectedAssignment) {
      setAssignmentEditForm({
        reviewerId: '',
        approverId: '',
        assignmentSource: 'MANUAL',
      });
      setReassignReason('');
      setEditingTargetId('');
      resetTargetForm(setTargetForm);
      return;
    }

    setAssignmentEditForm({
      reviewerId: selectedAssignment.reviewerId || '',
      approverId: selectedAssignment.approverId || '',
      assignmentSource: selectedAssignment.assignmentSource,
    });
    setReassignReason(selectedAssignment.reassignmentReason || '');
    setEditingTargetId('');
    resetTargetForm(setTargetForm);
  }, [selectedAssignment]);

  useEffect(() => {
    if (!selectedTarget) {
      resetTargetForm(setTargetForm);
      return;
    }

    setTargetForm({
      componentId: selectedTarget.componentId || '',
      indicatorId: selectedTarget.indicatorId || '',
      reviewerId: selectedTarget.reviewerId || '',
      approverId: selectedTarget.approverId || '',
      name: selectedTarget.name || '',
      description: selectedTarget.description || '',
      targetValue: selectedTarget.targetValue ? String(selectedTarget.targetValue) : '',
      targetText: selectedTarget.targetText || '',
      weight: String(selectedTarget.weight ?? ''),
      frequency: selectedTarget.frequency,
      evidenceRequired: selectedTarget.evidenceRequired,
    });
  }, [selectedTarget]);

  const handleCreateAssignment = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    if (!assignmentForm.employeeId) {
      toast.error('Employee wajib dipilih');
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.createPlanningAssignment(selectedPeriodId, {
        employeeId: assignmentForm.employeeId,
        reviewerId: assignmentForm.reviewerId || undefined,
        approverId: assignmentForm.approverId || undefined,
        assignmentSource: assignmentForm.assignmentSource || 'MANUAL',
      });
      toast.success('Assignment planning berhasil dibuat');
      setAssignmentForm({
        employeeId: '',
        reviewerId: '',
        approverId: '',
        assignmentSource: 'MANUAL',
      });
      await loadWorkspace(selectedPeriodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal membuat assignment');
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentForm, loadWorkspace, selectedPeriodId]);

  const handleSaveReviewerMatrix = useCallback(async () => {
    if (!selectedAssignment) return;

    setSavingAssignment(true);
    try {
      await performanceService.updatePlanningAssignment(selectedAssignment.id, {
        reviewerId: assignmentEditForm.reviewerId || undefined,
        approverId: assignmentEditForm.approverId || undefined,
        assignmentSource: assignmentEditForm.assignmentSource,
      });
      toast.success('Reviewer matrix berhasil diperbarui');
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal memperbarui reviewer matrix');
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentEditForm, loadWorkspace, selectedAssignment]);

  const handleReassign = useCallback(async () => {
    if (!selectedAssignment) return;
    if (!reassignReason.trim()) {
      toast.error('Alasan reassignment wajib diisi');
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.reassignPlanningAssignment(selectedAssignment.id, {
        reviewerId: assignmentEditForm.reviewerId || undefined,
        approverId: assignmentEditForm.approverId || undefined,
        reason: reassignReason.trim(),
      });
      toast.success('Assignment berhasil direassign');
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal reassign assignment');
    } finally {
      setSavingAssignment(false);
    }
  }, [assignmentEditForm, loadWorkspace, reassignReason, selectedAssignment]);

  const handleDeleteAssignment = useCallback(async (assignment: PerformancePlanningAssignment) => {
    if (!window.confirm(`Hapus assignment untuk ${assignment.employee.fullName}?`)) {
      return;
    }

    setSavingAssignment(true);
    try {
      await performanceService.deletePlanningAssignment(assignment.id);
      toast.success('Assignment berhasil dihapus');
      await loadWorkspace(assignment.periodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menghapus assignment');
    } finally {
      setSavingAssignment(false);
    }
  }, [loadWorkspace]);

  const handleSaveTarget = useCallback(async () => {
    if (!selectedAssignment) {
      toast.error('Pilih assignment terlebih dahulu');
      return;
    }
    if (!targetForm.componentId) {
      toast.error('Component wajib dipilih');
      return;
    }
    if (!targetForm.indicatorId) {
      toast.error('Indicator wajib dipilih');
      return;
    }

    const selectedIndicator = indicators.find((indicator) => indicator.id === targetForm.indicatorId);
    const payload: PerformancePlanningTargetPayload = {
      componentId: targetForm.componentId,
      indicatorId: targetForm.indicatorId,
      formulaId: selectedIndicator?.formulaId || undefined,
      reviewerId: targetForm.reviewerId || undefined,
      approverId: targetForm.approverId || undefined,
      name: targetForm.name.trim() || undefined,
      description: targetForm.description.trim() || undefined,
      targetValue: safeNumber(targetForm.targetValue),
      targetText: targetForm.targetText.trim() || undefined,
      weight: safeNumber(targetForm.weight) || 0,
      frequency: targetForm.frequency,
      evidenceRequired: targetForm.evidenceRequired,
    };

    if (!payload.weight) {
      toast.error('Weight target wajib diisi');
      return;
    }

    setSavingTarget(true);
    try {
      if (editingTargetId) {
        await performanceService.updatePlanningTarget(editingTargetId, payload);
        toast.success('Target planning berhasil diperbarui');
      } else {
        await performanceService.createPlanningTarget(selectedAssignment.id, payload);
        toast.success('Target planning berhasil ditambahkan');
      }
      resetTargetForm(setTargetForm);
      setEditingTargetId('');
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan target planning');
    } finally {
      setSavingTarget(false);
    }
  }, [editingTargetId, indicators, loadWorkspace, selectedAssignment, targetForm]);

  const handleEditTarget = useCallback((target: PerformancePlanningTarget) => {
    setEditingTargetId(target.id);
  }, []);

  const handleDeleteTarget = useCallback(async (target: PerformancePlanningTarget) => {
    if (!selectedAssignment) return;
    if (!window.confirm(`Hapus target ${target.name}?`)) {
      return;
    }

    setSavingTarget(true);
    try {
      await performanceService.deletePlanningTarget(target.id);
      toast.success('Target berhasil dihapus');
      if (editingTargetId === target.id) {
        setEditingTargetId('');
        resetTargetForm(setTargetForm);
      }
      await loadWorkspace(selectedAssignment.periodId);
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menghapus target');
    } finally {
      setSavingTarget(false);
    }
  }, [editingTargetId, loadWorkspace, selectedAssignment]);

  const handlePublishPlanning = useCallback(async () => {
    if (!selectedPeriodId) {
      toast.error('Pilih period terlebih dahulu');
      return;
    }

    setPublishing(true);
    try {
      const data = await performanceService.publishPlanning(selectedPeriodId);
      setWorkspace(data);
      toast.success('Planning period berhasil dipublish');
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal publish planning');
    } finally {
      setPublishing(false);
    }
  }, [selectedPeriodId]);

  const handleComponentChange = useCallback((componentId: string) => {
    const component = workspace?.methodVersion.components.find((item) => item.id === componentId);
    setTargetForm((prev) => ({
      ...prev,
      componentId,
      weight: component ? String(component.weight) : prev.weight,
    }));
  }, [workspace?.methodVersion.components]);

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div>
      <PageHeader
        title="Performance Planning"
        description="Workspace Phase 2 untuk assignment employee, reviewer matrix, target planning, dan publish preview."
        actions={(
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap()}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => void handlePublishPlanning()} disabled={publishing || !workspace}>
              <Rocket size={16} className="mr-2" />
              {publishing ? 'Publishing...' : 'Publish Planning'}
            </Button>
          </div>
        )}
      />

      <div className="rounded-xl border border-border bg-card p-5">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium">Performance Period</label>
            <Select2
              value={selectedPeriodId}
              onValueChange={setSelectedPeriodId}
              options={periodOptions}
              placeholder="Pilih period"
            />
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">Planning Published</p>
            <p className="mt-2 text-sm font-semibold">{formatDateTime(workspace?.planningPublishedAt)}</p>
          </div>
          <div className="rounded-xl border border-border bg-background px-4 py-3">
            <p className="text-xs text-muted-foreground">Validation Status</p>
            <p className="mt-2 text-sm font-semibold">
              {workspace?.planningReadiness.isReady ? 'READY TO PUBLISH' : 'NEEDS FIX'}
            </p>
          </div>
        </div>

        {workspace && (
          <div className="mt-4 grid gap-4 md:grid-cols-5">
            <StatCard label="Assignments" value={workspace.planningReadiness.metrics.assignmentCount} icon={<Users size={16} />} />
            <StatCard label="Targets" value={workspace.planningReadiness.metrics.targetCount} icon={<Target size={16} />} />
            <StatCard label="Required Components" value={workspace.planningReadiness.metrics.requiredComponentCount} icon={<ClipboardCheck size={16} />} />
            <StatCard label="Configured Weight" value={`${workspace.planningReadiness.metrics.configuredTotalWeight}%`} icon={<Target size={16} />} />
            <StatCard label="Weight Mode" value={workspace.planningReadiness.metrics.weightMode} icon={<ClipboardCheck size={16} />} />
          </div>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Assignment Builder</h3>
              <p className="text-xs text-muted-foreground">Tambah employee ke planning period dan set reviewer awal.</p>
            </div>
            <div className="space-y-3">
              <Select2
                value={assignmentForm.employeeId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, employeeId: value }))}
                options={employeeOptions}
                placeholder="Pilih employee"
              />
              <Select2
                value={assignmentForm.reviewerId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, reviewerId: value }))}
                options={[{ value: '', label: 'Tanpa reviewer' }, ...employeeOptions]}
                placeholder="Pilih reviewer"
              />
              <Select2
                value={assignmentForm.approverId || ''}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, approverId: value }))}
                options={[{ value: '', label: 'Tanpa approver' }, ...employeeOptions]}
                placeholder="Pilih approver"
              />
              <Select2
                value={assignmentForm.assignmentSource || 'MANUAL'}
                onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, assignmentSource: value as PerformancePlanningAssignmentPayload['assignmentSource'] }))}
                options={ASSIGNMENT_SOURCE_OPTIONS.map((value) => ({ value, label: value }))}
                placeholder="Pilih source"
              />
              <Button size="sm" className="w-full" onClick={() => void handleCreateAssignment()} disabled={savingAssignment || !selectedPeriodId}>
                <Plus size={16} className="mr-2" />
                {savingAssignment ? 'Menyimpan...' : 'Tambah Assignment'}
              </Button>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Assignment List</h3>
                <p className="text-xs text-muted-foreground">Pilih employee untuk edit target dan reviewer matrix.</p>
              </div>
              <span className="text-xs text-muted-foreground">{workspace?.planningAssignments.length || 0} item</span>
            </div>
            <div className="space-y-3">
              {workspaceLoading ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Loading workspace...
                </div>
              ) : !workspace?.planningAssignments.length ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                  Belum ada assignment pada period ini.
                </div>
              ) : (
                workspace.planningAssignments.map((assignment) => (
                  <button
                    key={assignment.id}
                    type="button"
                    onClick={() => setSelectedAssignmentId(assignment.id)}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                      assignment.id === selectedAssignmentId
                        ? 'border-primary bg-primary/5'
                        : 'border-border bg-background hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{assignment.employee.fullName}</p>
                        <p className="text-xs text-muted-foreground">{assignment.employee.employeeNumber}</p>
                      </div>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ASSIGNMENT_STATUS_STYLES[assignment.status] || ASSIGNMENT_STATUS_STYLES.DRAFT}`}>
                        {assignment.status}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                      <p>Reviewer: {assignment.reviewer?.fullName || '-'}</p>
                      <p>Approver: {assignment.approver?.fullName || '-'}</p>
                      <p>Targets: {assignment.targets.length}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Validation Summary</h3>
                <p className="text-xs text-muted-foreground">Preview kesiapan planning sebelum publish.</p>
              </div>
              {workspace?.planningReadiness.isReady ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
                  Ready
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400">
                  Needs Fix
                </span>
              )}
            </div>
            {!workspace ? (
              <p className="text-sm text-muted-foreground">Pilih period untuk membuka planning workspace.</p>
            ) : workspace.planningReadiness.isReady ? (
              <p className="text-sm text-emerald-700 dark:text-emerald-400">
                Planning sudah lengkap. Assignment, reviewer matrix, dan target siap dikunci.
              </p>
            ) : (
              <ul className="space-y-2 text-sm text-amber-700 dark:text-amber-300">
                {workspace.planningReadiness.issues.map((issue) => (
                  <li key={issue}>- {issue}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Reviewer Matrix</h3>
                <p className="text-xs text-muted-foreground">Atur reviewer dan approver untuk assignment terpilih.</p>
              </div>
              {selectedAssignment && (
                <Button size="sm" variant="outline" onClick={() => void handleDeleteAssignment(selectedAssignment)} disabled={savingAssignment}>
                  <Trash2 size={14} className="mr-2" />
                  Hapus
                </Button>
              )}
            </div>
            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">Pilih assignment dari panel kiri.</p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="text-sm font-semibold">{selectedAssignment.employee.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedAssignment.employee.employeeNumber} • {selectedAssignment.employee.department?.name || 'Tanpa department'} • {selectedAssignment.employee.position?.name || 'Tanpa position'}
                  </p>
                </div>
                <div className="grid gap-3 lg:grid-cols-3">
                  <Select2
                    value={assignmentEditForm.reviewerId}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, reviewerId: value }))}
                    options={[{ value: '', label: 'Tanpa reviewer' }, ...employeeOptions]}
                    placeholder="Pilih reviewer"
                  />
                  <Select2
                    value={assignmentEditForm.approverId}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, approverId: value }))}
                    options={[{ value: '', label: 'Tanpa approver' }, ...employeeOptions]}
                    placeholder="Pilih approver"
                  />
                  <Select2
                    value={assignmentEditForm.assignmentSource}
                    onValueChange={(value) => setAssignmentEditForm((prev) => ({ ...prev, assignmentSource: value as typeof prev.assignmentSource }))}
                    options={ASSIGNMENT_SOURCE_OPTIONS.map((value) => ({ value, label: value }))}
                    placeholder="Source"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleSaveReviewerMatrix()} disabled={savingAssignment}>
                    {savingAssignment ? 'Menyimpan...' : 'Simpan Matrix'}
                  </Button>
                </div>
                <div className="rounded-xl border border-dashed border-border p-4">
                  <p className="text-sm font-medium">Reassignment Flow</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Gunakan saat manager/reviewer berubah setelah planning pernah dipublish.
                  </p>
                  <Input
                    className="mt-3"
                    value={reassignReason}
                    onChange={(event) => setReassignReason(event.target.value)}
                    placeholder="Contoh: manager pindah branch per 1 Agustus"
                  />
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void handleReassign()} disabled={savingAssignment}>
                    Proses Reassign
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4">
              <h3 className="text-sm font-semibold">Target Assignment</h3>
              <p className="text-xs text-muted-foreground">Assign component, indicator, target, reviewer, dan approver per employee.</p>
            </div>
            {!selectedAssignment ? (
              <p className="text-sm text-muted-foreground">Pilih assignment untuk mengatur target.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid gap-3 lg:grid-cols-2">
                  <Select2 value={targetForm.componentId} onValueChange={handleComponentChange} options={componentOptions} placeholder="Pilih component" />
                  <Select2 value={targetForm.indicatorId} onValueChange={(value) => setTargetForm((prev) => ({ ...prev, indicatorId: value }))} options={indicatorOptions} placeholder="Pilih indicator" />
                  <Input value={targetForm.name} onChange={(event) => setTargetForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Nama target (opsional)" />
                  <Input value={targetForm.weight} onChange={(event) => setTargetForm((prev) => ({ ...prev, weight: event.target.value }))} placeholder="Weight target" type="number" min={0} max={100} />
                  <Input value={targetForm.targetValue} onChange={(event) => setTargetForm((prev) => ({ ...prev, targetValue: event.target.value }))} placeholder="Target numeric" type="number" />
                  <Input value={targetForm.targetText} onChange={(event) => setTargetForm((prev) => ({ ...prev, targetText: event.target.value }))} placeholder="Target text / qualitative" />
                  <Select2
                    value={targetForm.reviewerId}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, reviewerId: value }))}
                    options={[{ value: '', label: 'Gunakan reviewer assignment' }, ...employeeOptions]}
                    placeholder="Override reviewer"
                  />
                  <Select2
                    value={targetForm.approverId}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, approverId: value }))}
                    options={[{ value: '', label: 'Gunakan approver assignment' }, ...employeeOptions]}
                    placeholder="Override approver"
                  />
                  <Select2
                    value={targetForm.frequency || 'ONCE'}
                    onValueChange={(value) => setTargetForm((prev) => ({ ...prev, frequency: value as PerformancePlanningTargetPayload['frequency'] }))}
                    options={FREQUENCY_OPTIONS.map((value) => ({ value, label: value }))}
                    placeholder="Pilih frequency"
                  />
                  <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      checked={targetForm.evidenceRequired}
                      onChange={(event) => setTargetForm((prev) => ({ ...prev, evidenceRequired: event.target.checked }))}
                    />
                    Evidence required
                  </label>
                </div>
                <Input value={targetForm.description} onChange={(event) => setTargetForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Deskripsi target" />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => void handleSaveTarget()} disabled={savingTarget}>
                    {savingTarget ? 'Menyimpan...' : editingTargetId ? 'Simpan Perubahan Target' : 'Tambah Target'}
                  </Button>
                  {editingTargetId && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingTargetId('');
                        resetTargetForm(setTargetForm);
                      }}
                    >
                      Batal Edit
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedAssignment.targets.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                      Belum ada target untuk assignment ini.
                    </div>
                  ) : (
                    selectedAssignment.targets.map((target) => (
                      <div key={target.id} className="rounded-xl border border-border bg-background p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold">{target.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {target.component?.name || 'Tanpa component'} • {target.indicator?.name || 'Tanpa indicator'}
                            </p>
                          </div>
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ASSIGNMENT_STATUS_STYLES[target.status] || ASSIGNMENT_STATUS_STYLES.DRAFT}`}>
                            {target.status}
                          </span>
                        </div>
                        <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                          <p>Weight: {target.weight}% • Frequency: {target.frequency}</p>
                          <p>Target: {target.targetValue ?? target.targetText ?? '-'}</p>
                          <p>Reviewer: {target.reviewer?.fullName || selectedAssignment.reviewer?.fullName || '-'}</p>
                          <p>Approver: {target.approver?.fullName || selectedAssignment.approver?.fullName || '-'}</p>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleEditTarget(target)}>
                            Edit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleDeleteTarget(target)}>
                            Hapus
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
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

function resetTargetForm(
  setter: React.Dispatch<React.SetStateAction<{
    componentId: string;
    indicatorId: string;
    reviewerId: string;
    approverId: string;
    name: string;
    description: string;
    targetValue: string;
    targetText: string;
    weight: string;
    frequency: PerformancePlanningTargetPayload['frequency'];
    evidenceRequired: boolean;
  }>>
) {
  setter({
    componentId: '',
    indicatorId: '',
    reviewerId: '',
    approverId: '',
    name: '',
    description: '',
    targetValue: '',
    targetText: '',
    weight: '',
    frequency: 'ONCE',
    evidenceRequired: false,
  });
}

function awaitableEmptyIndicators() {
  return [] as Awaited<ReturnType<typeof performanceService.getIndicators>>;
}
