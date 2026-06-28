import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import {
  ArrowUpCircle,
  CheckCircle2,
  ClipboardList,
  GitBranch,
  Plus,
  RefreshCw,
  Settings2,
  Trash2,
  XCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthStore } from '@/stores/auth.store';
import {
  workflowEngineService,
  type WorkflowActionType,
  type WorkflowApproverType,
  type WorkflowConditionRule,
  type WorkflowInstance,
  type WorkflowInstanceStep,
  type WorkflowOperator,
  type WorkflowStage,
  type WorkflowTemplate,
} from '@/services/workflow-engine.service';

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-xl border border-border bg-background shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircle size={18} />
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
}: {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-xl border border-border bg-background shadow-xl" onClick={(event) => event.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={onConfirm}>
            Hapus
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

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${toneClass}`}>{label}</span>;
}

function emptyStage(level: number): WorkflowStage {
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
  return {
    field: '',
    operator: 'EQ',
    value: '',
  };
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
  const [stages, setStages] = useState<WorkflowStage[]>(
    initial?.stages?.map((stage) => ({
      ...stage,
      conditionRules: stage.conditionRules || [],
    })) || [emptyStage(1)]
  );
  const [saving, setSaving] = useState(false);

  const addStage = () => {
    setStages((prev) => [...prev, emptyStage(prev.length + 1)]);
  };

  const updateStage = <K extends keyof WorkflowStage>(index: number, key: K, value: WorkflowStage[K]) => {
    setStages((prev) =>
      prev.map((stage, stageIndex) => (stageIndex === index ? { ...stage, [key]: value } : stage))
    );
  };

  const removeStage = (index: number) => {
    setStages((prev) =>
      prev
        .filter((_, stageIndex) => stageIndex !== index)
        .map((stage, stageIndex) => ({ ...stage, level: stageIndex + 1 }))
    );
  };

  const addRule = (stageIndex: number) => {
    setStages((prev) =>
      prev.map((stage, index) =>
        index === stageIndex
          ? { ...stage, conditionRules: [...(stage.conditionRules || []), emptyRule()] }
          : stage
      )
    );
  };

  const updateRule = <K extends keyof WorkflowConditionRule>(
    stageIndex: number,
    ruleIndex: number,
    key: K,
    value: WorkflowConditionRule[K]
  ) => {
    setStages((prev) =>
      prev.map((stage, index) =>
        index === stageIndex
          ? {
              ...stage,
              conditionRules: (stage.conditionRules || []).map((rule, idx) =>
                idx === ruleIndex ? { ...rule, [key]: value } : rule
              ),
            }
          : stage
      )
    );
  };

  const removeRule = (stageIndex: number, ruleIndex: number) => {
    setStages((prev) =>
      prev.map((stage, index) =>
        index === stageIndex
          ? {
              ...stage,
              conditionRules: (stage.conditionRules || []).filter((_, idx) => idx !== ruleIndex),
            }
          : stage
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!companyId) {
      toast.error('companyId tidak tersedia');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        companyId,
        name,
        approvalType,
        resource: resource || undefined,
        description: description || undefined,
        isActive,
        stages: stages.map((stage, index) => ({
          ...stage,
          level: index + 1,
          approverRoleCode: stage.approverRoleCode || undefined,
          approverId: stage.approverId || undefined,
          backupApproverRoleCode: stage.backupApproverRoleCode || undefined,
          backupApproverId: stage.backupApproverId || undefined,
          conditionRules: (stage.conditionRules || []).filter((rule) => rule.field && rule.value),
        })),
      };

      if (initial?.id) {
        await workflowEngineService.updateTemplate(initial.id, payload);
        toast.success('Template workflow diperbarui');
      } else {
        await workflowEngineService.createTemplate(payload);
        toast.success('Template workflow dibuat');
      }

      await onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan template workflow');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nama Template *</label>
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approval Type *</label>
          <Input value={approvalType} onChange={(event) => setApprovalType(event.target.value.toUpperCase())} required />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Resource</label>
          <Input value={resource} onChange={(event) => setResource(event.target.value)} placeholder="mis. leave / payroll / expense" />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
            Template aktif
          </label>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Deskripsi</label>
        <textarea
          rows={3}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
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

        {stages.map((stage, stageIndex) => (
          <div key={`${stageIndex}-${stage.level}`} className="rounded-xl border border-border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-sm font-semibold">Stage {stageIndex + 1}</h4>
              {stages.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStage(stageIndex)}
                  className="text-sm text-red-600 hover:underline"
                >
                  Hapus
                </button>
              )}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nama Stage *</label>
                <Input value={stage.name} onChange={(event) => updateStage(stageIndex, 'name', event.target.value)} required />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approver Type *</label>
                <select
                  value={stage.approverType}
                  onChange={(event) => updateStage(stageIndex, 'approverType', event.target.value as WorkflowApproverType)}
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="ROLE">Role</option>
                  <option value="USER">User</option>
                  <option value="AUTO">Auto</option>
                </select>
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approver Role Code</label>
                <Input
                  value={stage.approverRoleCode || ''}
                  onChange={(event) => updateStage(stageIndex, 'approverRoleCode', event.target.value.toUpperCase())}
                  placeholder="mis. HR_MANAGER"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Approver User ID</label>
                <Input value={stage.approverId || ''} onChange={(event) => updateStage(stageIndex, 'approverId', event.target.value)} />
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Backup Role Code</label>
                <Input
                  value={stage.backupApproverRoleCode || ''}
                  onChange={(event) => updateStage(stageIndex, 'backupApproverRoleCode', event.target.value.toUpperCase())}
                  placeholder="mis. COMPANY_ADMIN"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Backup User ID</label>
                <Input
                  value={stage.backupApproverId || ''}
                  onChange={(event) => updateStage(stageIndex, 'backupApproverId', event.target.value)}
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
                  onChange={(event) => updateStage(stageIndex, 'slaHours', Number(event.target.value))}
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={stage.allowEscalation}
                    onChange={(event) => updateStage(stageIndex, 'allowEscalation', event.target.checked)}
                  />
                  Izinkan eskalasi
                </label>
              </div>
            </div>

            <div className="mt-5 rounded-lg bg-muted/50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h5 className="text-sm font-semibold">Condition Rules</h5>
                <Button type="button" size="sm" variant="outline" onClick={() => addRule(stageIndex)}>
                  <Plus size={14} className="mr-1.5" /> Tambah Rule
                </Button>
              </div>

              <div className="space-y-3">
                {(stage.conditionRules || []).map((rule, ruleIndex) => (
                  <div key={`${stageIndex}-${ruleIndex}`} className="grid gap-3 rounded-lg border border-border bg-background p-3 md:grid-cols-4">
                    <Input
                      value={rule.field}
                      onChange={(event) => updateRule(stageIndex, ruleIndex, 'field', event.target.value)}
                      placeholder="field"
                    />
                    <select
                      value={rule.operator}
                      onChange={(event) => updateRule(stageIndex, ruleIndex, 'operator', event.target.value as WorkflowOperator)}
                      className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
                    >
                      {['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'CONTAINS'].map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </select>
                    <Input
                      value={rule.value}
                      onChange={(event) => updateRule(stageIndex, ruleIndex, 'value', event.target.value)}
                      placeholder="value"
                    />
                    <Button type="button" variant="outline" onClick={() => removeRule(stageIndex, ruleIndex)}>
                      Hapus
                    </Button>
                  </div>
                ))}

                {!stage.conditionRules?.length && (
                  <p className="text-sm text-muted-foreground">Stage ini selalu aktif jika tidak ada condition rule.</p>
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

function StartInstanceForm({
  companyId,
  templates,
  onClose,
  onSaved,
}: {
  companyId: string;
  templates: WorkflowTemplate[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id || '');
  const [referenceType, setReferenceType] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [payloadText, setPayloadText] = useState('{\n  "amount": 15000000,\n  "department": "HR"\n}');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await workflowEngineService.startInstance({
        templateId,
        companyId,
        referenceType,
        referenceId,
        payload: payloadText ? JSON.parse(payloadText) : undefined,
      });
      toast.success('Workflow instance berhasil dimulai');
      await onSaved();
      onClose();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal memulai workflow instance');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Template *</label>
        <select
          value={templateId}
          onChange={(event) => setTemplateId(event.target.value)}
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
          required
        >
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template.approvalType})
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reference Type *</label>
          <Input value={referenceType} onChange={(event) => setReferenceType(event.target.value)} required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Reference ID *</label>
          <Input value={referenceId} onChange={(event) => setReferenceId(event.target.value)} required />
        </div>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Payload JSON</label>
        <textarea
          rows={8}
          value={payloadText}
          onChange={(event) => setPayloadText(event.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Batal
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? 'Memulai...' : 'Start Instance'}
        </Button>
      </div>
    </form>
  );
}

export function WorkflowEnginePage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'templates' | 'approvals' | 'instances'>('templates');
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [approvals, setApprovals] = useState<WorkflowInstanceStep[]>([]);
  const [instanceStatus, setInstanceStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<WorkflowTemplate | null>(null);

  const companyId = user?.companyId || localStorage.getItem('companyId') || '';
  const isConfigAdmin = useMemo(
    () => !!user && user.roles.some((role) => ['SUPER_ADMIN', 'GROUP_ADMIN', 'COMPANY_ADMIN', 'HR_MANAGER'].includes(role)),
    [user]
  );

  const loadTemplates = useCallback(async () => {
    if (!companyId) return;
    const data = await workflowEngineService.findTemplates(companyId);
    setTemplates(data);
  }, [companyId]);

  const loadInstances = useCallback(async () => {
    if (!companyId) return;
    const data = await workflowEngineService.findInstances(companyId, instanceStatus || undefined);
    setInstances(data);
  }, [companyId, instanceStatus]);

  const loadApprovals = useCallback(async () => {
    if (!companyId) return;
    const data = await workflowEngineService.findMyApprovals(companyId);
    setApprovals(data);
  }, [companyId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([loadTemplates(), loadInstances(), loadApprovals()]);
    } catch {
      toast.error('Gagal memuat data workflow engine');
    } finally {
      setLoading(false);
    }
  }, [loadApprovals, loadInstances, loadTemplates]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleDeleteTemplate = async () => {
    if (!deletingTemplate) return;
    try {
      await workflowEngineService.deleteTemplate(deletingTemplate.id);
      toast.success('Template workflow dihapus');
      setDeletingTemplate(null);
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal menghapus template workflow');
    }
  };

  const handleAction = async (instanceId: string, action: WorkflowActionType) => {
    const comment = window.prompt(`Komentar untuk aksi ${action} (opsional)`) || undefined;
    try {
      await workflowEngineService.applyAction(instanceId, action, comment);
      toast.success(`Aksi ${action.toLowerCase()} berhasil diproses`);
      await refresh();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal memproses aksi workflow');
    }
  };

  return (
    <div>
      <PageHeader
        title="Workflow Engine"
        description="Kelola template approval, condition rule, inbox approval, dan instance workflow lintas modul"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={refresh}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            {isConfigAdmin && (
              <Button variant="outline" size="sm" onClick={() => setShowStartModal(true)}>
                <GitBranch size={16} className="mr-2" /> Start Instance
              </Button>
            )}
            {isConfigAdmin && (
              <Button
                size="sm"
                onClick={() => {
                  setSelectedTemplate(null);
                  setShowTemplateModal(true);
                }}
              >
                <Plus size={16} className="mr-2" /> Template
              </Button>
            )}
          </>
        }
      />

      <div className="mb-6 flex gap-1 border-b border-border">
        {[
          { key: 'templates', label: 'Templates', icon: <Settings2 size={16} /> },
          { key: 'approvals', label: 'My Approvals', icon: <CheckCircle2 size={16} /> },
          { key: 'instances', label: 'Instances', icon: <ClipboardList size={16} /> },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium ${
              activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'instances' && (
        <div className="mb-4 flex gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'ESCALATED'].map((status) => (
            <button
              key={status || 'all-status'}
              onClick={() => setInstanceStatus(status)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium ${
                instanceStatus === status ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground'
              }`}
            >
              {status || 'Semua'}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Memuat data workflow engine...
        </div>
      ) : (
        <>
          {activeTab === 'templates' && (
            <div className="space-y-4">
              {!isConfigAdmin && (
                <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                  Anda hanya memiliki akses monitor/inbox. Konfigurasi template hanya untuk role admin/HR manager.
                </div>
              )}
              {templates.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Belum ada workflow template.
                </div>
              )}
              {templates.map((template) => (
                <div key={template.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{template.name}</h3>
                        <StatusBadge label={template.isActive ? 'Active' : 'Inactive'} tone={template.isActive ? 'success' : 'neutral'} />
                        <StatusBadge label={template.approvalType} tone="warning" />
                      </div>
                      {template.description && <p className="mb-3 text-sm text-muted-foreground">{template.description}</p>}
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                        <span>Resource: {template.resource || '-'}</span>
                        <span>Total instance: {template._count?.instances || 0}</span>
                      </div>
                      <div className="mt-4 space-y-2">
                        {template.stages.map((stage) => (
                          <div key={`${template.id}-${stage.level}`} className="rounded-lg bg-muted/50 p-3 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-medium">L{stage.level} - {stage.name}</span>
                              <span className="text-muted-foreground">
                                {stage.approverType === 'ROLE'
                                  ? stage.approverRoleCode || 'Role tidak diisi'
                                  : stage.approverType === 'USER'
                                    ? stage.approverId || 'User tidak diisi'
                                    : 'AUTO'}
                              </span>
                            </div>
                            {!!stage.conditionRules?.length && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                Rules: {stage.conditionRules.map((rule) => `${rule.field} ${rule.operator} ${rule.value}`).join(' | ')}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    {isConfigAdmin && (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedTemplate(template);
                            setShowTemplateModal(true);
                          }}
                        >
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setDeletingTemplate(template)}>
                          <Trash2 size={14} className="mr-1.5" /> Hapus
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'approvals' && (
            <div className="space-y-4">
              {approvals.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Tidak ada approval yang menunggu aksi Anda.
                </div>
              )}
              {approvals.map((approval) => (
                <div key={approval.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-semibold">{approval.name}</h3>
                        <StatusBadge label={approval.status} tone="warning" />
                        <StatusBadge label={approval.instance?.template?.approvalType || 'Workflow'} tone="neutral" />
                      </div>
                      <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                        <span>Template: {approval.instance?.template?.name || '-'}</span>
                        <span>Reference: {approval.instance?.referenceType} / {approval.instance?.referenceId}</span>
                        <span>Current level: {approval.level}</span>
                        <span>Dibuat: {dayjs(approval.createdAt).format('DD MMM YYYY HH:mm')}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleAction(approval.instanceId, 'APPROVE')}>
                        <CheckCircle2 size={15} className="mr-1.5" /> Approve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(approval.instanceId, 'REJECT')}>
                        <XCircle size={15} className="mr-1.5" /> Reject
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleAction(approval.instanceId, 'ESCALATE')}>
                        <ArrowUpCircle size={15} className="mr-1.5" /> Escalate
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'instances' && (
            <div className="space-y-4">
              {instances.length === 0 && (
                <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
                  Belum ada workflow instance.
                </div>
              )}
              {instances.map((instance) => (
                <div key={instance.id} className="rounded-xl border border-border bg-card p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{instance.template?.name || instance.approvalType}</h3>
                    <StatusBadge
                      label={instance.status}
                      tone={
                        instance.status === 'APPROVED'
                          ? 'success'
                          : instance.status === 'REJECTED'
                            ? 'danger'
                            : instance.status === 'ESCALATED'
                              ? 'warning'
                              : 'neutral'
                      }
                    />
                  </div>
                  <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                    <span>Reference: {instance.referenceType} / {instance.referenceId}</span>
                    <span>Requester: {instance.requesterId}</span>
                    <span>Current level: {instance.currentLevel || '-'}</span>
                    <span>Dibuat: {dayjs(instance.createdAt).format('DD MMM YYYY HH:mm')}</span>
                  </div>
                  <div className="mt-4 space-y-2">
                    {instance.steps.map((step) => (
                      <div key={step.id} className="rounded-lg bg-muted/50 p-3 text-sm">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">L{step.level} - {step.name}</span>
                          <StatusBadge
                            label={step.status}
                            tone={
                              step.status === 'APPROVED'
                                ? 'success'
                                : step.status === 'REJECTED'
                                  ? 'danger'
                                  : step.status === 'ESCALATED'
                                    ? 'warning'
                                    : 'neutral'
                            }
                          />
                          {step.isCurrent && <StatusBadge label="CURRENT" tone="warning" />}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Approver: {step.approverRoleCode || step.approverId || step.approverType}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

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
          onSaved={refresh}
        />
      </Modal>

      <Modal open={showStartModal} onClose={() => setShowStartModal(false)} title="Start Workflow Instance">
        <StartInstanceForm companyId={companyId} templates={templates} onClose={() => setShowStartModal(false)} onSaved={refresh} />
      </Modal>

      <ConfirmDialog
        open={!!deletingTemplate}
        title="Hapus Template"
        message={`Template "${deletingTemplate?.name || ''}" akan dihapus permanen.`}
        onClose={() => setDeletingTemplate(null)}
        onConfirm={handleDeleteTemplate}
      />
    </div>
  );
}
