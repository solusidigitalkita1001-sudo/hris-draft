import { randomUUID } from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { runInRequestContext, runInSystemContext } from '@/shared/context/RequestContext';
import { leaveService } from './leave.service';

/**
 * Leave, end to end, against a real MySQL.
 *
 * The nine existing real-database suites all cover payroll or EWA; the leave
 * journey — submit, approve, deduct, cancel — had only ever run against a
 * mocked Prisma client. The parts that matter here cannot be mocked
 * convincingly: `SELECT … FOR UPDATE` on the balance row, the deduction landing
 * exactly once under two concurrent approvals, and the payroll-period lock.
 *
 * Gated on RUN_DB_INTEGRATION like the advisory-lock suite, so it uses the
 * application's own Prisma client and therefore the real tenant middleware.
 */
const describeWithMysql = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

const YEAR = 2031; // far from seeded data, so fixtures cannot collide
const companies: string[] = [];
const groups: string[] = [];
const templates: string[] = [];

interface Fixture {
  companyId: string;
  employeeId: string;
  leaveTypeId: string;
  balanceId: string;
  userId: string;
}

async function fixture(options: { totalDays?: number; withBalance?: boolean } = {}): Promise<Fixture> {
  const totalDays = options.totalDays ?? 12;
  const companyId = randomUUID(), groupId = randomUUID(), userId = randomUUID();
  companies.push(companyId); groups.push(groupId);

  return runInSystemContext('leave-journey-fixture', async () => {
    await prisma.companyGroup.create({ data: { id: groupId, code: groupId, name: 'Leave journey tests' } });
    await prisma.company.create({ data: { id: companyId, groupId, code: companyId, name: 'Synthetic only' } });
    const employee = await prisma.employee.create({
      data: {
        companyId, employeeNumber: randomUUID(), firstName: 'Journey', lastName: 'Employee',
        fullName: 'Journey Employee', joinDate: new Date(Date.UTC(YEAR - 3, 0, 1)),
      },
    });
    const leaveType = await prisma.leaveType.create({
      data: { companyId, code: randomUUID().slice(0, 8), name: 'Annual journey', isAnnual: true, maxDays: 20 },
    });
    // Submission always opens a workflow instance and rolls the request back if
    // it cannot start, so the company needs a template with a resolvable
    // approver. A USER stage pointed at the HR actor is the smallest one that
    // satisfies the engine's "no stage without an approver" rule.
    const template = await prisma.workflowTemplate.create({
      data: {
        companyId, name: 'Leave journey template', approvalType: 'LEAVE_REQUEST', resource: 'leave', isActive: true,
        stages: { create: { name: 'HR', level: 1, approverType: 'USER', approverId: userId } },
      },
    });
    templates.push(template.id);
    let balanceId = '';
    if (options.withBalance !== false) {
      const balance = await prisma.leaveBalance.create({
        data: { companyId, employeeId: employee.id, leaveTypeId: leaveType.id, year: YEAR, totalDays, usedDays: 0, remainingDays: totalDays },
      });
      balanceId = balance.id;
    }
    return { companyId, employeeId: employee.id, leaveTypeId: leaveType.id, balanceId, userId };
  });
}

/** HR actor: may submit for others and approve, so one context covers the journey. */
function asHr<T>(f: Fixture, operation: () => Promise<T>): Promise<T> {
  return runInRequestContext({
    user: {
      id: f.userId, email: 'hr@example.test', companyId: f.companyId, companyScope: [f.companyId],
      roles: ['HR_MANAGER'], permissions: ['leave:create', 'leave:read', 'leave:approve', 'leave:update'],
    },
  }, operation);
}

const submit = (f: Fixture, startDate: string, endDate: string) => asHr(f, () => leaveService.createLeaveRequest({
  companyId: f.companyId, employeeId: f.employeeId, leaveTypeId: f.leaveTypeId,
  startDate, endDate, reason: 'Synthetic journey', totalDays: 1,
} as never));

/**
 * Every system-context call awaits inside the callback on purpose. A Prisma
 * promise is lazy: returning it from a non-async arrow hands an unexecuted
 * thenable back to the caller, which then runs the query *after*
 * runInSystemContext has left its AsyncLocalStorage scope — and the tenant
 * middleware rejects it for having no company context.
 */
const balance = (f: Fixture) => runInSystemContext('leave-journey-read', async () =>
  prisma.leaveBalance.findUniqueOrThrow({ where: { id: f.balanceId }, select: { usedDays: true, remainingDays: true } }));

