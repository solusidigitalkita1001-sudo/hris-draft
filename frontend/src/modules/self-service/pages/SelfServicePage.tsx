import { useState, useEffect, useCallback, type ReactNode } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { permissionRequestService, type PermissionRequest, type PermissionType, type RequestStatus, PERMISSION_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/services/permission-request.service';
import { leaveService } from '@/services/leave.service';
import { LeaveRequestForm } from '@/modules/leave/components/LeaveRequestForm';
import { attendanceService } from '@/services/attendance.service';
import { workCalendarService, type MyWorkCalendarDay, type MyWorkCalendarMonth, type ShiftSwapCandidateResponse, type ShiftSwapRequest, type ShiftSwapSchedulePreview } from '@/services/work-calendar.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { AppModal } from '@/components/shared/AppModal';
import { StatTile } from '@/components/shared/StatTile';
import { StatusChip, FilterChip, statusTone } from '@/components/shared/StatusChip';
import { TableShell, useTableControls } from '@/components/shared/TableShell';
import { popup } from '@/stores/popup.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCompanyStore } from '@/stores/company.store';
import {
  Plus, RefreshCw, FileText, CalendarDays, Clock,
  CheckCircle, XCircle, AlertCircle, Ban,
  Send, Repeat, Users, Table2, List,
} from 'lucide-react';
import { formatDate } from '@/utils/format';
import { apiErrorMessage } from '@/lib/errors';

const DAY_TYPE_LABELS: Record<string, string> = {
  WD: 'Kerja',
  WS: 'Shift',
  WE: 'Libur',
  NH: 'Libur Nasional',
  JL: 'Cuti Bersama',
  CH: 'Cuti',
  RH: 'Hari Istimewa',
  OT: 'Lembur',
};

const WEEKDAY_LABELS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function getCalendarCellTone(day: MyWorkCalendarDay) {
  if (day.overrideSource === 'SHIFT_SWAP') {
    return 'border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/40 dark:bg-violet-950/30 dark:text-violet-100';
  }

  if (day.absence?.category === 'SAKIT') {
    return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-100';
  }

  if (day.absence?.category === 'CUTI') {
    return 'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-900 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/30 dark:text-fuchsia-100';
  }

  if (day.absence?.category === 'IZIN') {
    return 'border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/40 dark:bg-orange-950/30 dark:text-orange-100';
  }

  if (day.scheduleSource === 'SHIFT_FORMULA') {
    return day.isWorkingDay
      ? 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100'
      : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200';
  }

  if (day.dayType === 'NH' || day.dayType === 'JL') {
    return 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100';
  }

  return day.isWorkingDay
    ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/30 dark:text-emerald-100'
    : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200';
}

function getAbsenceBadgeTone(category: NonNullable<MyWorkCalendarDay['absence']>['category']) {
  if (category === 'SAKIT') return 'border-red-200 bg-red-100 text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300';
  if (category === 'CUTI') return 'border-fuchsia-200 bg-fuchsia-100 text-fuchsia-700 dark:border-fuchsia-900/40 dark:bg-fuchsia-950/40 dark:text-fuchsia-300';
  return 'border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-900/40 dark:bg-orange-950/40 dark:text-orange-300';
}

function formatShiftSchedule(schedule?: ShiftSwapSchedulePreview | null) {
  if (!schedule) return 'Jadwal belum tersedia';

  const timeText = schedule.workStart && schedule.workEnd
    ? `${schedule.workStart} - ${schedule.workEnd}`
    : 'Tidak ada jam kerja';

  return schedule.label ? `${schedule.label} • ${timeText}` : timeText;
}

// ─── Segmented control (pill) ala handoff ───────────────
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { key: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (key: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex max-w-full gap-0.5 overflow-x-auto rounded-[14px] bg-secondary p-[3px]"
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          role="tab"
          aria-selected={value === option.key}
          onClick={() => onChange(option.key)}
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-[11px] px-3.5 py-2 text-[11.5px] font-medium transition-colors ${
            value === option.key
              ? 'bg-card text-foreground shadow-card'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

// ─── Tombol batalkan (danger, token semantik) ───────────
function CancelButton({ onClick, children = 'Batalkan' }: { onClick: () => void; children?: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 rounded-[12px] border border-danger/25 px-3 py-1.5 text-[11px] font-medium text-danger transition-colors hover:bg-danger-bg"
    >
      {children}
    </button>
  );
}

// ─── Permission Request Form ────────────────────────────
function PermissionForm({ onClose }: { onClose: () => void }) {
  const [type, setType] = useState<PermissionType>('PERSONAL');
  const [startDate, setStartDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [endDate, setEndDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [duration, setDuration] = useState(1);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const employeeId = localStorage.getItem('employeeId') || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId) return toast.error('employeeId tidak tersedia. Silakan login ulang');
    if (dayjs(endDate).isBefore(dayjs(startDate), 'day')) return toast.error('Tanggal selesai tidak boleh lebih kecil dari tanggal mulai');
    if (!Number.isFinite(duration) || duration <= 0) return toast.error('Durasi harus lebih dari 0');

    const maxDuration = dayjs(endDate).startOf('day').diff(dayjs(startDate).startOf('day'), 'day') + 1;
    if (duration > maxDuration) return toast.error(`Durasi melebihi rentang tanggal (maks ${maxDuration} hari)`);
    if (!reason.trim()) return toast.error('Alasan harus diisi');
    setSaving(true);
    try {
      await permissionRequestService.create({
        type,
        startDate: dayjs(startDate).toISOString(),
        endDate: dayjs(endDate).toISOString(),
        duration,
        reason: reason.trim(),
        employeeId,
      } as Partial<PermissionRequest>);
      toast.success('Pengajuan berhasil dikirim');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengirim pengajuan'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Tipe Izin *</label>
        <Select2
          value={type}
          onValueChange={(value) => setType(value as PermissionType)}
          options={Object.entries(PERMISSION_TYPE_LABELS).map(([key, label]) => ({
            value: key,
            label,
          }))}
          placeholder="Pilih tipe izin"
          className="h-9"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Tanggal Mulai *</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Tanggal Selesai *</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Durasi (hari) *</label>
        <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={0.5} step={0.5} required />
      </div>

      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Alasan *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Jelaskan alasan pengajuan..."
          rows={3}
          className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
          required
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
        <Button type="submit" size="sm" disabled={saving}>
          <Send size={14} className="mr-1.5" /> {saving ? 'Mengirim...' : 'Kirim Pengajuan'}
        </Button>
      </div>
    </form>
  );
}

function ShiftSwapRequestForm({ onClose }: { onClose: () => void }) {
  const [shiftDate, setShiftDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [targetEmployeeId, setTargetEmployeeId] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [candidateData, setCandidateData] = useState<ShiftSwapCandidateResponse | null>(null);

  const fetchCandidates = useCallback(async (date: string) => {
    setLoadingCandidates(true);
    try {
      const data = await workCalendarService.getMyShiftSwapCandidates(date);
      setCandidateData(data);
      setTargetEmployeeId((current) => data.candidates.some((candidate) => candidate.id === current) ? current : '');
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat kandidat tukar shift'));
      setCandidateData(null);
    } finally {
      setLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    void fetchCandidates(shiftDate);
  }, [fetchCandidates, shiftDate]);

  const selectedCandidate = candidateData?.candidates.find((candidate) => candidate.id === targetEmployeeId) ?? null;
  const isFactoryRequester = candidateData?.requester.employeeCategory === 'FACTORY';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!targetEmployeeId) {
      toast.error('Pilih rekan tukar shift terlebih dahulu');
      return;
    }

    if (!reason.trim()) {
      toast.error('Alasan request tukar shift harus diisi');
      return;
    }

    setSaving(true);
    try {
      await workCalendarService.createShiftSwapRequest({
        targetEmployeeId,
        shiftDate: dayjs(shiftDate).hour(12).minute(0).second(0).millisecond(0).toISOString(),
        reason: reason.trim(),
      });
      toast.success('Request tukar shift berhasil dikirim ke kepala regu');
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal mengirim request tukar shift'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Tanggal Shift *</label>
        <Input type="date" value={shiftDate} onChange={(e) => setShiftDate(e.target.value)} required />
      </div>

      <div className="rounded-field border border-border bg-accent/60 p-4">
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Akan disetujui oleh</p>
        <p className="text-sm font-semibold">{candidateData?.approver.fullName || '-'}</p>
        <p className="text-xs text-muted-foreground">
          {candidateData?.approver.employeeNumber || '-'}
          {candidateData?.approver.position?.name ? ` • ${candidateData.approver.position.name}` : ''}
        </p>
      </div>

      {loadingCandidates ? (
        <div className="rounded-field border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          Memuat kandidat tukar shift...
        </div>
      ) : !candidateData ? (
        <div className="rounded-field border border-border bg-muted/20 p-4 text-sm text-muted-foreground">
          Data kandidat belum tersedia.
        </div>
      ) : !isFactoryRequester ? (
        <div className="rounded-field border border-warning/30 bg-warning-bg p-4 text-sm text-warning">
          Fitur tukar shift hanya tersedia untuk pegawai pabrik yang memakai formula shifting.
        </div>
      ) : (
        <>
          <div>
            <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Rekan Tukar Shift *</label>
            <Select2
              value={targetEmployeeId}
              onValueChange={setTargetEmployeeId}
              options={[
                { value: '', label: candidateData.candidates.length > 0 ? 'Pilih rekan regu...' : 'Belum ada kandidat tersedia' },
                ...candidateData.candidates.map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.fullName} • ${candidate.employeeNumber}`,
                })),
              ]}
              placeholder="Pilih rekan regu..."
              className="h-9"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-field border border-border bg-background p-4">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Shift Saya</p>
              <p className="text-sm font-semibold">{candidateData.requester.fullName}</p>
              <p className="text-xs text-muted-foreground">{formatShiftSchedule(candidateData.requester.schedule)}</p>
            </div>
            <div className="rounded-field border border-border bg-background p-4">
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Shift Rekan</p>
              {selectedCandidate ? (
                <>
                  <p className="text-sm font-semibold">{selectedCandidate.fullName}</p>
                  <p className="text-xs text-muted-foreground">{formatShiftSchedule(selectedCandidate.schedule)}</p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Pilih rekan terlebih dahulu.</p>
              )}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Alasan Request *</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: ada kebutuhan keluarga dan sudah sepakat tukar dengan rekan satu regu."
              rows={3}
              className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground"
              required
            />
          </div>
        </>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" size="sm" onClick={onClose}>Batal</Button>
        <Button type="submit" size="sm" disabled={saving || loadingCandidates || !candidateData || !isFactoryRequester}>
          <Send size={14} className="mr-1.5" /> {saving ? 'Mengirim...' : 'Kirim Request'}
        </Button>
      </div>
    </form>
  );
}

// ─── Status icon per chip ───────────────────────────────
const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <AlertCircle size={12} />,
  APPROVED: <CheckCircle size={12} />,
  REJECTED: <XCircle size={12} />,
  CANCELLED: <Ban size={12} />,
};

function RequestStatusChip({ status }: { status: string }) {
  return (
    <StatusChip tone={statusTone(status)}>
      {STATUS_ICONS[status]} {REQUEST_STATUS_LABELS[status as RequestStatus] ?? status}
    </StatusChip>
  );
}

// ─── Main Component ─────────────────────────────────────
export function SelfServicePage() {
  const { user } = useAuthStore();
  const companyId = useCompanyStore((state) => state.activeCompanyId) ?? '';
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'permissions' | 'leave' | 'overtime' | 'calendar' | 'shift-swap'>('permissions');
  const [statusFilter, setStatusFilter] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'list'>('table');
  const [activeModal, setActiveModal] = useState<'permission' | 'shift-swap' | null>(null);
  const [shiftCalendarMeta, setShiftCalendarMeta] = useState<MyWorkCalendarMonth | null>(null);
  const [loadingShiftEligibility, setLoadingShiftEligibility] = useState(true);
  const employeeId = user?.employeeId || localStorage.getItem('employeeId') || '';

  const fetchPermissions = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await permissionRequestService.findMyRequests(employeeId, statusFilter || undefined);
      setPermissions(data);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat data'));
    } finally {
      setLoading(false);
    }
  }, [employeeId, statusFilter]);

  useEffect(() => { if (activeTab === 'permissions') fetchPermissions(); }, [fetchPermissions, activeTab]);

  const fetchShiftEligibility = useCallback(async () => {
    if (!employeeId) {
      setShiftCalendarMeta(null);
      setLoadingShiftEligibility(false);
      return;
    }

    setLoadingShiftEligibility(true);
    try {
      const now = dayjs();
      const data = await workCalendarService.getMyResolvedCalendar(now.year(), now.month() + 1);
      setShiftCalendarMeta(data);
    } catch {
      setShiftCalendarMeta(null);
    } finally {
      setLoadingShiftEligibility(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void fetchShiftEligibility();
  }, [fetchShiftEligibility]);

  const hasShiftCalendar = Boolean(shiftCalendarMeta?.shiftFormula);

  useEffect(() => {
    if (!loadingShiftEligibility && !hasShiftCalendar && activeTab === 'shift-swap') {
      setActiveTab('calendar');
    }
  }, [activeTab, hasShiftCalendar, loadingShiftEligibility]);

  useEffect(() => {
    if (!loadingShiftEligibility && !hasShiftCalendar && activeModal === 'shift-swap') {
      setActiveModal(null);
    }
  }, [activeModal, hasShiftCalendar, loadingShiftEligibility]);

  const handleCancel = async (id: string) => {
    const confirmed = await popup.confirm({
      title: 'Batalkan Pengajuan',
      description: 'Pengajuan ini akan dibatalkan. Lanjutkan?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Kembali',
      intent: 'destructive',
    });
    if (!confirmed) return;
    try {
      await permissionRequestService.cancel(id, employeeId);
      toast.success('Pengajuan dibatalkan');
      fetchPermissions();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal membatalkan'));
    }
  };

  const pendingCount = permissions.filter((p) => p.status === 'PENDING').length;
  const approvedCount = permissions.filter((p) => p.status === 'APPROVED').length;
  const rejectedCount = permissions.filter((p) => p.status === 'REJECTED').length;

  const table = useTableControls(permissions, (p, q) =>
    [PERMISSION_TYPE_LABELS[p.type], p.reason, REQUEST_STATUS_LABELS[p.status]]
      .join(' ')
      .toLowerCase()
      .includes(q));

  const tabs = [
    { key: 'permissions' as const, label: 'Izin', icon: <FileText size={14} /> },
    { key: 'leave' as const, label: 'Cuti', icon: <CalendarDays size={14} /> },
    { key: 'overtime' as const, label: 'Lembur', icon: <Clock size={14} /> },
    { key: 'shift-swap' as const, label: 'Tukar Shift', icon: <Repeat size={14} /> },
    { key: 'calendar' as const, label: 'Kalender Kerja', icon: <CalendarDays size={14} /> },
  ].filter((tab) => hasShiftCalendar || tab.key !== 'shift-swap');

  return (
    <div>
      {/* Header halaman ala handoff */}
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">Self Service</h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            Ajukan dan pantau status pengajuan Anda · diurutkan terbaru
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {activeTab === 'permissions' && (
            <Segmented
              ariaLabel="Mode tampilan"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { key: 'table' as const, label: 'Tabel', icon: <Table2 size={13} /> },
                { key: 'list' as const, label: 'List', icon: <List size={13} /> },
              ]}
            />
          )}
          <Button variant="outline" size="sm" onClick={fetchPermissions}>
            <RefreshCw size={15} className="mr-2" /> Refresh
          </Button>
          {activeTab === 'permissions' && (
            <Button size="sm" className="rounded-[14px]" onClick={() => setActiveModal('permission')}>
              <Plus size={15} className="mr-2" /> Ajukan Izin
            </Button>
          )}
          {activeTab === 'shift-swap' && hasShiftCalendar && (
            <Button size="sm" className="rounded-[14px]" onClick={() => setActiveModal('shift-swap')}>
              <Plus size={15} className="mr-2" /> Request Tukar Shift
            </Button>
          )}
        </div>
      </div>

      {/* Tab utama */}
      <div className="mt-5">
        <Segmented
          ariaLabel="Kategori pengajuan"
          value={activeTab}
          onChange={setActiveTab}
          options={tabs}
        />
      </div>

      {/* Strip stat kecil (radius 20) */}
      {activeTab === 'permissions' && (
        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3.5">
          <StatTile label="Total Pengajuan" value={permissions.length} />
          <StatTile label="Menunggu" value={pendingCount} valueClassName="text-warning" />
          <StatTile label="Disetujui" value={approvedCount} valueClassName="text-success" />
          <StatTile label="Ditolak" value={rejectedCount} valueClassName="text-danger" />
        </div>
      )}

      {/* Chip filter status */}
      {activeTab === 'permissions' && (
        <div className="mt-3.5 flex flex-wrap gap-2">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
            <FilterChip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s ? REQUEST_STATUS_LABELS[s as RequestStatus] : 'Semua'}
            </FilterChip>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Memuat data...</div>
        </div>
      )}

      {/* ─── PERMISSIONS TAB ──────────────────────────── */}
      {!loading && activeTab === 'permissions' && (
        <div className="mt-3.5">
          {permissions.length === 0 ? (
            <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
              <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
                <FileText size={24} className="text-primary" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {statusFilter ? 'Tidak ada pengajuan dengan status ini' : 'Belum ada pengajuan izin'}
              </p>
              <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
                Pengajuan izin Anda akan tampil di sini beserta status persetujuannya.
              </p>
              {!statusFilter && (
                <Button size="sm" className="rounded-[14px]" onClick={() => setActiveModal('permission')}>
                  <Plus size={15} className="mr-2" /> Ajukan Izin
                </Button>
              )}
            </div>
          ) : viewMode === 'table' ? (
            <TableShell
              search={table.search}
              setSearch={table.setSearch}
              pageSize={table.pageSize}
              setPageSize={table.setPageSize}
              page={table.page}
              setPage={table.setPage}
              totalPages={table.totalPages}
              totalItems={table.filtered.length}
              searchPlaceholder="Cari pengajuan…"
            >
              <table className="w-full min-w-[760px] text-left">
                <thead>
                  <tr className="bg-secondary/70">
                    {['Jenis', 'Periode', 'Durasi', 'Diajukan', 'Alasan', 'Status', ''].map((h, i) => (
                      <th key={i} className="px-5 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {table.paged.map((p) => (
                    <tr key={p.id} className="border-t border-border transition-colors hover:bg-muted/30">
                      <td className="px-5 py-3.5 text-xs font-medium text-foreground">{PERMISSION_TYPE_LABELS[p.type]}</td>
                      <td className="px-5 py-3.5 text-xs text-foreground">{formatDate(p.startDate)} — {formatDate(p.endDate)}</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{p.duration} hari</td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(p.createdAt)}</td>
                      <td className="max-w-[220px] truncate px-5 py-3.5 text-xs text-muted-foreground" title={p.reason}>{p.reason}</td>
                      <td className="px-5 py-3.5"><RequestStatusChip status={p.status} /></td>
                      <td className="px-5 py-3.5 text-right">
                        {p.status === 'PENDING' && <CancelButton onClick={() => handleCancel(p.id)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableShell>
          ) : (
            <div className="flex flex-col gap-2.5">
              {permissions.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-3.5 rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
                  <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-accent text-primary">
                    <FileText size={16} />
                  </span>
                  <div className="min-w-0 flex-[1_1_200px]">
                    <p className="text-[12.5px] font-medium text-foreground">
                      {PERMISSION_TYPE_LABELS[p.type]} · {p.duration} hari
                    </p>
                    <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {formatDate(p.startDate)} — {formatDate(p.endDate)} · diajukan {formatDate(p.createdAt)}
                    </p>
                    <p className="mt-1 truncate text-[11.5px] text-muted-foreground" title={p.reason}>{p.reason}</p>
                  </div>
                  <RequestStatusChip status={p.status} />
                  {p.status === 'PENDING' && <CancelButton onClick={() => handleCancel(p.id)} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── LEAVE TAB ────────────────────────────────── */}
      {!loading && activeTab === 'leave' && (
        <div className="mt-5">
          <LeaveTabView companyId={companyId} employeeId={employeeId} />
        </div>
      )}

      {/* ─── OVERTIME TAB ─────────────────────────────── */}
      {!loading && activeTab === 'overtime' && (
        <div className="mt-5">
          <OvertimeTabView companyId={companyId} />
        </div>
      )}

      {!loading && activeTab === 'shift-swap' && (
        <div className="mt-5">
          <ShiftSwapTabView
            canApprove={Boolean(user?.employeeId)}
            onCreateRequest={() => setActiveModal('shift-swap')}
          />
        </div>
      )}

      {!loading && activeTab === 'calendar' && (
        <div className="mt-5">
          <MyWorkCalendarTabView />
        </div>
      )}

      {/* Modal */}
      <AppModal
        open={activeModal !== null}
        onClose={() => setActiveModal(null)}
        title={activeModal === 'shift-swap' ? 'Request Tukar Shift' : 'Ajukan Izin'}
        description={activeModal === 'shift-swap'
          ? 'Request akan diteruskan ke kepala regu untuk disetujui'
          : 'Pengajuan akan diteruskan ke atasan langsung Anda'}
      >
        {activeModal === 'shift-swap' ? (
          <ShiftSwapRequestForm onClose={() => setActiveModal(null)} />
        ) : (
          <PermissionForm onClose={() => { setActiveModal(null); fetchPermissions(); }} />
        )}
      </AppModal>
    </div>
  );
}

function MyWorkCalendarTabView() {
  const [cursor, setCursor] = useState(dayjs().startOf('month'));
  const [loading, setLoading] = useState(true);
  const [calendar, setCalendar] = useState<MyWorkCalendarMonth | null>(null);

  const fetchCalendar = useCallback(async (target: dayjs.Dayjs) => {
    setLoading(true);
    try {
      const data = await workCalendarService.getMyResolvedCalendar(target.year(), target.month() + 1);
      setCalendar(data);
    } catch (error) {
      toast.error(apiErrorMessage(error, 'Gagal memuat kalender kerja'));
      setCalendar(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCalendar(cursor);
  }, [cursor, fetchCalendar]);

  const days = calendar?.days ?? [];
  const firstWeekday = cursor.date(1).day();
  const leadingSlots = Array.from({ length: firstWeekday }, () => null as MyWorkCalendarDay | null);
  const gridDays = [...leadingSlots, ...days];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-card border border-border bg-card p-4 shadow-card md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold tracking-tight">{cursor.format('MMMM YYYY')}</h3>
                <StatusChip tone="neutral">
                  {calendar?.employee.employeeCategory === 'FACTORY' ? 'Pegawai Pabrik' : 'Kalender Kerja Aktif'}
                </StatusChip>
                {calendar?.shiftFormula && (
                  <StatusChip tone="accent">Formula Shift {calendar.shiftFormula.code}</StatusChip>
                )}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Jadwal bulanan ini sudah resolve dari work calendar aktif dan otomatis memakai formula shift bila user termasuk pegawai pabrik.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCursor((prev) => prev.subtract(1, 'month'))}>
                Bulan Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor(dayjs().startOf('month'))}>
                Bulan Ini
              </Button>
              <Button variant="outline" size="sm" onClick={() => setCursor((prev) => prev.add(1, 'month'))}>
                Bulan Berikutnya
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
                {label}
              </div>
            ))}

            {loading && Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="min-h-[124px] animate-pulse rounded-2xl border border-border bg-muted/30" />
            ))}

            {!loading && gridDays.map((day, index) => (
              <div
                key={day ? day.date : `empty-${index}`}
                className={day
                  ? `min-h-[124px] rounded-2xl border p-3 transition-colors ${getCalendarCellTone(day)}`
                  : 'min-h-[124px] rounded-2xl border border-dashed border-border/60 bg-transparent'}
              >
                {day && (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold">{dayjs(day.date).date()}</div>
                        <div className="text-[11px] opacity-70">
                          {day.absence?.category ? `Approved ${day.absence.category}` : (DAY_TYPE_LABELS[day.dayType] || day.dayType)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center rounded-full border border-current/15 px-2 py-0.5 text-[10px] font-semibold">
                          {day.overrideSource === 'SHIFT_SWAP'
                            ? 'SWAP'
                            : day.scheduleSource === 'SHIFT_FORMULA'
                              ? 'SHIFT'
                              : 'CALENDAR'}
                        </span>
                        {day.absence && (
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getAbsenceBadgeTone(day.absence.category)}`}>
                            {day.absence.category}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs">
                      <div className="font-medium">
                        {day.workStart && day.workEnd ? `${day.workStart} - ${day.workEnd}` : 'Tidak ada jam kerja'}
                      </div>
                      {day.absence && (
                        <>
                          <div className="font-semibold">{day.absence.label}</div>
                          <div className="line-clamp-2 opacity-80">{day.absence.reason}</div>
                          {day.absence.partialDay && <div className="opacity-80">Pengajuan parsial / setengah hari</div>}
                        </>
                      )}
                      {day.label && <div className="opacity-80">{day.label}</div>}
                      {day.swappedWithEmployee && (
                        <div className="opacity-80">
                          Tukar dengan {day.swappedWithEmployee.fullName}
                        </div>
                      )}
                      {day.crossesMidnight && <div className="opacity-80">Lintas tengah malam</div>}
                      {day.notes && <div className="line-clamp-2 opacity-70">{day.notes}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <h3 className="mb-4 text-[15px] font-semibold tracking-[-0.3px]">Profil Jadwal</h3>
            {!calendar ? (
              <p className="text-sm text-muted-foreground">Belum ada data kalender kerja.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Pegawai</p>
                  <p className="font-medium">{calendar.employee.fullName}</p>
                  <p className="text-muted-foreground">{calendar.employee.employeeNumber}</p>
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Posisi Organisasi</p>
                  <p>{calendar.employee.position?.name || '-'}</p>
                  <p className="text-muted-foreground">
                    {[calendar.employee.department?.name, calendar.employee.branch?.name].filter(Boolean).join(' • ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Kalender Kerja Terhubung</p>
                  <p>{calendar.linkedCalendar?.name || '-'}</p>
                  <p className="text-muted-foreground">
                    {calendar.linkedCalendar ? `${calendar.linkedCalendar.scope} • ${calendar.linkedCalendar.year}` : 'Belum ada calendar aktif'}
                  </p>
                </div>
                <div>
                  <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">Formula Shift</p>
                  <p>{calendar.shiftFormula ? `${calendar.shiftFormula.code} - ${calendar.shiftFormula.name}` : 'Tidak menggunakan formula shift'}</p>
                  <p className="text-muted-foreground">
                    {calendar.shiftFormula?.startDate ? `Mulai ${formatDate(calendar.shiftFormula.startDate)}` : 'Mengikuti work calendar biasa'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5">
            <StatTile label="Hari Kerja" value={calendar?.summary.workingDays || 0} valueClassName="text-success" />
            <StatTile label="Hari Off" value={calendar?.summary.offDays || 0} valueClassName="text-muted-foreground" />
            <StatTile label="Hari Calendar" value={calendar?.summary.calendarDays || 0} valueClassName="text-warning" />
            <StatTile label="Hari Shift" value={calendar?.summary.shiftDays || 0} valueClassName="text-primary" />
            <StatTile label="Hari Swap" value={calendar?.summary.shiftSwapDays || 0} valueClassName="text-violet-500 dark:text-violet-400" />
            <StatTile label="Cuti Approved" value={calendar?.summary.approvedLeaveDays || 0} valueClassName="text-fuchsia-500 dark:text-fuchsia-400" />
            <StatTile label="Izin Approved" value={calendar?.summary.approvedPermissionDays || 0} valueClassName="text-orange-500 dark:text-orange-400" />
            <StatTile label="Sakit Approved" value={calendar?.summary.approvedSickDays || 0} valueClassName="text-danger" />
          </div>

          <div className="rounded-card border border-border bg-card p-4 shadow-card">
            <h3 className="mb-3 text-[15px] font-semibold tracking-[-0.3px]">Legenda</h3>
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span>Hari kerja dari work calendar</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-blue-400" />
                <span>Hari kerja dari formula shift</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-violet-400" />
                <span>Hari hasil tukar shift yang sudah disetujui kepala regu</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span>Hari khusus dari calendar seperti libur nasional / cuti bersama</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-fuchsia-400" />
                <span>Cuti approved yang sudah sinkron ke kalender kerja</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-orange-400" />
                <span>Izin approved yang sudah sinkron ke kalender kerja</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span>Sakit approved yang sudah sinkron ke kalender kerja</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-slate-400" />
                <span>Hari tidak bekerja</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ShiftSwapTabView({
  canApprove,
  onCreateRequest,
}: {
  canApprove: boolean;
  onCreateRequest: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<ShiftSwapRequest[]>([]);
  const [approvals, setApprovals] = useState<ShiftSwapRequest[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [myRequests, myApprovals] = await Promise.all([
        workCalendarService.getMyShiftSwapRequests(),
        canApprove ? workCalendarService.getMyShiftSwapApprovals('PENDING') : Promise.resolve([]),
      ]);
      setRequests(myRequests);
      setApprovals(myApprovals);
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memuat request tukar shift'));
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCancel = async (id: string) => {
    const confirmed = await popup.confirm({
      title: 'Batalkan Request Tukar Shift',
      description: 'Request yang masih pending akan dibatalkan. Lanjutkan?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Kembali',
      intent: 'destructive',
    });

    if (!confirmed) return;

    try {
      await workCalendarService.cancelShiftSwapRequest(id);
      toast.success('Request tukar shift dibatalkan');
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal membatalkan request'));
    }
  };

  const handleReview = async (id: string, action: 'approve' | 'reject') => {
    const approvalNotes = window.prompt(
      action === 'approve'
        ? 'Catatan persetujuan kepala regu (opsional)'
        : 'Alasan penolakan kepala regu (opsional)',
      '',
    ) || undefined;

    try {
      if (action === 'approve') {
        await workCalendarService.approveShiftSwapRequest(id, approvalNotes);
        toast.success('Request tukar shift disetujui');
      } else {
        await workCalendarService.rejectShiftSwapRequest(id, approvalNotes);
        toast.success('Request tukar shift ditolak');
      }
      fetchData();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal memproses request'));
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3.5">
        <StatTile label="Total Request" value={requests.length} />
        <StatTile label="Menunggu Saya" value={requests.filter((item) => item.status === 'PENDING').length} valueClassName="text-warning" />
        <StatTile label="Disetujui" value={requests.filter((item) => item.status === 'APPROVED').length} valueClassName="text-success" />
        <StatTile label="Menunggu Approval" value={approvals.length} valueClassName="text-primary" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-sm text-muted-foreground">Memuat request tukar shift...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.1fr)_420px]">
          <div className="rounded-card border border-border bg-card p-5 shadow-card">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.3px]">Request Saya</h3>
                <p className="text-xs text-muted-foreground">Ajukan tukar shift ke kepala regu dan pantau statusnya di sini.</p>
              </div>
              <Button size="sm" className="rounded-[14px]" onClick={onCreateRequest}>
                <Plus size={15} className="mr-2" /> Request Baru
              </Button>
            </div>

            {requests.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16">
                <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
                  <Repeat size={24} className="text-primary" />
                </div>
                <p className="text-sm text-muted-foreground">Belum ada request tukar shift.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {requests.map((request) => (
                  <div key={request.id} className="rounded-card-sm border border-border bg-background p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <RequestStatusChip status={request.status} />
                          <span className="text-xs font-medium text-muted-foreground">
                            {formatDate(request.shiftDate)}
                          </span>
                        </div>
                        <p className="text-sm font-semibold">
                          Tukar dengan {request.targetEmployee?.fullName || '-'}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {request.targetEmployee?.employeeNumber || '-'} • Approver: {request.approverEmployee?.fullName || '-'}
                        </p>
                        <p className="mt-3 text-sm">{request.reason}</p>
                        {request.approvalNotes && (
                          <div className="mt-3 rounded-field border border-border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                            Catatan kepala regu: {request.approvalNotes}
                          </div>
                        )}
                      </div>
                      {request.status === 'PENDING' && (
                        <CancelButton onClick={() => handleCancel(request.id)} />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-card border border-border bg-card p-5 shadow-card">
              <div className="mb-3 flex items-center gap-2">
                <Users size={16} className="text-muted-foreground" />
                <h3 className="text-[15px] font-semibold tracking-[-0.3px]">Approval Kepala Regu</h3>
              </div>
              <p className="mb-4 text-xs text-muted-foreground">
                Panel ini muncul untuk kepala regu yang menjadi approver resmi request tukar shift.
              </p>

              {approvals.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Tidak ada request yang menunggu approval Anda.
                </p>
              ) : (
                <div className="space-y-3">
                  {approvals.map((request) => (
                    <div key={request.id} className="rounded-card-sm border border-border bg-background p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <RequestStatusChip status={request.status} />
                        <span className="text-xs text-muted-foreground">{formatDate(request.shiftDate)}</span>
                      </div>
                      <p className="text-sm font-semibold">
                        {request.requesterEmployee?.fullName || '-'} ↔ {request.targetEmployee?.fullName || '-'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {request.requesterEmployee?.employeeNumber || '-'} • {request.targetEmployee?.employeeNumber || '-'}
                      </p>
                      <p className="mt-3 text-sm">{request.reason}</p>
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={() => handleReview(request.id, 'approve')}>
                          Setujui
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleReview(request.id, 'reject')}>
                          Tolak
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leave Tab ──────────────────────────────────────────
function LeaveTabView({ companyId, employeeId }: { companyId: string; employeeId: string }) {
  const [leaves, setLeaves] = useState<Awaited<ReturnType<typeof leaveService.getRequests>>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const fetchLeaves = useCallback(async () => {
    if (!companyId) {
      setLeaves([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      // Tab self-service hanya menampilkan pengajuan milik sendiri.
      const data = await leaveService.getRequests(companyId, employeeId ? { employeeId } : undefined);
      setLeaves(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [companyId, employeeId]);

  useEffect(() => { void fetchLeaves(); }, [fetchLeaves]);

  const handleCancelLeave = async (id: string) => {
    const confirmed = await popup.confirm({
      title: 'Batalkan Pengajuan Cuti',
      description: 'Pengajuan cuti yang masih pending ini akan dibatalkan. Lanjutkan?',
      confirmText: 'Ya, Batalkan',
      cancelText: 'Kembali',
      intent: 'destructive',
    });
    if (!confirmed) return;
    try {
      await leaveService.cancelRequest(id);
      toast.success('Pengajuan cuti dibatalkan');
      fetchLeaves();
    } catch (err) {
      toast.error(apiErrorMessage(err, 'Gagal membatalkan pengajuan cuti'));
    }
  };

  const openForm = () => {
    if (!employeeId) {
      toast.error('Akun ini tidak tertaut ke data karyawan sehingga tidak bisa mengajukan cuti');
      return;
    }
    setShowForm(true);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Memuat data cuti...</div></div>;

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" className="rounded-[14px]" onClick={openForm}>
          <Plus size={15} className="mr-2" /> Ajukan Cuti
        </Button>
      </div>

      {leaves.length === 0 ? (
        <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
            <CalendarDays size={24} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Belum ada pengajuan cuti</p>
          <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
            Pengajuan cuti Anda akan tampil di sini beserta status persetujuannya.
          </p>
          <Button size="sm" className="rounded-[14px]" onClick={openForm}>
            <Plus size={15} className="mr-2" /> Ajukan Cuti
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {leaves.map((l) => (
            <div key={l.id} className="flex flex-wrap items-center gap-3.5 rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-accent text-primary">
                <CalendarDays size={16} />
              </span>
              <div className="min-w-0 flex-[1_1_200px]">
                <p className="text-[12.5px] font-medium text-foreground">
                  {l.leaveType?.name || 'Cuti'} · {l.totalDays} hari
                </p>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {formatDate(l.startDate)} — {formatDate(l.endDate)}
                </p>
                <p className="mt-1 truncate text-[11.5px] text-muted-foreground" title={l.reason}>{l.reason}</p>
              </div>
              <RequestStatusChip status={l.status} />
              {l.status === 'PENDING' && l.employeeId === employeeId && (
                <CancelButton onClick={() => handleCancelLeave(l.id)} />
              )}
            </div>
          ))}
        </div>
      )}

      <AppModal
        open={showForm}
        onClose={() => setShowForm(false)}
        title="Ajukan Cuti"
        description="Saldo cuti terpotong otomatis setelah pengajuan disetujui"
      >
        <LeaveRequestForm
          companyId={companyId}
          employeeId={employeeId}
          onSuccess={fetchLeaves}
          onClose={() => setShowForm(false)}
        />
      </AppModal>
    </div>
  );
}

// ─── Overtime Tab ───────────────────────────────────────
function OvertimeTabView({ companyId }: { companyId: string }) {
  const [overtimes, setOvertimes] = useState<Awaited<ReturnType<typeof attendanceService.getOvertime>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await attendanceService.getOvertime(companyId);
        setOvertimes(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
  })(); }, []); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Memuat data lembur...</div></div>;

  if (overtimes.length === 0) return (
    <div className="flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
      <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
        <Clock size={24} className="text-primary" />
      </div>
      <p className="text-sm font-medium text-foreground">Belum ada pengajuan lembur</p>
      <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
        Riwayat lembur Anda akan tampil di sini setelah tercatat oleh sistem.
      </p>
    </div>
  );

  return (
    <div className="space-y-2.5">
      {overtimes.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center gap-3.5 rounded-card-sm border border-border bg-card px-[18px] py-4 shadow-card">
          <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full bg-accent text-primary">
            <Clock size={16} />
          </span>
          <div className="min-w-0 flex-[1_1_200px]">
            <p className="text-[12.5px] font-medium text-foreground">
              Lembur {o.durationHours || 0} jam
            </p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{o.date ? formatDate(o.date) : '-'}</p>
            <p className="mt-1 truncate text-[11.5px] text-muted-foreground" title={o.reason}>{o.reason}</p>
          </div>
          <RequestStatusChip status={o.status} />
        </div>
      ))}
    </div>
  );
}
