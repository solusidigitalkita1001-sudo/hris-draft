import { useState, useEffect, useCallback } from 'react';
import { assetService, type Asset, type AssetCategory } from '@/services/asset.service';
import { employeeService } from '@/services/employee.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { Search, RefreshCw, Plus, Package, UserRound, Pencil, Trash2, ArrowRightLeft, CornerDownLeft, FolderCog } from 'lucide-react';
import { formatCurrency } from '@/utils/format';
import toast from 'react-hot-toast';
import { apiErrorMessage } from '@/lib/errors';
import { useCompanyStore } from '@/stores/company.store';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';

// ─── Status style map ────────────────────────────────────
const STYLES: Record<string, string> = {
  AVAILABLE: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  ASSIGNED: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  MAINTENANCE: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  RETIRED: 'bg-gray-50 text-gray-500 dark:bg-gray-900 dark:text-gray-400',
};

const EDIT_STATUS_OPTIONS: { value: string; label: TranslationKey }[] = [
  { value: 'AVAILABLE', label: 'ops.asset.status.available' },
  { value: 'MAINTENANCE', label: 'ops.asset.status.maintenance' },
  { value: 'RETIRED', label: 'ops.asset.status.retired' },
];

const CONDITION_OPTIONS = ['NEW', 'GOOD', 'FAIR', 'POOR'] as const;
const RETURN_CONDITION_OPTIONS = ['GOOD', 'FAIR', 'DAMAGED', 'LOST'] as const;

