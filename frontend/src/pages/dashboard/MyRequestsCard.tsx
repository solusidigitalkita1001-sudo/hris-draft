import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { CalendarDays, FileText } from 'lucide-react';
import type { LeaveRequest } from '@/services/leave.service';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey } from '@/i18n/translations';
import { DashCard, CardTitle, StatusChip, EmptyHint, type ChipTone } from './shared';

const STATUS_TONES: Record<string, { tone: ChipTone; labelKey: TranslationKey }> = {
  PENDING: { tone: 'warning', labelKey: 'ops.dashboard.requests.status.pending' },
  APPROVED: { tone: 'success', labelKey: 'ops.dashboard.requests.status.approved' },
  REJECTED: { tone: 'danger', labelKey: 'ops.dashboard.requests.status.rejected' },
  CANCELLED: { tone: 'neutral', labelKey: 'ops.dashboard.requests.status.cancelled' },
};

/** Kartu "Pengajuan Terakhir" untuk persona karyawan: cuti milik sendiri. */
export function MyRequestsCard({ requests, className }: { requests: LeaveRequest[]; className?: string }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const items = requests.slice(0, 4);

  return (
    <DashCard className={`flex flex-1 flex-col ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{t('ops.dashboard.requests.title')}</CardTitle>
        <button
          type="button"
          onClick={() => navigate('/self-service')}
          className="text-[11.5px] font-medium text-primary hover:underline"
        >
          {t('ops.dashboard.requests.viewAll')}
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyHint
          icon={<FileText size={28} aria-hidden="true" />}
          title={t('ops.dashboard.requests.emptyTitle')}
          note={t('ops.dashboard.requests.emptyNote')}
        />
      ) : (
        <div className="mt-3.5 flex flex-col gap-2">
          {items.map((request) => {
            const status = STATUS_TONES[request.status];
            const statusTone = status?.tone ?? ('neutral' as ChipTone);
            const statusLabel = status ? t(status.labelKey) : request.status;
            return (
              <div key={request.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-3">
                <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[12px] bg-card text-primary shadow-card">
                  <CalendarDays size={15} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-foreground">
                    {request.leaveType?.name ?? t('ops.dashboard.leave.typeFallback')} ·{' '}
                    {t('ops.dashboard.requests.days', { count: request.totalDays })}
                  </p>
                  <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                    {dayjs(request.startDate).format('D MMM')} – {dayjs(request.endDate).format('D MMM YYYY')}
                  </p>
                </div>
                <StatusChip tone={statusTone}>{statusLabel}</StatusChip>
              </div>
            );
          })}
        </div>
      )}
    </DashCard>
  );
}
