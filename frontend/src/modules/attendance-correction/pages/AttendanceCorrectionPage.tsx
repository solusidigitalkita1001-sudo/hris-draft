import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CalendarClock, Plus, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AppModal } from '@/components/shared/AppModal';
import { StatTile } from '@/components/shared/StatTile';
import { FilterChip, StatusChip, statusTone } from '@/components/shared/StatusChip';
import { TableShell, useTableControls } from '@/components/shared/TableShell';
import {
  attendanceCorrectionService,
  type AttendanceCorrection,
  type AttendanceCorrectionStatus,
} from '@/services/attendance-correction.service';
import { AttendanceCorrectionForm } from '@/modules/attendance-correction/components/AttendanceCorrectionForm';
import { useAuthStore } from '@/stores/auth.store';
import { apiErrorMessage } from '@/lib/errors';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { formatDate, formatTime } from '@/utils/format';

const STATUS_LABEL_KEYS: Record<string, TranslationKey> = {
  PENDING: 'ess.status.pending',
  APPROVED: 'ess.status.approved',
  REJECTED: 'ess.status.rejected',
  CANCELLED: 'ess.status.cancelled',
};

/** Status yang diterima query backend (`attendanceCorrectionListQuerySchema`). */
const STATUS_FILTERS: Array<'' | AttendanceCorrectionStatus> = [
  '',
  'PENDING',
  'APPROVED',
  'REJECTED',
  'CANCELLED',
];

/** `date` berupa kolom Date; potong ke YYYY-MM-DD agar bebas pergeseran zona waktu. */
function dateOnly(value: string): string {
  return String(value).slice(0, 10);
}

/**
 * Koreksi absensi self-service (GAP-30).
 * Daftar pengajuan sendiri: GET /attendance-corrections/my
 * Pengajuan baru: POST /attendance-corrections
 */
