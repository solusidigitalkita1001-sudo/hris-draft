import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { authService, type AuthUser, type UserSession } from '@/services/auth.service';
import {
  employeeService,
  type Employee,
  type MyReportingLine,
  type CareerTransaction,
  type EmployeeEmergencyContact,
  type EmployeeAttachment,
} from '@/services/employee.service';
import { leaveService, type LeaveBalance } from '@/services/leave.service';
import { payrollService, type MyPayslipSummary, type PayslipPinStatus } from '@/services/payroll.service';
import { PayslipPinDialog } from '@/modules/payroll/components/PayslipPinDialog';
import { useAuthStore } from '@/stores/auth.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip, statusTone } from '@/components/shared/StatusChip';
import { apiErrorMessage } from '@/lib/errors';
import { formatDate, getInitials } from '@/utils/format';
import {
  RefreshCw, Lock, CreditCard, KeyRound, ShieldCheck, FileText,
  Check, Download, ExternalLink, AlertTriangle,
} from 'lucide-react';

// ─── Label maps ─────────────────────────────────────────
const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  PERMANENT: 'Karyawan tetap',
  CONTRACT: 'Karyawan kontrak',
  PROBATION: 'Masa percobaan',
  INTERNSHIP: 'Magang',
  FREELANCE: 'Freelance',
  PART_TIME: 'Paruh waktu',
};

const EMPLOYEE_CATEGORY_LABELS: Record<string, string> = {
  OFFICE: 'Kantor',
  FACTORY: 'Pabrik',
  FIELD: 'Lapangan',
  REMOTE: 'Remote',
};

const CAREER_TYPE_LABELS: Record<string, string> = {
  PROMOTION: 'Promosi',
  DEMOTION: 'Demosi',
  MUTATION: 'Mutasi',
  TRANSFER: 'Transfer',
  ROTATION: 'Rotasi',
  ACTING_ASSIGNMENT: 'Penugasan Sementara',
  STATUS_CHANGE: 'Perubahan Status',
};

type ProfileTab = 'overview' | 'payslip' | 'employment' | 'documents' | 'settings';

function payslipDate(p: MyPayslipSummary): string {
  return p.payrollRun?.period?.payDate || p.createdAt;
}

const TABS: { key: ProfileTab; label: string }[] = [
  { key: 'overview', label: 'Ringkasan' },
  { key: 'payslip', label: 'Slip Gaji' },
  { key: 'employment', label: 'Kepegawaian' },
  { key: 'documents', label: 'Dokumen' },
  { key: 'settings', label: 'Pengaturan' },
];

// ─── Small presentational pieces ────────────────────────
function FieldRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">{k}</p>
      <p className="mt-1.5 break-words text-[12.5px] font-medium text-foreground">{v}</p>
    </div>
  );
}

function SectionCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-[15px] font-semibold tracking-[-0.3px] text-foreground">{title}</h3>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </div>
  );
}

