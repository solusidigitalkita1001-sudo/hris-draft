import type { Prisma } from '@prisma/client';
import { humanizeCode } from './approval-summary';

/**
 * Nobody was told when their request was decided. Every approval flow already
 * passes through the workflow engine, so one notification here reaches all nine
 * domains — leave, loan, business trip, expense claim, shift swap, overtime,
 * career movement, permission request and attendance correction — instead of a
 * publish call bolted onto each service.
 *
 * ponytail: only the requester is notified, and only on the final decision.
 * "Your turn to approve" is already visible in the approval inbox, and the SLA
 * sweep chases the ones that go stale; adding a per-step notification would
 * multiply volume for something the approver can already see.
 */
export interface DecisionNotificationInput {
  companyId: string;
  requesterId: string;
  actorId: string;
  approvalType: string;
  referenceType: string;
  referenceId: string;
  status: 'APPROVED' | 'REJECTED';
  comment?: string | null;
}

export function buildDecisionNotification(input: DecisionNotificationInput): Prisma.NotificationUncheckedCreateInput | null {
  // Approving your own request is already restricted, and where a system actor
  // finalises one there is nobody new to inform.
  if (!input.requesterId || input.requesterId === input.actorId) return null;

  const subject = humanizeCode(input.approvalType);
  const approved = input.status === 'APPROVED';
  const comment = input.comment?.trim();

  return {
    companyId: input.companyId,
    userId: input.requesterId,
    title: approved ? `${subject} disetujui` : `${subject} ditolak`,
    message: [
      approved
        ? `Pengajuan ${subject.toLowerCase()} Anda telah disetujui.`
        : `Pengajuan ${subject.toLowerCase()} Anda ditolak.`,
      comment ? `Catatan approver: ${comment}` : null,
    ].filter(Boolean).join(' '),
    type: approved ? 'SUCCESS' : 'WARNING',
    resource: input.referenceType.toLowerCase(),
    action: `WORKFLOW_${input.status}`,
    referenceId: input.referenceId,
  };
}
