import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import dayjs from 'dayjs';
import { permissionRequestService, type PermissionRequest, type PermissionType, type RequestStatus, PERMISSION_TYPE_LABELS, REQUEST_STATUS_LABELS } from '@/services/permission-request.service';
import { leaveService } from '@/services/leave.service';
import { attendanceService } from '@/services/attendance.service';
import { workCalendarService, type MyWorkCalendarDay, type MyWorkCalendarMonth } from '@/services/work-calendar.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup } from '@/stores/popup.store';
import {
  Plus, RefreshCw, FileText, CalendarDays, Clock,
  CheckCircle, XCircle, AlertCircle, Ban,
  Send,
} from 'lucide-react';
import { formatDate } from '@/utils/format';

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

// ─── Stat Card ──────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────
function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
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
      } as any);
      toast.success('Pengajuan berhasil dikirim');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengirim pengajuan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipe Izin *</label>
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
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tanggal Mulai *</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tanggal Selesai *</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Durasi (hari) *</label>
        <Input type="number" value={duration} onChange={(e) => setDuration(Number(e.target.value))} min={0.5} step={0.5} required />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1.5">Alasan *</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Jelaskan alasan pengajuan..."
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background text-foreground resize-none"
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

// ─── Request Card ───────────────────────────────────────
const STATUS_STYLES: Record<string, string> = {
  PENDING: 'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200',
  APPROVED: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border-emerald-200',
  REJECTED: 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200',
  CANCELLED: 'bg-gray-50 text-gray-500 dark:bg-gray-800 dark:text-gray-400 border-gray-200',
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <AlertCircle size={14} />,
  APPROVED: <CheckCircle size={14} />,
  REJECTED: <XCircle size={14} />,
  CANCELLED: <Ban size={14} />,
};