// ─── Modal wrapper ────────────────────────────────────────
function Modal({ open, onClose, title, children }: {
  open: boolean; onClose: () => void; title: string; children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

// ─── Employee picker (cari lalu pilih) ────────────────────
function EmployeePicker({ companyId, value, onChange }: {
  companyId: string; value: string; onChange: (id: string) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await employeeService.getEmployees({ companyId, search: query || undefined, page: 1, limit: 50 });
        if (!cancelled) {
          setOptions(result.data.map((e: { id: string; fullName: string; employeeNumber: string }) => ({
            value: e.id, label: `${e.fullName} (${e.employeeNumber})`,
          })));
        }
      } catch { /* list stays as-is */ }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [companyId, query]);

  return (
    <div className="space-y-2">
      <Input placeholder={t('ops.asset.picker.search')} value={query} onChange={(e) => setQuery(e.target.value)} />
      <Select2 value={value} onValueChange={onChange} options={options} placeholder={t('ops.asset.picker.select')} />
    </div>
  );
}

// ─── Asset Form (create + edit) ───────────────────────────
function AssetForm({ initial, categories, onSave, onClose }: {
  initial?: Asset;
  categories: AssetCategory[];
  onSave: (data: Record<string, unknown>) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initial?.name ?? '');
  const [assetCode, setAssetCode] = useState(initial?.assetCode ?? '');
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? '');
  const [serialNumber, setSerialNumber] = useState(initial?.serialNumber ?? '');
  const [purchaseValue, setPurchaseValue] = useState<number | ''>(initial?.purchaseValue ? Number(initial.purchaseValue) : '');
  const [status, setStatus] = useState(initial?.status ?? 'AVAILABLE');
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial);
  const statusEditable = isEdit && initial?.status !== 'ASSIGNED';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return toast.error(t('ops.asset.form.nameRequired'));
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        ...(isEdit ? {} : { assetCode: assetCode.trim() || undefined }),
        categoryId: categoryId || (isEdit ? null : undefined),
        serialNumber: serialNumber.trim() || (isEdit ? null : undefined),
        purchaseValue: purchaseValue === '' ? (isEdit ? null : undefined) : Number(purchaseValue),
        ...(statusEditable && status !== initial?.status ? { status } : {}),
      });
      onClose();
    } catch {
      // error handled by caller
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.name')}</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ops.asset.form.namePlaceholder')} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.code')}</label>
        {/* Kode = identitas stiker fisik: boleh diisi saat create, terkunci saat edit. */}
        <Input value={assetCode} disabled={isEdit} onChange={(e) => setAssetCode(e.target.value)} placeholder={t('ops.asset.form.codePlaceholder')} />
        {!isEdit && <p className="mt-1 text-[11px] text-muted-foreground">{t('ops.asset.form.codeHint')}</p>}
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.category')}</label>
        <Select2 value={categoryId} onValueChange={setCategoryId}
          options={[{ value: '', label: t('ops.asset.form.noCategory') }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.serialNumber')}</label>
        <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder={t('ops.asset.form.serialNumberPlaceholder')} />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.purchaseValue')}</label>
        <Input type="number" value={purchaseValue} onChange={(e) => setPurchaseValue(e.target.value === '' ? '' : Number(e.target.value))} placeholder={t('ops.asset.form.purchaseValuePlaceholder')} min={0} />
      </div>

      {statusEditable && (
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.form.status')}</label>
          <Select2 value={status} onValueChange={setStatus} options={EDIT_STATUS_OPTIONS.map((option) => ({ value: option.value, label: t(option.label) }))} />
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('ops.asset.form.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

// ─── Assign / Transfer form ───────────────────────────────
function HandoverForm({ companyId, mode, onSave, onClose }: {
  companyId: string; mode: 'assign' | 'transfer';
  onSave: (employeeId: string, condition: string, notes: string) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [employeeId, setEmployeeId] = useState('');
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return toast.error(t('ops.asset.handover.employeeRequired'));
    setSaving(true);
    try { await onSave(employeeId, condition, notes); onClose(); }
    catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">
          {mode === 'assign' ? t('ops.asset.handover.toEmployee') : t('ops.asset.handover.transferTo')}
        </label>
        <EmployeePicker companyId={companyId} value={employeeId} onChange={setEmployeeId} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.handover.condition')}</label>
        <Select2 value={condition} onValueChange={setCondition}
          options={CONDITION_OPTIONS.map((c) => ({ value: c, label: c }))} />
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.handover.notes')}</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('ops.asset.handover.notesPlaceholder')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('ops.asset.form.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

// ─── Return form ──────────────────────────────────────────
function ReturnForm({ onSave, onClose }: {
  onSave: (condition: string, notes: string) => Promise<void>; onClose: () => void;
}) {
  const { t } = useI18n();
  const [condition, setCondition] = useState('GOOD');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try { await onSave(condition, notes); onClose(); }
    catch { /* handled by caller */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.handover.returnCondition')}</label>
        <Select2 value={condition} onValueChange={setCondition}
          options={RETURN_CONDITION_OPTIONS.map((c) => ({ value: c, label: c }))} />
        <p className="mt-1 text-[11px] text-muted-foreground">{t('ops.asset.handover.returnHint')}</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('ops.asset.handover.notes')}</label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('ops.asset.handover.notesPlaceholder')} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('ops.asset.form.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

// ─── Category manager ─────────────────────────────────────
const METHOD_OPTIONS = ['STRAIGHT_LINE', 'DECLINING_BALANCE', 'SUM_OF_YEARS_DIGITS', 'UNITS_OF_PRODUCTION'];

function CategoryManager({ categories, onChanged }: {
  categories: AssetCategory[]; onChanged: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [method, setMethod] = useState('STRAIGHT_LINE');
  const [lifeMonths, setLifeMonths] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error(t('ops.asset.category.nameRequired'));
    setSaving(true);
    try {
      await assetService.createCategory({
        name: name.trim(), depreciationMethod: method,
        usefulLifeMonths: lifeMonths === '' ? undefined : Number(lifeMonths),
      });
      setName(''); setLifeMonths('');
      toast.success(t('ops.asset.category.created'));
      onChanged();
    } catch (err) { toast.error(apiErrorMessage(err, t('ops.asset.category.saveFailed'))); }
    finally { setSaving(false); }
  };

  const remove = async (id: string) => {
    try {
      await assetService.deleteCategory(id);
      toast.success(t('ops.asset.category.deleted'));
      onChanged();
    } catch (err) { toast.error(apiErrorMessage(err, t('ops.asset.category.deleteFailed'))); }
  };

  return (
    <div className="space-y-4">
      <ul className="space-y-2">
        {categories.length === 0 && <li className="text-sm text-muted-foreground">{t('ops.asset.category.empty')}</li>}
        {categories.map((c) => (
          <li key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
            <div>
              <p className="text-sm font-medium">{c.name}</p>
              <p className="text-xs text-muted-foreground">
                {c.depreciationMethod}{c.usefulLifeMonths ? ` · ${c.usefulLifeMonths} ${t('ops.asset.category.months')}` : ''}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => remove(c.id)} aria-label={t('common.delete')}>
              <Trash2 size={14} />
            </Button>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="space-y-2 border-t border-border pt-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('ops.asset.category.namePlaceholder')} />
        <div className="flex gap-2">
          <div className="flex-1">
            <Select2 value={method} onValueChange={setMethod} options={METHOD_OPTIONS.map((m) => ({ value: m, label: m }))} />
          </div>
          <Input className="w-28" type="number" min={1} value={lifeMonths}
            onChange={(e) => setLifeMonths(e.target.value === '' ? '' : Number(e.target.value))}
            placeholder={t('ops.asset.category.lifePlaceholder')} />
        </div>
        <Button type="submit" size="sm" disabled={saving}><Plus size={14} className="mr-1" />{t('ops.asset.category.add')}</Button>
      </form>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export function AssetList() {
  const { t } = useI18n();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [handover, setHandover] = useState<{ asset: Asset; mode: 'assign' | 'transfer' } | null>(null);
  const [returning, setReturning] = useState<Asset | null>(null);

  const fetchData = useCallback(async () => {
    if (!companyId) {
      setAssets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [assetRows, categoryRows] = await Promise.all([
        assetService.getAll(companyId),
        assetService.getCategories().catch(() => [] as AssetCategory[]),
      ]);
      setAssets(assetRows);
      setCategories(categoryRows);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, [companyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const act = (promise: Promise<unknown>, okKey: TranslationKey, failKey: TranslationKey) =>
    promise.then(() => { toast.success(t(okKey)); fetchData(); })
      .catch((err) => { toast.error(apiErrorMessage(err, t(failKey))); throw err; });

  const handleCreate = (data: Record<string, unknown>) =>
    act(assetService.create({ ...data, companyId }), 'ops.asset.toast.created', 'ops.asset.toast.createFailed');
  const handleUpdate = (data: Record<string, unknown>) =>
    act(assetService.update(editing!.id, data), 'ops.asset.toast.updated', 'ops.asset.toast.updateFailed');
  const handleDelete = (asset: Asset) => {
    if (!window.confirm(t('ops.asset.confirmDelete', { name: asset.name }))) return;
    act(assetService.delete(asset.id), 'ops.asset.toast.deleted', 'ops.asset.toast.deleteFailed').catch(() => undefined);
  };
  const handleHandover = (employeeId: string, condition: string, notes: string) => {
    const { asset, mode } = handover!;
    return mode === 'assign'
      ? act(assetService.assign(asset.id, { employeeId, conditionAtAssign: condition, notes: notes || undefined }), 'ops.asset.toast.assigned', 'ops.asset.toast.assignFailed')
      : act(assetService.transfer(asset.id, { toEmployeeId: employeeId, condition, notes: notes || undefined }), 'ops.asset.toast.transferred', 'ops.asset.toast.transferFailed');
  };
  const handleReturn = (condition: string, notes: string) => {
    const active = returning!.assignments?.find((a) => !a.returnedAt);
    if (!active) return Promise.reject(toast.error(t('ops.asset.toast.noActiveAssignment')));
    return act(assetService.returnAsset(returning!.id, active.id, { conditionAtReturn: condition, notes: notes || undefined }), 'ops.asset.toast.returned', 'ops.asset.toast.returnFailed');
  };

  const filtered = assets.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.assetCode.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <PageHeader title={t('ops.asset.title')} description={t('ops.asset.description')}
        actions={<><Button variant="outline" size="sm" onClick={fetchData}><RefreshCw size={16} className="mr-2" />{t('common.refresh')}</Button>
          <Button variant="outline" size="sm" onClick={() => setShowCategories(true)}><FolderCog size={16} className="mr-2" />{t('ops.asset.categories')}</Button>
          <Button size="sm" onClick={() => setShowCreate(true)}><Plus size={16} className="mr-2" />{t('ops.asset.add')}</Button></>} />
      <div className="relative mb-4 max-w-xs"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input placeholder={t('ops.asset.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" /></div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>
        : filtered.length === 0 ? <div className="col-span-full text-center py-12"><Package size={32} className="mx-auto text-muted-foreground/40" /><p className="text-sm text-muted-foreground mt-2">{t('ops.asset.empty')}</p></div>
        : filtered.map((a) => (
          <div key={a.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-900 flex items-center justify-center"><Package size={20} className="text-muted-foreground" /></div>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{a.name}</p><p className="text-xs text-muted-foreground font-mono">{a.assetCode}</p></div>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[a.status] || ''}`}>{a.status}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {a.currentValue && <span>{formatCurrency(Number(a.currentValue))}</span>}
              {a.assignments?.filter(as => !as.returnedAt).map(as => (
                <span key={as.id} className="flex items-center gap-1"><UserRound size={12} />{as.employee?.fullName}</span>
              ))}
            </div>
            {a.serialNumber && <p className="text-xs text-muted-foreground mt-2">{t('ops.asset.sn', { serial: a.serialNumber })}</p>}
            <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border">
              {a.status === 'AVAILABLE' && (
                <Button variant="outline" size="sm" onClick={() => setHandover({ asset: a, mode: 'assign' })}>
                  <UserRound size={14} className="mr-1" />{t('ops.asset.action.assign')}
                </Button>
              )}
              {a.status === 'ASSIGNED' && (
                <>
                  <Button variant="outline" size="sm" onClick={() => setReturning(a)}>
                    <CornerDownLeft size={14} className="mr-1" />{t('ops.asset.action.return')}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setHandover({ asset: a, mode: 'transfer' })}>
                    <ArrowRightLeft size={14} className="mr-1" />{t('ops.asset.action.transfer')}
                  </Button>
                </>
              )}
              <span className="flex-1" />
              <Button variant="outline" size="sm" onClick={() => setEditing(a)} aria-label={t('common.edit')}><Pencil size={14} /></Button>
              {a.status !== 'ASSIGNED' && (
                <Button variant="outline" size="sm" onClick={() => handleDelete(a)} aria-label={t('common.delete')}><Trash2 size={14} /></Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('ops.asset.add')}>
        <AssetForm categories={categories} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={t('ops.asset.edit')}>
        {editing && <AssetForm initial={editing} categories={categories} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal open={Boolean(handover)} onClose={() => setHandover(null)}
        title={handover?.mode === 'assign' ? t('ops.asset.action.assign') : t('ops.asset.action.transfer')}>
        {handover && <HandoverForm companyId={companyId} mode={handover.mode} onSave={handleHandover} onClose={() => setHandover(null)} />}
      </Modal>
      <Modal open={Boolean(returning)} onClose={() => setReturning(null)} title={t('ops.asset.action.return')}>
        {returning && <ReturnForm onSave={handleReturn} onClose={() => setReturning(null)} />}
      </Modal>
      <Modal open={showCategories} onClose={() => setShowCategories(false)} title={t('ops.asset.categories')}>
        <CategoryManager categories={categories} onChanged={fetchData} />
      </Modal>
    </div>
  );
}
