import { useState, useEffect, useCallback, useRef, type ChangeEvent, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  employeeService,
  type Employee,
  type CareerTransaction,
  type FaceProfileStatus,
} from '@/services/employee.service';
import { organizationService, type Branch, type Department, type Position } from '@/services/organization.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { useI18n } from '@/i18n/provider';
import { cn } from '@/utils/cn';
import {
  ArrowLeft, UserRound, Mail, Phone, Briefcase,
  CalendarDays, BadgeCheck, Sparkles, Plus, ArrowRightLeft, Loader2,
  Users, GraduationCap, PhoneCall, BookOpen, Award, Paperclip, type LucideIcon,
  ScanFace, ShieldCheck, Upload, Trash2,
} from 'lucide-react';
import { formatDate, formatDateTime } from '@/utils/format';
import {
  FamilyTab, EducationTab, EmergencyContactTab,
  TrainingTab, SkillTab, ExperienceTab, AttachmentTab,
} from '@/modules/employee/components/detail-tabs';

const CAREER_TRANSACTION_TYPES = [
  'PROMOTION',
  'DEMOTION',
  'MUTATION',
  'TRANSFER',
  'ROTATION',
  'ACTING_ASSIGNMENT',
  'STATUS_CHANGE',
] as const;

const EMPLOYMENT_TYPES = ['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING'] as const;

const WORKSPACE_SECTIONS = [
  {
    key: 'overview',
    icon: UserRound,
  },
  {
    key: 'profile',
    icon: Users,
  },
  {
    key: 'career',
    icon: Briefcase,
  },
] as const;

function getCareerTransactionLabel(type: CareerTransaction['transactionType'], t: ReturnType<typeof useI18n>['t']) {
  switch (type) {
    case 'PROMOTION':
      return t('employees.detail.transactionType.promotion');
    case 'DEMOTION':
      return t('employees.detail.transactionType.demotion');
    case 'MUTATION':
      return t('employees.detail.transactionType.mutation');
    case 'TRANSFER':
      return t('employees.detail.transactionType.transfer');
    case 'ROTATION':
      return t('employees.detail.transactionType.rotation');
    case 'ACTING_ASSIGNMENT':
      return t('employees.detail.transactionType.actingAssignment');
    case 'STATUS_CHANGE':
      return t('employees.detail.transactionType.statusChange');
    default:
      return type;
  }
}

function ChangeRow({ label, from, to }: { label: string; from?: string | null; to?: string | null }) {
  if (!from && !to) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <span className="truncate">{from || '-'}</span>
        <ArrowRightLeft size={12} className="shrink-0 text-muted-foreground" />
        <span className="truncate font-medium">{to || '-'}</span>
      </div>
    </div>
  );
}

function OverviewStatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
          <p className="mt-2 text-base font-semibold leading-tight text-foreground">{value}</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground">
          <Icon size={16} />
        </div>
      </div>
    </div>
  );
}

function DetailCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('rounded-2xl border border-border bg-background', className)}>
      <div className="border-b border-border px-5 py-4">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p> : null}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/15 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-sm font-medium text-foreground', mono && 'font-mono text-[13px]')}>
        {value || '-'}
      </p>
    </div>
  );
}

