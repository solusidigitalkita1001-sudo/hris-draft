import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileText } from 'lucide-react';
import type { WorkflowInstanceStep } from '@/services/workflow-engine.service';
import { useI18n } from '@/i18n/provider';
import type { TranslationKey, TranslationParams } from '@/i18n/translations';
import { CardTitle, DashCard, StatusChip } from './shared';

function approvalIcon(approvalType?: string) {
  const type = (approvalType || '').toUpperCase();
  if (type.includes('LEAVE') || type.includes('CUTI')) return CalendarDays;
  return FileText;
}

function waitingChip(
  createdAt: string,
  t: (key: TranslationKey, params?: TranslationParams) => string
): { label: string; tone: 'success' | 'warning' | 'danger' } {
  const days = dayjs().diff(dayjs(createdAt), 'day');
  if (days <= 0) return { label: t('ops.dashboard.approvals.new'), tone: 'success' };
  if (days <= 2) return { label: t('ops.dashboard.approvals.daysWaiting', { days }), tone: 'warning' };
  return { label: t('ops.dashboard.approvals.daysWaiting', { days }), tone: 'danger' };
}

/** Kartu "Approval Menunggu" — 2 pengajuan teratas yang menunggu aksi user. */
export function ApprovalPendingCard({
  approvals,
  title,
  emptyLabel,
}: {
  approvals: WorkflowInstanceStep[];
  title: string;
  emptyLabel: string;
}) {
  const { t } = useI18n();
  const top = approvals.slice(0, 2);

  return (
    <DashCard className="flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <Link to="/workflow-engine" className="text-[11.5px] font-medium text-primary hover:underline whitespace-nowrap">
          {t('ops.dashboard.approvals.viewAll')}
        </Link>
      </div>

      {approvals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 size={26} className="text-success" />
          <p className="text-xs font-medium text-foreground">{emptyLabel}</p>
          <p className="text-[11px] text-muted-foreground">{t('ops.dashboard.approvals.allHandled')}</p>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex items-center gap-3">
            <span className="text-[30px] leading-none font-semibold tracking-[-1.4px] text-foreground">
              {approvals.length}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              {t('ops.dashboard.approvals.awaitingYourApproval')}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {top.map((step) => {
              const Icon = approvalIcon(step.instance?.approvalType);
              const chip = waitingChip(step.createdAt, t);
              return (
                <div key={step.id} className="flex items-center gap-3 rounded-2xl bg-secondary px-3.5 py-3">
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-xl bg-card text-primary">
                    <Icon size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">
                      {step.instance?.template?.name || step.instance?.approvalType || step.name}
                    </p>
                    <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                      {step.instance?.referenceType || t('ops.dashboard.approvals.request')}
                      {' · '}
                      {dayjs(step.createdAt).format('D MMM YYYY')}
                    </p>
                  </div>
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex items-center gap-2.5 pt-4">
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
              {t('ops.dashboard.approvals.currentStage', { stage: top[0]?.name || t('ops.dashboard.approvals.approval') })}
              {top[0]?.level ? ` · ${t('ops.dashboard.approvals.level', { level: top[0].level })}` : ''}
            </span>
            <Link to="/workflow-engine" className="shrink-0 text-[11px] font-medium text-primary hover:underline">
              {t('ops.dashboard.approvals.processNow')}
            </Link>
          </div>
        </>
      )}
    </DashCard>
  );
}
