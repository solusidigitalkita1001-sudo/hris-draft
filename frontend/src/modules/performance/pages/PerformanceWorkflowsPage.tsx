import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  performanceService,
  type PerformanceWorkflowTemplate,
  type PerformanceWorkflowTemplatePayload,
  type PerformanceWorkflowStage,
  type PerformanceWorkflowRule,
} from '@/services/performance.service';
import { useCompanyStore } from '@/stores/company.store';
import { GitBranch, Plus, RefreshCw, ShieldCheck, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const APPROVER_TYPE_OPTIONS = ['ROLE', 'USER', 'AUTO'] as const;
const RULE_OPERATOR_OPTIONS = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS'] as const;

function createEmptyRule(): PerformanceWorkflowRule {
  return {
    field: '',
    operator: 'EQ',
    value: '',
  };
}

function createEmptyStage(level: number): PerformanceWorkflowStage {
  return {
    name: '',
    level,
    approverType: 'ROLE',
    approverRoleCode: '',
    approverId: '',
    backupApproverRoleCode: '',
    backupApproverId: '',
    slaHours: 72,
    allowEscalation: true,
    conditionRules: [],
  };
}

function buildInitialWorkflowForm() {
  return {
    name: '',
    description: '',
    isActive: true,
    stages: [createEmptyStage(1)],
  };
}

type WorkflowMode = 'review' | 'approval';

export function PerformanceWorkflowsPage() {
  const { activeCompany } = useCompanyStore();
  const companyId = activeCompany?.id || '';

  const [reviewWorkflows, setReviewWorkflows] = useState<PerformanceWorkflowTemplate[]>([]);
  const [approvalWorkflows, setApprovalWorkflows] = useState<PerformanceWorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingMode, setSavingMode] = useState<WorkflowMode | ''>('');
  const [reviewForm, setReviewForm] = useState(buildInitialWorkflowForm);
  const [approvalForm, setApprovalForm] = useState(buildInitialWorkflowForm);

  const loadData = useCallback(async () => {
    if (!companyId) {
      setReviewWorkflows([]);
      setApprovalWorkflows([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [reviewData, approvalData] = await Promise.all([
        performanceService.getReviewWorkflows(companyId),
        performanceService.getApprovalWorkflows(companyId),
      ]);
      setReviewWorkflows(reviewData);
      setApprovalWorkflows(approvalData);
    } catch (error) {
      console.error(error);
      toast.error('Gagal memuat workflow templates');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const updateStage = (
    mode: WorkflowMode,
    stageIndex: number,
    field: keyof PerformanceWorkflowStage,
    value: string | number | boolean | PerformanceWorkflowRule[]
  ) => {
    const setter = mode === 'review' ? setReviewForm : setApprovalForm;
    setter((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) =>
        index === stageIndex ? { ...stage, [field]: value } : stage
      ),
    }));
  };

  const updateRule = (mode: WorkflowMode, stageIndex: number, ruleIndex: number, field: keyof PerformanceWorkflowRule, value: string) => {
    const setter = mode === 'review' ? setReviewForm : setApprovalForm;
    setter((prev) => ({
      ...prev,
      stages: prev.stages.map((stage, index) =>
        index === stageIndex
          ? {
              ...stage,
              conditionRules: stage.conditionRules.map((rule, currentRuleIndex) =>
                currentRuleIndex === ruleIndex ? { ...rule, [field]: value } : rule
              ),
            }
          : stage
      ),
    }));
  };

  const handleCreateWorkflow = useCallback(async (mode: WorkflowMode) => {
    if (!companyId) {
      toast.error('Company belum aktif');
      return;
    }

    const form = mode === 'review' ? reviewForm : approvalForm;
    if (!form.name.trim()) {
      toast.error('Nama workflow wajib diisi');
      return;
    }

    if (form.stages.some((stage) => !stage.name.trim())) {
      toast.error('Semua workflow stage wajib punya nama');
      return;
    }

    setSavingMode(mode);
    try {
      const payload: PerformanceWorkflowTemplatePayload = {
        companyId,
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        isActive: form.isActive,
        stages: form.stages.map((stage, index) => ({
          ...stage,
          name: stage.name.trim(),
          level: Number(stage.level || index + 1),
          approverRoleCode: stage.approverRoleCode?.trim() || undefined,
          approverId: stage.approverId?.trim() || undefined,
          backupApproverRoleCode: stage.backupApproverRoleCode?.trim() || undefined,
          backupApproverId: stage.backupApproverId?.trim() || undefined,
          conditionRules: stage.conditionRules
            .filter((rule) => rule.field.trim() && rule.value.trim())
            .map((rule) => ({
              field: rule.field.trim(),
              operator: rule.operator,
              value: rule.value.trim(),
            })),
        })),
      };

      if (mode === 'review') {
        await performanceService.createReviewWorkflow(payload);
        setReviewForm(buildInitialWorkflowForm());
        toast.success('Review workflow template berhasil dibuat');
      } else {
        await performanceService.createApprovalWorkflow(payload);
        setApprovalForm(buildInitialWorkflowForm());
        toast.success('Approval workflow template berhasil dibuat');
      }

      await loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.response?.data?.message || 'Gagal menyimpan workflow template');
    } finally {
      setSavingMode('');
    }
  }, [approvalForm, companyId, loadData, reviewForm]);

  const renderWorkflowSection = (
    title: string,
    mode: WorkflowMode,
    workflows: PerformanceWorkflowTemplate[],
    form: typeof reviewForm,
    setForm: typeof setReviewForm
  ) => (
    <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center gap-2">
          {mode === 'review' ? <GitBranch size={16} /> : <ShieldCheck size={16} />}
          <h2 className="text-sm font-semibold">New {title}</h2>
        </div>

        <div className="space-y-3">
          <Input
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder={mode === 'review' ? 'Annual Review Flow' : 'Final Approval Flow'}
          />
          <textarea
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            placeholder="Deskripsi singkat workflow template."
          />
          <label className="flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
            />
            Active
          </label>

          <div className="space-y-4">
            {form.stages.map((stage, stageIndex) => (
              <div key={`${mode}-stage-${stageIndex}`} className="rounded-xl border border-border p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold">Stage {stageIndex + 1}</p>
                  {form.stages.length > 1 && (
                    <button
                      type="button"
                      className="text-xs text-destructive"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          stages: prev.stages.filter((_, index) => index !== stageIndex).map((item, index) => ({
                            ...item,
                            level: index + 1,
                          })),
                        }))
                      }
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    value={stage.name}
                    onChange={(e) => updateStage(mode, stageIndex, 'name', e.target.value)}
                    placeholder="Manager Review"
                  />
                  <Input
                    type="number"
                    value={stage.level}
                    onChange={(e) => updateStage(mode, stageIndex, 'level', Number(e.target.value || stageIndex + 1))}
                    placeholder="1"
                  />
                  <Select2
                    value={stage.approverType}
                    onValueChange={(value) => updateStage(mode, stageIndex, 'approverType', value)}
                    options={APPROVER_TYPE_OPTIONS.map((value) => ({ value, label: value }))}
                    placeholder="Approver type"
                  />
                  <Input
                    value={stage.approverRoleCode || ''}
                    onChange={(e) => updateStage(mode, stageIndex, 'approverRoleCode', e.target.value)}
                    placeholder="Approver role code"
                  />
                  <Input
                    value={stage.approverId || ''}
                    onChange={(e) => updateStage(mode, stageIndex, 'approverId', e.target.value)}
                    placeholder="Approver user id"
                  />
                  <Input
                    type="number"
                    value={stage.slaHours}
                    onChange={(e) => updateStage(mode, stageIndex, 'slaHours', Number(e.target.value || 72))}
                    placeholder="72"
                  />
                </div>

                <label className="mt-3 flex items-center gap-2 rounded-lg border border-border px-3 py-3 text-sm">
                  <input
                    type="checkbox"
                    checked={stage.allowEscalation}
                    onChange={(e) => updateStage(mode, stageIndex, 'allowEscalation', e.target.checked)}
                  />
                  Allow escalation
                </label>

                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-muted-foreground">Condition Rules</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setForm((prev) => ({
                          ...prev,
                          stages: prev.stages.map((item, index) =>
                            index === stageIndex
                              ? { ...item, conditionRules: [...item.conditionRules, createEmptyRule()] }
                              : item
                          ),
                        }))
                      }
                    >
                      <Plus size={14} className="mr-2" />
                      Rule
                    </Button>
                  </div>

                  {stage.conditionRules.map((rule, ruleIndex) => (
                    <div key={`${mode}-stage-${stageIndex}-rule-${ruleIndex}`} className="rounded-lg border border-dashed border-border p-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Input
                          value={rule.field}
                          onChange={(e) => updateRule(mode, stageIndex, ruleIndex, 'field', e.target.value)}
                          placeholder="field"
                        />
                        <Select2
                          value={rule.operator}
                          onValueChange={(value) => updateRule(mode, stageIndex, ruleIndex, 'operator', value)}
                          options={RULE_OPERATOR_OPTIONS.map((value) => ({ value, label: value }))}
                          placeholder="Operator"
                        />
                        <Input
                          value={rule.value}
                          onChange={(e) => updateRule(mode, stageIndex, ruleIndex, 'value', e.target.value)}
                          placeholder="value"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setForm((prev) => ({
                ...prev,
                stages: [...prev.stages, createEmptyStage(prev.stages.length + 1)],
              }))
            }
          >
            <Plus size={14} className="mr-2" />
            Tambah Stage
          </Button>

          <Button size="sm" className="w-full" onClick={() => void handleCreateWorkflow(mode)} disabled={savingMode === mode}>
            {savingMode === mode ? 'Menyimpan...' : `Buat ${title}`}
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h2 className="mb-4 text-sm font-semibold">{title} List</h2>
        <div className="space-y-3">
          {workflows.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">Belum ada {title.toLowerCase()}.</div>
          ) : (
            workflows.map((workflow) => (
              <div key={workflow.id} className="rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{workflow.name}</p>
                    <p className="text-xs text-muted-foreground">{workflow.approvalType}</p>
                  </div>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {workflow.isActive ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {workflow.description || 'Belum ada deskripsi workflow.'}
                </p>
                <div className="mt-3 space-y-2">
                  {workflow.stages.map((stage) => (
                    <div key={stage.id || `${workflow.id}-${stage.level}`} className="rounded-lg bg-muted/50 px-3 py-2">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{stage.level}. {stage.name}</p>
                        <span className="text-xs text-muted-foreground">{stage.approverType}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {stage.approverRoleCode || stage.approverId || 'Auto step'} • SLA {stage.slaHours} jam
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Performance Workflows"
        description="Kelola workflow template review dan approval untuk method version Performance Management."
        actions={(
          <Button size="sm" variant="outline" onClick={loadData}>
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </Button>
        )}
      />

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Review Workflows</p>
          <p className="mt-2 text-2xl font-semibold">{reviewWorkflows.length}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Approval Workflows</p>
          <p className="mt-2 text-2xl font-semibold">{approvalWorkflows.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading...</div>
      ) : (
        <div className="space-y-6">
          {renderWorkflowSection('Review Workflow', 'review', reviewWorkflows, reviewForm, setReviewForm)}
          {renderWorkflowSection('Approval Workflow', 'approval', approvalWorkflows, approvalForm, setApprovalForm)}
        </div>
      )}
    </div>
  );
}
