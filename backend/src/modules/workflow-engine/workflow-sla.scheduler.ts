import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';

export const WORKFLOW_SLA_SWEEP_JOB = 'workflow:sla-sweep';

const DEFAULT_SLA_HOURS = 72;
const RENOTIFY_INTERVAL_MS = 24 * 3_600_000;

/**
 * Hourly sweep for approval steps that exceeded their stage SLA. Deliberately
 * notification-only: it never advances or escalates state automatically,
 * because the current ESCALATE semantics skip the level when no backup
 * approver exists — a timer must never silently discharge an approval.
 */
export async function runWorkflowSlaSweep(): Promise<{ scanned: number; overdue: number; notified: number }> {
  const steps = await prisma.workflowInstanceStep.findMany({
    where: { status: 'PENDING', isCurrent: true, instance: { status: { in: ['PENDING', 'ESCALATED'] } } },
    select: {
      id: true, name: true, level: true, approverId: true, backupApproverId: true, createdAt: true,
      stage: { select: { slaHours: true } },
      instance: { select: { id: true, companyId: true, referenceType: true, referenceId: true } },
    },
  });

  const now = Date.now();
  let overdue = 0;
  let notified = 0;
  for (const step of steps) {
    // stage is null when the template was edited after start; fall back.
    const slaHours = step.stage?.slaHours ?? DEFAULT_SLA_HOURS;
    if (now < step.createdAt.getTime() + slaHours * 3_600_000) continue;
    overdue += 1;

    const recipients = [step.approverId, step.backupApproverId].filter((id): id is string => Boolean(id));
    for (const userId of recipients) {
      const recent = await prisma.notification.findFirst({
        where: { userId, action: 'SLA_OVERDUE', referenceId: step.id, createdAt: { gte: new Date(now - RENOTIFY_INTERVAL_MS) } },
        select: { id: true },
      });
      if (recent) continue; // at most one reminder per approver per step per day
      await prisma.notification.create({
        data: {
          companyId: step.instance.companyId,
          userId,
          title: `Approval melewati SLA (level ${step.level}: ${step.name})`,
          message: `Langkah approval "${step.name}" untuk ${step.instance.referenceType} sudah menunggu lebih dari ${slaHours} jam. Segera tindak lanjuti di menu persetujuan.`,
          type: 'WARNING',
          resource: 'workflow',
          action: 'SLA_OVERDUE',
          referenceId: step.id,
        },
      });
      notified += 1;
    }
  }

  logger.info('Workflow SLA sweep complete', { scanned: steps.length, overdue, notified });
  return { scanned: steps.length, overdue, notified };
}

/** Register the hourly sweep. Safe to call repeatedly — BullMQ dedups by jobId. */
export async function scheduleWorkflowSlaSweep(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — workflow SLA sweep will not be scheduled');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    WORKFLOW_SLA_SWEEP_JOB,
    {},
    { repeat: { pattern: '0 * * * *' }, jobId: 'workflow-sla-sweep-cron' },
  );
  logger.info('Workflow SLA sweep scheduled (hourly)');
}
