import prisma from '@/shared/database/prisma';
import { CreateAttendanceCorrectionDTO } from './attendance-correction.dto';

class AttendanceCorrectionRepository {
  findAll(companyId: string, filters?: { employeeId?: string; status?: string }) {
    const where: Record<string, unknown> = { companyId, deletedAt: null };
    if (filters?.employeeId) where.employeeId = filters.employeeId;
    if (filters?.status) where.status = filters.status;
    return prisma.attendanceCorrection.findMany({
      where,
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string) {
    return prisma.attendanceCorrection.findFirst({
      where: { id, deletedAt: null },
      include: { employee: { select: { id: true, fullName: true, employeeNumber: true } } },
    });
  }

  create(data: CreateAttendanceCorrectionDTO) {
    return prisma.attendanceCorrection.create({
      data: {
        employeeId: data.employeeId,
        companyId: data.companyId,
        attendanceId: data.attendanceId,
        date: new Date(data.date),
        requestedCheckIn: data.requestedCheckIn ? new Date(data.requestedCheckIn) : null,
        requestedCheckOut: data.requestedCheckOut ? new Date(data.requestedCheckOut) : null,
        reason: data.reason,
      },
    });
  }

  updateStatus(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    opts?: { approvedBy?: string; rejectionReason?: string }
  ) {
    return prisma.attendanceCorrection.update({
      where: { id },
      data: {
        status,
        ...(status === 'APPROVED' && { approvedBy: opts?.approvedBy, approvedAt: new Date() }),
        ...(status === 'REJECTED' && opts?.rejectionReason && { rejectionReason: opts.rejectionReason }),
      },
    });
  }
}

export const attendanceCorrectionRepository = new AttendanceCorrectionRepository();
