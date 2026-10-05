import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';

export class ReportsRepository {
  async dashboardSummary(companyId: string, userId: string, roles: string[]) {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayEnd = new Date(todayStart);
    todayEnd.setHours(23, 59, 59, 999);

    const [totalEmployees, totalDepartments, presentToday, onLeaveToday, pendingApprovals, recentActivity] =
      await Promise.all([
        prisma.employee.count({
          where: {
            companyId,
            deletedAt: null,
          },
        }),
        prisma.department.count({
          where: {
            companyId,
            deletedAt: null,
          },
        }),
        prisma.attendance.count({
          where: {
            companyId,
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
            status: {
              not: 'ABSENT',
            },
            deletedAt: null,
          },
        }),
        prisma.leaveRequest.count({
          where: {
            companyId,
            status: 'APPROVED',
            startDate: { lte: todayEnd },
            endDate: { gte: todayStart },
            deletedAt: null,
          },
        }),
        prisma.workflowInstanceStep.count({
          where: {
            instance: { companyId },
            isCurrent: true,
            status: 'PENDING',
            OR: [
              { approverId: userId },
              { approverRoleCode: { in: roles } },
            ],
          },
        }),
        prisma.auditLog.findMany({
          where: { companyId },
          orderBy: { createdAt: 'desc' },
          take: 8,
          include: {
            user: {
              select: {
                email: true,
              },
            },
          },
        }),
      ]);

    return {
      stats: {
        totalEmployees,
        totalDepartments,
        presentToday,
        onLeaveToday,
      },
      pendingApprovals,
      recentActivity: recentActivity.map((log) => ({
        id: log.id,
        action: log.action,
        entity: log.entity,
        entityId: log.entityId,
        actorEmail: log.user?.email ?? 'System',
        createdAt: log.createdAt,
      })),
    };
  }

  // ─── Headcount Report ──────────────────────────────────
  async headcount(companyId: string, departmentId?: string) {
    const where: Prisma.EmployeeWhereInput = {
      companyId,
      deletedAt: null,
      ...(departmentId ? { departmentId } : {}),
    };

    const byDepartment = await prisma.employee.groupBy({
      by: ['departmentId'],
      where,
      _count: { id: true },
    });

    const byStatus = await prisma.employee.groupBy({
      by: ['employmentStatus'],
      where,
      _count: { id: true },
    });

    const byGender = await prisma.employee.groupBy({
      by: ['gender'],
      where,
      _count: { id: true },
    });

    // Resolve department names
    const deptIds = byDepartment.map((d) => d.departmentId).filter(Boolean) as string[];
    const departments = deptIds.length > 0
      ? await prisma.department.findMany({
          where: { id: { in: deptIds } },
          select: { id: true, name: true },
        })
      : [];
    const deptMap = new Map<string, string>(departments.map((d) => [d.id, d.name]));

    return {
      total: byDepartment.reduce((sum, d) => sum + d._count.id, 0),
      byDepartment: byDepartment.map((d) => ({
        departmentId: d.departmentId,
        departmentName: deptMap.get(d.departmentId ?? '') ?? 'Unknown',
        count: d._count.id,
      })),
      byStatus: byStatus.map((s) => ({ status: s.employmentStatus, count: s._count.id })),
      byGender: byGender.map((g) => ({ gender: g.gender ?? 'Unknown', count: g._count.id })),
    };
  }

  // ─── Attendance Report ─────────────────────────────────
  async attendance(companyId: string, startDate: string, endDate: string) {
    const where: Prisma.AttendanceWhereInput = {
      companyId,
      date: { gte: new Date(startDate), lte: new Date(endDate) },
    };

    const byStatus = await prisma.attendance.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const totalRecords = byStatus.reduce((sum, s) => sum + s._count.id, 0);
    const lateCount = await prisma.attendance.count({
      where: { ...where, lateMinutes: { gt: 0 } },
    });

    return {
      total: totalRecords,
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      lateCount,
      lateRate: totalRecords > 0 ? Math.round((lateCount / totalRecords) * 100) : 0,
    };
  }

