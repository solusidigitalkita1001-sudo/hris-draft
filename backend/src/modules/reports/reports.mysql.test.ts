import { randomUUID } from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { runInRequestContext, runInSystemContext } from '@/shared/context/RequestContext';
import { reportsRepository } from './reports.repository';

/**
 * Reports, against a real MySQL.
 *
 * The module had no tests at all. Its queries are cross-table aggregates, and a
 * wrong one is silent: a number simply appears on a management screen. Two risks
 * matter most and neither can be reproduced with a mocked client — whether an
 * aggregate counts another tenant's rows, and whether the arithmetic matches the
 * rows that exist.
 */
const describeWithMysql = process.env.RUN_DB_INTEGRATION === '1' ? describe : describe.skip;

const YEAR = 2033; // far from seeded data
const RANGE = { start: `${YEAR}-01-01`, end: `${YEAR}-12-31` };
const companies: string[] = [];
const groups: string[] = [];

interface Tenant {
  companyId: string;
  departmentId: string;
  employees: string[];
  leaveTypeId: string;
}

/**
 * Two employees in one department, one of them female, both joined inside the
 * range; two attendance rows (one late); one approved leave of three days and
 * one pending leave that must not be counted.
 */
async function tenant(prefix: string): Promise<Tenant> {
  const companyId = randomUUID(), groupId = randomUUID();
  companies.push(companyId); groups.push(groupId);

  return runInSystemContext('reports-fixture', async () => {
    await prisma.companyGroup.create({ data: { id: groupId, code: groupId, name: `Reports ${prefix}` } });
    await prisma.company.create({ data: { id: companyId, groupId, code: companyId, name: `Reports ${prefix}` } });
    const department = await prisma.department.create({
      data: { companyId, code: randomUUID().slice(0, 8), name: `${prefix} Dept` },
    });
    const leaveType = await prisma.leaveType.create({
      data: { companyId, code: randomUUID().slice(0, 8), name: `${prefix} Annual`, isAnnual: true, maxDays: 12 },
    });

    const employees: string[] = [];
    for (const [index, gender] of ['MALE', 'FEMALE'].entries()) {
      const employee = await prisma.employee.create({
        data: {
          companyId, departmentId: department.id, employeeNumber: randomUUID(),
          firstName: prefix, lastName: `Person ${index}`, fullName: `${prefix} Person ${index}`,
          gender: gender as 'MALE' | 'FEMALE', employmentStatus: 'ACTIVE',
          joinDate: new Date(Date.UTC(YEAR, 2, 10 + index)),
        },
      });
      employees.push(employee.id);
    }

    await prisma.attendance.createMany({
      data: [
        { companyId, employeeId: employees[0], date: new Date(Date.UTC(YEAR, 3, 6)), status: 'PRESENT', lateMinutes: 0 },
        { companyId, employeeId: employees[1], date: new Date(Date.UTC(YEAR, 3, 6)), status: 'LATE', lateMinutes: 15 },
      ],
    });

    const leaveBase = { companyId, employeeId: employees[0], leaveTypeId: leaveType.id, reason: 'Reports fixture' };
    await prisma.leaveRequest.createMany({
      data: [
        { ...leaveBase, startDate: new Date(Date.UTC(YEAR, 4, 4)), endDate: new Date(Date.UTC(YEAR, 4, 6)), totalDays: 3, status: 'APPROVED' },
        // Pending must never reach a report: it has not happened yet.
        { ...leaveBase, startDate: new Date(Date.UTC(YEAR, 5, 1)), endDate: new Date(Date.UTC(YEAR, 5, 2)), totalDays: 2, status: 'PENDING' },
      ],
    });

    return { companyId, departmentId: department.id, employees, leaveTypeId: leaveType.id };
  });
}

function asHr<T>(companyId: string, operation: () => Promise<T>): Promise<T> {
  return runInRequestContext({
    user: {
      id: randomUUID(), email: 'reports@example.test', companyId, companyScope: [companyId],
      roles: ['HR_MANAGER'], permissions: ['report:read'],
    },
  }, operation);
}

