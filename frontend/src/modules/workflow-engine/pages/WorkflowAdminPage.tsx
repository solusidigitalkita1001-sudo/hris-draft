import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  ArrowUpCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  GitBranch,
  Plus,
  RefreshCw,
  Settings2,
  ShieldCheck,
  Trash2,
  XCircle,
  X as CloseIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useAuthStore } from '@/stores/auth.store';
import {
  workflowService,
  type BulkApprovalResult,
  type WorkflowApproverType,
  type WorkflowConditionRule,
  type WorkflowOperator,
  type WorkflowStageInput,
  type WorkflowTemplate,
} from '@/services/workflow.service';
import { workflowEngineService, type WorkflowActionType } from '@/services/workflow-engine.service';

const APPROVAL_TYPES = [
  'LEAVE_REQUEST',
  'LOAN_REQUEST',
  'BUSINESS_TRIP',
  'EXPENSE_CLAIM',
  'SHIFT_SWAP',
  'OVERTIME_REQUEST',
];

const RESOURCES = ['leave', 'employee-loan', 'travel', 'work-calendar', 'attendance'];

const ROLE_OPTIONS = [
  'SUPER_ADMIN',
  'GROUP_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
  'HR_STAFF',
  'MANAGER',
  'EMPLOYEE',
  'OPSL',
  'FINANCE_MANAGER',
];

const OPERATORS: WorkflowOperator[] = ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS'];

