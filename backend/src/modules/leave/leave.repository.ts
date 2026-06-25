import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { CreateLeaveTypeDTO, CreateLeaveRequestDTO, CreateLeaveBalanceDTO } from './leave.dto';

export class LeaveRepository {
  // Leave Types
  async findAllLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({ where: { companyId, deletedAt: null }, orderBy: { sortOrder: 'asc' } });
  }

  async createLeaveType(data: CreateLeaveTypeDTO) {
    return prisma.leaveType.create({ data });
  }

  // Leave Requests
  async findAllLeaveRequests(companyId: string, filters?: { employeeId?: string; status?: string; leaveTypeId?: string }) {
    const where: Prisma.LeaveRequestWhereInput = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status as any;
    if (filters?.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;
    return prisma.leaveRequest.findMany({
      where,
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        leaveType: { select: { id: true, name: true, code: true, isPaid: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findLeaveRequestById(id: string) {
    return prisma.leaveRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, department: { select: { name: true } } } },
        leaveType: true,
      },
    });
  }

  async createLeaveRequest(data: CreateLeaveRequestDTO) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);
    const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24)) + 1);

    return prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        companyId: data.companyId,
        leaveTypeId: data.leaveTypeId,
        startDate: start,
        endDate: end,
        totalDays,
        reason: data.reason,
        attachment: data.attachment,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        leaveType: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async updateLeaveStatus(id: string, status: string, approvedBy?: string, rejectionReason?: string) {
    const update: Prisma.LeaveRequestUpdateInput = { status: status as any };
    if (status === 'APPROVED') { update.approvedBy = approvedBy; update.approvedAt = new Date(); }
    if (status === 'REJECTED' && rejectionReason) update.rejectionReason = rejectionReason;
    return prisma.leaveRequest.update({ where: { id }, data: update });
  }

  // Leave Balances
  async findLeaveBalances(employeeId: string) {
    return prisma.leaveBalance.findMany({
      where: { employeeId },
      include: { leaveType: { select: { id: true, name: true, code: true, isPaid: true } } },
    });
  }

  async upsertLeaveBalance(data: CreateLeaveBalanceDTO) {
    return prisma.leaveBalance.upsert({
      where: { employeeId_leaveTypeId_year: { employeeId: data.employeeId, leaveTypeId: data.leaveTypeId, year: data.year } },
      update: { totalDays: data.totalDays },
      create: { ...data, remainingDays: data.totalDays },
    });
  }
}

export const leaveRepository = new LeaveRepository();
