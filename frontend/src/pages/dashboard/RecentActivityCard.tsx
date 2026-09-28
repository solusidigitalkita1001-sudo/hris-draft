import dayjs from 'dayjs';
import { Activity } from 'lucide-react';
import type { DashboardSummary } from '@/services/reports.service';
import { CardTitle, DashCard, EmptyHint } from './shared';
import { initialsOf } from './format';

type ActivityItem = DashboardSummary['recentActivity'][number];

/** Kartu "Aktivitas Terbaru" — audit log ringkas dari ringkasan dashboard. */
export function RecentActivityCard({
  items,
  title,
  emptyLabel,
}: {
  items: ActivityItem[];
  title: string;
  emptyLabel: string;
}) {
  return (
    <DashCard>
      <CardTitle>{title}</CardTitle>

      {items.length === 0 ? (
        <EmptyHint icon={<Activity size={26} />} title={emptyLabel} />
      ) : (
        <div className="mt-2">
          {items.slice(0, 6).map((item, i) => (
            <div
              key={item.id}
              className={`flex items-center gap-3.5 py-3 ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-[10.5px] font-semibold text-primary">
                {initialsOf(item.actorEmail)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-medium text-foreground">
                  {item.action} {item.entity}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                  {item.actorEmail}
                  {item.entityId ? ` · ${item.entityId}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-[10.5px] text-muted-foreground">
                {dayjs(item.createdAt).locale('id').format('D MMM HH:mm')}
              </span>
            </div>
          ))}
        </div>
      )}
    </DashCard>
  );
}
