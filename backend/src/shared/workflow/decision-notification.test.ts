import { buildDecisionNotification } from './decision-notification';

/**
 * Before this, a requester learned the outcome only by opening the app and
 * looking. Every approval domain goes through the workflow engine, so the
 * notification is built once here and covers all of them.
 */
const base = {
  companyId: 'company-a',
  requesterId: 'user-requester',
  actorId: 'user-approver',
  approvalType: 'LEAVE_REQUEST',
  referenceType: 'LEAVE_REQUEST',
  referenceId: 'leave-1',
} as const;

describe('workflow decision notification', () => {
  it('addresses the requester and names the domain on approval', () => {
    const notification = buildDecisionNotification({ ...base, status: 'APPROVED' });

    expect(notification).toMatchObject({
      companyId: 'company-a',
      userId: 'user-requester',
      title: 'Leave Request disetujui',
      type: 'SUCCESS',
      resource: 'leave_request',
      action: 'WORKFLOW_APPROVED',
      referenceId: 'leave-1',
    });
  });

  it('carries the approver comment when a request is rejected', () => {
    const notification = buildDecisionNotification({
      ...base, status: 'REJECTED', comment: '  Sisa saldo tidak cukup  ',
    });

    expect(notification?.title).toBe('Leave Request ditolak');
    expect(notification?.type).toBe('WARNING');
    expect(notification?.message).toContain('Catatan approver: Sisa saldo tidak cukup');
  });

  it('omits the comment line when there is none', () => {
    const approved = buildDecisionNotification({ ...base, status: 'APPROVED', comment: '   ' });
    expect(approved?.message).not.toContain('Catatan approver');
  });

  it('stays silent when the actor is the requester', () => {
    // Self-approval is already restricted; where it is legitimate there is
    // nobody new to inform.
    expect(buildDecisionNotification({
      ...base, actorId: base.requesterId, status: 'APPROVED',
    })).toBeNull();
  });

  it('stays silent without a requester', () => {
    expect(buildDecisionNotification({ ...base, requesterId: '', status: 'APPROVED' })).toBeNull();
  });

  it.each([
    ['OVERTIME_REQUEST', 'Overtime Request'],
    ['ATTENDANCE_CORRECTION', 'Attendance Correction'],
    ['CAREER_MOVEMENT', 'Career Movement'],
    ['EXPENSE_CLAIM', 'Expense Claim'],
  ])('reads %s as "%s"', (approvalType, subject) => {
    const notification = buildDecisionNotification({ ...base, approvalType, status: 'APPROVED' });
    expect(notification?.title).toBe(`${subject} disetujui`);
  });
});
