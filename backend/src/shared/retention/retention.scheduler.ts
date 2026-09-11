import { queueManager, QueueNames } from '@/infrastructure/queue/QueueManager';
import { logger } from '@/shared/logger/WinstonLogger';
import prisma from '@/shared/database/prisma';

export const RETENTION_SWEEP_JOB = 'retention:sweep';

/**
 * Data-retention sweep (checklist §38). Opt-in per company — deletion is
 * destructive, so every rule stays OFF until the tenant sets a positive
 * day count in company settings:
 *   retention_face_log_days  — hard-delete AttendanceFaceLog rows older than N days
 *                              (biometric minimization; the attendance row itself stays)
 *   retention_candidate_days — anonymize candidates with no update in N days
 *                              (except HIRED ones), keeping the row for statistics
 */
export async function runRetentionSweep(): Promise<{ companies: number; faceLogsDeleted: number; candidatesAnonymized: number }> {
  const companies = await prisma.company.findMany({ where: { deletedAt: null }, select: { id: true } });
  let faceLogsDeleted = 0;
  let candidatesAnonymized = 0;

  for (const company of companies) {
    const settings = await prisma.companySetting.findMany({
      where: { companyId: company.id, key: { in: ['retention_face_log_days', 'retention_candidate_days'] } },
      select: { key: true, value: true },
    });
    const days = (key: string) => {
      const raw = settings.find((s) => s.key === key)?.value;
      const parsed = Number(raw);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    };

    const faceLogDays = days('retention_face_log_days');
    if (faceLogDays > 0) {
      const cutoff = new Date(Date.now() - faceLogDays * 86_400_000);
      const removed = await prisma.attendanceFaceLog.deleteMany({
        where: { companyId: company.id, createdAt: { lt: cutoff } },
      });
      faceLogsDeleted += removed.count;
    }

    const candidateDays = days('retention_candidate_days');
    if (candidateDays > 0) {
      const cutoff = new Date(Date.now() - candidateDays * 86_400_000);
      const stale = await prisma.candidate.findMany({
        where: {
          companyId: company.id,
          deletedAt: null,
          updatedAt: { lt: cutoff },
          email: { not: null }, // not yet anonymized
          applications: { none: { status: 'HIRED' } },
        },
        select: { id: true },
        take: 500, // bounded batch per sweep
      });
      for (const candidate of stale) {
        await prisma.candidate.update({
          where: { id: candidate.id },
          data: {
            firstName: 'Anonymized',
            lastName: 'Candidate',
            email: null,
            phone: null,
            resume: null,
            portfolio: null,
            notes: null,
            currentCompany: null,
            currentPosition: null,
            deletedAt: new Date(),
          },
        });
        candidatesAnonymized += 1;
      }
    }
  }

  if (faceLogsDeleted || candidatesAnonymized) {
    logger.info('Retention sweep complete', { companies: companies.length, faceLogsDeleted, candidatesAnonymized });
  }
  return { companies: companies.length, faceLogsDeleted, candidatesAnonymized };
}

/** Register the daily sweep (02:00). Safe to call repeatedly — BullMQ dedups by jobId. */
export async function scheduleRetentionSweep(): Promise<void> {
  if (!queueManager.isEnabled()) {
    logger.warn('Queue disabled — retention sweep will not be scheduled');
    return;
  }
  await queueManager.enqueue(
    QueueNames.LEAVE_AUTOMATION,
    RETENTION_SWEEP_JOB,
    {},
    { repeat: { pattern: '0 2 * * *' }, jobId: 'retention-sweep-cron' },
  );
  logger.info('Retention sweep scheduled (daily 02:00)');
}