  // ─── Leave Report ──────────────────────────────────────
  async leave(companyId: string, startDate: string, endDate: string) {
    const where: Prisma.LeaveRequestWhereInput = {
      companyId,
      status: 'APPROVED',
      startDate: { gte: new Date(startDate) },
      endDate: { lte: new Date(endDate) },
    };

    const byType = await prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where,
      _sum: { totalDays: true },
      _count: { id: true },
    });

    const typeIds = byType.map((t) => t.leaveTypeId);
    const types = typeIds.length > 0
      ? await prisma.leaveType.findMany({
          where: { id: { in: typeIds } },
          select: { id: true, name: true },
        })
      : [];
    const typeMap = new Map<string, string>(types.map((t) => [t.id, t.name]));

    const byDepartment = await prisma.leaveRequest.groupBy({
      by: ['employeeId'],
      where,
      _sum: { totalDays: true },
    });

    return {
      totalRequests: byType.reduce((sum, t) => sum + t._count.id, 0),
      totalDays: byType.reduce((sum, t) => sum + (t._sum.totalDays ?? 0), 0),
      byType: byType.map((t) => ({
        leaveTypeId: t.leaveTypeId,
        leaveTypeName: typeMap.get(t.leaveTypeId) ?? 'Unknown',
        count: t._count.id,
        totalDays: t._sum.totalDays ?? 0,
      })),
      // This counts distinct employees, not departments; it was named after
      // the variable rather than after what it holds.
      employeesWithLeave: byDepartment.length,
    };
  }

  // ─── Payroll Report ────────────────────────────────────
  async payroll(companyId: string, periodId?: string, options?: { byDepartment?: boolean }) {
    const where: Prisma.PayrollRunWhereInput = {
      companyId,
      status: { in: ['COMPLETED', 'APPROVED', 'DISBURSED'] },
      ...(periodId ? { periodId } : {}),
    };

    const runs = await prisma.payrollRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: periodId ? undefined : 12,
      select: {
        id: true,
        name: true,
        totalEmployees: true,
        totalEarnings: true,
        totalDeductions: true,
        totalNetPay: true,
        status: true,
        createdAt: true,
      },
    });

    const summary = runs.length > 0
      ? {
          totalEarnings: runs.reduce((s, r) => s + Number(r.totalEarnings), 0),
          totalDeductions: runs.reduce((s, r) => s + Number(r.totalDeductions), 0),
          totalNetPay: runs.reduce((s, r) => s + Number(r.totalNetPay), 0),
          totalEmployees: Math.max(...runs.map((r) => r.totalEmployees)),
        }
      : { totalEarnings: 0, totalDeductions: 0, totalNetPay: 0, totalEmployees: 0 };

    const byDepartment = options?.byDepartment
      ? await this.payrollByDepartment(companyId, runs.map((run) => run.id))
      : undefined;

    return { summary, runs, ...(byDepartment ? { byDepartment } : {}) };
  }

  /**
   * Runs carry no department dimension — payslips do, in the org context
   * frozen on them at calculation time. Reading the snapshot rather than the
   * employee's current department is deliberate: a transfer in March must not
   * silently move January's cost to the new department.
   */
  private async payrollByDepartment(companyId: string, runIds: string[]) {
    if (!runIds.length) return [];
    const payslips = await prisma.payslip.findMany({
      where: { companyId, payrollRunId: { in: runIds } },
      select: { employeeSnapshot: true, totalEarnings: true, totalDeductions: true, netPay: true },
    });

    const buckets = new Map<string, {
      departmentId: string | null; departmentName: string; employees: number;
      totalEarnings: number; totalDeductions: number; totalNetPay: number;
    }>();
    for (const slip of payslips) {
      const snapshot = (slip.employeeSnapshot ?? {}) as { departmentId?: string | null; departmentName?: string | null };
      const key = snapshot.departmentId ?? 'unassigned';
      const bucket = buckets.get(key) ?? {
        departmentId: snapshot.departmentId ?? null,
        departmentName: snapshot.departmentName ?? 'Tanpa departemen',
        employees: 0, totalEarnings: 0, totalDeductions: 0, totalNetPay: 0,
      };
      bucket.employees += 1;
      bucket.totalEarnings += Number(slip.totalEarnings);
      bucket.totalDeductions += Number(slip.totalDeductions);
      bucket.totalNetPay += Number(slip.netPay);
      buckets.set(key, bucket);
    }
    return [...buckets.values()].sort((a, b) => b.totalNetPay - a.totalNetPay);
  }

  /**
   * Leave balance — the fifth standard report, and the one that was missing.
   * The existing leave report sums days *taken* over a range, which answers a
   * different question: it cannot tell you who is sitting on unused
   * entitlement, which is the figure both HR and the accrual liability need.
   */
  async leaveBalance(companyId: string, year?: number, departmentId?: string) {
    const targetYear = year ?? new Date().getUTCFullYear();
    const balances = await prisma.leaveBalance.findMany({
      where: {
        companyId,
        year: targetYear,
        expiredAt: null,
        employee: { deletedAt: null, status: 'ACTIVE', ...(departmentId ? { departmentId } : {}) },
      },
      select: {
        totalDays: true, usedDays: true, remainingDays: true,
        leaveType: { select: { id: true, name: true, isPaid: true } },
        employee: { select: { id: true, department: { select: { id: true, name: true } } } },
      },
    });

    const byType = new Map<string, { leaveTypeId: string; leaveTypeName: string; employees: number; entitlement: number; used: number; remaining: number }>();
    const byDept = new Map<string, { departmentId: string | null; departmentName: string; employees: Set<string>; remaining: number }>();
    for (const row of balances) {
      const type = byType.get(row.leaveType.id) ?? {
        leaveTypeId: row.leaveType.id, leaveTypeName: row.leaveType.name,
        employees: 0, entitlement: 0, used: 0, remaining: 0,
      };
      type.employees += 1;
      type.entitlement += row.totalDays;
      type.used += row.usedDays;
      type.remaining += row.remainingDays;
      byType.set(row.leaveType.id, type);

      const key = row.employee.department?.id ?? 'unassigned';
      const dept = byDept.get(key) ?? {
        departmentId: row.employee.department?.id ?? null,
        departmentName: row.employee.department?.name ?? 'Tanpa departemen',
        employees: new Set<string>(), remaining: 0,
      };
      dept.employees.add(row.employee.id);
      dept.remaining += row.remainingDays;
      byDept.set(key, dept);
    }

    return {
      year: targetYear,
      totals: {
        employees: new Set(balances.map((row) => row.employee.id)).size,
        entitlement: balances.reduce((sum, row) => sum + row.totalDays, 0),
        used: balances.reduce((sum, row) => sum + row.usedDays, 0),
        // The outstanding liability: days owed and not yet taken.
        remaining: balances.reduce((sum, row) => sum + row.remainingDays, 0),
      },
      byType: [...byType.values()].sort((a, b) => b.remaining - a.remaining),
      byDepartment: [...byDept.values()]
        .map((dept) => ({ ...dept, employees: dept.employees.size }))
        .sort((a, b) => b.remaining - a.remaining),
    };
  }

  // ─── Turnover Report ───────────────────────────────────
  async turnover(companyId: string, startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const [newHires, resignations, activeCount] = await Promise.all([
      prisma.employee.count({
        where: {
          companyId,
          deletedAt: null,
          joinDate: { gte: start, lte: end },
        },
      }),
      prisma.resignation.count({
        where: {
          companyId,
          status: 'COMPLETED',
          createdAt: { gte: start, lte: end },
        },
      }),
      prisma.employee.count({
        where: { companyId, deletedAt: null, employmentStatus: 'ACTIVE' },
      }),
    ]);

    const monthRanges: Array<{ year: number; month: number; monthStart: Date; monthEnd: Date }> = [];
    const current = new Date(start);
    while (current <= end) {
      const monthStart = new Date(current.getFullYear(), current.getMonth(), 1);
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0, 23, 59, 59, 999);
      monthRanges.push({
        year: current.getFullYear(),
        month: current.getMonth() + 1,
        monthStart,
        monthEnd,
      });
      current.setMonth(current.getMonth() + 1);
    }

    const months = await Promise.all(
      monthRanges.map(async ({ year, month, monthStart, monthEnd }) => {
        const [hires, resigns] = await Promise.all([
          prisma.employee.count({
            where: { companyId, deletedAt: null, joinDate: { gte: monthStart, lte: monthEnd } },
          }),
          prisma.resignation.count({
            where: { companyId, status: 'COMPLETED', createdAt: { gte: monthStart, lte: monthEnd } },
          }),
        ]);

        return { year, month, hires, resigns };
      })
    );

    return {
      totalActive: activeCount,
      newHires,
      resignations,
      turnoverRate: activeCount > 0 ? Math.round((resignations / activeCount) * 100) : 0,
      monthly: months,
    };
  }

  // ─── Recruitment Report ────────────────────────────────
  async recruitment(companyId: string, startDate: string, endDate: string) {
    const where: Prisma.JobApplicationWhereInput = {
      companyId,
      appliedAt: { gte: new Date(startDate), lte: new Date(endDate) },
    };

    const byStage = await prisma.jobApplication.groupBy({
      by: ['status'],
      where,
      _count: { id: true },
    });

    const totalPostings = await prisma.jobPosting.count({
      where: { companyId, status: { in: ['PUBLISHED', 'ON_HOLD'] } },
    });

    const totalCandidates = await prisma.candidate.count({
      where: { companyId, status: 'ACTIVE' },
    });

    return {
      totalApplications: byStage.reduce((sum, s) => sum + s._count.id, 0),
      totalPostings,
      totalCandidates,
      byStage: byStage.map((s) => ({ stage: s.status, count: s._count.id })),
    };
  }
}

export const reportsRepository = new ReportsRepository();
