import { useState, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import {
  organizationService,
  type AttendancePolicyMethod,
  type Branch,
  type BranchAttendancePolicy,
  type Company,
  type OutsideRadiusAction,
} from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import {
  Building2,
  Clock3,
  Fingerprint,
  Globe,
  LocateFixed,
  Mail,
  Map,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Phone,
} from 'lucide-react';

// ─── Extended Branch type (backend supports these fields) ─────
interface BranchExtended extends Branch {
  address?: string;
  phone?: string;
  email?: string;
  latitude?: number;
  longitude?: number;
  company?: { id: string; name: string; code: string };
}

const ATTENDANCE_METHOD_OPTIONS: Array<{ value: AttendancePolicyMethod; labelKey: TranslationKey }> = [
  { value: 'FINGERPRINT', labelKey: 'organization.branches.policy.method.fingerprint' },
  { value: 'MOBILE_GPS', labelKey: 'organization.branches.policy.method.mobileGps' },
  { value: 'BOTH', labelKey: 'organization.branches.policy.method.both' },
  { value: 'MANUAL', labelKey: 'organization.branches.policy.method.manual' },
];

const OUTSIDE_RADIUS_OPTIONS: Array<{ value: OutsideRadiusAction; labelKey: TranslationKey }> = [
  { value: 'REJECT', labelKey: 'organization.branches.policy.outsideRadius.reject' },
  { value: 'FLAG', labelKey: 'organization.branches.policy.outsideRadius.flag' },
  { value: 'REVIEW', labelKey: 'organization.branches.policy.outsideRadius.review' },
];

function formatMethodLabel(method: AttendancePolicyMethod, t: ReturnType<typeof useI18n>['t']) {
  const option = ATTENDANCE_METHOD_OPTIONS.find((item) => item.value === method);
  return option ? t(option.labelKey) : method;
}

// ─── Modal ──────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
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

function ConfirmDialog({ open, onClose, onConfirm, title, message }: {
  open: boolean; onClose: () => void; onConfirm: () => void;
  title: string; message: string;
}) {
  const { t } = useI18n();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-5">
          <h3 className="text-base font-semibold mb-2">{title}</h3>
          <p className="text-sm text-muted-foreground">{message}</p>
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-border">
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button size="sm" onClick={onConfirm} className="bg-red-600 hover:bg-red-700">{t('common.delete')}</Button>
        </div>
      </div>
    </div>
  );
}

