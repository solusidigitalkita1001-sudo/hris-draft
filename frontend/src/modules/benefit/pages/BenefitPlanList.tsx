import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { benefitService, type BenefitPlan } from '@/services/benefit.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, Heart, Users, Pencil } from 'lucide-react';

// ─── Modal ────────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Benefit Plan Form ────────────────────────────────────
const PLAN_TYPES = [
  { value: 'Health Insurance', label: 'Health Insurance' },
  { value: 'Dental', label: 'Dental' },
  { value: 'Vision', label: 'Vision' },
  { value: 'Life Insurance', label: 'Life Insurance' },
  { value: 'Retirement', label: 'Retirement' },
  { value: 'Transportation', label: 'Transportation' },
  { value: 'Meal', label: 'Meal' },
  { value: 'Education', label: 'Education' },
  { value: 'Wellness', label: 'Wellness' },
  { value: 'Other', label: 'Other' },
];

function BenefitPlanForm({ initial, onSave, onClose }: {
  initial?: Partial<BenefitPlan>;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const companyId = localStorage.getItem('companyId') || '';
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [type, setType] = useState(initial?.type || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [provider, setProvider] = useState(initial?.provider || '');
  const [employeeContribution, setEmployeeContribution] = useState(initial?.employeeContribution?.toString() || '');
  const [employerContribution, setEmployerContribution] = useState(initial?.employerContribution?.toString() || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim() || !type) {
      return toast.error('Name, code, and type are required');
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        code: code.trim().toUpperCase(),
        type,
        description: description.trim() || undefined,
        provider: provider.trim() || undefined,
        employeeContribution: Number(employeeContribution) || 0,
        employerContribution: Number(employerContribution) || 0,
        isActive,
        companyId,
      });
      onClose();
    } catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Plan Name *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Health Insurance" required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Code *</label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. HI-001" required />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Type *</label>
        <Select2 value={type} onValueChange={setType} options={PLAN_TYPES} placeholder="Select plan type" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Description</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Plan description" />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Provider</label>
        <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. BPJS, AXA, Manulife" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee Contribution (%)</label>
          <Input value={employeeContribution} onChange={(e) => setEmployeeContribution(e.target.value)} placeholder="e.g. 50" type="number" min="0" max="100" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employer Contribution (%)</label>
          <Input value={employerContribution} onChange={(e) => setEmployerContribution(e.target.value)} placeholder="e.g. 50" type="number" min="0" max="100" />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary/30 h-4 w-4"
        />
        <span className="text-sm font-medium">Active</span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────
export function BenefitPlanList() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BenefitPlan | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const companyId = localStorage.getItem('companyId') || '';
      const data = await benefitService.getPlans(companyId);
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch benefit plans:', error);
      toast.error('Failed to load benefit plans');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await benefitService.createPlan(data);
      toast.success('Benefit plan created');
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to create plan');
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    try {
      await benefitService.updatePlan(editing.id, data);
      toast.success('Benefit plan updated');
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to update plan');
      throw err;
    }
  };

  const filtered = plans.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title="Benefit Plans"
        description="Manage employee benefit programs and enrollments"
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              Refresh
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" />
              Add Plan
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search plans..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Heart size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No benefit plans found</p>
            </div>
          </div>
        ) : (
          filtered.map((plan) => (
            <div
              key={plan.id}
              className="group bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors cursor-pointer relative"
              onClick={() => navigate(`/benefits/plans/${plan.id}`)}
            >
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(plan); }}
                className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Edit plan"
              >
                <Pencil size={14} />
              </button>

              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950 flex items-center justify-center">
                  <Heart size={20} className="text-rose-600 dark:text-rose-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{plan.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{plan.code}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400">
                  {plan.type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  plan.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                }`}>
                  {plan.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{plan._count?.enrollments || 0} enrolled</span>
                </div>
                <span>
                  {plan.employeeContribution}% / {plan.employerContribution}%
                </span>
              </div>

              {plan.provider && (
                <p className="text-xs text-muted-foreground mt-2">
                  Provider: {plan.provider}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Benefit Plan">
        <BenefitPlanForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Benefit Plan">
        {editing && <BenefitPlanForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
