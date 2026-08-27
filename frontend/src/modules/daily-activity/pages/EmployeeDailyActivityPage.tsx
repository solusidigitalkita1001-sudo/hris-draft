import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import {
  dailyActivityService,
  type DailyActivity,
  type DailyActivityType,
  type CreateDailyActivityPayload,
  DAILY_ACTIVITY_TYPE_LABELS,
  DAILY_ACTIVITY_TYPE_CLASSNAMES,
} from '@/services/daily-activity.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/ui/select2';
import {
  MapPin, Plus, RefreshCw, XCircle, Send, CheckCircle2, Clock, Camera, Navigation, AlertTriangle,
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
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-border w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

function GPSCaptureButton({
  onCaptured,
  value,
}: {
  onCaptured: (coord: { latitude: number; longitude: number; accuracyMeters?: number }) => void;
  value: { latitude?: number; longitude?: number };
}) {
  const [capturing, setCapturing] = useState(false);
  const captured = value.latitude !== undefined && value.longitude !== undefined;

  const capture = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Browser tidak mendukung geolocation. Silakan izinkan akses lokasi.');
      return;
    }
    setCapturing(true);
    try {
      const pos: GeolocationPosition = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      onCaptured({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracyMeters: pos.coords.accuracy,
      });
      toast.success(`GPS berhasil di-capture (akurasi ${Math.round(pos.coords.accuracy)}m)`);
    } catch (err: any) {
      toast.error(`Gagal capture GPS: ${err?.message || 'Izin lokasi ditolak user'}`);
    } finally {
      setCapturing(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={captured ? 'outline' : 'secondary'}
          size="sm"
          onClick={capture}
          disabled={capturing}
          className="w-full"
        >
          <Navigation size={16} className="mr-2" />
          {capturing ? 'Mencari lokasi...' : captured ? 'Re-capture GPS' : 'Capture Lokasi GPS Sekarang'}
        </Button>
      </div>
      {captured && (
        <div className="text-xs rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-2 space-y-0.5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={14} /> <span className="font-semibold">GPS Sudah Tercapture</span>
          </div>
          <div className="text-muted-foreground font-mono text-[11px]">
            Lat: {Number(value.latitude).toFixed(6)}, Lon: {Number(value.longitude).toFixed(6)}
          </div>
        </div>
      )}
      {!captured && (
        <div className="text-xs rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="text-yellow-800 dark:text-yellow-300">
            Anda <strong>wajib</strong> capture GPS sebelum submit agar diverifikasi berada di radius site.
          </div>
        </div>
      )}
    </div>
  );
}

function CreateActivityForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const now = useMemo(() => {
    const d = new Date();
    d.setMinutes(0, 0, 0);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${today}T${hh}:${mm}`;
  }, [today]);
  const later = useMemo(() => {
    const d = new Date();
    d.setHours(d.getHours() + 1, 0, 0, 0);
    return `${today}T${String(d.getHours()).padStart(2, '0')}:00`;
  }, [today]);

  const [branchId, setBranchId] = useState('');
  const [activityDate, setActivityDate] = useState(today);
  const [activityType, setActivityType] = useState<DailyActivityType>('WORK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [startTime, setStartTime] = useState(now);
  const [endTime, setEndTime] = useState(later);
  const [notes, setNotes] = useState('');

  const [gpsCoord, setGpsCoord] = useState<{ latitude?: number; longitude?: number; accuracyMeters?: number }>({});
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchId) return toast.error('Pilih lokasi site / branch terlebih dahulu');
    if (title.trim().length < 3) return toast.error('Judul aktivitas minimal 3 karakter');
    if (!gpsCoord.latitude || !gpsCoord.longitude) {
      return toast.error('Wajib capture GPS sebelum submit');
    }
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      return toast.error('Waktu selesai harus lebih besar dari waktu mulai');
    }

    const payload: CreateDailyActivityPayload = {
      branchId,
      activityDate,
      activityType,
      title: title.trim(),
      description: description.trim() || undefined,
      photoUrl: photoUrl.trim() || undefined,
      latitude: gpsCoord.latitude,
      longitude: gpsCoord.longitude,
      geoAccuracyMeters: gpsCoord.accuracyMeters,
      startTime: new Date(startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      notes: notes.trim() || undefined,
    };

    setLoading(true);
    try {
      await dailyActivityService.createRequest(payload);
      toast.success('Laporan aktivitas berhasil dikirim');
      onSubmitted();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal mengirim aktivitas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tanggal Aktivitas *</Label>
          <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipe Aktivitas *</Label>
          <Select2
            value={activityType}
            onValueChange={(v) => setActivityType(v as DailyActivityType)}
            options={(Object.keys(DAILY_ACTIVITY_TYPE_LABELS) as DailyActivityType[]).map((t) => ({
              value: t,
              label: DAILY_ACTIVITY_TYPE_LABELS[t],
            }))}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Lokasi Site / Branch *</Label>
        <Select2
          value={branchId}
          onValueChange={setBranchId}
          options={[
            { value: '', label: '-- Pilih Site --', disabled: true },
            { value: 'default-branch-1', label: 'Kantor Pusat (Jakarta)' },
          ]}
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Judul Aktivitas *</Label>
        <Input
          placeholder="Contoh: Installasi jaringan LAN lantai 3"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Waktu Mulai *</Label>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Waktu Selesai *</Label>
          <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Deskripsi / Catatan Pekerjaan</Label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Rincian kegiatan yang dilakukan, hambatan, dll."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          <Camera size={14} className="inline mr-1" /> URL Bukti Foto (opsional)
        </Label>
        <Input
          type="url"
          placeholder="https://..."
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
        />
      </div>

      <GPSCaptureButton
        value={{ latitude: gpsCoord.latitude, longitude: gpsCoord.longitude }}
        onCaptured={(c) => setGpsCoord(c)}
      />

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">Catatan Tambahan</Label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Opsional"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>Batal</Button>
        <Button type="submit" disabled={loading || !gpsCoord.latitude}>
          {loading ? 'Mengirim...' : (<><Send size={16} className="mr-2" />Kirim Aktivitas</>)}
        </Button>
      </div>
    </form>
  );
}

export function EmployeeDailyActivityPage() {
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<DailyActivityType | 'ALL'>('ALL');
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    return { startDate: start, endDate: end };
  });
  const [formOpen, setFormOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    try {
      const data = await dailyActivityService.getMyActivities(dateRange);
      setActivities(data);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal memuat daftar aktivitas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch(); }, [typeFilter, dateRange]);

  const filtered = useMemo(
    () => (typeFilter === 'ALL' ? activities : activities.filter((a) => a.activityType === typeFilter)),
    [activities, typeFilter],
  );

  const summaryTotalMinutes = useMemo(
    () => filtered.reduce((s, a) => s + a.durationMinutes, 0),
    [filtered],
  );

  const handleDelete = async (id: string) => {
    if (!confirm('Hapus laporan aktivitas ini?')) return;
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

  const handleComplete = async (id: string) => {
    if (!confirm('Tandai aktivitas ini SELESAI dengan waktu sekarang?')) return;
    setCompletingId(id);
    try {
      await dailyActivityService.completeRequest(id);
      toast.success('Aktivitas ditandai selesai');
      void fetch();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Gagal menandai selesai');
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title="Aktivitas Harian"
          description="Laporkan aktivitas kerja harian Anda, capture GPS untuk validasi lokasi site"
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void fetch()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={16} className="mr-2" />Laporkan Aktivitas
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Total Aktivitas Bulan Ini</div>
          <div className="text-2xl font-semibold mt-1">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Total Durasi Kerja</div>
          <div className="text-2xl font-semibold mt-1">{formatDuration(summaryTotalMinutes)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">Aktivitas Di Luar Radius Site</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">
            {filtered.filter((a) => a.isOutsideRadius).length}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tipe Aktivitas</Label>
          <Select2
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as DailyActivityType | 'ALL')}
            options={TYPE_FILTERS}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tanggal Mulai</Label>
          <Input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">Tanggal Akhir</Label>
          <Input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">Tanggal</th>
                <th className="px-4 py-3 text-left">Tipe</th>
                <th className="px-4 py-3 text-left">Judul Aktivitas</th>
                <th className="px-4 py-3 text-left">Site / Branch</th>
                <th className="px-4 py-3 text-left">Waktu & Durasi</th>
                <th className="px-4 py-3 text-left">Lokasi</th>
                <th className="px-4 py-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    Memuat...
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <MapPin size={28} className="opacity-50" />
                      Belum ada laporan aktivitas di periode ini
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">{formatDate(a.activityDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${DAILY_ACTIVITY_TYPE_CLASSNAMES[a.activityType]}`}>
                      {DAILY_ACTIVITY_TYPE_LABELS[a.activityType]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{a.title}</div>
                    {a.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{a.description}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <MapPin size={13} className="text-muted-foreground" />
                      <span>{a.branch?.name || '—'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs">{formatDateTime(a.startTime).slice(11, 16)} — {formatDateTime(a.endTime).slice(11, 16)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                      <Clock size={12} /> {formatDuration(a.durationMinutes)}
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
                          {a.isOutsideRadius ? 'Di Luar Radius' : 'Di Dalam Radius'}
                        </span>
                        {a.distanceFromBranchMeters !== null && a.distanceFromBranchMeters !== undefined && (
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {a.distanceFromBranchMeters} m dari site
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Tidak ada GPS</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="inline-flex gap-1.5 justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void handleComplete(a.id)}
                        disabled={completingId === a.id}
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Selesai
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title="Laporkan Aktivitas Baru">
        <CreateActivityForm onClose={() => setFormOpen(false)} onSubmitted={fetch} />
      </Modal>
    </div>
  );
}
