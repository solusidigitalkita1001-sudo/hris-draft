import { useCallback, useEffect, useState } from 'react';
import dayjs from 'dayjs';
import toast from 'react-hot-toast';
import { AlertCircle, CalendarClock, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { StatusChip } from '@/components/shared/StatusChip';
import { attendanceService, type AttendanceRecord } from '@/services/attendance.service';
import {
  attendanceCorrectionService,
  type CreateAttendanceCorrectionPayload,
} from '@/services/attendance-correction.service';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import { formatTime } from '@/utils/format';

/**
 * Form pengajuan koreksi absensi (POST /attendance-corrections).
 *
 * Catatan kontrak backend:
 * - `date` dikirim sebagai tengah malam UTC (`YYYY-MM-DDT00:00:00.000Z`) karena
 *   service membandingkan `new Date(date).toISOString().slice(0, 10)` dengan
 *   tanggal attendance; tengah malam lokal akan bergeser satu hari.
 * - Minimal satu dari jam masuk / jam keluar wajib terisi.
 * - `reason` wajib, 3–2000 karakter.
 */
export function AttendanceCorrectionForm({
  onSuccess,
  onClose,
}: {
  onSuccess?: () => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [date, setDate] = useState(dayjs().format('YYYY-MM-DD'));
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const [existing, setExisting] = useState<AttendanceRecord | null>(null);
  const [contextLoading, setContextLoading] = useState(false);
  const [contextError, setContextError] = useState<string | null>(null);

  // Baris absensi yang sudah ada untuk tanggal terpilih — ditampilkan sebagai
  // konteks dan dikirim sebagai `attendanceId` agar koreksi menimpa baris itu
  // alih-alih membuat baris baru.
  const fetchExisting = useCallback(async () => {
    if (!date) {
      setExisting(null);
      return;
    }
    setContextLoading(true);
    setContextError(null);
    try {
      const result = await attendanceService.getMyAttendance({
        month: dayjs(date).format('YYYY-MM'),
        limit: 31,
      });
      setExisting(result.items.find((item) => String(item.date).slice(0, 10) === date) ?? null);
    } catch (error) {
      setExisting(null);
      setContextError(apiErrorMessage(error, t('ess.attendanceCorrection.context.failed')));
    } finally {
      setContextLoading(false);
    }
  }, [date, t]);

  useEffect(() => {
    void fetchExisting();
  }, [fetchExisting]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!checkInTime && !checkOutTime) {
      toast.error(t('ess.attendanceCorrection.form.validation.timeRequired'));
      return;
    }
    if (reason.trim().length < 3) {
      toast.error(t('ess.attendanceCorrection.form.validation.reasonTooShort'));
      return;
    }
    const requestedCheckIn = checkInTime ? dayjs(`${date}T${checkInTime}`) : null;
    const requestedCheckOut = checkOutTime ? dayjs(`${date}T${checkOutTime}`) : null;
    if (requestedCheckIn && requestedCheckOut && !requestedCheckOut.isAfter(requestedCheckIn)) {
      toast.error(t('ess.attendanceCorrection.form.validation.checkOutBeforeCheckIn'));
      return;
    }

    const payload: CreateAttendanceCorrectionPayload = {
      date: `${date}T00:00:00.000Z`,
      reason: reason.trim(),
      ...(existing ? { attendanceId: existing.id } : {}),
      ...(requestedCheckIn ? { requestedCheckIn: requestedCheckIn.toISOString() } : {}),
      ...(requestedCheckOut ? { requestedCheckOut: requestedCheckOut.toISOString() } : {}),
    };

    setSaving(true);
    try {
      await attendanceCorrectionService.create(payload);
      toast.success(t('ess.attendanceCorrection.form.toast.success'));
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(apiErrorMessage(error, t('ess.attendanceCorrection.form.toast.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="attendance-correction-date"
          className="mb-1.5 block text-xs font-medium text-muted-foreground"
        >
          {t('ess.attendanceCorrection.form.date')} *
        </label>
        <Input
          id="attendance-correction-date"
          type="date"
          value={date}
          max={dayjs().format('YYYY-MM-DD')}
          onChange={(event) => setDate(event.target.value)}
          required
        />
      </div>

      {/* Konteks: baris absensi yang sudah tercatat pada tanggal itu */}
      <div className="rounded-card-sm border border-border bg-background px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.8px] text-muted-foreground">
          <CalendarClock size={13} /> {t('ess.attendanceCorrection.context.title')}
        </p>
        {contextLoading ? (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {t('ess.attendanceCorrection.context.loading')}
          </p>
        ) : contextError ? (
          <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-warning">
            <AlertCircle size={13} className="mt-px flex-none" />
            {contextError}
          </p>
        ) : existing ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="text-[11.5px] text-muted-foreground">
              {t('ess.attendanceCorrection.context.checkIn')}:{' '}
              <span className="font-medium text-foreground">
                {existing.checkIn
                  ? formatTime(existing.checkIn)
                  : t('ess.attendanceCorrection.context.notRecorded')}
              </span>
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {t('ess.attendanceCorrection.context.checkOut')}:{' '}
              <span className="font-medium text-foreground">
                {existing.checkOut
                  ? formatTime(existing.checkOut)
                  : t('ess.attendanceCorrection.context.notRecorded')}
              </span>
            </span>
            <StatusChip tone="accent">{existing.status}</StatusChip>
          </div>
        ) : (
          <p className="mt-2 text-[11.5px] text-muted-foreground">
            {t('ess.attendanceCorrection.context.none')}
          </p>
        )}
      </div>

      <div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label
              htmlFor="attendance-correction-check-in"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {t('ess.attendanceCorrection.form.checkIn')}
            </label>
            <Input
              id="attendance-correction-check-in"
              type="time"
              value={checkInTime}
              onChange={(event) => setCheckInTime(event.target.value)}
            />
          </div>
          <div>
            <label
              htmlFor="attendance-correction-check-out"
              className="mb-1.5 block text-xs font-medium text-muted-foreground"
            >
              {t('ess.attendanceCorrection.form.checkOut')}
            </label>
            <Input
              id="attendance-correction-check-out"
              type="time"
              value={checkOutTime}
              onChange={(event) => setCheckOutTime(event.target.value)}
            />
          </div>
        </div>
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock size={12} /> {t('ess.attendanceCorrection.form.timeHint')}
        </p>
      </div>

      <div>
        <label
          htmlFor="attendance-correction-reason"
          className="mb-1.5 block text-xs font-medium text-muted-foreground"
        >
          {t('ess.common.reason')} *
        </label>
        <textarea
          id="attendance-correction-reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={t('ess.attendanceCorrection.form.reasonPlaceholder')}
          rows={3}
          maxLength={2000}
          required
          className="w-full resize-none rounded-field border border-border bg-background px-3.5 py-2.5 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={saving}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="sm" className="rounded-[14px]" disabled={saving}>
          {saving ? t('ess.common.sending') : t('ess.attendanceCorrection.form.submit')}
        </Button>
      </div>
    </form>
  );
}