describeWithMysql('leave journey (isolated real MySQL)', () => {
  afterAll(async () => {
    await runInSystemContext('leave-journey-cleanup', async () => {
      const companyId = { in: companies };
      await prisma.workflowInstanceLog.deleteMany({ where: { instance: { companyId } } });
      await prisma.workflowInstanceStep.deleteMany({ where: { instance: { companyId } } });
      await prisma.workflowInstance.deleteMany({ where: { companyId } });
      await prisma.workflowStage.deleteMany({ where: { templateId: { in: templates } } });
      await prisma.workflowTemplate.deleteMany({ where: { companyId } });
      await prisma.leaveRequest.deleteMany({ where: { companyId } });
      await prisma.leaveBalance.deleteMany({ where: { companyId } });
      await prisma.nationalHoliday.deleteMany({ where: { companyId } });
      await prisma.leaveType.deleteMany({ where: { companyId } });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.companyGroup.deleteMany({ where: { id: { in: groups } } });
    });
    await prisma.$disconnect();
  });

  it('counts working days only, skipping the weekend and a national holiday', async () => {
    const f = await fixture();
    // Monday 2031-01-06 .. Friday 2031-01-10, with Wednesday a holiday.
    await runInSystemContext('leave-journey-holiday', async () => prisma.nationalHoliday.create({
      data: {
        companyId: f.companyId, name: 'Synthetic holiday', date: new Date(Date.UTC(YEAR, 0, 8)),
        type: 'NH', year: YEAR,
      },
    }));

    const request = await submit(f, `${YEAR}-01-06`, `${YEAR}-01-12`); // includes Sat+Sun

    // Mon, Tue, Thu, Fri — Wednesday is the holiday, the weekend is not counted.
    expect(request?.totalDays).toBe(4);
    expect(request?.status).toBe('PENDING');
  });

  it('refuses a request with no balance row at submission, not at the approver desk', async () => {
    const f = await fixture({ withBalance: false });

    await expect(submit(f, `${YEAR}-02-03`, `${YEAR}-02-04`)).rejects.toMatchObject({ statusCode: 400 });

    const left = await runInSystemContext('leave-journey-count', async () =>
      prisma.leaveRequest.count({ where: { companyId: f.companyId } }));
    expect(left).toBe(0);
  });

  it('refuses a request longer than the remaining balance', async () => {
    const f = await fixture({ totalDays: 1 });

    await expect(submit(f, `${YEAR}-03-03`, `${YEAR}-03-06`)).rejects.toMatchObject({ statusCode: 400 });
  });

  it('deducts the balance exactly once when two approvals race', async () => {
    const f = await fixture({ totalDays: 10 });
    const request = await submit(f, `${YEAR}-04-07`, `${YEAR}-04-09`); // Mon..Wed = 3 days

    const results = await Promise.allSettled([
      asHr(f, () => leaveService.finalizeApprovalEffects(request!.id)),
      asHr(f, () => leaveService.finalizeApprovalEffects(request!.id)),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(2);

    // Both calls succeed — the second is idempotent — but the row is locked, so
    // the deduction lands once. A double deduction here would silently cost the
    // employee three days of leave.
    await expect(balance(f)).resolves.toEqual({ usedDays: 3, remainingDays: 7 });
    const stored = await runInSystemContext('leave-journey-read', async () =>
      prisma.leaveRequest.findUniqueOrThrow({ where: { id: request!.id }, select: { status: true } }));
    expect(stored.status).toBe('APPROVED');
  });

  it('returns the days to the balance when an approved request is cancelled', async () => {
    const f = await fixture({ totalDays: 10 });
    const request = await submit(f, `${YEAR}-05-05`, `${YEAR}-05-07`); // Mon..Wed = 3 days
    await asHr(f, () => leaveService.finalizeApprovalEffects(request!.id));
    await expect(balance(f)).resolves.toEqual({ usedDays: 3, remainingDays: 7 });

    await asHr(f, () => leaveService.cancelLeave(request!.id, f.userId, null));

    await expect(balance(f)).resolves.toEqual({ usedDays: 0, remainingDays: 10 });
  });

  it('refuses to approve leave that falls inside a closed payroll period', async () => {
    const f = await fixture({ totalDays: 10 });
    const request = await submit(f, `${YEAR}-06-02`, `${YEAR}-06-04`);
    await runInSystemContext('leave-journey-period', async () => prisma.payrollPeriod.create({
      data: {
        companyId: f.companyId, code: randomUUID(), name: 'Closed June', status: 'CLOSED',
        startDate: new Date(Date.UTC(YEAR, 5, 1)), endDate: new Date(Date.UTC(YEAR, 5, 30)),
        payDate: new Date(Date.UTC(YEAR, 5, 30)),
      },
    }));

    // Approving now would change LEAVE_DAYS after payroll already consumed them.
    await expect(asHr(f, () => leaveService.finalizeApprovalEffects(request!.id)))
      .rejects.toMatchObject({ statusCode: 409 });
    await expect(balance(f)).resolves.toEqual({ usedDays: 0, remainingDays: 10 });

    await runInSystemContext('leave-journey-period-cleanup', async () =>
      prisma.payrollPeriod.deleteMany({ where: { companyId: f.companyId } }));
  });
});
