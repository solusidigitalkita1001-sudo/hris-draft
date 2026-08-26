import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import {
  dailyActivityService,
  type DailyActivity,
  type DailyActivityType,
  DAILY_ACTIVITY_TYPE_LABELS,
  DAILY_ACTIVITY_TYPE_CLASSNAMES,
} from '@/services/daily-activity.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/ui/select2';
import {
  RefreshCw, Eye, MapPin, Clock, CheckCircle2, AlertTriangle, XCircle, UserRound,
} from 'lucide-react';

const TYPE_FILTERS: Array<{ value: DailyActivityType | 'ALL'; label: string }> = [
  { value: 'ALL', label: 'Semua Tipe' },
  { value: 'WORK', label: 'Kerja Rutin' },
  { value: 'SITE_VISIT', label: 'Kunjungan Site' },
  { value: 'SITE_INSPECTION', label: 'Inspeksi Site' },
  { value: 'MEETING', label: 'Rapat' },
  { value: 'OTHER', label: 'Lainnya' },
];

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-xl mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">{title}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <XCircle size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function AdminDailyActivityApprovalPage() {
  const companyId = localStorage.getItem('companyId') || '';
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<DailyActivityType | 'ALL'>('ALL');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  });

  const [detailModal, setDetailModal] = useState<{ id: string; open: boolean; data?: DailyActivity | null }>({ id: '', open: false, data: null });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetch = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const data = await dailyActivityService.findAll(companyId, {
        activityType: typeFilter === 'ALL' ? undefined : typeFilter,
        startDate: dateRange.start,
        endDate: dateRange.end,
      });
      setActivities(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat daftar aktivitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch(); }, [companyId, typeFilter, dateRange]);

  const filtered = useMemo(() => {
    if (!employeeSearch.trim()) return activities;
    const q = employeeSearch.trim().toLowerCase();
    return activities.filter((a) => {
      if (a.title.toLowerCase().includes(q)) return true;
      if (a.description?.toLowerCase().includes(q)) return true;
      const emp = a.employee;
      if (!emp) return false;
      return emp.fullName.toLowerCase().includes(q) || (emp.employeeNumber || '').toLowerCase().includes(q);
    });
  }, [activities, employeeSearch]);

  const summary = useMemo(() => {
    const total = filtered.length;
    const totalMinutes = filtered.reduce((s, a) => s + a.durationMinutes, 0);
    const outsideRadius = filtered.filter((a) => a.isOutsideRadius).length;
    const uniqueEmployees = new Set(filtered.map((a) => a.employeeId)).size;
    return { total, totalMinutes, outsideRadius, uniqueEmployees };
  }, [filtered]);

  const openDetail = async (id: string) => {
    setDetailModal({ id, open: true, data: null });
    try {
      const d = await dailyActivityService.findById(id);
      setDetailModal({ id, open: true, data: d });
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat detail');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus aktivitas ini?')) return;
    setDeletingId(id);
    try {
      await dailyActivityService.deleteRequest(id);
      toast.success('Aktivitas dihapus');
      void fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menghapus');
    } finally {
      setDeletingId(null);
    }
  };

  const detail = detailModal.data;

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Monitoring Aktivitas Harian Karyawan"
          subtitle="Lihat, review, dan kelola laporan aktivitas semua karyawan"
        />
        <Button variant="ghost" size="sm" onClick={() => void fetch()} disabled={loading}>
          <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Total Laporan Bulan Ini</div>
          <div className="text-2xl font-semibold mt-1">{summary.total}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Total Durasi Kerja</div>
          <div className="text-2xl font-semibold mt-1">{formatDuration(summary.totalMinutes)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Karyawan Aktif Melapor</div>
          <div className="text-2xl font-semibold mt-1 text-blue-600 dark:text-blue-400">{summary.uniqueEmployees}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Luar Radius Site</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">{summary.outsideRadius}</div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5 flex-1 min-w-[220px]">
          <Label className="text-xs font-medium text-muted-foreground">
            <UserRound size={14} className="inline mr-1" />
            Cari Karyawan / Judul
          </Label>
          <Input
            placeholder="Nama, NIK, atau judul aktivitas..."
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipe Aktivitas</Label>
          <Select2
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as DailyActivityType | 'ALL')}
            options={TYPE_FILTERS}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tgl Mulai</Label>
          <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tgl Akhir</Label>
          <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Karyawan</th>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Tipe & Judul</th>
                <th className="px-4 py-3 text-left">Site</th>
                <th className="px-4 py-3 text-left">Durasi</th>
                <th className="px-4 py-3 text-left">Lokasi GPS</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Memuat...</td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <MapPin size={28} className="opacity-50" />
                      Tidak ada data aktivitas untuk filter ini
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">
                        {a.employee?.fullName?.slice(0, 2) || '??'}
                      </div>
                      <div>
                        <div className="font-medium leading-tight">{a.employee?.fullName || 'Unknown'}</div>
                        <div className="text-[11px] text-muted-foreground font-mono">{a.employee?.employeeNumber || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">{formatDate(a.activityDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium mb-1.5 ${DAILY_ACTIVITY_TYPE_CLASSNAMES[a.activityType]}`}>
                      {DAILY_ACTIVITY_TYPE_LABELS[a.activityType]}
                    </span>
                    <div className="font-medium leading-tight">{a.title}</div>
                    {a.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <MapPin size={12} className="text-muted-foreground" />
                      <span>{a.branch?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-xs">
                      <Clock size={12} className="text-muted-foreground" />
                      <span className="font-semibold">{formatDuration(a.durationMinutes)}</span>
                    </div>
                    <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {formatDateTime(a.startTime).slice(11, 16)} — {formatDateTime(a.endTime).slice(11, 16)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {a.latitude && a.longitude ? (
                      <div>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium ${a.isOutsideRadius
                          ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900'
                        }`}>
                          {a.isOutsideRadius ? <AlertTriangle size={11} /> : <CheckCircle2 size={11} />}
                          {a.isOutsideRadius ? 'Luar Radius' : 'Dalam Radius'}
                        </span>
                        {a.distanceFromBranchMeters !== null && a.distanceFromBranchMeters !== undefined && (
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">{a.distanceFromBranchMeters} m</div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Tanpa GPS</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5 justify-end">
                      <Button size="sm" variant="outline" onClick={() => void openDetail(a.id)}>
                        <Eye size={14} className="mr-1" />Detail
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => void handleDelete(a.id)}
                        disabled={deletingId === a.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <XCircle size={14} />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={detailModal.open}
        onClose={() => setDetailModal({ id: '', open: false, data: null })}
        title="Detail Aktivitas Karyawan"
      >
        {!detail && (
          <div className="py-10 text-center text-muted-foreground">Memuat detail...</div>
        )}
        {detail && (
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${DAILY_ACTIVITY_TYPE_CLASSNAMES[detail.activityType]}`}>
                  {DAILY_ACTIVITY_TYPE_LABELS[detail.activityType]}
                </span>
                <h3 className="font-semibold text-lg mt-2 leading-tight">{detail.title}</h3>
              </div>
              <div className="text-right">
                <div className="font-semibold">{formatDate(detail.activityDate)}</div>
                <div className="font-mono text-xs text-muted-foreground mt-0.5">
                  {formatDateTime(detail.startTime).slice(11, 16)} — {formatDateTime(detail.endTime).slice(11, 16)}
                </div>
                <div className="text-xs mt-1 inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                  <Clock size={11} /> {formatDuration(detail.durationMinutes)}
                </div>
              </div>
            </div>

            {detail.employee && (
              <div className="flex items-center gap-3 rounded-lg border border-border p-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold">
                  {detail.employee.fullName.slice(0, 2)}
                </div>
                <div className="flex-1">
                  <div className="font-medium">{detail.employee.fullName}</div>
                  <div className="text-xs text-muted-foreground font-mono">{detail.employee.employeeNumber}</div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="space-y-1 rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <MapPin size={12} /> Lokasi Site
                </div>
                <div className="font-medium">{detail.branch?.name || '—'}</div>
                {detail.branch && (
                  <div className="text-xs text-muted-foreground font-mono">{detail.branch.code}</div>
                )}
              </div>
              <div className="space-y-1 rounded-lg border border-border p-3">
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {detail.isOutsideRadius ? <AlertTriangle size={12} className="text-amber-600" /> : <CheckCircle2 size={12} className="text-emerald-600" />}
                  Validasi Geofence
                </div>
                <div className={`font-medium ${detail.isOutsideRadius ? 'text-amber-600' : 'text-emerald-600'}`}>
                  {detail.isOutsideRadius ? 'Di Luar Radius Site' : 'Di Dalam Radius Site'}
                </div>
                {(detail.distanceFromBranchMeters !== null && detail.distanceFromBranchMeters !== undefined) && (
                  <div className="text-xs text-muted-foreground font-mono">
                    Jarak: {detail.distanceFromBranchMeters} meter
                  </div>
                )}
                {detail.latitude && detail.longitude && (
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">
                    {Number(detail.latitude).toFixed(5)}, {Number(detail.longitude).toFixed(5)}
                  </div>
                )}
              </div>
            </div>

            {detail.description && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Deskripsi Kegiatan</div>
                <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap leading-relaxed">
                  {detail.description}
                </div>
              </div>
            )}

            {detail.photoUrl && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Bukti Foto</div>
                <a
                  href={detail.photoUrl}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block rounded-lg border border-border overflow-hidden"
                >
                  <img src={detail.photoUrl} alt="Bukti Aktivitas" className="w-full max-h-64 object-cover" />
                </a>
              </div>
            )}

            {detail.notes && (
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground font-medium">Catatan Tambahan</div>
                <div className="rounded-lg border border-border p-3 text-sm whitespace-pre-wrap leading-relaxed bg-muted/30">
                  {detail.notes}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                onClick={() => void handleDelete(detail.id)}
                disabled={deletingId === detail.id}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                <XCircle size={14} className="mr-1" />Hapus Aktivitas
              </Button>
              <Button onClick={() => setDetailModal({ id: '', open: false, data: null })}>Tutup</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