describeWithMysql('reports (isolated real MySQL)', () => {
  let own: Tenant;
  let other: Tenant;

  beforeAll(async () => {
    own = await tenant('Own');
    other = await tenant('Other');
  });

  afterAll(async () => {
    await runInSystemContext('reports-cleanup', async () => {
      const companyId = { in: companies };
      await prisma.leaveRequest.deleteMany({ where: { companyId } });
      await prisma.leaveType.deleteMany({ where: { companyId } });
      await prisma.attendance.deleteMany({ where: { companyId } });
      await prisma.employee.deleteMany({ where: { companyId } });
      await prisma.department.deleteMany({ where: { companyId } });
      await prisma.company.deleteMany({ where: { id: companyId } });
      await prisma.companyGroup.deleteMany({ where: { id: { in: groups } } });
    });
    await prisma.$disconnect();
  });

  it('counts headcount for the active company only, grouped as the screen shows it', async () => {
    const report = await asHr(own.companyId, () => reportsRepository.headcount(own.companyId));

    expect(report.total).toBe(2);
    expect(report.byDepartment).toEqual([
      { departmentId: own.departmentId, departmentName: 'Own Dept', count: 2 },
    ]);
    expect(report.byStatus).toEqual([{ status: 'ACTIVE', count: 2 }]);
    expect(report.byGender.map((row) => row.gender).sort()).toEqual(['FEMALE', 'MALE']);
    // The other tenant has an identically shaped department; it must not appear.
    expect(JSON.stringify(report)).not.toContain('Other Dept');
  });

  it('filters headcount by department without crossing into another tenant', async () => {
    const report = await asHr(own.companyId, () => reportsRepository.headcount(own.companyId, own.departmentId));
    expect(report.total).toBe(2);

    // Asking for the other tenant's department id must yield nothing, not its rows.
    const foreign = await asHr(own.companyId, () => reportsRepository.headcount(own.companyId, other.departmentId));
    expect(foreign.total).toBe(0);
  });

  it('reports attendance counts and derives the late rate from them', async () => {
    const report = await asHr(own.companyId, () =>
      reportsRepository.attendance(own.companyId, `${YEAR}-04-01`, `${YEAR}-04-30`));

    expect(report.total).toBe(2);
    expect(report.lateCount).toBe(1);
    expect(report.lateRate).toBe(50);
    expect(report.byStatus.map((row) => row.status).sort()).toEqual(['LATE', 'PRESENT']);
  });

  it('excludes dates outside the requested window', async () => {
    const report = await asHr(own.companyId, () =>
      reportsRepository.attendance(own.companyId, `${YEAR}-05-01`, `${YEAR}-05-31`));

    expect(report).toMatchObject({ total: 0, lateCount: 0, lateRate: 0 });
  });

  it('counts approved leave only, and sums the days it actually approved', async () => {
    const report = await asHr(own.companyId, () =>
      reportsRepository.leave(own.companyId, RANGE.start, RANGE.end));

    // The pending two-day request is deliberately absent.
    expect(report.totalRequests).toBe(1);
    expect(report.totalDays).toBe(3);
    expect(report.byType).toEqual([
      { leaveTypeId: own.leaveTypeId, leaveTypeName: 'Own Annual', count: 1, totalDays: 3 },
    ]);
    expect(report.byDepartmentCount).toBe(1);
  });

  it('counts new hires within the range, reports active headcount and a turnover rate', async () => {
    const report = await asHr(own.companyId, () =>
      reportsRepository.turnover(own.companyId, RANGE.start, RANGE.end));

    expect(report).toMatchObject({ newHires: 2, resignations: 0, totalActive: 2, turnoverRate: 0 });
    // One entry per month in the range, with the hires landing in March.
    expect(report.monthly).toHaveLength(12);
    expect(report.monthly.find((month) => month.month === 3)).toMatchObject({ hires: 2, resigns: 0 });
    expect(report.monthly.filter((month) => month.hires > 0)).toHaveLength(1);
  });

  it('gives each tenant its own numbers from the same query', async () => {
    const [ownReport, otherReport] = await Promise.all([
      asHr(own.companyId, () => reportsRepository.headcount(own.companyId)),
      asHr(other.companyId, () => reportsRepository.headcount(other.companyId)),
    ]);

    expect(ownReport.byDepartment[0].departmentName).toBe('Own Dept');
    expect(otherReport.byDepartment[0].departmentName).toBe('Other Dept');
  });
});
