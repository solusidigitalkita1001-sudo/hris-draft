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
      byDepartmentCount: byDepartment.length,
    };
  }

  // ─── Payroll Report ────────────────────────────────────
  async payroll(companyId: string, periodId?: string) {
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

    return { summary, runs };
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
