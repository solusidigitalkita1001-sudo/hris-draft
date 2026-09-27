import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { benefitService, type BenefitPlan } from '@/services/benefit.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Plus, Search, RefreshCw, Heart, Users, Pencil } from 'lucide-react';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

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
/** Nilai tipe plan dikirim apa adanya ke server; hanya labelnya diterjemahkan. */
const PLAN_TYPE_LABEL_KEYS: Record<string, TranslationKey> = {
  'Health Insurance': 'fin.benefit.typeHealthInsurance',
  Dental: 'fin.benefit.typeDental',
  Vision: 'fin.benefit.typeVision',
  'Life Insurance': 'fin.benefit.typeLifeInsurance',
  Retirement: 'fin.benefit.typeRetirement',
  Transportation: 'fin.benefit.typeTransportation',
  Meal: 'fin.benefit.typeMeal',
  Education: 'fin.benefit.typeEducation',
  Wellness: 'fin.benefit.typeWellness',
  Other: 'fin.benefit.typeOther',
};

const PLAN_TYPE_VALUES = Object.keys(PLAN_TYPE_LABEL_KEYS);

function BenefitPlanForm({ initial, onSave, onClose }: {
  initial?: Partial<BenefitPlan>;
  onSave: (data: Partial<BenefitPlan>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [provider, setProvider] = useState(initial?.provider || '');
  const [employeeContribution, setEmployeeContribution] = useState(initial?.employeeContribution?.toString() || '');
  const [employerContribution, setEmployerContribution] = useState(initial?.employerContribution?.toString() || '');
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !type) {
      return toast.error(t('fin.benefit.errRequired'));
    }
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
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
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.benefit.nameLabel')} *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('fin.benefit.namePlaceholder')} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.common.code')}</label>
          <Input value={initial?.code || ''} disabled placeholder={t('fin.common.codeAutoPlaceholder')} />
          <p className="mt-1 text-[11px] text-muted-foreground">{t('fin.benefit.codeHint')}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.common.type')} *</label>
        <Select2
          value={type}
          onValueChange={setType}
          options={PLAN_TYPE_VALUES.map((value) => ({ value, label: t(PLAN_TYPE_LABEL_KEYS[value]) }))}
          placeholder={t('fin.benefit.selectType')}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.common.description')}</label>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t('fin.benefit.descPlaceholder')} />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.benefit.provider')}</label>
        <Input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={t('fin.benefit.providerPlaceholder')} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.benefit.employeeContribution')}</label>
          <Input value={employeeContribution} onChange={(e) => setEmployeeContribution(e.target.value)} placeholder={t('fin.benefit.pctPlaceholder')} type="number" min="0" max="100" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('fin.benefit.employerContribution')}</label>
          <Input value={employerContribution} onChange={(e) => setEmployerContribution(e.target.value)} placeholder={t('fin.benefit.pctPlaceholder')} type="number" min="0" max="100" />
        </div>
      </div>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="rounded border-gray-300 text-primary focus:ring-primary/30 h-4 w-4"
        />
        <span className="text-sm font-medium">{t('common.active')}</span>
      </label>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('fin.common.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────
export function BenefitPlanList() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [plans, setPlans] = useState<BenefitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BenefitPlan | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setPlans([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await benefitService.getPlans(companyId);
      setPlans(data);
    } catch (error) {
      console.error('Failed to fetch benefit plans:', error);
      toast.error(t('fin.benefit.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [companyId, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async (data: Partial<BenefitPlan>) => {
    try {
      await benefitService.createPlan(data);
      toast.success(t('fin.benefit.created'));
      setShowCreate(false);
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.benefit.createFailed')));
      throw err;
    }
  };

  const handleUpdate = async (data: Partial<BenefitPlan>) => {
    if (!editing) return;
    try {
      await benefitService.updatePlan(editing.id, data);
      toast.success(t('fin.benefit.updated'));
      setEditing(null);
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('fin.benefit.updateFailed')));
      throw err;
    }
  };

  const filtered = plans.filter(
    (p) => p.name.toLowerCase().includes(search.toLowerCase()) || p.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <PageHeader
        title={t('fin.benefit.title')}
        description={t('fin.benefit.description')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" />
              {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" />
              {t('fin.benefit.add')}
            </Button>
          </>
        }
      />

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('fin.benefit.searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 max-w-xs"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-2">
              <Heart size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{t('fin.benefit.empty')}</p>
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
                title={t('fin.benefit.editTooltip')}
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
                  {PLAN_TYPE_LABEL_KEYS[plan.type] ? t(PLAN_TYPE_LABEL_KEYS[plan.type]) : plan.type}
                </span>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  plan.isActive
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                    : 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400'
                }`}>
                  {plan.isActive ? t('common.active') : t('common.inactive')}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Users size={14} />
                  <span>{t('fin.benefit.enrolledCount', { count: plan._count?.enrollments || 0 })}</span>
                </div>
                <span>
                  {plan.employeeContribution}% / {plan.employerContribution}%
                </span>
              </div>

              {plan.provider && (
                <p className="text-xs text-muted-foreground mt-2">
                  {t('fin.benefit.providerLine', { provider: plan.provider })}
                </p>
              )}
            </div>
          ))
        )}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('fin.benefit.createTitle')}>
        <BenefitPlanForm onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('fin.benefit.editTitle')}>
        {editing && <BenefitPlanForm initial={editing} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>
    </div>
  );
}
