import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateAttendanceDTO, UpdateAttendanceDTO, CreateOvertimeDTO } from './attendance.dto';

export class AttendanceRepository {
  async findAll(companyId: string, filters?: { employeeId?: string; date?: string; month?: string; status?: string }) {
    const where: Prisma.AttendanceWhereInput = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status as any;
    if (filters?.date) {
      const d = new Date(filters.date);
      where.date = { gte: new Date(d.getFullYear(), d.getMonth(), d.getDate()), lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59) };
    }

    return prisma.attendance.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.attendance.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            department: { select: { name: true } },
          },
        },
        branch: { select: { id: true, name: true, code: true } },
        attendancePolicy: { select: { id: true, attendanceMethod: true } },
      },
    });
  }

  async findByEmployeeAndDate(employeeId: string, date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return prisma.attendance.findFirst({ where: { employeeId, date: { gte: start, lte: end }, deletedAt: null } });
  }

  async create(data: Prisma.AttendanceUncheckedCreateInput) {
    return prisma.attendance.create({
      data,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
        attendancePolicy: { select: { id: true, attendanceMethod: true } },
      },
    });
  }

  async update(id: string, data: UpdateAttendanceDTO) {
    const updateData: Prisma.AttendanceUpdateInput = {};
    if (data.checkIn !== undefined) updateData.checkIn = new Date(data.checkIn);
    if (data.checkOut !== undefined) updateData.checkOut = new Date(data.checkOut);
    if (data.method !== undefined) updateData.method = data.method as any;
    if (data.checkOutLatitude !== undefined) updateData.checkOutLatitude = data.checkOutLatitude;
    if (data.checkOutLongitude !== undefined) updateData.checkOutLongitude = data.checkOutLongitude;
    if (data.workDuration !== undefined) updateData.workDuration = data.workDuration;
    if (data.earlyLeaveMinutes !== undefined) updateData.earlyLeaveMinutes = data.earlyLeaveMinutes;
    if (data.distanceMeters !== undefined) updateData.distanceMeters = data.distanceMeters;
    if (data.isWithinRadius !== undefined) updateData.isWithinRadius = data.isWithinRadius;
    if (data.isException !== undefined) updateData.isException = data.isException;
    if (data.exceptionType !== undefined) updateData.exceptionType = data.exceptionType as any;
    if (data.exceptionReason !== undefined) updateData.exceptionReason = data.exceptionReason;
    if (data.requiresReview !== undefined) updateData.requiresReview = data.requiresReview;
    if (data.policySnapshot !== undefined) updateData.policySnapshot = data.policySnapshot as Prisma.InputJsonValue;
    if (data.status !== undefined) updateData.status = data.status as any;
    if (data.notes !== undefined) updateData.notes = data.notes;
    return prisma.attendance.update({
      where: { id },
      data: updateData,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
        attendancePolicy: { select: { id: true, attendanceMethod: true } },
      },
    });
  }

  async delete(id: string) {
    return prisma.attendance.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // Overtime
  async findAllOvertime(companyId: string, filters?: { employeeId?: string; status?: string }) {
    const where: Prisma.OvertimeRequestWhereInput = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status as any;
    return prisma.overtimeRequest.findMany({
      where,
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async createOvertime(data: CreateOvertimeDTO) {
    return prisma.overtimeRequest.create({
      data: {
        employeeId: data.employeeId,
        companyId: data.companyId,
        date: new Date(data.date),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        durationHours: data.durationHours,
        reason: data.reason,
        multiplier: data.multiplier,
      },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
    });
  }

  async updateOvertimeStatus(id: string, status: string, approvedBy?: string) {
    const updateData: Prisma.OvertimeRequestUpdateInput = { status: status as any };
    if (status === 'APPROVED') {
      updateData.approvedBy = approvedBy;
      updateData.approvedAt = new Date();
    }
    return prisma.overtimeRequest.update({ where: { id }, data: updateData });
  }

  /**
   * Get attendance summary counts grouped by status for a given company, month, and year.
   * Returns only aggregate counts, not the individual records.
   */
  async getSummary(companyId: string, month: number, year: number, departmentId?: string) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59);

    const where: Prisma.AttendanceWhereInput = {
      companyId,
      deletedAt: null,
      date: { gte: start, lte: end },
    };
    if (departmentId) {
      where.employee = { departmentId };
    }

    const [groupedRecords, totalEmployees] = await Promise.all([
      prisma.attendance.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      departmentId
        ? prisma.employee.count({ where: { companyId, departmentId, deletedAt: null } })
        : prisma.employee.count({ where: { companyId, deletedAt: null } }),
    ]);

    const countsByStatus = groupedRecords.reduce<Record<string, number>>((acc, record) => {
      acc[record.status] = record._count._all;
      return acc;
    }, {});

    const total = groupedRecords.reduce((sum, record) => sum + record._count._all, 0);
    const present = countsByStatus.PRESENT ?? 0;
    const late = countsByStatus.LATE ?? 0;
    const absent = countsByStatus.ABSENT ?? 0;
    const excused = countsByStatus.EXCUSED ?? 0;

    return {
      total,
      present,
      late,
      absent,
      excused,
      totalEmployees,
      month,
      year,
    };
  }

  /**
   * Get attendance report data enriched with employee info, ready for CSV export.
   * Returns structured rows that can be easily converted to CSV format.
   */
  async getReport(
    companyId: string,
    filters?: { startDate?: string; endDate?: string; departmentId?: string; employeeId?: string },
  ) {
    const where: Prisma.AttendanceWhereInput = { companyId, deletedAt: null };
    if (filters?.startDate || filters?.endDate) {
      where.date = {};
      if (filters?.startDate) where.date.gte = new Date(filters.startDate);
      if (filters?.endDate) where.date.lte = new Date(filters.endDate);
    }
    if (filters?.departmentId) {
      where.employee = { departmentId: filters.departmentId };
    }
    if (filters?.employeeId) {
      where.employeeId = filters.employeeId;
    }

    const records = await prisma.attendance.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            department: { select: { name: true } },
            position: { select: { name: true } },
          },
        },
      },
      orderBy: [{ date: 'desc' }, { employee: { fullName: 'asc' } }],
    });

    // Map records into flat CSV-friendly rows
    const rows = records.map((r) => ({
      employeeId: r.employee.employeeNumber,
      employeeName: r.employee.fullName,
      department: r.employee.department?.name ?? '',
      position: r.employee.position?.name ?? '',
      date: r.date.toISOString().slice(0, 10),
      checkIn: r.checkIn ? r.checkIn.toISOString() : '',
      checkOut: r.checkOut ? r.checkOut.toISOString() : '',
      status: r.status,
      notes: r.notes ?? '',
    }));

    // Build CSV string with header
    const header = 'Employee ID,Employee Name,Department,Position,Date,Check In,Check Out,Status,Notes';
    const csvLines = rows.map((row) =>
      [
        row.employeeId,
        `"${row.employeeName.replace(/"/g, '""')}"`,
        `"${row.department.replace(/"/g, '""')}"`,
        `"${row.position.replace(/"/g, '""')}"`,
        row.date,
        row.checkIn,
        row.checkOut,
        row.status,
        `"${row.notes.replace(/"/g, '""')}"`,
      ].join(','),
    );

    return {
      rows,
      csv: [header, ...csvLines].join('\n'),
      total: rows.length,
    };
  }
}

export const attendanceRepository = new AttendanceRepository();