function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-4xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-xl border border-border bg-background shadow-xl`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  open,
  title,
  message,
  onClose,
  onConfirm,
  confirmText = 'Hapus',
  confirmVariant = 'danger',
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
  confirmText?: string;
  confirmVariant?: 'danger' | 'primary' | 'default';
}) {
  if (!open) return null;
  const confirmClass =
    confirmVariant === 'danger'
      ? 'bg-red-600 hover:bg-red-700'
      : confirmVariant === 'primary'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : '';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="p-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" className={confirmClass} onClick={onConfirm}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CommentPrompt({
  open,
  onClose,
  onSubmit,
  title,
  submitText,
  intent = 'default',
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (comment?: string) => void;
  title: string;
  submitText: string;
  intent?: 'default' | 'destructive' | 'success';
}) {
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setComment('');
      setSubmitting(false);
    }
  }, [open]);

  if (!open) return null;
  const btnClass =
    intent === 'destructive'
      ? 'bg-red-600 hover:bg-red-700'
      : intent === 'success'
        ? 'bg-emerald-600 hover:bg-emerald-700'
        : '';

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(comment.trim() || undefined);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="p-5">
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
            Komentar (opsional)
          </label>
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Tambahkan komentar..."
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            Batal
          </Button>
          <Button size="sm" className={btnClass} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Memproses...' : submitText}
          </Button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: 'neutral' | 'warning' | 'success' | 'danger' }) {
  const toneClass =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'danger'
        ? 'border-red-200 bg-red-50 text-red-700'
        : tone === 'warning'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>
      {label}
    </span>
  );
}

function emptyStage(level: number): WorkflowStageInput {
  return {
    name: `Stage ${level}`,
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

function emptyRule(): WorkflowConditionRule {
  return { field: '', operator: 'EQ', value: '' };
}

function TemplateForm({
  initial,
  companyId,
  onClose,
  onSaved,
}: {
  initial?: WorkflowTemplate | null;
  companyId: string;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name || '');
  const [approvalType, setApprovalType] = useState(initial?.approvalType || '');
  const [resource, setResource] = useState(initial?.resource || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [stages, setStages] = useState<WorkflowStageInput[]>(
    initial?.stages?.map((s) => ({ ...s, conditionRules: s.conditionRules || [] })) || [emptyStage(1)]
  );
  const [saving, setSaving] = useState(false);

  const addStage = () => setStages((p) => [...p, emptyStage(p.length + 1)]);

  const updateStage = <K extends keyof WorkflowStageInput>(idx: number, key: K, value: WorkflowStageInput[K]) =>
    setStages((p) => p.map((s, i) => (i === idx ? { ...s, [key]: value } : s)));

  const moveStage = (idx: number, dir: -1 | 1) => {
    setStages((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, level: i + 1 }));
    });
  };

  const removeStage = (idx: number) =>
    setStages((p) =>
      p
        .filter((_, i) => i !== idx)
        .map((s, i) => ({ ...s, level: i + 1 }))
    );

  const addRule = (stageIdx: number) =>
    setStages((p) =>
      p.map((s, i) =>
        i === stageIdx ? { ...s, conditionRules: [...(s.conditionRules || []), emptyRule()] } : s
      )
    );

  const updateRule = <K extends keyof WorkflowConditionRule>(
    sIdx: number,
    rIdx: number,
    key: K,
    value: WorkflowConditionRule[K]
  ) =>
    setStages((p) =>
      p.map((s, i) =>
        i === sIdx
          ? {
              ...s,
              conditionRules: (s.conditionRules || []).map((r, j) => (j === rIdx ? { ...r, [key]: value } : r)),
            }
          : s
      )
    );

  const removeRule = (sIdx: number, rIdx: number) =>
    setStages((p) =>
      p.map((s, i) =>
        i === sIdx
          ? { ...s, conditionRules: (s.conditionRules || []).filter((_, j) => j !== rIdx) }
          : s
      )
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) {
      toast.error('companyId tidak tersedia');
      return;
    }
    if (!name.trim() || !approvalType.trim()) {
      toast.error('Nama dan Approval Type wajib diisi');
      return;
    }
    if (stages.length === 0) {
      toast.error('Minimal 1 stage diperlukan');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        companyId,
        name: name.trim(),
        approvalType: approvalType.trim(),
        resource: resource || undefined,
        description: description || undefined,
        isActive,
        stages: stages.map((s, idx) => ({
          ...s,
          level: idx + 1,
          approverRoleCode: s.approverRoleCode || undefined,
          approverId: s.approverId || undefined,
          backupApproverRoleCode: s.backupApproverRoleCode || undefined,
          backupApproverId: s.backupApproverId || undefined,
          conditionRules: (s.conditionRules || []).filter((r) => r.field && r.value),
        })),
      };
      if (initial?.id) {
        await workflowService.updateTemplate(initial.id, payload);
        toast.success('Template workflow diperbarui');
      } else {
        await workflowService.createTemplate(payload);
        toast.success('Template workflow dibuat');
      }
      await onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menyimpan template');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nama Template *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approval Type *</label>
          <Select2
            value={approvalType}
            onValueChange={setApprovalType}
            options={APPROVAL_TYPES.map((v) => ({ value: v, label: v })).concat([
              { value: '__custom__', label: 'Other (custom)' },
            ])}
            placeholder="Pilih approval type"
            render={
              approvalType && !APPROVAL_TYPES.includes(approvalType) ? (
                <input
                  value={approvalType}
                  onChange={(e) => setApprovalType(e.target.value.toUpperCase())}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  placeholder="Ketik custom approval type"
                />
              ) : undefined
            }
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Resource</label>
          <Select2
            value={resource || ''}
            onValueChange={setResource}
            options={RESOURCES.map((v) => ({ value: v, label: v }))}
            placeholder="Pilih resource"
            allowClear
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            Template aktif
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Deskripsi</label>
        <textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Approval Stages</h3>
          <Button type="button" size="sm" variant="outline" onClick={addStage}>
            <Plus size={14} className="mr-1.5" /> Tambah Stage
          </Button>
        </div>

        {stages.map((stage, sIdx) => (
          <div key={`${sIdx}-${stage.level}`} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold">
                Stage {sIdx + 1} &middot; L{stage.level}
              </h4>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => moveStage(sIdx, -1)}
                  disabled={sIdx === 0}
                >
                  <ChevronUp size={14} />
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => moveStage(sIdx, 1)}
                  disabled={sIdx === stages.length - 1}
                >
                  <ChevronDown size={14} />
                </Button>
                {stages.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeStage(sIdx)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Hapus Stage
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nama Stage *</label>
                <Input
                  value={stage.name}
                  onChange={(e) => updateStage(sIdx, 'name', e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approver Type *</label>
                <Select2
                  value={stage.approverType}
                  onValueChange={(v) => updateStage(sIdx, 'approverType', v as WorkflowApproverType)}
                  options={[
                    { value: 'ROLE', label: 'Role' },
                    { value: 'USER', label: 'User' },
                    { value: 'AUTO', label: 'Auto' },
                  ]}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Approver Role Code
                </label>
                <Select2
                  value={stage.approverRoleCode || ''}
                  onValueChange={(v) => updateStage(sIdx, 'approverRoleCode', v)}
                  options={ROLE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Pilih role"
                  allowClear
                  disabled={stage.approverType === 'AUTO' || stage.approverType === 'USER'}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Approver User ID
                </label>
                <Input
                  value={stage.approverId || ''}
                  onChange={(e) => updateStage(sIdx, 'approverId', e.target.value)}
                  placeholder="UUID karyawan"
                  disabled={stage.approverType === 'AUTO' || stage.approverType === 'ROLE'}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Backup Role Code
                </label>
                <Select2
                  value={stage.backupApproverRoleCode || ''}
                  onValueChange={(v) => updateStage(sIdx, 'backupApproverRoleCode', v)}
                  options={ROLE_OPTIONS.map((v) => ({ value: v, label: v }))}
                  placeholder="Pilih backup role"
                  allowClear
                  disabled={stage.approverType === 'AUTO'}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  Backup User ID
                </label>
                <Input
                  value={stage.backupApproverId || ''}
                  onChange={(e) => updateStage(sIdx, 'backupApproverId', e.target.value)}
                  placeholder="UUID karyawan backup"
                  disabled={stage.approverType === 'AUTO'}
                />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">SLA Hours *</label>
                <Input
                  type="number"
                  min={1}
                  value={stage.slaHours}
                  onChange={(e) => updateStage(sIdx, 'slaHours', Number(e.target.value))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stage.allowEscalation}
                    onChange={(e) => updateStage(sIdx, 'allowEscalation', e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                  Izinkan Eskalasi
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-muted/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h5 className="text-sm font-semibold">Condition Rules</h5>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => addRule(sIdx)}
                >
                  <Plus size={14} className="mr-1.5" /> Tambah Rule
                </Button>
              </div>
              <div className="space-y-3">
                {(stage.conditionRules || []).map((rule, rIdx) => (
                  <div
                    key={`${sIdx}-${rIdx}`}
                    className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-4"
                  >
                    <Input
                      value={rule.field}
                      onChange={(e) => updateRule(sIdx, rIdx, 'field', e.target.value)}
                      placeholder="field (mis. totalDays, amount)"
                    />
                    <Select2
                      value={rule.operator}
                      onValueChange={(v) => updateRule(sIdx, rIdx, 'operator', v as WorkflowOperator)}
                      options={OPERATORS.map((op) => ({ value: op, label: op }))}
                    />
                    <Input
                      value={rule.value}
                      onChange={(e) => updateRule(sIdx, rIdx, 'value', e.target.value)}
                      placeholder="value"
                    />
                    <Button type="button" variant="outline" onClick={() => removeRule(sIdx, rIdx)}>
                      Hapus
                    </Button>
                  </div>
                ))}
                {!stage.conditionRules?.length && (
                  <p className="text-sm text-muted-foreground">
                    Stage ini selalu aktif jika tidak ada condition rule.
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Menyimpan...' : 'Simpan Template'}
        </Button>
      </div>
    </form>
  );
}

function getReferenceLink(referenceType: string, referenceId: string) {
  switch (referenceType) {
    case 'LEAVE_REQUEST':
      return `/leave/${referenceId}`;
    case 'LOAN_REQUEST':
      return `/employee-loans/${referenceId}`;
    case 'BUSINESS_TRIP':
      return `/travel-expenses?trip=${referenceId}`;
    case 'EXPENSE_CLAIM':
      return `/travel-expenses?claim=${referenceId}`;
    case 'SHIFT_SWAP_REQUEST':
      return `/work-calendar?shiftSwap=${referenceId}`;
    case 'OVERTIME_REQUEST':
      return `/attendance?overtime=${referenceId}`;
    default:
      return null;
  }
}

export function WorkflowAdminPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const companyId = user?.companyId || localStorage.getItem('companyId') || '';

  const [activeTab, setActiveTab] = useState<'templates' | 'approvals'>('templates');

  // Tab 1 - Templates state
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [filterApprovalType, setFilterApprovalType] = useState('');
  const [filterResource, setFilterResource] = useState('');
  const [filterIsActive, setFilterIsActive] = useState<'' | 'true' | 'false'>('');
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WorkflowTemplate | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(true);

  // Tab 2 - My Approvals state
  const [approvals, setApprovals] = useState<any[]>([]);
  const [approvalsLoading, setApprovalsLoading] = useState(true);
  const [filterApprovalType2, setFilterApprovalType2] = useState('');
  const [filterStatus, setFilterStatus] = useState('PENDING');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk + individual actions dialog state
  const [bulkAction, setBulkAction] = useState<null | 'APPROVE' | 'REJECT'>(null);
  const [individualAction, setIndividualAction] = useState<{
    instanceId: string;
    action: WorkflowActionType;
  } | null>(null);

  const loadTemplates = useCallback(async () => {
    if (!companyId) return;
    setTemplatesLoading(true);
    try {
      const filters: { approvalType?: string; resource?: string; isActive?: boolean } = {};
      if (filterApprovalType) filters.approvalType = filterApprovalType;
      if (filterResource) filters.resource = filterResource;
      if (filterIsActive !== '') filters.isActive = filterIsActive === 'true';
      const data = await workflowService.listTemplates(companyId, filters);
      setTemplates(data);
    } catch {
      toast.error('Gagal memuat workflow templates');
    } finally {
      setTemplatesLoading(false);
    }
  }, [companyId, filterApprovalType, filterResource, filterIsActive]);

  const loadApprovals = useCallback(async () => {
    if (!companyId) return;
    setApprovalsLoading(true);
    try {
      const data = await workflowService.getMyApprovals(companyId);
      setApprovals(data);
    } catch {
      toast.error('Gagal memuat approvals');
    } finally {
      setApprovalsLoading(false);
    }
  }, [companyId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTemplates(), loadApprovals()]);
  }, [loadTemplates, loadApprovals]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  useEffect(() => {
    loadApprovals();
  }, [loadApprovals]);

  useEffect(() => {
    setSelectedIds([]);
  }, [activeTab, approvals]);

  // ----- Templates actions -----
  const handleDuplicate = async (tpl: WorkflowTemplate) => {
    try {
      const payload = {
        companyId,
        name: `${tpl.name} (Copy)`,
        approvalType: tpl.approvalType,
        resource: tpl.resource || undefined,
        description: tpl.description || undefined,
        isActive: false,
        stages: tpl.stages.map((s) => ({
          ...s,
          approverRoleCode: s.approverRoleCode || undefined,
          approverId: s.approverId || undefined,
          backupApproverRoleCode: s.backupApproverRoleCode || undefined,
          backupApproverId: s.backupApproverId || undefined,
          conditionRules: s.conditionRules || [],
        })),
      };
      await workflowService.createTemplate(payload);
      toast.success('Template berhasil diduplikasi');
      await loadTemplates();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menduplikasi template');
    }
  };

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      await workflowService.deleteTemplate(deletingTemplate.id);
      toast.success('Template dihapus');
      setDeletingTemplate(null);
      await loadTemplates();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus template');
    }
  };

  // ----- Approvals actions -----
  const filteredApprovals = useMemo(() => {
    return approvals.filter((a: any) => {
      if (filterApprovalType2) {
        const at = a.instance?.approvalType || a.approvalType;
        if (at !== filterApprovalType2) return false;
      }
      if (filterStatus) {
        if ((a.status || a.instance?.status) !== filterStatus) return false;
      }
      return true;
    });
  }, [approvals, filterApprovalType2, filterStatus]);

  const toggleSelect = (instanceId: string) => {
    setSelectedIds((prev) =>
      prev.includes(instanceId) ? prev.filter((i) => i !== instanceId) : [...prev, instanceId]
    );
  };

  const toggleSelectAll = () => {
    const allIds = filteredApprovals.map((a: any) => a.instanceId || a.instance?.id);
    if (selectedIds.length >= allIds.length && allIds.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allIds);
    }
  };

  const allSelected = filteredApprovals.length > 0 && selectedIds.length === filteredApprovals.map((a: any) => a.instanceId || a.instance?.id).filter((v: string) => v).length;

  const handleBulkSubmit = async (comment?: string) => {
    if (!bulkAction || selectedIds.length === 0) return;
    try {
      const result: BulkApprovalResult = await workflowService.bulkApproval({
        instanceIds: selectedIds,
        action: bulkAction,
        comment,
      });
      const icon = bulkAction === 'APPROVE' ? '✅' : '❌';
      toast.success(
        `${icon} Bulk ${bulkAction.toLowerCase()}: ${result.successful}/${result.total} berhasil${
          result.failed > 0 ? `, ${result.failed} gagal` : ''
        }`
      );
      setSelectedIds([]);
      await loadApprovals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Bulk action gagal');
    } finally {
      setBulkAction(null);
    }
  };

  const handleIndividualSubmit = async (comment?: string) => {
    if (!individualAction) return;
    try {
      await workflowEngineService.applyAction(
        individualAction.instanceId,
        individualAction.action,
        comment
      );
      toast.success(`Aksi ${individualAction.action.toLowerCase()} berhasil`);
      await loadApprovals();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memproses aksi');
    } finally {
      setIndividualAction(null);
    }
  };

  const handleRowClick = (approval: any) => {
    const refType = approval.instance?.referenceType;
    const refId = approval.instance?.referenceId;
    const link = getReferenceLink(refType, refId);
    if (link) navigate(link);
  };

  return (
    <div>
      <PageHeader
        title="Admin Workflow Engine"
        description="Kelola approval templates (A.4) dan batch approval MyApprovals (A.5)"
        actions={
          <Button variant="outline" size="sm" onClick={refreshAll}>
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {[
          { key: 'templates', label: 'Approval Templates', icon: <GitBranch size={16} /> },
          { key: 'approvals', label: 'My Approvals', icon: <CheckCircle2 size={16} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ============ TAB 1: APPROVAL TEMPLATES ============ */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Filter bar + actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Approval Type
                  </label>
                  <Select2
                    value={filterApprovalType}
                    onValueChange={setFilterApprovalType}
                    options={APPROVAL_TYPES.map((v) => ({ value: v, label: v }))}
                    allowClear
                    placeholder="Semua type"
                  />
                </div>
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Resource
                  </label>
                  <Select2
                    value={filterResource}
                    onValueChange={setFilterResource}
                    options={RESOURCES.map((v) => ({ value: v, label: v }))}
                    allowClear
                    placeholder="Semua resource"
                  />
                </div>
                <div className="w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Is Active
                  </label>
                  <Select2
                    value={filterIsActive}
                    onValueChange={(v) => setFilterIsActive(v as any)}
                    options={[
                      { value: '', label: 'Semua' },
                      { value: 'true', label: 'Aktif' },
                      { value: 'false', label: 'Nonaktif' },
                    ]}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedTemplate(null);
                    setShowTemplateModal(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus size={16} className="mr-2" /> New Template
                </Button>
              </div>
            </div>
          </div>

          {/* Templates table-like list */}
          {templatesLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Memuat templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Belum ada workflow template.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Name</th>
                    <th className="px-4 py-3 text-left font-medium">Approval Type</th>
                    <th className="px-4 py-3 text-left font-medium">Resource</th>
                    <th className="px-4 py-3 text-left font-medium">Stages</th>
                    <th className="px-4 py-3 text-left font-medium">Is Active</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {templates.map((tpl) => (
                    <tr key={tpl.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3">
                        <div className="font-medium">{tpl.name}</div>
                        {tpl.description && (
                          <div className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {tpl.description}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge label={tpl.approvalType} tone="warning" />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tpl.resource || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                          {tpl.stages.length} stages
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge
                          label={tpl.isActive ? 'Active' : 'Inactive'}
                          tone={tpl.isActive ? 'success' : 'neutral'}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedTemplate(tpl);
                              setShowTemplateModal(true);
                            }}
                          >
                            <Settings2 size={13} className="mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDuplicate(tpl)}
                          >
                            <Copy size={13} className="mr-1" />
                            Duplicate
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setDeletingTemplate(tpl)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 size={13} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ============ TAB 2: MY APPROVALS (BULK) ============ */}
      {activeTab === 'approvals' && (
        <div className="space-y-4">
          {/* Header / Batch actions */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap gap-3">
                <div className="w-[180px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Approval Type
                  </label>
                  <Select2
                    value={filterApprovalType2}
                    onValueChange={setFilterApprovalType2}
                    options={APPROVAL_TYPES.map((v) => ({ value: v, label: v }))}
                    allowClear
                    placeholder="Semua type"
                  />
                </div>
                <div className="w-[160px]">
                  <label className="mb-1 block text-xs font-medium text-muted-foreground">
                    Status
                  </label>
                  <Select2
                    value={filterStatus}
                    onValueChange={setFilterStatus}
                    options={[
                      { value: 'PENDING', label: 'PENDING' },
                      { value: 'ESCALATED', label: 'ESCALATED' },
                      { value: '', label: 'Semua' },
                    ]}
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {selectedIds.length} dipilih
                  </span>
                )}
                <Button
                  size="sm"
                  disabled={selectedIds.length === 0}
                  onClick={() => setBulkAction('APPROVE')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={15} className="mr-1.5" />
                  Bulk Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={selectedIds.length === 0}
                  onClick={() => setBulkAction('REJECT')}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle size={15} className="mr-1.5" />
                  Bulk Reject
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedIds([])}
                  disabled={selectedIds.length === 0}
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>

          {approvalsLoading ? (
            <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Memuat approvals...
            </div>
          ) : filteredApprovals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Tidak ada approval yang menunggu aksi Anda.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="w-10 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-border"
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Request Type</th>
                    <th className="px-4 py-3 text-left font-medium">Submitted By</th>
                    <th className="px-4 py-3 text-left font-medium">Date Submitted</th>
                    <th className="px-4 py-3 text-left font-medium">Current Level</th>
                    <th className="px-4 py-3 text-left font-medium">Reference</th>
                    <th className="px-4 py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredApprovals.map((approval: any) => {
                    const instanceId = approval.instanceId || approval.instance?.id;
                    const isChecked = instanceId ? selectedIds.includes(instanceId) : false;
                    const refType = approval.instance?.referenceType;
                    const refId = approval.instance?.referenceId;
                    const refLink = getReferenceLink(refType, refId);
                    return (
                      <tr
                        key={approval.id}
                        className="cursor-pointer hover:bg-muted/30"
                        onClick={() => handleRowClick(approval)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {instanceId && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelect(instanceId)}
                              className="h-4 w-4 rounded border-border"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge
                            label={approval.instance?.approvalType || approval.approvalType || 'WORKFLOW'}
                            tone="warning"
                          />
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {approval.instance?.requesterId || '-'}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {dayjs(approval.createdAt || approval.instance?.createdAt).format(
                            'DD MMM YYYY HH:mm'
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{approval.name}</div>
                          <div className="text-xs text-muted-foreground">
                            Level {approval.level}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {refLink ? (
                            <a
                              href={refLink}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                navigate(refLink);
                              }}
                              className="text-primary hover:underline font-medium"
                            >
                              {refType} / {refId?.slice(0, 8)}...
                            </a>
                          ) : (
                            <span className="text-muted-foreground">
                              {refType || '-'} / {refId?.slice(0, 8) || '-'}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            <Button
                              size="sm"
                              onClick={() =>
                                instanceId &&
                                setIndividualAction({ instanceId, action: 'APPROVE' })
                              }
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                            >
                              <CheckCircle2 size={13} className="mr-1" />
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                instanceId &&
                                setIndividualAction({ instanceId, action: 'REJECT' })
                              }
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <XCircle size={13} className="mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                instanceId &&
                                setIndividualAction({ instanceId, action: 'ESCALATE' })
                              }
                            >
                              <ArrowUpCircle size={13} className="mr-1" />
                              Escalate
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== Modals ===== */}
      <Modal
        open={showTemplateModal}
        onClose={() => {
          setShowTemplateModal(false);
          setSelectedTemplate(null);
        }}
        title={selectedTemplate ? 'Edit Workflow Template' : 'Buat Workflow Template'}
      >
        <TemplateForm
          initial={selectedTemplate}
          companyId={companyId}
          onClose={() => {
            setShowTemplateModal(false);
            setSelectedTemplate(null);
          }}
          onSaved={loadTemplates}
        />
      </Modal>

      <ConfirmDialog
        open={!!deletingTemplate}
        title="Hapus Template"
        message={`Template "${deletingTemplate?.name || ''}" akan dihapus permanen. Lanjutkan?`}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
      />

      <CommentPrompt
        open={bulkAction !== null}
        title={`Bulk ${bulkAction === 'APPROVE' ? 'Approve' : 'Reject'} (${selectedIds.length} items)`}
        submitText={bulkAction === 'APPROVE' ? 'Bulk Approve' : 'Bulk Reject'}
        intent={bulkAction === 'APPROVE' ? 'success' : 'destructive'}
        onClose={() => setBulkAction(null)}
        onSubmit={handleBulkSubmit}
      />

      <CommentPrompt
        open={individualAction !== null}
        title={`${individualAction?.action === 'APPROVE' ? 'Approve' : individualAction?.action === 'REJECT' ? 'Reject' : 'Escalate'} Request`}
        submitText={individualAction?.action || ''}
        intent={
          individualAction?.action === 'APPROVE'
            ? 'success'
            : individualAction?.action === 'REJECT'
              ? 'destructive'
              : 'default'
        }
        onClose={() => setIndividualAction(null)}
        onSubmit={handleIndividualSubmit}
      />
    </div>
  );
}
