import { randomUUID } from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { runInRequestContext, runInSystemContext } from '@/shared/context/RequestContext';
import { workflowEngineRepository } from './workflow-engine.repository';

/**
 * Decision notifications, against a real MySQL.
 *
 * The builder has unit tests, but they cannot answer the questions that matter
 * once a decision commits: does a row actually land, does it land on the
 * requester rather than the approver, is there exactly one, and does it share
 * the decision's transaction so a rolled-back approval leaves no notification
 * claiming otherwise.
 */
const describeWithMysql = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

const companies: string[] = [];
const groups: string[] = [];
const users: string[] = [];

interface Fixture {
  companyId: string;
  requesterUserId: string;
  approverUserId: string;
  instanceId: string;
  referenceId: string;
}

async function fixture(): Promise<Fixture> {
  const companyId = randomUUID(), groupId = randomUUID();
  const requesterUserId = randomUUID(), approverUserId = randomUUID();
  companies.push(companyId); groups.push(groupId); users.push(requesterUserId, approverUserId);

  return runInSystemContext('decision-notification-fixture', async () => {
    await prisma.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Decision notifications' } });
    await prisma.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    for (const [id, email] of [[requesterUserId, 'requester'], [approverUserId, 'approver']] as const) {
      await prisma.user.create({
        data: { id, email: `${email}-${id}@example.test`, passwordHash: 'x', status: 'ACTIVE' },
      });
    }
    const template = await prisma.workflowTemplate.create({
      data: {
        companyId, name: 'Leave decisions', approvalType: 'LEAVE_REQUEST', resource: 'leave', isActive: true,
        stages: { create: { name: 'Approver', level: 1, approverType: 'USER', approverId: approverUserId } },
      },
    });
    const referenceId = randomUUID();
    const instance = await workflowEngineRepository.startInstance(requesterUserId, {
      templateId: template.id, companyId, approvalType: 'LEAVE_REQUEST',
      referenceType: 'LEAVE_REQUEST', referenceId, payload: { reason: 'Synthetic' },
    });
    return { companyId, requesterUserId, approverUserId, instanceId: instance.id, referenceId };
  });
}

const act = (f: Fixture, action: 'APPROVE' | 'REJECT', comment?: string) => runInRequestContext({
  user: {
    id: f.approverUserId, email: 'approver@example.test', companyId: f.companyId,
    companyScope: [f.companyId], roles: ['HR_MANAGER'], permissions: ['leave:approve'],
  },
}, () => workflowEngineRepository.applyAction(f.instanceId, f.approverUserId, ['HR_MANAGER'], { action, comment } as never));

const notifications = (f: Fixture, userId: string) => runInSystemContext('decision-notification-read', async () =>
  prisma.notification.findMany({
    where: { companyId: f.companyId, userId },
    select: { title: true, message: true, type: true, resource: true, action: true, referenceId: true },
  }));

describeWithMysql('workflow decision notifications (isolated real MySQL)', () => {
  afterAll(async () => {
    await runInSystemContext('decision-notification-cleanup', async () => {
      const companyId = { in: companies };
      await prisma.notification.deleteMany({ where: { companyId } });
      await prisma.workflowInstanceLog.deleteMany({ where: { instance: { companyId } } });
      await prisma.workflowInstanceStep.deleteMany({ where: { instance: { companyId } } });
      await prisma.workflowInstance.deleteMany({ where: { companyId } });
      await prisma.workflowStage.deleteMany({ where: { template: { companyId } } });
      await prisma.workflowTemplate.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.companyGroup.deleteMany({ where: { id: { in: groups } } });
      await prisma.user.deleteMany({ where: { id: { in: users } } });
    });
    await prisma.$disconnect();
  });

  it('tells the requester, once, when their request is approved', async () => {
    const f = await fixture();

    await act(f, 'APPROVE', 'Disetujui, silakan');

    const inbox = await notifications(f, f.requesterUserId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({
      title: 'Leave Request disetujui',
      type: 'SUCCESS',
      resource: 'leave_request',
      action: 'WORKFLOW_APPROVED',
      referenceId: f.referenceId,
    });
    // The approver already knows what they just decided.
    await expect(notifications(f, f.approverUserId)).resolves.toEqual([]);
  });

  it('carries the approver comment when the request is rejected', async () => {
    const f = await fixture();

    await act(f, 'REJECT', 'Saldo tidak cukup');

    const inbox = await notifications(f, f.requesterUserId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ title: 'Leave Request ditolak', type: 'WARNING', action: 'WORKFLOW_REJECTED' });
    expect(inbox[0].message).toContain('Catatan approver: Saldo tidak cukup');
  });

  it('writes nothing while the request is still pending a later level', async () => {
    const companyId = randomUUID(), groupId = randomUUID();
    const requesterUserId = randomUUID(), firstApprover = randomUUID(), secondApprover = randomUUID();
    companies.push(companyId); groups.push(groupId); users.push(requesterUserId, firstApprover, secondApprover);

    const f = await runInSystemContext('decision-notification-two-stage', async () => {
      await prisma.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Two stage' } });
      await prisma.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Two stage' } });
      for (const id of [requesterUserId, firstApprover, secondApprover]) {
        await prisma.user.create({ data: { id, email: `${id}@example.test`, passwordHash: 'x', status: 'ACTIVE' } });
      }
      const template = await prisma.workflowTemplate.create({
        data: {
          companyId, name: 'Two levels', approvalType: 'LEAVE_REQUEST', resource: 'leave', isActive: true,
          stages: { create: [
            { name: 'First', level: 1, approverType: 'USER', approverId: firstApprover },
            { name: 'Second', level: 2, approverType: 'USER', approverId: secondApprover },
          ] },
        },
      });
      const referenceId = randomUUID();
      const instance = await workflowEngineRepository.startInstance(requesterUserId, {
        templateId: template.id, companyId, approvalType: 'LEAVE_REQUEST',
        referenceType: 'LEAVE_REQUEST', referenceId, payload: {},
      });
      return { companyId, requesterUserId, approverUserId: firstApprover, instanceId: instance.id, referenceId };
    });

    // Level one approved: the request is not decided yet, so the requester has
    // nothing final to be told.
    await act(f, 'APPROVE');
    await expect(notifications(f, f.requesterUserId)).resolves.toEqual([]);

    // Level two decides it, and only then does the notification appear.
    await runInRequestContext({
      user: {
        id: secondApprover, email: 'second@example.test', companyId: f.companyId,
        companyScope: [f.companyId], roles: ['HR_MANAGER'], permissions: ['leave:approve'],
      },
    }, () => workflowEngineRepository.applyAction(f.instanceId, secondApprover, ['HR_MANAGER'], { action: 'APPROVE' } as never));

    const inbox = await notifications(f, f.requesterUserId);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]).toMatchObject({ action: 'WORKFLOW_APPROVED', referenceId: f.referenceId });
  });
});
