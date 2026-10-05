import prisma from '@/shared/database/prisma';
import { logger } from '@/shared/logger/WinstonLogger';
import { runInSystemContext } from '@/shared/context/RequestContext';

/**
 * GAP-27 promised signer ordering, deadlines **and** automatic reminders. The
 * first two were built; the reminder was not — no notification write, no
 * scheduler — so a document sat unsigned past its due date with nobody told,
 * which is the one failure the deadline existed to prevent.
 *
 * Two decisions worth stating, because both are about not being ignored:
 *
 * Only the signer whose turn it is gets reminded. The order field means step 3
 * cannot sign before step 1, so reminding step 3 is asking for something the
 * system would refuse. People who receive impossible requests stop reading.
 *
 * One reminder per deadline tier, recorded on the row. A daily sweep that
 * re-sends every morning trains the recipient to filter the sender, at which
 * point the feature is worse than absent.
 */
export const SIGNING_REMINDER_OFFSETS_DAYS = [7, 3, 1];
/** Recorded once the deadline has passed, so the overdue notice is sent once. */
const OVERDUE = 0;

function daysUntil(target: Date, now: Date): number {
  const a = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

export interface SigningReminderResult {
  checked: number;
  notified: number;
  /** Already reminded at this tier, or not this signer's turn yet. */
  skipped: number;
  overdue: number;
}

export async function sweepSigningReminders(now = new Date()): Promise<SigningReminderResult> {
  return runInSystemContext('document-signing-reminder-sweep', async () => {
    const result: SigningReminderResult = { checked: 0, notified: 0, skipped: 0, overdue: 0 };

    const horizon = new Date(now);
    horizon.setUTCDate(horizon.getUTCDate() + Math.max(...SIGNING_REMINDER_OFFSETS_DAYS));

    const pending = await prisma.documentSigner.findMany({
      where: { status: 'PENDING', dueAt: { not: null, lte: horizon } },
      select: {
        id: true, userId: true, order: true, dueAt: true, lastReminderDays: true,
        document: {
          select: {
            id: true, title: true, companyId: true,
            signers: { where: { status: 'PENDING' }, select: { order: true } },
          },
        },
      },
    });
    result.checked = pending.length;

    for (const signer of pending) {
      if (!signer.dueAt) continue;

      // Whose turn it is: the lowest order still unsigned on this document.
      const currentStep = Math.min(...signer.document.signers.map((row) => row.order));
      if (signer.order !== currentStep) { result.skipped++; continue; }

      const remaining = daysUntil(signer.dueAt, now);
      const tier = remaining < 0
        ? OVERDUE
        : SIGNING_REMINDER_OFFSETS_DAYS.filter((days) => remaining <= days).sort((a, b) => a - b)[0];
      if (tier === undefined) { result.skipped++; continue; }
      // Tiers descend towards the deadline, so an equal or lower recorded tier
      // means this reminder has already gone out.
      if (signer.lastReminderDays !== null && signer.lastReminderDays <= tier) { result.skipped++; continue; }

      const due = signer.dueAt.toISOString().slice(0, 10);
      await prisma.notification.create({
        data: {
          companyId: signer.document.companyId,
          userId: signer.userId,
          title: remaining < 0
            ? 'Tanda tangan dokumen sudah melewati tenggat'
            : `Tanda tangan dokumen jatuh tempo dalam ${remaining} hari`,
          message: remaining < 0
            ? `Dokumen "${signer.document.title}" menunggu tanda tangan Anda dan tenggatnya ${due} sudah terlewat.`
            : `Dokumen "${signer.document.title}" menunggu tanda tangan Anda sebelum ${due}.`,
          type: remaining < 0 ? ('ERROR' as const) : ('WARNING' as const),
          resource: 'document-management',
          action: 'SIGNATURE_DUE',
          referenceId: signer.document.id,
        },
      });
      await prisma.documentSigner.update({
        where: { id: signer.id },
        data: { lastReminderDays: tier },
      });
      result.notified++;
      if (remaining < 0) result.overdue++;
    }

    logger.info('Document signing reminders swept', { ...result });
    return result;
  });
}