function BranchForm({ initial, companies, onSave, onClose }: {
  initial?: Partial<BranchExtended>;
  companies: Company[];
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [companyId, setCompanyId] = useState(initial?.companyId || '');
  const [name, setName] = useState(initial?.name || '');
  const [code, setCode] = useState(initial?.code || '');
  const [address, setAddress] = useState(initial?.address || '');
  const [phone, setPhone] = useState(initial?.phone || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [timezone, setTimezone] = useState(initial?.timezone || 'Asia/Jakarta');
  const [latitude, setLatitude] = useState(initial?.latitude?.toString() || '');
  const [longitude, setLongitude] = useState(initial?.longitude?.toString() || '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyId) return toast.error(t('organization.branches.form.companyRequired'));
    if (!name.trim() || !code.trim()) return toast.error(t('organization.branches.form.requiredFields'));
    setSaving(true);
    try {
      await onSave({
        companyId,
        name: name.trim(),
        code: code.trim().toUpperCase(),
        address: address.trim(),
        phone: phone.trim(),
        email: email.trim(),
        timezone,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
      });
      onClose();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.company')} *</label>
        <Select2
          value={companyId}
          onValueChange={setCompanyId}
          options={companies.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
          placeholder={t('organization.branches.form.selectCompany')}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.branchName')} *</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('organization.branches.form.branchNamePlaceholder')} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.code')} *</label>
          <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder={t('organization.branches.form.codePlaceholder')} required />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.address')}</label>
        <textarea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={t('organization.branches.form.addressPlaceholder')}
          rows={2}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground resize-none"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.phone')}</label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('organization.branches.form.phonePlaceholder')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.email')}</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('organization.branches.form.emailPlaceholder')} type="email" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.timezone')}</label>
        <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder={t('organization.branches.form.timezonePlaceholder')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.latitude')}</label>
          <Input value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder={t('organization.branches.form.latitudePlaceholder')} type="number" step="any" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">{t('organization.branches.form.longitude')}</label>
          <Input value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder={t('organization.branches.form.longitudePlaceholder')} type="number" step="any" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
        <Button type="submit" size="sm" disabled={saving}>{saving ? t('organization.branches.form.saving') : t('common.save')}</Button>
      </div>
    </form>
  );
}

function PolicyForm({
  branch,
  initial,
  onSave,
  onDelete,
  onClose,
}: {
  branch: BranchExtended;
  initial?: BranchAttendancePolicy | null;
  onSave: (data: {
    attendanceMethod: AttendancePolicyMethod;
    gpsLatitude?: number;
    gpsLongitude?: number;
    gpsRadiusMeters?: number;
    allowOutsideRadius: boolean;
    outsideRadiusAction: OutsideRadiusAction;
    lateToleranceMinutes: number;
    earlyCheckoutToleranceMinutes: number;
    allowHolidayAttendance: boolean;
    allowWeekendAttendance: boolean;
    autoAbsentEnabled: boolean;
    autoCheckoutEnabled: boolean;
    requiresSelfie: boolean;
    requiresLocation: boolean;
    isActive: boolean;
    notes?: string;
  }) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [attendanceMethod, setAttendanceMethod] = useState<AttendancePolicyMethod>(initial?.attendanceMethod || 'MANUAL');
  const [gpsLatitude, setGpsLatitude] = useState(initial?.gpsLatitude?.toString() || '');
  const [gpsLongitude, setGpsLongitude] = useState(initial?.gpsLongitude?.toString() || '');
  const [gpsRadiusMeters, setGpsRadiusMeters] = useState(initial?.gpsRadiusMeters?.toString() || '');
  const [allowOutsideRadius, setAllowOutsideRadius] = useState(initial?.allowOutsideRadius || false);
  const [outsideRadiusAction, setOutsideRadiusAction] = useState<OutsideRadiusAction>(initial?.outsideRadiusAction || 'REVIEW');
  const [lateToleranceMinutes, setLateToleranceMinutes] = useState(initial?.lateToleranceMinutes?.toString() || '0');
  const [earlyCheckoutToleranceMinutes, setEarlyCheckoutToleranceMinutes] = useState(initial?.earlyCheckoutToleranceMinutes?.toString() || '0');
  const [allowHolidayAttendance, setAllowHolidayAttendance] = useState(initial?.allowHolidayAttendance || false);
  const [allowWeekendAttendance, setAllowWeekendAttendance] = useState(initial?.allowWeekendAttendance || false);
  const [autoAbsentEnabled, setAutoAbsentEnabled] = useState(initial?.autoAbsentEnabled || false);
  const [autoCheckoutEnabled, setAutoCheckoutEnabled] = useState(initial?.autoCheckoutEnabled || false);
  const [requiresSelfie, setRequiresSelfie] = useState(initial?.requiresSelfie || false);
  const [requiresLocation, setRequiresLocation] = useState(initial?.requiresLocation || false);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const needsGps = attendanceMethod === 'MOBILE_GPS' || attendanceMethod === 'BOTH' || requiresLocation;
  const toggleFields: Array<{
    key: TranslationKey;
    checked: boolean;
    setChecked: (value: boolean) => void;
  }> = [
    { key: 'organization.branches.policy.fields.isActive', checked: isActive, setChecked: setIsActive },
    { key: 'organization.branches.policy.fields.requiresLocation', checked: requiresLocation, setChecked: setRequiresLocation },
    { key: 'organization.branches.policy.fields.requiresSelfie', checked: requiresSelfie, setChecked: setRequiresSelfie },
    { key: 'organization.branches.policy.fields.allowOutsideRadius', checked: allowOutsideRadius, setChecked: setAllowOutsideRadius },
    { key: 'organization.branches.policy.fields.allowHolidayAttendance', checked: allowHolidayAttendance, setChecked: setAllowHolidayAttendance },
    { key: 'organization.branches.policy.fields.allowWeekendAttendance', checked: allowWeekendAttendance, setChecked: setAllowWeekendAttendance },
    { key: 'organization.branches.policy.fields.autoAbsentEnabled', checked: autoAbsentEnabled, setChecked: setAutoAbsentEnabled },
    { key: 'organization.branches.policy.fields.autoCheckoutEnabled', checked: autoCheckoutEnabled, setChecked: setAutoCheckoutEnabled },
  ];

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave({
        attendanceMethod,
        gpsLatitude: gpsLatitude ? parseFloat(gpsLatitude) : undefined,
        gpsLongitude: gpsLongitude ? parseFloat(gpsLongitude) : undefined,
        gpsRadiusMeters: gpsRadiusMeters ? parseInt(gpsRadiusMeters, 10) : undefined,
        allowOutsideRadius,
        outsideRadiusAction,
        lateToleranceMinutes: parseInt(lateToleranceMinutes || '0', 10),
        earlyCheckoutToleranceMinutes: parseInt(earlyCheckoutToleranceMinutes || '0', 10),
        allowHolidayAttendance,
        allowWeekendAttendance,
        autoAbsentEnabled,
        autoCheckoutEnabled,
        requiresSelfie,
        requiresLocation,
        isActive,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch {
      // handled in parent
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete();
      onClose();
    } catch {
      // handled in parent
    } finally {
      setDeleting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-xl border border-border bg-muted/30 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck size={18} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{branch.name}</p>
            <p className="text-xs text-muted-foreground">{branch.company?.name || t('organization.branches.policy.companyFallback')}</p>
            <p className="text-xs text-muted-foreground">
              {t('organization.branches.policy.branchCoordinatesHint', {
                latitude: branch.latitude ?? '-',
                longitude: branch.longitude ?? '-',
              })}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.attendanceMethod')}</label>
          <Select2
            value={attendanceMethod}
            onValueChange={(value) => setAttendanceMethod(value as AttendancePolicyMethod)}
            options={ATTENDANCE_METHOD_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            placeholder={t('organization.branches.policy.selectMethod')}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.outsideRadiusAction')}</label>
          <Select2
            value={outsideRadiusAction}
            onValueChange={(value) => setOutsideRadiusAction(value as OutsideRadiusAction)}
            options={OUTSIDE_RADIUS_OPTIONS.map((option) => ({
              value: option.value,
              label: t(option.labelKey),
            }))}
            placeholder={t('organization.branches.policy.selectOutsideRadiusAction')}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.gpsRadiusMeters')}</label>
          <Input value={gpsRadiusMeters} onChange={(event) => setGpsRadiusMeters(event.target.value)} type="number" min="1" placeholder="100" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.gpsLatitude')}</label>
          <Input value={gpsLatitude} onChange={(event) => setGpsLatitude(event.target.value)} type="number" step="any" placeholder={branch.latitude?.toString() || '-6.2088'} />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.gpsLongitude')}</label>
          <Input value={gpsLongitude} onChange={(event) => setGpsLongitude(event.target.value)} type="number" step="any" placeholder={branch.longitude?.toString() || '106.8456'} />
        </div>
      </div>

      {needsGps && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          {t('organization.branches.policy.gpsHint')}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.lateToleranceMinutes')}</label>
          <Input value={lateToleranceMinutes} onChange={(event) => setLateToleranceMinutes(event.target.value)} type="number" min="0" placeholder="0" />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.earlyCheckoutToleranceMinutes')}</label>
          <Input value={earlyCheckoutToleranceMinutes} onChange={(event) => setEarlyCheckoutToleranceMinutes(event.target.value)} type="number" min="0" placeholder="0" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-xl border border-border p-4 md:grid-cols-2">
        {toggleFields.map((field) => (
          <label key={field.key} className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm">
            <input
              type="checkbox"
              checked={field.checked}
              onChange={(event) => field.setChecked(event.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span>{t(field.key)}</span>
          </label>
        ))}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('organization.branches.policy.fields.notes')}</label>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          placeholder={t('organization.branches.policy.notesPlaceholder')}
          rows={3}
          className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground resize-none"
        />
      </div>

      <div className="flex items-center justify-between gap-2 pt-2">
        <div>
          {initial ? (
            <Button type="button" variant="outline" size="sm" onClick={handleDelete} disabled={deleting}>
              <Trash2 size={14} className="mr-2" />
              {deleting ? t('organization.branches.policy.deleting') : t('organization.branches.policy.delete')}
            </Button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? t('organization.branches.policy.saving') : t('common.save')}
          </Button>
        </div>
      </div>
    </form>
  );
}

export function BranchListPage() {
  const { t } = useI18n();
  const [branches, setBranches] = useState<BranchExtended[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BranchExtended | null>(null);
  const [deleting, setDeleting] = useState<BranchExtended | null>(null);
  const [policyTarget, setPolicyTarget] = useState<BranchExtended | null>(null);

  const STATUS_OPTIONS = [
    { value: '', label: t('organization.branches.filters.allStatus') },
    { value: 'ACTIVE', label: t('common.active') },
    { value: 'INACTIVE', label: t('common.inactive') },
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [branchData, companyData] = await Promise.all([
        organizationService.findBranches(),
        organizationService.getCompanies(),
      ]);
      setBranches(branchData as BranchExtended[]);
      setCompanies(companyData);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
      toast.error(t('organization.branches.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCreate = async (data: any) => {
    try {
      await organizationService.createBranch(data);
      toast.success(t('organization.branches.toast.createSuccess'));
      setShowCreate(false);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('organization.branches.toast.createFailed'));
      throw err;
    }
  };

  const handleUpdate = async (data: any) => {
    if (!editing) return;
    try {
      await organizationService.updateBranch(editing.id, data);
      toast.success(t('organization.branches.toast.updateSuccess'));
      setEditing(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('organization.branches.toast.updateFailed'));
      throw err;
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await organizationService.deleteBranch(deleting.id);
      toast.success(t('organization.branches.toast.deleteSuccess'));
      setDeleting(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('organization.branches.toast.deleteFailed'));
    }
  };

  const handlePolicySave = async (data: any) => {
    if (!policyTarget) return;
    try {
      await organizationService.upsertBranchAttendancePolicy(policyTarget.id, data);
      toast.success(t('organization.branches.toast.policySaved'));
      setPolicyTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('organization.branches.toast.policySaveFailed'));
      throw err;
    }
  };

  const handlePolicyDelete = async () => {
    if (!policyTarget) return;
    try {
      await organizationService.deleteBranchAttendancePolicy(policyTarget.id);
      toast.success(t('organization.branches.toast.policyDeleted'));
      setPolicyTarget(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || t('organization.branches.toast.policyDeleteFailed'));
      throw err;
    }
  };

  const filteredBranches = branches.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.code.toLowerCase().includes(search.toLowerCase()) ||
      (b.address && b.address.toLowerCase().includes(search.toLowerCase())) ||
      (b.phone && b.phone.includes(search));
    const matchesStatus = !statusFilter || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div>
      <PageHeader
        title={t('organization.branches.title')}
        description={t('organization.branches.description')}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw size={16} className="mr-2" /> {t('common.refresh')}
            </Button>
            <Button size="sm" onClick={() => setShowCreate(true)}>
              <Plus size={16} className="mr-2" /> {t('organization.branches.actions.add')}
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t('organization.branches.filters.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="w-40">
          <Select2
            value={statusFilter}
            onValueChange={setStatusFilter}
            options={STATUS_OPTIONS}
            placeholder={t('organization.branches.filters.allStatus')}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        </div>
      ) : filteredBranches.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <MapPin size={40} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            {search || statusFilter ? t('organization.branches.empty.filtered') : t('organization.branches.empty.default')}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBranches.map((branch) => (
            <div
              key={branch.id}
              className="rounded-xl border border-border bg-card shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin size={20} className="text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{branch.name}</p>
                      <p className="text-xs font-mono text-muted-foreground">{branch.code}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                    branch.status === 'ACTIVE'
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                  }`}>
                    {branch.status === 'ACTIVE' ? t('common.active') : t('common.inactive')}
                  </span>
                </div>

                {branch.company && (
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
                    <Building2 size={13} />
                    <span>{branch.company.name}</span>
                  </div>
                )}

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  {branch.address && (
                    <div className="flex items-start gap-1.5">
                      <Map size={13} className="mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{branch.address}</span>
                    </div>
                  )}
                  {branch.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone size={13} className="shrink-0" />
                      <span>{branch.phone}</span>
                    </div>
                  )}
                  {branch.email && (
                    <div className="flex items-center gap-1.5">
                      <Mail size={13} className="shrink-0" />
                      <span className="truncate">{branch.email}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Globe size={13} className="shrink-0" />
                    <span>{branch.timezone}</span>
                  </div>
                </div>

                <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/30 p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {branch.attendancePolicy?.attendanceMethod === 'FINGERPRINT' ? <Fingerprint size={15} /> : <LocateFixed size={15} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">{t('organization.branches.policy.cardTitle')}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {branch.attendancePolicy
                          ? formatMethodLabel(branch.attendancePolicy.attendanceMethod, t)
                          : t('organization.branches.policy.notConfigured')}
                      </p>
                    </div>
                  </div>

                  {branch.attendancePolicy ? (
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-background px-2 py-1">
                        {t('organization.branches.policy.summary.radius', {
                          radius: branch.attendancePolicy.gpsRadiusMeters ?? '-',
                        })}
                      </span>
                      <span className="rounded-full bg-background px-2 py-1">
                        {t('organization.branches.policy.summary.lateTolerance', {
                          minutes: branch.attendancePolicy.lateToleranceMinutes,
                        })}
                      </span>
                      <span className="rounded-full bg-background px-2 py-1">
                        {branch.attendancePolicy.requiresLocation
                          ? t('organization.branches.policy.summary.locationRequired')
                          : t('organization.branches.policy.summary.locationOptional')}
                      </span>
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      {t('organization.branches.policy.defaultFallback')}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-end gap-1 px-4 py-2.5 border-t border-border bg-muted/30 rounded-b-xl">
                <button
                  onClick={() => setPolicyTarget(branch)}
                  className="p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary"
                  title={t('organization.branches.actions.attendancePolicy')}
                >
                  <Clock3 size={15} />
                </button>
                <button
                  onClick={() => setEditing(branch)}
                  className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                  title={t('common.edit')}
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => setDeleting(branch)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600"
                  title={t('common.delete')}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t('organization.branches.form.createTitle')}>
        <BranchForm companies={companies} onSave={handleCreate} onClose={() => setShowCreate(false)} />
      </Modal>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('organization.branches.form.editTitle')}>
        {editing && <BranchForm initial={editing} companies={companies} onSave={handleUpdate} onClose={() => setEditing(null)} />}
      </Modal>
      <Modal
        open={!!policyTarget}
        onClose={() => setPolicyTarget(null)}
        title={t('organization.branches.policy.modalTitle')}
      >
        {policyTarget && (
          <PolicyForm
            branch={policyTarget}
            initial={policyTarget.attendancePolicy}
            onSave={handlePolicySave}
            onDelete={handlePolicyDelete}
            onClose={() => setPolicyTarget(null)}
          />
        )}
      </Modal>
      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('organization.branches.confirm.deleteTitle')}
        message={t('organization.branches.confirm.deleteMessage', {
          name: deleting?.name || '',
        })}
      />
    </div>
  );
}