export function AttendanceCorrectionPage() {
  const { t } = useI18n();
  const { user } = useAuthStore();
  const [corrections, setCorrections] = useState<AttendanceCorrection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'' | AttendanceCorrectionStatus>('');
  const [modalOpen, setModalOpen] = useState(false);

  const isLinkedToEmployee = Boolean(user?.employeeId);

  const fetchCorrections = useCallback(async () => {
    if (!isLinkedToEmployee) {
      setCorrections([]);
      setError(t('ess.attendanceCorrection.notLinked'));
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCorrections(await attendanceCorrectionService.getMine(statusFilter || undefined));
    } catch (err) {
      setCorrections([]);
      setError(apiErrorMessage(err, t('ess.common.loadFailed')));
    } finally {
      setLoading(false);
    }
  }, [isLinkedToEmployee, statusFilter, t]);

  useEffect(() => {
    void fetchCorrections();
  }, [fetchCorrections]);

  const pendingCount = corrections.filter((c) => c.status === 'PENDING').length;
  const approvedCount = corrections.filter((c) => c.status === 'APPROVED').length;
  const rejectedCount = corrections.filter((c) => c.status === 'REJECTED').length;

  const table = useTableControls(corrections, (c, q) =>
    [
      formatDate(dateOnly(c.date)),
      c.reason,
      STATUS_LABEL_KEYS[c.status] ? t(STATUS_LABEL_KEYS[c.status]) : c.status,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q));

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div>
          <h1 className="text-xl font-semibold tracking-[-0.9px] text-foreground">
            {t('ess.attendanceCorrection.title')}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {t('ess.attendanceCorrection.subtitle')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => void fetchCorrections()}>
            <RefreshCw size={15} className="mr-2" /> {t('common.refresh')}
          </Button>
          <Button
            size="sm"
            className="rounded-[14px]"
            disabled={!isLinkedToEmployee}
            onClick={() => setModalOpen(true)}
          >
            <Plus size={15} className="mr-2" /> {t('ess.attendanceCorrection.action.new')}
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3.5">
        <StatTile label={t('ess.attendanceCorrection.stats.total')} value={corrections.length} />
        <StatTile label={t('ess.status.pending')} value={pendingCount} valueClassName="text-warning" />
        <StatTile label={t('ess.status.approved')} value={approvedCount} valueClassName="text-success" />
        <StatTile label={t('ess.status.rejected')} value={rejectedCount} valueClassName="text-danger" />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((s) => (
          <FilterChip key={s || 'ALL'} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
            {s ? (STATUS_LABEL_KEYS[s] ? t(STATUS_LABEL_KEYS[s]) : s) : t('ess.common.all')}
          </FilterChip>
        ))}
      </div>

      {loading ? (
        <div className="mt-3.5 flex items-center justify-center rounded-card border border-border bg-card py-20">
          <p className="text-sm text-muted-foreground">{t('ess.common.loadingData')}</p>
        </div>
      ) : error ? (
        <div className="mt-3.5 flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-danger-bg">
            <AlertCircle size={24} className="text-danger" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {t('ess.attendanceCorrection.error.title')}
          </p>
          <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
            {error}
          </p>
          {isLinkedToEmployee && (
            <Button variant="outline" size="sm" onClick={() => void fetchCorrections()}>
              <RefreshCw size={15} className="mr-2" /> {t('ess.attendanceCorrection.error.retry')}
            </Button>
          )}
        </div>
      ) : corrections.length === 0 ? (
        <div className="mt-3.5 flex flex-col items-center gap-3.5 rounded-card border border-border bg-card px-6 py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-[22px] bg-accent">
            <CalendarClock size={24} className="text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {statusFilter
              ? t('ess.attendanceCorrection.empty.filtered')
              : t('ess.attendanceCorrection.empty.title')}
          </p>
          <p className="max-w-[340px] text-center text-[11.5px] leading-relaxed text-muted-foreground">
            {t('ess.attendanceCorrection.empty.hint')}
          </p>
          {!statusFilter && (
            <Button
              size="sm"
              className="rounded-[14px]"
              disabled={!isLinkedToEmployee}
              onClick={() => setModalOpen(true)}
            >
              <Plus size={15} className="mr-2" /> {t('ess.attendanceCorrection.action.new')}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-3.5">
          <TableShell
            search={table.search}
            setSearch={table.setSearch}
            pageSize={table.pageSize}
            setPageSize={table.setPageSize}
            page={table.page}
            setPage={table.setPage}
            totalPages={table.totalPages}
            totalItems={table.filtered.length}
            searchPlaceholder={t('ess.attendanceCorrection.searchPlaceholder')}
          >
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="bg-secondary/70">
                  {[
                    t('ess.attendanceCorrection.table.date'),
                    t('ess.attendanceCorrection.table.requestedCheckIn'),
                    t('ess.attendanceCorrection.table.requestedCheckOut'),
                    t('ess.common.reason'),
                    t('ess.attendanceCorrection.table.submitted'),
                    t('ess.common.status'),
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-5 py-3.5 text-[10.5px] font-semibold uppercase tracking-[0.6px] text-muted-foreground"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.paged.map((c) => (
                  <tr key={c.id} className="border-t border-border transition-colors hover:bg-muted/30">
                    <td className="px-5 py-3.5 text-xs font-medium text-foreground">
                      {formatDate(dateOnly(c.date))}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      {c.requestedCheckIn
                        ? formatTime(c.requestedCheckIn)
                        : t('ess.attendanceCorrection.unchanged')}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      {c.requestedCheckOut
                        ? formatTime(c.requestedCheckOut)
                        : t('ess.attendanceCorrection.unchanged')}
                    </td>
                    <td className="max-w-[260px] px-5 py-3.5 text-xs text-muted-foreground">
                      <p className="truncate" title={c.reason}>{c.reason}</p>
                      {c.status === 'REJECTED' && c.rejectionReason && (
                        <p className="mt-1 truncate text-[11px] text-danger" title={c.rejectionReason}>
                          {t('ess.attendanceCorrection.rejectionReason', { reason: c.rejectionReason })}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-muted-foreground">{formatDate(c.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <StatusChip tone={statusTone(c.status)}>
                        {STATUS_LABEL_KEYS[c.status] ? t(STATUS_LABEL_KEYS[c.status]) : c.status}
                      </StatusChip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableShell>
        </div>
      )}

      <AppModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('ess.attendanceCorrection.modal.title')}
        description={t('ess.attendanceCorrection.modal.description')}
      >
        <AttendanceCorrectionForm
          onSuccess={() => void fetchCorrections()}
          onClose={() => setModalOpen(false)}
        />
      </AppModal>
    </div>
  );
}
