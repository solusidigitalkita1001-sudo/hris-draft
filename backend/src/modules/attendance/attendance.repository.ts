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
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
      orderBy: { date: 'desc' },
    });
  }

  async findById(id: string) {
    return prisma.attendance.findFirst({ where: { id, deletedAt: null }, include: { employee: { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } } } });
  }

  async findByEmployeeAndDate(employeeId: string, date: Date) {
    const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const end = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59);
    return prisma.attendance.findFirst({ where: { employeeId, date: { gte: start, lte: end }, deletedAt: null } });
  }

  async create(data: CreateAttendanceDTO) {
    return prisma.attendance.create({
      data: {
        employeeId: data.employeeId,
        companyId: data.companyId,
        date: new Date(data.date),
        checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
        checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
        status: data.status as any,
        notes: data.notes,
      },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
    });
  }

  async update(id: string, data: UpdateAttendanceDTO) {
    const update: Prisma.AttendanceUpdateInput = {};
    if (data.checkIn !== undefined) update.checkIn = new Date(data.checkIn);
    if (data.checkOut !== undefined) update.checkOut = new Date(data.checkOut);
    if (data.status !== undefined) update.status = data.status as any;
    if (data.notes !== undefined) update.notes = data.notes;
    return prisma.attendance.update({ where: { id }, data: update });
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
    const update: Prisma.OvertimeRequestUpdateInput = { status: status as any };
    if (status === 'APPROVED') {
      update.approvedBy = approvedBy;
      update.approvedAt = new Date();
    }
    return prisma.overtimeRequest.update({ where: { id }, data: update });
  }
}

export const attendanceRepository = new AttendanceRepository();