// ─── Main Component ─────────────────────────────────────
export function SelfServicePage() {
  const [permissions, setPermissions] = useState<PermissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'permissions' | 'leave' | 'overtime' | 'calendar'>('permissions');
  const [statusFilter, setStatusFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const companyId = localStorage.getItem('companyId') || '';
  const employeeId = localStorage.getItem('employeeId') || '';

  const fetchPermissions = useCallback(async () => {
    if (!employeeId) return;
    setLoading(true);
    try {
      const data = await permissionRequestService.findMyRequests(employeeId, statusFilter || undefined);
      setPermissions(data);
    } catch {
      toast.error('Gagal memuat data');
    } finally {
      setLoading(false);
    }
  }, [employeeId, statusFilter]);

  useEffect(() => { if (activeTab === 'permissions') fetchPermissions(); }, [fetchPermissions, activeTab]);

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
    } catch {
      toast.error('Gagal membatalkan');
    }
  };

  const pendingCount = permissions.filter((p) => p.status === 'PENDING').length;
  const approvedCount = permissions.filter((p) => p.status === 'APPROVED').length;

  const TABS = [
    { key: 'permissions' as const, label: 'Izin', icon: <FileText size={16} /> },
    { key: 'leave' as const, label: 'Cuti', icon: <CalendarDays size={16} /> },
    { key: 'overtime' as const, label: 'Lembur', icon: <Clock size={16} /> },
    { key: 'calendar' as const, label: 'Kalender Kerja', icon: <CalendarDays size={16} /> },
  ];

  return (
    <div>
      <PageHeader
        title="Self Service"
        description="Ajukan dan pantau status pengajuan Anda"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={fetchPermissions}>
              <RefreshCw size={16} className="mr-2" /> Refresh
            </Button>
            {activeTab === 'permissions' && (
              <Button size="sm" onClick={() => setShowForm(true)}>
                <Plus size={16} className="mr-2" /> Ajukan Izin
              </Button>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      {activeTab === 'permissions' && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total Pengajuan" value={permissions.length} color="text-foreground" />
          <StatCard label="Pending" value={pendingCount} color="text-amber-500" />
          <StatCard label="Disetujui" value={approvedCount} color="text-emerald-500" />
          <StatCard label="Ditolak" value={permissions.filter((p) => p.status === 'REJECTED').length} color="text-red-500" />
        </div>
      )}

      {/* Status filter */}
      {activeTab === 'permissions' && (
        <div className="flex gap-1 mb-4">
          {['', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                statusFilter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-border hover:border-primary/50'
              }`}
            >
              {s ? REQUEST_STATUS_LABELS[s as RequestStatus] : 'Semua'}
            </button>
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
        <>
          {permissions.length === 0 ? (
            <div className="flex flex-col items-center py-20 gap-3">
              <FileText size={48} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {statusFilter ? 'Tidak ada pengajuan dengan status ini' : 'Belum ada pengajuan izin'}
              </p>
              {!statusFilter && (
                <Button size="sm" onClick={() => setShowForm(true)}>
                  <Plus size={16} className="mr-2" /> Ajukan Izin
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {permissions.map((p) => (
                <div
                  key={p.id}
                  className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[p.status]}`}>
                          {STATUS_ICONS[p.status]} {REQUEST_STATUS_LABELS[p.status]}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">{PERMISSION_TYPE_LABELS[p.type]}</span>
                      </div>
                      <p className="text-sm mt-1">{p.reason}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span>{formatDate(p.startDate)} — {formatDate(p.endDate)}</span>
                        <span>{p.duration} hari</span>
                        <span>Pengajuan: {formatDate(p.createdAt)}</span>
                      </div>
                    </div>
                    {p.status === 'PENDING' && (
                      <button
                        onClick={() => handleCancel(p.id)}
                        className="shrink-0 px-2.5 py-1 text-xs font-medium rounded-lg border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        Batalkan
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── LEAVE TAB ────────────────────────────────── */}
      {!loading && activeTab === 'leave' && (
        <LeaveTabView companyId={companyId} />
      )}

      {/* ─── OVERTIME TAB ─────────────────────────────── */}
      {!loading && activeTab === 'overtime' && (
        <OvertimeTabView companyId={companyId} />
      )}

      {!loading && activeTab === 'calendar' && (
        <MyWorkCalendarTabView />
      )}

      {/* Modal */}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Ajukan Izin">
        <PermissionForm onClose={() => { setShowForm(false); fetchPermissions(); }} />
      </Modal>
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
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Gagal memuat kalender kerja');
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
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5">
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4 md:p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold">{cursor.format('MMMM YYYY')}</h3>
                <span className="inline-flex items-center rounded-full border border-border px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {calendar?.employee.employeeCategory === 'FACTORY' ? 'Pegawai Pabrik' : 'Kalender Kerja Aktif'}
                </span>
                {calendar?.shiftFormula && (
                  <span className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-300">
                    Formula Shift {calendar.shiftFormula.code}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
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

          <div className="grid grid-cols-7 gap-2 mt-5">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-2 py-2 text-xs font-semibold text-muted-foreground">
                {label}
              </div>
            ))}

            {loading && Array.from({ length: 35 }).map((_, index) => (
              <div key={index} className="min-h-[124px] rounded-2xl border border-border bg-muted/30 animate-pulse" />
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
                          {day.scheduleSource === 'SHIFT_FORMULA' ? 'SHIFT' : 'CALENDAR'}
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
                          <div className="opacity-80 line-clamp-2">{day.absence.reason}</div>
                          {day.absence.partialDay && <div className="opacity-80">Pengajuan parsial / setengah hari</div>}
                        </>
                      )}
                      {day.label && <div className="opacity-80">{day.label}</div>}
                      {day.crossesMidnight && <div className="opacity-80">Lintas tengah malam</div>}
                      {day.notes && <div className="opacity-70 line-clamp-2">{day.notes}</div>}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-4">Profil Jadwal</h3>
            {!calendar ? (
              <p className="text-sm text-muted-foreground">Belum ada data kalender kerja.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Pegawai</p>
                  <p className="font-medium">{calendar.employee.fullName}</p>
                  <p className="text-muted-foreground">{calendar.employee.employeeNumber}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Posisi Organisasi</p>
                  <p>{calendar.employee.position?.name || '-'}</p>
                  <p className="text-muted-foreground">
                    {[calendar.employee.department?.name, calendar.employee.branch?.name].filter(Boolean).join(' • ') || '-'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Kalender Kerja Terhubung</p>
                  <p>{calendar.linkedCalendar?.name || '-'}</p>
                  <p className="text-muted-foreground">
                    {calendar.linkedCalendar ? `${calendar.linkedCalendar.scope} • ${calendar.linkedCalendar.year}` : 'Belum ada calendar aktif'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Formula Shift</p>
                  <p>{calendar.shiftFormula ? `${calendar.shiftFormula.code} - ${calendar.shiftFormula.name}` : 'Tidak menggunakan formula shift'}</p>
                  <p className="text-muted-foreground">
                    {calendar.shiftFormula?.startDate ? `Mulai ${formatDate(calendar.shiftFormula.startDate)}` : 'Mengikuti work calendar biasa'}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Hari Kerja" value={calendar?.summary.workingDays || 0} color="text-emerald-500" />
            <StatCard label="Hari Off" value={calendar?.summary.offDays || 0} color="text-slate-500" />
            <StatCard label="Hari Calendar" value={calendar?.summary.calendarDays || 0} color="text-amber-500" />
            <StatCard label="Hari Shift" value={calendar?.summary.shiftDays || 0} color="text-blue-500" />
            <StatCard label="Cuti Approved" value={calendar?.summary.approvedLeaveDays || 0} color="text-fuchsia-500" />
            <StatCard label="Izin Approved" value={calendar?.summary.approvedPermissionDays || 0} color="text-orange-500" />
            <StatCard label="Sakit Approved" value={calendar?.summary.approvedSickDays || 0} color="text-red-500" />
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-border p-4">
            <h3 className="text-sm font-semibold mb-3">Legenda</h3>
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

// ─── Leave Tab ──────────────────────────────────────────
function LeaveTabView({ companyId }: { companyId: string }) {
  const [leaves, setLeaves] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await leaveService.getRequests(companyId);
        setLeaves(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Memuat data cuti...</div></div>;

  if (leaves.length === 0) return (
    <div className="flex flex-col items-center py-20 gap-3">
      <CalendarDays size={48} className="text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Belum ada pengajuan cuti</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {leaves.map((l) => (
        <div key={l.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              l.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
              l.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>{l.status}</span>
            <span className="text-xs text-muted-foreground">{l.leaveType?.name || 'Cuti'}</span>
          </div>
          <p className="text-sm mt-1">{l.reason}</p>
          <div className="text-xs text-muted-foreground mt-2">
            {formatDate(l.startDate)} — {formatDate(l.endDate)} ({l.totalDays} hari)
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Overtime Tab ───────────────────────────────────────
function OvertimeTabView({ companyId }: { companyId: string }) {
  const [overtimes, setOvertimes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await attendanceService.getOvertime(companyId);
        setOvertimes(data);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="text-sm text-muted-foreground">Memuat data lembur...</div></div>;

  if (overtimes.length === 0) return (
    <div className="flex flex-col items-center py-20 gap-3">
      <Clock size={48} className="text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Belum ada pengajuan lembur</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {overtimes.map((o) => (
        <div key={o.id} className="bg-white dark:bg-gray-800 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2 mb-1">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
              o.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' :
              o.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
              'bg-amber-50 text-amber-700'
            }`}>{o.status}</span>
            <span className="text-xs text-muted-foreground">{o.date ? formatDate(o.date) : ''}</span>
          </div>
          <p className="text-sm mt-1">{o.reason}</p>
          <div className="text-xs text-muted-foreground mt-2">
            {o.durationHours || o.hours || 0} jam
          </div>
        </div>
      ))}
    </div>
  );
}