/** Donut ring r=25 stroke 7 (62px) sesuai prototipe. */
function RingStat({ fraction, label }: { fraction: number; label: string }) {
  const r = 25;
  const c = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(1, fraction));
  return (
    <div className="relative h-[62px] w-[62px] flex-none" aria-hidden="true">
      <svg width="62" height="62" viewBox="0 0 62 62" className="-rotate-90">
        <circle cx="31" cy="31" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="31" cy="31" r={r} fill="none" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${clamped * c} ${c}`}
          className="stroke-primary transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tracking-[-0.2px] text-foreground">
        {label}
      </span>
    </div>
  );
}

/** Sparkline batang 6 bulan. */
function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex h-[52px] flex-none items-end gap-1" aria-hidden="true">
      {values.map((v, i) => (
        <span
          key={i}
          className={`w-[7px] rounded-[4px] ${v > 0 ? 'bg-primary' : 'bg-muted'}`}
          style={{ height: `${v > 0 ? Math.max(18, (v / max) * 100) : 10}%` }}
        />
      ))}
    </div>
  );
}

/** Bar bertingkat progres masa kerja. */
function MiniSteps({ filled, total = 4 }: { filled: number; total?: number }) {
  return (
    <div className="flex w-[58px] flex-none flex-col-reverse gap-[5px]" aria-hidden="true">
      {Array.from({ length: total }).map((_, i) => (
        <span key={i} className={`h-[7px] rounded-[4px] ${i < filled ? 'bg-primary' : 'bg-muted'}`} />
      ))}
    </div>
  );
}

function ChartStatCard({
  label, value, unit, badge, note, chart,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  badge?: string;
  note?: string;
  chart?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-card-sm border border-border bg-card px-[18px] py-[17px] shadow-card">
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground">{label}</p>
        <div className="mt-2 flex flex-wrap items-baseline gap-1.5">
          <span className="text-2xl font-semibold leading-none tracking-[-1px] text-foreground">{value}</span>
          {unit && <span className="text-[11px] text-muted-foreground">{unit}</span>}
        </div>
        {(badge || note) && (
          <div className="mt-2.5 flex items-center gap-1.5">
            {badge && (
              <span className="whitespace-nowrap rounded-full bg-accent px-2 py-1 text-[9.5px] font-semibold tracking-[0.2px] text-primary">
                {badge}
              </span>
            )}
            {note && <span className="truncate text-[10px] text-muted-foreground">{note}</span>}
          </div>
        )}
      </div>
      {chart}
    </div>
  );
}

// ─── PIN slip gaji ──────────────────────────────────────
function PayslipPinCard() {
  const [status, setStatus] = useState<PayslipPinStatus | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setStatus(await payrollService.getPayslipPinStatus());
    } catch {
      // Akun tanpa tautan karyawan (mis. admin murni) tidak punya PIN slip gaji.
      setStatus(null);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const pinSet = status?.pinSet === true;

  return (
    <SectionCard
      title="PIN Slip Gaji"
      action={
        loaded && status !== null ? (
          <StatusChip tone={pinSet ? 'success' : 'warning'}>
            {pinSet ? 'PIN sudah diset' : 'Belum diset'}
          </StatusChip>
        ) : undefined
      }
    >
      <p className="text-xs text-muted-foreground">
        PIN 6 digit melindungi nominal slip gaji Anda: server hanya mengirim angka setelah PIN
        terverifikasi di halaman Slip Gaji Saya.
      </p>
      {!loaded ? (
        <p className="mt-4 text-xs text-muted-foreground">Memuat status PIN...</p>
      ) : status === null ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Akun ini tidak tertaut ke data karyawan, jadi tidak memiliki slip gaji untuk dilindungi PIN.
        </p>
      ) : (
        <div className="mt-4 flex justify-end">
          <Button size="sm" variant={pinSet ? 'outline' : 'default'} onClick={() => setDialogOpen(true)}>
            <KeyRound size={14} className="mr-1.5" /> {pinSet ? 'Ubah PIN' : 'Atur PIN'}
          </Button>
        </div>
      )}
      <PayslipPinDialog
        open={dialogOpen}
        mode="set"
        pinAlreadySet={pinSet}
        onClose={() => setDialogOpen(false)}
        onPinSaved={load}
      />
    </SectionCard>
  );
}

// ─── Ganti kata sandi ───────────────────────────────────
function ChangePasswordCard({ mustChange }: { mustChange: boolean }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) return toast.error('Kata sandi baru minimal 8 karakter');
    if (newPassword !== confirmPassword) return toast.error('Konfirmasi kata sandi tidak sama');
    setSaving(true);
    try {
      await authService.changePassword(currentPassword, newPassword);
      toast.success('Kata sandi berhasil diganti');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengganti kata sandi'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Ganti kata sandi">
      {mustChange && (
        <div className="mb-4 flex items-center gap-2.5 rounded-field bg-warning-bg px-4 py-3 text-xs text-warning">
          <AlertTriangle size={14} className="flex-none" />
          Akun Anda ditandai wajib mengganti kata sandi.
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Kata sandi saat ini</label>
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Kata sandi baru</label>
            <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
          </div>
          <div>
            <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Ulangi kata sandi baru</label>
            <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">Minimal 8 karakter. Setelah diganti, session di perangkat lain sebaiknya dicabut.</p>
        <div className="flex justify-end">
          <Button type="submit" size="sm" disabled={saving}>
            <KeyRound size={14} className="mr-1.5" /> {saving ? 'Menyimpan...' : 'Simpan kata sandi'}
          </Button>
        </div>
      </form>
    </SectionCard>
  );
}

// ─── Halaman utama ──────────────────────────────────────
export function ProfilePage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [profile, setProfile] = useState<AuthUser | null>(null);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reportingLine, setReportingLine] = useState<MyReportingLine | null>(null);
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [payslips, setPayslips] = useState<MyPayslipSummary[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [careers, setCareers] = useState<CareerTransaction[] | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmployeeEmergencyContact[] | null>(null);
  const [attachments, setAttachments] = useState<EmployeeAttachment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [tab, setTab] = useState<ProfileTab>('overview');

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const profileData = await authService.getProfile();
      setProfile(profileData);
      setUser(profileData);
      const empId = profileData.employeeId || '';

      // Data pendukung dimuat best-effort: endpoint yang tidak bisa diakses
      // (403 untuk karyawan biasa) menghasilkan empty state jujur, bukan error.
      const [sessionsR, reportingR, balancesR, payslipsR, employeeR] = await Promise.allSettled([
        authService.getSessions(),
        employeeService.getMyReportingLine(),
        empId ? leaveService.getBalances(empId) : Promise.resolve([] as LeaveBalance[]),
        payrollService.getMyPayslips(),
        empId ? employeeService.getEmployee(empId) : Promise.reject(new Error('no-employee')),
      ]);
      setSessions(sessionsR.status === 'fulfilled' ? sessionsR.value : []);
      setReportingLine(reportingR.status === 'fulfilled' ? reportingR.value : null);
      setBalances(balancesR.status === 'fulfilled' ? balancesR.value : []);
      setPayslips(payslipsR.status === 'fulfilled' ? payslipsR.value : []);
      const emp = employeeR.status === 'fulfilled' ? employeeR.value : null;
      setEmployee(emp);

      if (emp) {
        const [careersR, contactsR, attachmentsR] = await Promise.allSettled([
          employeeService.getCareerTransactions(emp.id),
          employeeService.getEmergencyContacts(emp.id),
          employeeService.getAttachments(emp.id),
        ]);
        setCareers(careersR.status === 'fulfilled' ? careersR.value : null);
        setEmergencyContacts(contactsR.status === 'fulfilled' ? contactsR.value : null);
        setAttachments(attachmentsR.status === 'fulfilled' ? attachmentsR.value : null);
      } else {
        setCareers(null);
        setEmergencyContacts(null);
        setAttachments(null);
      }
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memuat profil'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [setUser]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRevokeSession = useCallback(async (sessionId: string) => {
    setRevokingId(sessionId);
    try {
      await authService.revokeSession(sessionId);
      toast.success('Session berhasil dicabut');
      await loadData(true);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal mencabut session'));
    } finally {
      setRevokingId(null);
    }
  }, [loadData]);

  // ── Derivasi dari data nyata ──────────────────────────
  const displayName = employee?.fullName || profile?.name || reportingLine?.employee.fullName || profile?.email || 'Pengguna';
  const employeeNumber = employee?.employeeNumber || reportingLine?.employee.employeeNumber || '';
  const positionName = employee?.position?.name || reportingLine?.employee.position?.name || '';
  const joinDate = employee?.joinDate || null;
  const employmentTypeLabel = employee?.employmentType
    ? (EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType)
    : null;

  const tenure = useMemo(() => {
    if (!joinDate) return null;
    const start = dayjs(joinDate);
    if (!start.isValid() || start.isAfter(dayjs())) return null;
    const totalMonths = dayjs().diff(start, 'month');
    return { years: Math.floor(totalMonths / 12), months: totalMonths % 12, totalMonths };
  }, [joinDate]);

  const currentYear = dayjs().year();
  const yearBalances = useMemo(() => {
    const thisYear = balances.filter((b) => b.year === currentYear);
    return thisYear.length > 0 ? thisYear : balances;
  }, [balances, currentYear]);
  const leaveTotal = yearBalances.reduce((sum, b) => sum + Number(b.totalDays || 0), 0);
  const leaveRemaining = yearBalances.reduce((sum, b) => sum + Number(b.remainingDays || 0), 0);

  const payslipsThisYear = payslips.filter((p) => dayjs(payslipDate(p)).year() === currentYear).length;
  const payslipBars = useMemo(() => {
    const months = Array.from({ length: 6 }, (_, i) => dayjs().subtract(5 - i, 'month').format('YYYY-MM'));
    return months.map((m) => payslips.filter((p) => dayjs(payslipDate(p)).format('YYYY-MM') === m).length);
  }, [payslips]);

  const completeness = useMemo(() => {
    if (!employee) return null;
    const checks: { label: string; ok: boolean }[] = [
      { label: 'Email', ok: Boolean(employee.email || profile?.email) },
      { label: 'Nomor telepon', ok: Boolean(employee.phone) },
      { label: 'Alamat', ok: Boolean(employee.address) },
      { label: 'Nomor identitas', ok: Boolean(employee.idNumber) },
      { label: 'Rekening bank', ok: Boolean(employee.bankAccount) },
      { label: 'NPWP', ok: Boolean(employee.taxId) },
      ...(emergencyContacts !== null
        ? [{ label: 'Kontak darurat', ok: emergencyContacts.length > 0 }]
        : []),
    ];
    const done = checks.filter((c) => c.ok).length;
    return { pct: Math.round((done / checks.length) * 100), checks };
  }, [employee, emergencyContacts, profile?.email]);

  const latestPayslip = payslips[0] ?? null;
  const supervisor = reportingLine?.primarySupervisor ?? null;

  if (loading) {
    return <div className="py-12 text-sm text-muted-foreground">Memuat profil...</div>;
  }

  return (
    <div>
      {/* ── Cover gradien ala handoff ── */}
      <div className="relative h-[158px] overflow-hidden rounded-card bg-[linear-gradient(115deg,#26496F_0%,#315B8C_52%,#4A7BB0_100%)]">
        <div className="absolute -top-[90px] -right-10 h-[280px] w-[280px] rounded-full bg-white/[.08]" />
        <div className="absolute -bottom-[140px] left-[120px] h-[300px] w-[300px] rounded-full bg-white/[.06]" />
      </div>

      {/* ── Identitas: avatar overlap + nama + aksi ── */}
      <div className="-mt-[52px] flex flex-wrap items-end justify-between gap-5 px-4 sm:px-6">
        <div className="flex min-w-0 items-end gap-3.5 sm:gap-[18px]">
          <div className="relative flex-none">
            <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-[5px] border-background bg-primary text-3xl font-semibold text-primary-foreground shadow-[0_18px_34px_-20px_rgba(15,23,42,0.7)]">
              {getInitials(displayName)}
            </div>
            <span className="absolute bottom-1.5 right-1.5 h-[17px] w-[17px] rounded-full border-[3px] border-background bg-success" aria-hidden="true" />
          </div>
          <div className="min-w-0 pb-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-[22px] font-semibold tracking-[-0.7px] text-foreground">{displayName}</h1>
              {employmentTypeLabel && <StatusChip tone="accent">{employmentTypeLabel}</StatusChip>}
            </div>
            <p className="mt-1 truncate text-[12.5px] text-muted-foreground">
              {[positionName, employeeNumber, joinDate ? `bergabung ${formatDate(joinDate)}` : null]
                .filter(Boolean)
                .join(' · ') || profile?.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2.5 pb-1.5">
          <Button variant="outline" size="sm" onClick={() => loadData(true)} disabled={refreshing}>
            <RefreshCw size={14} className={`mr-2 ${refreshing ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => setTab('payslip')}>
            <CreditCard size={14} className="mr-2 text-primary" /> Slip gaji
          </Button>
          <Button size="sm" className="rounded-[14px]" onClick={() => setTab('settings')}>
            <KeyRound size={14} className="mr-2" /> Ubah kata sandi
          </Button>
        </div>
      </div>

      {/* ── Strip stat berbentuk chart ── */}
      <div className="mt-[22px] grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-3.5">
        <ChartStatCard
          label="Masa kerja"
          value={tenure ? (tenure.years > 0 ? tenure.years : tenure.months) : '—'}
          unit={tenure ? (tenure.years > 0 ? `thn ${tenure.months} bln` : 'bulan') : undefined}
          badge={employmentTypeLabel ?? undefined}
          note={joinDate ? `sejak ${formatDate(joinDate)}` : 'Tanggal bergabung belum tersedia'}
          chart={tenure ? <MiniSteps filled={Math.max(1, Math.round(((tenure.totalMonths % 12) / 12) * 4))} /> : undefined}
        />
        <ChartStatCard
          label={`Sisa cuti ${currentYear}`}
          value={yearBalances.length > 0 ? leaveRemaining : '—'}
          unit={yearBalances.length > 0 ? `dari ${leaveTotal} hari` : undefined}
          badge={yearBalances.length > 0 ? `${yearBalances.length} jenis cuti` : undefined}
          note={yearBalances.length > 0 ? undefined : 'Saldo cuti belum tersedia'}
          chart={yearBalances.length > 0 && leaveTotal > 0
            ? <RingStat fraction={leaveRemaining / leaveTotal} label={`${leaveRemaining}/${leaveTotal}`} />
            : undefined}
        />
        <ChartStatCard
          label={`Slip gaji ${currentYear}`}
          value={payslipsThisYear}
          unit="slip terbit"
          badge="Terlindungi PIN"
          note="6 bulan terakhir"
          chart={<MiniBars values={payslipBars} />}
        />
        <ChartStatCard
          label="Sesi aktif"
          value={sessions.length}
          unit="perangkat"
          badge="Keamanan"
          note={sessions[0] ? `terakhir ${formatDate(sessions[0].createdAt)}` : 'Belum ada session tercatat'}
          chart={(
            <div className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-accent" aria-hidden="true">
              <ShieldCheck size={22} className="text-primary" />
            </div>
          )}
        />
      </div>

      {/* ── Tab ── */}
      <div className="mt-[18px] flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Bagian profil">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap border-b-2 px-[18px] py-3 text-[12.5px] transition-colors ${
              tab === t.key
                ? 'border-primary font-medium text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Ringkasan ── */}
      {tab === 'overview' && (
        <div className="mt-[18px] grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 space-y-3.5">
            <SectionCard title="Informasi pribadi">
              <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,180px),1fr))] gap-4">
                <FieldRow k="Nama lengkap" v={displayName} />
                <FieldRow k="Email" v={employee?.email || profile?.email || '-'} />
                <FieldRow k="No. karyawan" v={employeeNumber || '-'} />
                <FieldRow k="Telepon" v={employee?.phone || '-'} />
                <FieldRow k="Departemen" v={employee?.department?.name || '-'} />
                <FieldRow k="Posisi" v={positionName || '-'} />
                <FieldRow k="Cabang" v={employee?.branch?.name || '-'} />
                <FieldRow k="Alamat" v={employee?.address || '-'} />
              </div>
              {!employee && (
                <p className="mt-4 text-[11px] text-muted-foreground">
                  Sebagian data pribadi tidak dapat diakses dari akun ini. Hubungi HR bila ada data yang perlu diperbarui.
                </p>
              )}
            </SectionCard>

            <SectionCard title={`Saldo cuti ${currentYear}`}>
              {yearBalances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada saldo cuti yang tercatat untuk akun ini.</p>
              ) : (
                <div className="space-y-4">
                  {yearBalances.map((b) => {
                    const total = Number(b.totalDays || 0);
                    const remaining = Number(b.remainingDays || 0);
                    const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
                    return (
                      <div key={b.id}>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-[12.5px] font-medium text-foreground">{b.leaveType?.name || 'Cuti'}</span>
                          <span className="text-xs text-muted-foreground">
                            sisa <span className="font-semibold text-foreground">{remaining}</span> / {total} hari
                          </span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </div>

          <div className="min-w-0 space-y-3.5">
            {completeness && (
              <SectionCard
                title="Kelengkapan profil"
                action={<span className="text-[13px] font-semibold text-primary">{completeness.pct}%</span>}
              >
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completeness.pct}%` }} />
                </div>
                <div className="mt-4 space-y-2.5">
                  {completeness.checks.map((c) => (
                    <div key={c.label} className="flex items-center gap-2.5">
                      <span className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full ${c.ok ? 'bg-success-bg text-success' : 'bg-secondary text-muted-foreground'}`}>
                        <Check size={10} strokeWidth={3.2} />
                      </span>
                      <span className="flex-1 text-[11.5px] text-foreground">{c.label}</span>
                      <span className={`text-[10.5px] font-medium ${c.ok ? 'text-success' : 'text-muted-foreground'}`}>
                        {c.ok ? 'Lengkap' : 'Belum'}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Atasan langsung">
              {supervisor ? (
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full bg-[#5D87B4] text-[13px] font-semibold text-white">
                      {getInitials(supervisor.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-foreground">{supervisor.fullName}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {supervisor.position?.name || reportingLine?.reportsToPosition?.name || '-'}
                      </p>
                    </div>
                  </div>
                  {reportingLine && reportingLine.alternateSupervisors.length > 0 && (
                    <div className="mt-4 border-t border-border pt-3">
                      <p className="text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Pejabat alternatif</p>
                      <div className="mt-2 space-y-1.5">
                        {reportingLine.alternateSupervisors.map((alt) => (
                          <p key={alt.id} className="text-[11.5px] text-foreground">
                            {alt.fullName}
                            <span className="text-muted-foreground"> · {alt.position?.name || '-'}</span>
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {reportingLine?.reportsToPosition
                    ? `Posisi atasan (${reportingLine.reportsToPosition.name}) belum terisi.`
                    : 'Struktur atasan langsung belum tersedia untuk posisi Anda.'}
                </p>
              )}
            </SectionCard>

            <SectionCard title="Kontak darurat">
              {emergencyContacts === null ? (
                <p className="text-sm text-muted-foreground">Data kontak darurat tidak dapat diakses dari portal ini.</p>
              ) : emergencyContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada kontak darurat yang terdaftar. Hubungi HR untuk menambahkan.</p>
              ) : (
                <div className="space-y-3">
                  {emergencyContacts.map((c) => (
                    <div key={c.id}>
                      <p className="text-[12.5px] font-medium text-foreground">{c.fullName}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted-foreground">{c.relationship} · {c.phone}</p>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Tab: Slip Gaji ── */}
      {tab === 'payslip' && (
        <div className="mt-[18px] grid grid-cols-1 items-start gap-3.5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="min-w-0 rounded-card border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3.5">
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.3px] text-foreground">Slip gaji saya</h3>
                <p className="mt-1 text-[11.5px] text-muted-foreground">Nominal disembunyikan · dibuka dengan PIN di halaman Slip Gaji Saya</p>
              </div>
              <StatusChip tone="accent"><Lock size={11} /> Terlindungi PIN</StatusChip>
            </div>

            {payslips.length === 0 ? (
              <div className="mt-5 flex flex-col items-center gap-3 rounded-card-sm border border-dashed border-border px-6 py-12">
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-accent">
                  <FileText size={20} className="text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground">Belum ada slip gaji terbit</p>
                <p className="max-w-[300px] text-center text-[11.5px] text-muted-foreground">
                  Slip gaji Anda akan tampil di sini setiap kali payroll diterbitkan.
                </p>
              </div>
            ) : (
              <div className="mt-4 space-y-2.5">
                {payslips.map((p) => (
                  <div key={p.id} className="flex flex-wrap items-center gap-3.5 rounded-[18px] border border-border bg-background px-4 py-3.5">
                    <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[14px] bg-accent">
                      <FileText size={17} className="text-primary" />
                    </span>
                    <div className="min-w-0 flex-[1_1_160px]">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-foreground">
                          {p.payrollRun?.period?.name || p.payrollRun?.name || 'Periode payroll'}
                        </span>
                        <StatusChip tone={statusTone(p.status)}>{p.status}</StatusChip>
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {p.payrollRun?.period?.payDate
                          ? `Dibayarkan ${formatDate(p.payrollRun.period.payDate)}`
                          : `Terbit ${formatDate(p.createdAt)}`}
                      </p>
                    </div>
                    <div className="flex-none text-right">
                      <p className="text-[13px] font-semibold tracking-[1px] text-muted-foreground">Rp ••••••••</p>
                      <p className="mt-0.5 text-[10px] text-muted-foreground">take home pay</p>
                    </div>
                    <Button
                      size="sm"
                      className="rounded-[13px]"
                      title="Buka dengan PIN di halaman Slip Gaji Saya"
                      onClick={() => navigate('/my-payslips')}
                    >
                      <Lock size={12} className="mr-1.5" /> Buka
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0 space-y-3.5">
            <SectionCard title={`Ringkasan payroll ${currentYear}`}>
              <div className="flex items-end gap-2">
                <span className="text-[26px] font-semibold leading-none tracking-[-1.1px] text-foreground">{payslipsThisYear}</span>
                <span className="pb-0.5 text-[11.5px] text-muted-foreground">slip gaji terbit</span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-muted-foreground">Metode bayar</span>
                  <span className="text-[11.5px] font-medium text-foreground">
                    {employee?.bankName ? `Transfer ${employee.bankName}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-muted-foreground">Rekening</span>
                  <span className="text-[11.5px] font-medium text-foreground">
                    {employee?.bankAccount ? `···· ${employee.bankAccount.slice(-4)}` : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-muted-foreground">Slip terakhir</span>
                  <span className="text-[11.5px] font-medium text-foreground">
                    {latestPayslip?.payrollRun?.period?.name || (latestPayslip ? formatDate(latestPayslip.createdAt) : '—')}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11.5px] text-muted-foreground">Status terakhir</span>
                  <span className="text-[11.5px] font-medium text-foreground">{latestPayslip?.status || '—'}</span>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Kenapa nominal disembunyikan?">
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                Slip gaji berisi data sensitif. Server tidak mengirim nominal ke halaman ini —
                angka hanya dibuka setelah verifikasi PIN di halaman <span className="font-medium text-foreground">Slip Gaji Saya</span>,
                sehingga orang lain tidak dapat melihat gaji Anda saat layar terbuka.
              </p>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ── Tab: Kepegawaian ── */}
      {tab === 'employment' && (
        <div className="mt-[18px]">
          {!employee ? (
            <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
                <FileText size={24} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Data kepegawaian tidak dapat diakses</p>
              <p className="max-w-[360px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
                Akun ini tidak memiliki akses baca ke data kepegawaian lengkap. Hubungi HR bila Anda memerlukan salinan data tersebut.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
              <SectionCard title="Data kepegawaian">
                <div className="divide-y divide-border">
                  {[
                    ['No. karyawan', employee.employeeNumber],
                    ['Status karyawan', employee.employmentStatus || '-'],
                    ['Tipe kepegawaian', EMPLOYMENT_TYPE_LABELS[employee.employmentType] || employee.employmentType || '-'],
                    ['Kategori', EMPLOYEE_CATEGORY_LABELS[employee.employeeCategory] || employee.employeeCategory || '-'],
                    ['Tanggal bergabung', employee.joinDate ? formatDate(employee.joinDate) : '-'],
                    ['Departemen', employee.department?.name || '-'],
                    ['Posisi', employee.position?.name || '-'],
                    ['Cabang', employee.branch?.name || '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="text-right text-xs font-medium text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Riwayat jabatan">
                {careers === null ? (
                  <p className="text-sm text-muted-foreground">Riwayat jabatan tidak dapat diakses dari portal ini.</p>
                ) : careers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada riwayat perubahan jabatan yang tercatat.</p>
                ) : (
                  <div className="flex flex-col">
                    {careers.map((c, idx) => (
                      <div key={c.id} className="flex gap-3.5">
                        <div className="flex flex-none flex-col items-center">
                          <span className={`mt-1 h-[11px] w-[11px] rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                          {idx < careers.length - 1 && <span className="w-[2px] flex-1 bg-border" />}
                        </div>
                        <div className="min-w-0 flex-1 pb-5">
                          <p className="text-[12.5px] font-semibold text-foreground">
                            {CAREER_TYPE_LABELS[c.transactionType] || c.transactionType}
                            {c.toPosition?.name ? ` — ${c.toPosition.name}` : ''}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            {formatDate(c.effectiveDate)}
                            {c.fromPosition?.name ? ` · dari ${c.fromPosition.name}` : ''}
                            {c.reason ? ` · ${c.reason}` : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Dokumen ── */}
      {tab === 'documents' && (
        <div className="mt-[18px]">
          {attachments === null ? (
            <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
                <FileText size={24} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Dokumen tidak dapat diakses</p>
              <p className="max-w-[360px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
                Akun ini tidak memiliki akses ke arsip dokumen kepegawaian. Hubungi HR bila Anda memerlukan salinan dokumen.
              </p>
            </div>
          ) : attachments.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
                <FileText size={24} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">Belum ada dokumen</p>
              <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
                Dokumen kepegawaian Anda (kontrak, sertifikat, dan lainnya) akan tampil di sini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3.5">
              {attachments.map((d) => (
                <div key={d.id} className="flex flex-col gap-3.5 rounded-[22px] border border-border bg-card p-[18px] shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[14px] bg-accent">
                      <FileText size={17} className="text-primary" />
                    </span>
                    <StatusChip tone="neutral">{d.category || 'Dokumen'}</StatusChip>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-foreground" title={d.originalName || d.fileName}>
                      {d.originalName || d.fileName}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {formatDate(d.createdAt)}
                      {d.fileSize ? ` · ${Math.max(1, Math.round(d.fileSize / 1024))} KB` : ''}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] border border-border py-2 text-[11px] font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      <ExternalLink size={12} /> Pratinjau
                    </a>
                    <a
                      href={d.fileUrl}
                      download
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-[12px] bg-primary py-2 text-[11px] font-medium text-primary-foreground shadow-primary-btn transition-colors hover:bg-primary-hover"
                    >
                      <Download size={12} /> Unduh
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Pengaturan ── */}
      {tab === 'settings' && (
        <div className="mt-[18px] grid grid-cols-1 items-start gap-3.5 lg:grid-cols-2">
          <div className="min-w-0 space-y-3.5">
            <ChangePasswordCard mustChange={Boolean(profile?.mustChangePassword)} />
            <PayslipPinCard />
          </div>

          <SectionCard
            title="Keamanan & akses"
            action={(
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                {sessions.length} session
              </span>
            )}
          >
            <p className="mb-4 text-xs text-muted-foreground">
              Daftar session login yang masih aktif untuk akun ini. Cabut session yang tidak Anda kenali.
              Tema dan bahasa diatur lewat topbar; keluar akun lewat menu pengguna.
            </p>

            {!sessions.length ? (
              <div className="rounded-field border border-dashed border-border p-6 text-sm text-muted-foreground">
                Belum ada session aktif yang tercatat.
              </div>
            ) : (
              <div className="space-y-2.5">
                {sessions.map((session) => (
                  <div key={session.id} className="flex flex-col gap-3 rounded-[18px] border border-border bg-background p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0 space-y-1">
                      <p className="break-all text-[12.5px] font-medium text-foreground">{session.userAgent || 'Perangkat tidak dikenal'}</p>
                      <p className="text-[11px] text-muted-foreground">IP: {session.ipAddress || '-'}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Masuk {formatDate(session.createdAt)} · kedaluwarsa {formatDate(session.expiresAt)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-danger/25 text-danger hover:bg-danger-bg"
                      disabled={revokingId === session.id}
                      onClick={() => handleRevokeSession(session.id)}
                    >
                      {revokingId === session.id ? 'Mencabut...' : 'Cabut Session'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
