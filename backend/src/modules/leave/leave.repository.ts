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

  /** Ambil data yang diperlukan untuk kalkulasi akrual pro-rate + carry-over. */
  async findAccrualInputs(employeeId: string, leaveTypeId: string, year: number) {
    const [employee, leaveType, previousBalance] = await Promise.all([
      prisma.employee.findUnique({
        where: { id: employeeId },
        select: { id: true, companyId: true, joinDate: true },
      }),
      prisma.leaveType.findUnique({
        where: { id: leaveTypeId },
        select: { id: true, companyId: true, isAnnual: true, maxDays: true },
      }),
      prisma.leaveBalance.findUnique({
        where: { employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year: year - 1 } },
        select: { remainingDays: true },
      }),
    ]);
    return { employee, leaveType, previousBalance };
  }

  /**
   * Upsert balance hasil akrual. Saat update, sisa (remainingDays) dihitung ulang
   * = totalDays - usedDays yang sudah terpakai (tidak menimpa cuti yang sudah diambil).
   */
  async upsertAccruedBalance(data: {
    employeeId: string;
    companyId: string;
    leaveTypeId: string;
    year: number;
    totalDays: number;
  }) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: {
            employeeId: data.employeeId,
            leaveTypeId: data.leaveTypeId,
            year: data.year,
          },
        },
        select: { id: true, usedDays: true },
      });

      if (existing) {
        return tx.leaveBalance.update({
          where: { id: existing.id },
          data: {
            totalDays: data.totalDays,
            remainingDays: Math.max(0, data.totalDays - existing.usedDays),
          },
        });
      }

      return tx.leaveBalance.create({
        data: {
          employeeId: data.employeeId,
          companyId: data.companyId,
          leaveTypeId: data.leaveTypeId,
          year: data.year,
          totalDays: data.totalDays,
          usedDays: 0,
          remainingDays: data.totalDays,
        },
      });
    });
  }
}

export const leaveRepository = new LeaveRepository();
