import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, FileText } from 'lucide-react';
import type { WorkflowInstanceStep } from '@/services/workflow-engine.service';
import { CardTitle, DashCard, StatusChip } from './shared';

function approvalIcon(approvalType?: string) {
  const type = (approvalType || '').toUpperCase();
  if (type.includes('LEAVE') || type.includes('CUTI')) return CalendarDays;
  return FileText;
}

function waitingChip(createdAt: string): { label: string; tone: 'success' | 'warning' | 'danger' } {
  const days = dayjs().diff(dayjs(createdAt), 'day');
  if (days <= 0) return { label: 'Baru', tone: 'success' };
  if (days <= 2) return { label: `${days} hari`, tone: 'warning' };
  return { label: `${days} hari`, tone: 'danger' };
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
  const top = approvals.slice(0, 2);

  return (
    <DashCard className="flex-1 flex flex-col">
      <div className="flex items-center justify-between gap-3">
        <CardTitle>{title}</CardTitle>
        <Link to="/workflow-engine" className="text-[11.5px] font-medium text-primary hover:underline whitespace-nowrap">
          Lihat semua
        </Link>
      </div>

      {approvals.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
          <CheckCircle2 size={26} className="text-success" />
          <p className="text-xs font-medium text-foreground">{emptyLabel}</p>
          <p className="text-[11px] text-muted-foreground">Semua pengajuan tim sudah ditindaklanjuti.</p>
        </div>
      ) : (
        <>
          <div className="mt-3.5 flex items-center gap-3">
            <span className="text-[30px] leading-none font-semibold tracking-[-1.4px] text-foreground">
              {approvals.length}
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              pengajuan menunggu persetujuan Anda
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-2.5">
            {top.map((step) => {
              const Icon = approvalIcon(step.instance?.approvalType);
              const chip = waitingChip(step.createdAt);
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
                      {step.instance?.referenceType || 'Pengajuan'}
                      {' · '}
                      {dayjs(step.createdAt).locale('id').format('D MMM YYYY')}
                    </p>
                  </div>
                  <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                </div>
              );
            })}
          </div>

          <div className="mt-auto flex items-center gap-2.5 pt-4">
            <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted-foreground">
              Tahap Anda saat ini: {top[0]?.name || 'Persetujuan'}
              {top[0]?.level ? ` · level ${top[0].level}` : ''}
            </span>
            <Link to="/workflow-engine" className="shrink-0 text-[11px] font-medium text-primary hover:underline">
              Proses sekarang
            </Link>
          </div>
        </>
      )}
    </DashCard>
  );
}