function CareerTransactionDialog({
  open,
  onClose,
  onSubmit,
  saving,
  branches,
  departments,
  positions,
  employee,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    effectiveDate: string;
    transactionType: CareerTransaction['transactionType'];
    toBranchId?: string | null;
    toDepartmentId?: string | null;
    toPositionId?: string | null;
    toEmploymentType?: string | null;
    referenceNumber?: string;
    reason?: string;
    notes?: string;
  }) => Promise<void>;
  saving: boolean;
  branches: Branch[];
  departments: Department[];
  positions: Position[];
  employee: Employee | null;
}) {
  const [form, setForm] = useState({
    effectiveDate: new Date().toISOString().split('T')[0],
    transactionType: 'PROMOTION' as CareerTransaction['transactionType'],
    toBranchId: '',
    toDepartmentId: '',
    toPositionId: '',
    toEmploymentType: '',
    referenceNumber: '',
    reason: '',
    notes: '',
  });
  const { t } = useI18n();

  useEffect(() => {
    if (!open || !employee) return;
    setForm({
      effectiveDate: new Date().toISOString().split('T')[0],
      transactionType: 'PROMOTION',
      toBranchId: employee.branchId || '',
      toDepartmentId: employee.departmentId || '',
      toPositionId: employee.positionId || '',
      toEmploymentType: employee.employmentType || '',
      referenceNumber: '',
      reason: '',
      notes: '',
    });
  }, [open, employee]);

  if (!open || !employee) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl rounded-2xl border border-border bg-background shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('employees.detail.dialog.badge')}</p>
            <h3 className="mt-1 text-lg font-semibold">{employee.fullName}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{t('employees.detail.dialog.description')}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t('employees.detail.dialog.close')}
          </Button>
        </div>

        <form
          onSubmit={async (event) => {
            event.preventDefault();
            await onSubmit({
              effectiveDate: new Date(form.effectiveDate).toISOString(),
              transactionType: form.transactionType,
              toBranchId: form.toBranchId || null,
              toDepartmentId: form.toDepartmentId || null,
              toPositionId: form.toPositionId || null,
              toEmploymentType: form.toEmploymentType || null,
              referenceNumber: form.referenceNumber || undefined,
              reason: form.reason || undefined,
              notes: form.notes || undefined,
            });
          }}
          className="p-5"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.transactionType')}</label>
              <Select2
                value={form.transactionType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, transactionType: value as CareerTransaction['transactionType'] }))}
                options={CAREER_TRANSACTION_TYPES.map((type) => ({
                  value: type,
                  label: getCareerTransactionLabel(type, t),
                }))}
                placeholder={t('employees.detail.dialog.selectTransaction')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.effectiveDate')}</label>
              <Input type="date" value={form.effectiveDate} onChange={(e) => setForm((prev) => ({ ...prev, effectiveDate: e.target.value }))} required className="h-10" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.toBranch')}</label>
              <Select2
                value={form.toBranchId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toBranchId: value }))}
                options={[
                  { value: '', label: t('employees.detail.dialog.noBranch') },
                  ...branches.map((branch) => ({ value: branch.id, label: branch.name })),
                ]}
                placeholder={t('employees.detail.dialog.selectBranch')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.toDepartment')}</label>
              <Select2
                value={form.toDepartmentId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toDepartmentId: value }))}
                options={[
                  { value: '', label: t('employees.detail.dialog.noDepartment') },
                  ...departments.map((department) => ({ value: department.id, label: department.name })),
                ]}
                placeholder={t('employees.detail.dialog.selectDepartment')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.toPosition')}</label>
              <Select2
                value={form.toPositionId}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toPositionId: value }))}
                options={[
                  { value: '', label: t('employees.detail.dialog.noPosition') },
                  ...positions.map((position) => ({ value: position.id, label: position.name })),
                ]}
                placeholder={t('employees.detail.dialog.selectPosition')}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.toEmploymentType')}</label>
              <Select2
                value={form.toEmploymentType}
                onValueChange={(value) => setForm((prev) => ({ ...prev, toEmploymentType: value }))}
                options={[
                  { value: '', label: t('employees.detail.dialog.noChange') },
                  ...EMPLOYMENT_TYPES.map((type) => ({ value: type, label: type })),
                ]}
                placeholder={t('employees.detail.dialog.selectEmploymentType')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.referenceNumber')}</label>
              <Input value={form.referenceNumber} onChange={(e) => setForm((prev) => ({ ...prev, referenceNumber: e.target.value }))} placeholder="SK/HR/2026/001" className="h-10" />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.reason')}</label>
              <textarea
                value={form.reason}
                onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))}
                className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={t('employees.detail.dialog.reasonPlaceholder')}
              />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{t('employees.detail.dialog.notes')}</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                className="h-20 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                placeholder={t('employees.detail.dialog.notesPlaceholder')}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3 border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={onClose}>{t('common.cancel')}</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 size={16} className="mr-2 animate-spin" /> : <Sparkles size={16} className="mr-2" />}
              {saving ? t('employees.detail.dialog.saving') : t('employees.detail.dialog.save')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EmployeeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [transactions, setTransactions] = useState<CareerTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [faceProfile, setFaceProfile] = useState<FaceProfileStatus>({ enrolled: false });
  const [faceProfileError, setFaceProfileError] = useState<string | null>(null);
  const [savingFaceProfile, setSavingFaceProfile] = useState(false);
  const facePhotoInputRef = useRef<HTMLInputElement | null>(null);
  const requestedEmployeeIdRef = useRef<string | null>(null);
  const requestedCompanyIdRef = useRef<string | null>(null);
  const [activeTab, setActiveTab] = useState('family');
  const [activeWorkspace, setActiveWorkspace] = useState<(typeof WORKSPACE_SECTIONS)[number]['key']>('overview');

  const workspaceSections = [
    {
      key: 'overview',
      label: t('employees.detail.sections.overview.label'),
      description: t('employees.detail.sections.overview.description'),
      icon: Sparkles,
    },
    {
      key: 'profile',
      label: t('employees.detail.sections.profile.label'),
      description: t('employees.detail.sections.profile.description'),
      icon: Users,
    },
    {
      key: 'career',
      label: t('employees.detail.sections.career.label'),
      description: t('employees.detail.sections.career.description'),
      icon: Briefcase,
    },
  ] as const;

  const detailTabs = [
    { key: 'family', label: t('employees.detail.tabs.family.label'), icon: Users, description: t('employees.detail.tabs.family.description') },
    { key: 'education', label: t('employees.detail.tabs.education.label'), icon: GraduationCap, description: t('employees.detail.tabs.education.description') },
    { key: 'emergency', label: t('employees.detail.tabs.emergency.label'), icon: PhoneCall, description: t('employees.detail.tabs.emergency.description') },
    { key: 'training', label: t('employees.detail.tabs.training.label'), icon: BookOpen, description: t('employees.detail.tabs.training.description') },
    { key: 'skill', label: t('employees.detail.tabs.skill.label'), icon: Award, description: t('employees.detail.tabs.skill.description') },
    { key: 'experience', label: t('employees.detail.tabs.experience.label'), icon: Briefcase, description: t('employees.detail.tabs.experience.description') },
    { key: 'attachment', label: t('employees.detail.tabs.attachment.label'), icon: Paperclip, description: t('employees.detail.tabs.attachment.description') },
  ] as const;

  const activeTabConfig = detailTabs.find((tab) => tab.key === activeTab) || detailTabs[0];
  const ActiveSectionIcon = activeTabConfig.icon;

  function renderActiveDetailTab() {
    if (!employee) return null;

    switch (activeTab) {
      case 'family':
        return <FamilyTab employeeId={employee.id} />;
      case 'education':
        return <EducationTab employeeId={employee.id} />;
      case 'emergency':
        return <EmergencyContactTab employeeId={employee.id} />;
      case 'training':
        return <TrainingTab employeeId={employee.id} />;
      case 'skill':
        return <SkillTab employeeId={employee.id} />;
      case 'experience':
        return <ExperienceTab employeeId={employee.id} />;
      case 'attachment':
        return <AttachmentTab employeeId={employee.id} />;
      default:
        return <FamilyTab employeeId={employee.id} />;
    }
  }

  const fetchData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [employeeData, careerData] = await Promise.all([
        employeeService.getEmployee(id),
        employeeService.getCareerTransactions(id),
      ]);
      setEmployee(employeeData);
      setTransactions(careerData);
      try {
        const faceProfileData = await employeeService.getFaceProfile(id);
        setFaceProfile(faceProfileData);
        setFaceProfileError(null);
      } catch (error) {
        console.error('Failed to fetch face profile:', error);
        setFaceProfileError('Status profil wajah belum dapat dimuat. Coba muat ulang halaman.');
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error);
      toast.error(t('employees.detail.toast.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    if (!id) return;
    if (requestedEmployeeIdRef.current === id) return;
    requestedEmployeeIdRef.current = id;
    fetchData();
  }, [fetchData, id]);

  useEffect(() => {
    const companyId = employee?.companyId || '';
    if (!companyId) return;
    if (requestedCompanyIdRef.current === companyId) return;
    requestedCompanyIdRef.current = companyId;

    const fetchRefs = async () => {
      try {
        const [departmentData, positionData, branchData] = await Promise.all([
          organizationService.getDepartments(companyId),
          organizationService.getPositions(companyId),
          organizationService.getBranches(companyId),
        ]);
        setDepartments(departmentData);
        setPositions(positionData);
        setBranches(branchData);
      } catch (error) {
        console.error('Failed to fetch organization refs:', error);
      }
    };

    fetchRefs();
  }, [employee?.companyId]);

  const handleFacePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const photo = event.target.files?.[0];
    event.target.value = '';
    if (!id || !photo) return;
    if (!['image/jpeg', 'image/png'].includes(photo.type)) {
      toast.error('Gunakan foto JPEG atau PNG.');
      return;
    }
    if (photo.size > 5 * 1024 * 1024) {
      toast.error('Ukuran foto maksimal 5 MB.');
      return;
    }

    try {
      setSavingFaceProfile(true);
      const status = await employeeService.enrollFaceProfile(id, photo);
      setFaceProfile(status);
      setFaceProfileError(null);
      toast.success('Profil wajah berhasil didaftarkan.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Registrasi wajah gagal.');
    } finally {
      setSavingFaceProfile(false);
    }
  };

  const handleDeleteFaceProfile = async () => {
    if (!id || !window.confirm('Hapus profil wajah karyawan ini? Face recognition tidak bisa dipakai sampai registrasi ulang.')) return;
    try {
      setSavingFaceProfile(true);
      await employeeService.deleteFaceProfile(id);
      setFaceProfile({ enrolled: false });
      setFaceProfileError(null);
      toast.success('Profil wajah dihapus.');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal menghapus profil wajah.');
    } finally {
      setSavingFaceProfile(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-sm text-muted-foreground">{t('common.loading')}</div>;
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-muted-foreground">{t('employees.detail.notFound')}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate('/employees')}>
          {t('employees.detail.actions.backToEmployees')}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={employee.fullName}
        description={`#${employee.employeeNumber}`}
        actions={
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus size={16} className="mr-2" />
              {t('employees.detail.actions.careerTransaction')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate('/employees')}>
              <ArrowLeft size={16} className="mr-2" />
              {t('employees.detail.actions.back')}
            </Button>
          </div>
        }
      />

      <div className="space-y-8">
        <div className="overflow-hidden rounded-[28px] border border-border bg-card">
          <div className="grid gap-6 px-5 py-5 lg:grid-cols-[minmax(0,1.45fr)_340px] lg:px-7 lg:py-6">
            <div className="space-y-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[24px] border border-border bg-muted/20">
                  {employee.avatar ? (
                    <img src={employee.avatar} alt="" className="h-24 w-24 rounded-[24px] object-cover" />
                  ) : (
                    <UserRound size={38} className="text-muted-foreground" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      {t('employees.detail.workspace.badge')}
                    </span>
                    <span className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                      #{employee.employeeNumber}
                    </span>
                  </div>

                  <h2 className="mt-4 text-3xl font-semibold tracking-tight text-foreground">{employee.fullName}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{employee.position?.name || t('employees.detail.positionFallback')}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                      {employee.department?.name || t('employees.detail.departmentFallback')}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                      {employee.branch?.name || t('employees.detail.companyLevel')}
                    </span>
                    <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-foreground">
                      {employee.employmentStatus}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-background px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail size={14} />
                        <span className="truncate text-sm">{employee.email || '-'}</span>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-background px-4 py-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone size={14} />
                        <span className="text-sm">{employee.phone || '-'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <OverviewStatCard icon={BadgeCheck} label={t('employees.detail.stats.employmentStatus')} value={employee.employmentStatus} />
              <OverviewStatCard icon={Briefcase} label={t('employees.detail.stats.employmentType')} value={employee.employmentType} />
              <OverviewStatCard icon={CalendarDays} label={t('employees.detail.stats.joinDate')} value={employee.joinDate ? formatDate(employee.joinDate) : '-'} />
              <OverviewStatCard icon={Sparkles} label={t('employees.detail.stats.careerHistory')} value={t('employees.detail.stats.recordCount', { count: transactions.length })} />
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {workspaceSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeWorkspace === section.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => setActiveWorkspace(section.key)}
                className={cn(
                  'rounded-2xl border px-5 py-4 text-left transition-all duration-200',
                  isActive
                    ? 'border-foreground/15 bg-foreground text-background'
                    : 'border-border bg-card hover:border-foreground/15 hover:bg-muted/20'
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'rounded-xl border p-2.5',
                      isActive ? 'border-white/10 bg-white/10 text-background' : 'border-border bg-muted/30 text-muted-foreground'
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{section.label}</p>
                    <p className={cn('mt-1 text-xs leading-5', isActive ? 'text-background/75' : 'text-muted-foreground')}>
                      {section.description}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="rounded-[28px] border border-border bg-card shadow-sm">
          <div className="px-5 py-5 lg:px-6 lg:py-6">
            {activeWorkspace === 'overview' && (
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                  <DetailCard
                    title={t('employees.detail.cards.identitySummary.title')}
                    subtitle={t('employees.detail.cards.identitySummary.subtitle')}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <DetailItem label={t('employees.detail.fields.department')} value={employee.department?.name} />
                      <DetailItem label={t('employees.detail.fields.position')} value={employee.position?.name} />
                      <DetailItem label={t('employees.detail.fields.companyScope')} value={employee.branch?.name || employee.department?.name || t('employees.detail.companyLevel')} />
                      <DetailItem label={t('employees.detail.fields.joinDate')} value={employee.joinDate ? formatDate(employee.joinDate) : '-'} />
                    </div>
                  </DetailCard>

                  <DetailCard
                    title={t('employees.detail.cards.personalDetails.title')}
                    subtitle={t('employees.detail.cards.personalDetails.subtitle')}
                  >
                    <div className="grid gap-3">
                      <DetailItem label={t('employees.detail.fields.gender')} value={employee.gender} />
                      <DetailItem label={t('employees.detail.fields.religion')} value={employee.religion} />
                      <DetailItem label={t('employees.detail.fields.maritalStatus')} value={employee.maritalStatus} />
                      <DetailItem label={t('employees.detail.fields.idNumber')} value={employee.idNumber} />
                    </div>
                  </DetailCard>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
                  <DetailCard
                    title={t('employees.detail.cards.bankTax.title')}
                    subtitle={t('employees.detail.cards.bankTax.subtitle')}
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <DetailItem label={t('employees.detail.fields.bankName')} value={employee.bankName} />
                      <DetailItem label={t('employees.detail.fields.bankAccount')} value={employee.bankAccount} mono />
                      <DetailItem label={t('employees.detail.fields.accountHolder')} value={employee.bankAccountHolder} />
                      <DetailItem label={t('employees.detail.fields.taxId')} value={employee.taxId} mono />
                      <DetailItem label={t('employees.detail.fields.bpjsEmployment')} value={employee.bpjsKetenagakerjaan} mono />
                      <DetailItem label={t('employees.detail.fields.bpjsHealth')} value={employee.bpjsKesehatan} mono />
                    </div>
                  </DetailCard>

                  <div className="space-y-6">
                    <DetailCard
                      title={t('employees.detail.cards.recordInfo.title')}
                      subtitle={t('employees.detail.cards.recordInfo.subtitle')}
                    >
                      <div className="grid gap-3">
                        <DetailItem label={t('employees.detail.fields.createdAt')} value={formatDateTime(employee.createdAt)} />
                      </div>
                    </DetailCard>

                    <DetailCard
                      title="Profil face recognition"
                      subtitle="Template biometrik untuk verifikasi check-in. Foto sumber tidak disimpan."
                    >
                      <div className="space-y-4">
                        <div className="flex items-start gap-3 rounded-2xl border border-border bg-muted/15 p-4">
                          <div className={cn(
                            'rounded-xl border p-2.5',
                            faceProfile.enrolled
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'border-border bg-background text-muted-foreground',
                          )}>
                            {faceProfile.enrolled && !faceProfileError ? <ShieldCheck size={18} /> : <ScanFace size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-foreground">
                              {faceProfileError
                                ? 'Status profil tidak tersedia'
                                : faceProfile.enrolled
                                  ? 'Wajah sudah terdaftar'
                                  : 'Belum ada profil wajah'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-muted-foreground">
                              {faceProfileError ?? (faceProfile.enrolled
                                ? `Diperbarui ${faceProfile.updatedAt ? formatDateTime(faceProfile.updatedAt) : '-'}. Template disimpan terenkripsi.`
                                : 'Unggah atau ambil satu foto frontal dengan pencahayaan yang jelas.')}
                            </p>
                          </div>
                        </div>

                        <input
                          ref={facePhotoInputRef}
                          type="file"
                          accept="image/jpeg,image/png"
                          capture="user"
                          className="sr-only"
                          aria-label="Pilih foto untuk registrasi wajah"
                          onChange={handleFacePhoto}
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant={faceProfile.enrolled ? 'outline' : 'default'}
                            disabled={savingFaceProfile || Boolean(faceProfileError)}
                            onClick={() => facePhotoInputRef.current?.click()}
                          >
                            {savingFaceProfile ? <Loader2 size={15} className="mr-2 animate-spin" /> : <Upload size={15} className="mr-2" />}
                            {faceProfile.enrolled ? 'Daftarkan ulang' : 'Daftarkan wajah'}
                          </Button>
                          {faceProfile.enrolled ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingFaceProfile || Boolean(faceProfileError)}
                              onClick={handleDeleteFaceProfile}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 size={15} className="mr-2" />
                              Hapus profil
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    </DetailCard>

                    <DetailCard
                      title={t('employees.detail.cards.latestCareer.title')}
                      subtitle={t('employees.detail.cards.latestCareer.subtitle')}
                    >
                      {transactions[0] ? (
                        <div className="space-y-3">
                          <span className="inline-flex items-center rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
                            {getCareerTransactionLabel(transactions[0].transactionType, t)}
                          </span>
                          <DetailItem label={t('employees.detail.fields.reference')} value={transactions[0].referenceNumber || t('employees.detail.noReference')} />
                          <DetailItem label={t('employees.detail.fields.effectiveDate')} value={formatDate(transactions[0].effectiveDate)} />
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-6 text-sm text-muted-foreground">
                          {t('employees.detail.career.empty')}
                        </div>
                      )}
                    </DetailCard>
                  </div>
                </div>

                {employee.address && (
                  <DetailCard
                    title={t('employees.detail.cards.address.title')}
                    subtitle={t('employees.detail.cards.address.subtitle')}
                  >
                    <div className="rounded-2xl bg-muted/30 px-4 py-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{employee.address}</p>
                    </div>
                  </DetailCard>
                )}
              </div>
            )}

            {activeWorkspace === 'profile' && (
              <div className="rounded-[28px] border border-border bg-card shadow-sm">
                <div className="border-b border-border px-5 py-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <h3 className="text-sm font-semibold">{t('employees.detail.profile.title')}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t('employees.detail.profile.subtitle')}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-muted/15 px-3 py-2 text-xs text-muted-foreground">
                      {t('employees.detail.profile.activeSection')}: <span className="font-medium text-foreground">{activeTabConfig.label}</span>
                    </div>
                  </div>
                </div>

                <div className="border-b border-border px-4 py-4">
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {detailTabs.map((tab) => {
                      const Icon = tab.icon;
                      const isActive = activeTab === tab.key;

                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setActiveTab(tab.key)}
                          className={cn(
                            'min-w-[190px] rounded-2xl border px-4 py-3 text-left transition-all',
                            isActive
                              ? 'border-foreground/15 bg-foreground text-background'
                              : 'border-border bg-background hover:border-foreground/15 hover:bg-muted/20'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <Icon size={16} />
                            <span className="text-sm font-medium">{tab.label}</span>
                          </div>
                          <p className={cn('mt-2 text-xs leading-5', isActive ? 'text-background/75' : 'text-muted-foreground')}>
                            {tab.description}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="px-5 py-5">
                  <div className="mb-4 rounded-2xl border border-dashed border-border bg-muted/10 px-4 py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-xl border border-border bg-muted/20 p-2 text-muted-foreground">
                        <ActiveSectionIcon size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{activeTabConfig.label}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{activeTabConfig.description}</p>
                      </div>
                    </div>
                  </div>
                  {renderActiveDetailTab()}
                </div>
              </div>
            )}

            {activeWorkspace === 'career' && (
              <div className="rounded-[28px] border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold">{t('employees.detail.career.title')}</h3>
                    <p className="text-xs text-muted-foreground">{t('employees.detail.career.subtitle')}</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setDialogOpen(true)}>
                    <Plus size={16} className="mr-2" />
                    {t('employees.detail.career.add')}
                  </Button>
                </div>

                {transactions.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center text-sm text-muted-foreground">
                    {t('employees.detail.career.empty')}
                  </div>
                ) : (
                  <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
                    {transactions.map((transaction) => (
                      <div key={transaction.id} className="rounded-2xl border border-border bg-background p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center rounded-full border border-border bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground">
                                {getCareerTransactionLabel(transaction.transactionType, t)}
                              </span>
                              <span className="text-xs text-muted-foreground">{formatDate(transaction.effectiveDate)}</span>
                            </div>
                            <p className="mt-2 text-sm font-medium">{transaction.referenceNumber || t('employees.detail.noReference')}</p>
                            {transaction.reason && (
                              <p className="mt-1 text-sm text-muted-foreground">{transaction.reason}</p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {t('employees.detail.career.createdAt', { date: formatDateTime(transaction.createdAt) })}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2">
                          <ChangeRow label={t('employees.detail.fields.branch')} from={transaction.fromBranch?.name} to={transaction.toBranch?.name} />
                          <ChangeRow label={t('employees.detail.fields.department')} from={transaction.fromDepartment?.name} to={transaction.toDepartment?.name} />
                          <ChangeRow label={t('employees.detail.fields.position')} from={transaction.fromPosition?.name} to={transaction.toPosition?.name} />
                          <ChangeRow label={t('employees.detail.fields.employmentType')} from={transaction.fromEmploymentType} to={transaction.toEmploymentType} />
                        </div>

                        {transaction.notes && (
                          <div className="mt-3 rounded-xl border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            {transaction.notes}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <CareerTransactionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={employee}
        saving={savingTransaction}
        branches={branches}
        departments={departments}
        positions={positions}
        onSubmit={async (payload) => {
          if (!id) return;
          try {
            setSavingTransaction(true);
            await employeeService.createCareerTransaction(id, payload);
            toast.success(t('employees.detail.toast.submitSuccess'));
            setDialogOpen(false);
            await fetchData();
          } catch (error) {
            console.error('Failed to create career transaction:', error);
            toast.error(t('employees.detail.toast.submitFailed'));
          } finally {
            setSavingTransaction(false);
          }
        }}
      />
    </div>
  );
}
