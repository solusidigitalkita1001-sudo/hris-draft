import { useState, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { formatDate, formatDateTime, formatDuration } from '@/utils/format';
import {
  dailyActivityService,
  type DailyActivity,
  type DailyActivityType,
  type CreateDailyActivityPayload,
  DAILY_ACTIVITY_TYPE_CLASSNAMES,
} from '@/services/daily-activity.service';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select2 } from '@/components/ui/select2';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import {
  MapPin, Plus, RefreshCw, XCircle, Send, CheckCircle2, Clock, Camera, Navigation, AlertTriangle,
} from 'lucide-react';

const ACTIVITY_TYPE_LABEL_KEYS: Record<DailyActivityType, TranslationKey> = {
  WORK: 'ess.dailyActivity.type.work',
  SITE_VISIT: 'ess.dailyActivity.type.siteVisit',
  SITE_INSPECTION: 'ess.dailyActivity.type.siteInspection',
  MEETING: 'ess.dailyActivity.type.meeting',
  OTHER: 'ess.dailyActivity.type.other',
};

const TYPE_FILTER_KEYS: Array<{ value: DailyActivityType | 'ALL'; labelKey: TranslationKey }> = [
  { value: 'ALL', labelKey: 'ess.dailyActivity.filter.allTypes' },
  { value: 'WORK', labelKey: 'ess.dailyActivity.type.work' },
  { value: 'SITE_VISIT', labelKey: 'ess.dailyActivity.type.siteVisit' },
  { value: 'SITE_INSPECTION', labelKey: 'ess.dailyActivity.type.siteInspection' },
  { value: 'MEETING', labelKey: 'ess.dailyActivity.type.meeting' },
  { value: 'OTHER', labelKey: 'ess.dailyActivity.type.other' },
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
  const { t } = useI18n();
  const [capturing, setCapturing] = useState(false);
  const captured = value.latitude !== undefined && value.longitude !== undefined;

  const capture = async () => {
    if (!('geolocation' in navigator)) {
      toast.error(t('ess.dailyActivity.gps.unsupported'));
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
      toast.success(t('ess.dailyActivity.gps.captured', { accuracy: Math.round(pos.coords.accuracy) }));
    } catch (err) {
      toast.error(t('ess.dailyActivity.gps.captureFailed', {
        message: apiErrorMessage(err, t('ess.dailyActivity.gps.deniedFallback')),
      }));
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
          {capturing
            ? t('ess.dailyActivity.gps.locating')
            : captured
              ? t('ess.dailyActivity.gps.recapture')
              : t('ess.dailyActivity.gps.captureNow')}
        </Button>
      </div>
      {captured && (
        <div className="text-xs rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30 dark:border-emerald-900 px-3 py-2 space-y-0.5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 size={14} /> <span className="font-semibold">{t('ess.dailyActivity.gps.capturedLabel')}</span>
          </div>
          <div className="text-muted-foreground font-mono text-[11px]">
            {t('ess.dailyActivity.gps.latLon', {
              lat: Number(value.latitude).toFixed(6),
              lon: Number(value.longitude).toFixed(6),
            })}
          </div>
        </div>
      )}
      {!captured && (
        <div className="text-xs rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/30 dark:border-yellow-900 px-3 py-2 flex items-start gap-2">
          <AlertTriangle size={14} className="mt-0.5 text-yellow-600 dark:text-yellow-400 flex-shrink-0" />
          <div className="text-yellow-800 dark:text-yellow-300">
            {t('ess.dailyActivity.gps.warnPrefix')} <strong>{t('ess.dailyActivity.gps.warnStrong')}</strong> {t('ess.dailyActivity.gps.warnSuffix')}
          </div>
        </div>
      )}
    </div>
  );
}

function CreateActivityForm({ onClose, onSubmitted }: { onClose: () => void; onSubmitted: () => void }) {
  const { t } = useI18n();
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
    if (!branchId) return toast.error(t('ess.dailyActivity.form.toast.selectSite'));
    if (title.trim().length < 3) return toast.error(t('ess.dailyActivity.form.toast.titleMin'));
    if (!gpsCoord.latitude || !gpsCoord.longitude) {
      return toast.error(t('ess.dailyActivity.form.toast.gpsRequired'));
    }
    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      return toast.error(t('ess.dailyActivity.form.toast.endAfterStart'));
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
      toast.success(t('ess.dailyActivity.form.toast.submitSuccess'));
      onSubmitted();
      onClose();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.dailyActivity.form.toast.submitFailed')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.activityDate')} *</Label>
          <Input type="date" value={activityDate} onChange={(e) => setActivityDate(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.filter.activityType')} *</Label>
          <Select2
            value={activityType}
            onValueChange={(v) => setActivityType(v as DailyActivityType)}
            options={(Object.keys(ACTIVITY_TYPE_LABEL_KEYS) as DailyActivityType[]).map((type) => ({
              value: type,
              label: t(ACTIVITY_TYPE_LABEL_KEYS[type]),
            }))}
          />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.siteBranch')} *</Label>
        <Select2
          value={branchId}
          onValueChange={setBranchId}
          options={[
            { value: '', label: t('ess.dailyActivity.form.selectSite'), disabled: true },
            { value: 'default-branch-1', label: 'Kantor Pusat (Jakarta)' },
          ]}
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.titleLabel')} *</Label>
        <Input
          placeholder={t('ess.dailyActivity.form.titlePlaceholder')}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.startTime')} *</Label>
          <Input type="datetime-local" value={startTime} onChange={(e) => setStartTime(e.target.value)} required />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.endTime')} *</Label>
          <Input type="datetime-local" value={endTime} onChange={(e) => setEndTime(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.description')}</Label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('ess.dailyActivity.form.descriptionPlaceholder')}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          <Camera size={14} className="inline mr-1" /> {t('ess.dailyActivity.form.photoUrl')}
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
        <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.form.additionalNotes')}</Label>
        <textarea
          rows={2}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('ess.dailyActivity.form.optionalPlaceholder')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>{t('common.cancel')}</Button>
        <Button type="submit" disabled={loading || !gpsCoord.latitude}>
          {loading ? t('ess.common.sending') : (<><Send size={16} className="mr-2" />{t('ess.dailyActivity.form.submit')}</>)}
        </Button>
      </div>
    </form>
  );
}

export function EmployeeDailyActivityPage() {
  const { t } = useI18n();
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
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.dailyActivity.toast.loadFailed')));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void fetch(); }, [typeFilter, dateRange]); // eslint-disable-line react-hooks/exhaustive-deps -- intentional deps (mount-only load / stable helper / avoids setState loop)

  const filtered = useMemo(
    () => (typeFilter === 'ALL' ? activities : activities.filter((a) => a.activityType === typeFilter)),
    [activities, typeFilter],
  );

  const summaryTotalMinutes = useMemo(
    () => filtered.reduce((s, a) => s + a.durationMinutes, 0),
    [filtered],
  );

  const handleDelete = async (id: string) => {
    if (!confirm(t('ess.dailyActivity.confirm.delete'))) return;
    setDeletingId(id);
    try {
      await dailyActivityService.deleteRequest(id);
      toast.success(t('ess.dailyActivity.toast.deleted'));
      void fetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.dailyActivity.toast.deleteFailed')));
    } finally {
      setDeletingId(null);
    }
  };

  const handleComplete = async (id: string) => {
    if (!confirm(t('ess.dailyActivity.confirm.complete'))) return;
    setCompletingId(id);
    try {
      await dailyActivityService.completeRequest(id);
      toast.success(t('ess.dailyActivity.toast.completed'));
      void fetch();
    } catch (err) {
      toast.error(apiErrorMessage(err, t('ess.dailyActivity.toast.completeFailed')));
    } finally {
      setCompletingId(null);
    }
  };

  return (
    <div className="space-y-5 px-6 py-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <PageHeader
          title={t('ess.dailyActivity.title')}
          description={t('ess.dailyActivity.description')}
        />
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => void fetch()} disabled={loading}>
            <RefreshCw size={16} className={`mr-2 ${loading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={16} className="mr-2" />{t('ess.dailyActivity.reportActivity')}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('ess.dailyActivity.stats.totalThisMonth')}</div>
          <div className="text-2xl font-semibold mt-1">{filtered.length}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('ess.dailyActivity.stats.totalDuration')}</div>
          <div className="text-2xl font-semibold mt-1">{formatDuration(summaryTotalMinutes)}</div>
        </div>
        <div className="rounded-xl border border-border bg-white dark:bg-gray-800 p-5 shadow-sm">
          <div className="text-xs text-muted-foreground">{t('ess.dailyActivity.stats.outsideRadius')}</div>
          <div className="text-2xl font-semibold mt-1 text-amber-600 dark:text-amber-400">
            {filtered.filter((a) => a.isOutsideRadius).length}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm p-4 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.filter.activityType')}</Label>
          <Select2
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as DailyActivityType | 'ALL')}
            options={TYPE_FILTER_KEYS.map((filter) => ({ value: filter.value, label: t(filter.labelKey) }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.filter.startDate')}</Label>
          <Input type="date" value={dateRange.startDate} onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })} />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-muted-foreground">{t('ess.dailyActivity.filter.endDate')}</Label>
          <Input type="date" value={dateRange.endDate} onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })} />
        </div>
      </div>

      <div className="rounded-xl border border-border bg-white dark:bg-gray-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wide">
              <tr>
                <th className="px-4 py-3 text-left">{t('ess.common.date')}</th>
                <th className="px-4 py-3 text-left">{t('ess.common.type')}</th>
                <th className="px-4 py-3 text-left">{t('ess.dailyActivity.table.title')}</th>
                <th className="px-4 py-3 text-left">{t('ess.dailyActivity.table.siteBranch')}</th>
                <th className="px-4 py-3 text-left">{t('ess.dailyActivity.table.timeDuration')}</th>
                <th className="px-4 py-3 text-left">{t('ess.dailyActivity.table.location')}</th>
                <th className="px-4 py-3 text-right">{t('ess.common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t('common.loading')}
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    <div className="inline-flex flex-col items-center gap-1.5">
                      <MapPin size={28} className="opacity-50" />
                      {t('ess.dailyActivity.empty')}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filtered.map((a) => (
                <tr key={a.id} className="hover:bg-muted/20 transition">
                  <td className="px-4 py-3">{formatDate(a.activityDate)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-medium ${DAILY_ACTIVITY_TYPE_CLASSNAMES[a.activityType]}`}>
                      {t(ACTIVITY_TYPE_LABEL_KEYS[a.activityType])}
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
                          {a.isOutsideRadius
                            ? t('ess.dailyActivity.chip.outsideRadius')
                            : t('ess.dailyActivity.chip.withinRadius')}
                        </span>
                        {a.distanceFromBranchMeters !== null && a.distanceFromBranchMeters !== undefined && (
                          <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                            {t('ess.dailyActivity.distanceFromSite', { distance: a.distanceFromBranchMeters })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t('ess.dailyActivity.noGps')}</span>
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
                        {t('ess.dailyActivity.action.complete')}
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

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('ess.dailyActivity.modal.newTitle')}>
        <CreateActivityForm onClose={() => setFormOpen(false)} onSubmitted={fetch} />
      </Modal>
    </div>
  );
}
