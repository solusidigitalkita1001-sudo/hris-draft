import prisma from '@/shared/database/prisma';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { attendanceCorrectionRepository } from './attendance-correction.repository';
import { CreateAttendanceCorrectionDTO } from './attendance-correction.dto';

class AttendanceCorrectionService {
  findAll(companyId: string, filters?: { employeeId?: string; status?: string }) {
    return attendanceCorrectionRepository.findAll(companyId, filters);
  }

  async findById(id: string) {
    const correction = await attendanceCorrectionRepository.findById(id);
    if (!correction) throw new NotFoundError('Attendance correction not found');
    return correction;
  }

  async create(data: CreateAttendanceCorrectionDTO) {
    if (!data.requestedCheckIn && !data.requestedCheckOut) {
      throw new BadRequestError('Minimal satu dari requestedCheckIn atau requestedCheckOut harus diisi');
    }
    const correction = await attendanceCorrectionRepository.create(data);
    logger.info('Attendance correction created', { id: correction.id, employeeId: data.employeeId });
    return correction;
  }

  async approve(id: string, approverUserId: string, approverEmployeeId?: string | null) {
    const correction = await this.findById(id);
    if (approverEmployeeId && approverEmployeeId === correction.employeeId) {
      throw new ForbiddenError('Cannot approve your own attendance correction');
    }
    if (correction.status !== 'PENDING') {
      throw new BadRequestError('Koreksi absensi sudah diproses');
    }

    await prisma.$transaction(async (tx) => {
      // Apply the correction to the attendance record
      if (correction.attendanceId) {
        await tx.attendance.update({
          where: { id: correction.attendanceId },
          data: {
            ...(correction.requestedCheckIn && { checkIn: correction.requestedCheckIn }),
            ...(correction.requestedCheckOut && { checkOut: correction.requestedCheckOut }),
            status: 'PRESENT',
          },
        });
      } else {
        // No existing record — create one for the requested date
        await tx.attendance.upsert({
          where: { employeeId_date: { employeeId: correction.employeeId, date: correction.date } },
          create: {
            employeeId: correction.employeeId,
            companyId: correction.companyId,
            date: correction.date,
            checkIn: correction.requestedCheckIn ?? undefined,
            checkOut: correction.requestedCheckOut ?? undefined,
            status: 'PRESENT',
            method: 'MANUAL',
          },
          update: {
            ...(correction.requestedCheckIn && { checkIn: correction.requestedCheckIn }),
            ...(correction.requestedCheckOut && { checkOut: correction.requestedCheckOut }),
            status: 'PRESENT',
          },
        });
      }

      await tx.attendanceCorrection.update({
        where: { id },
        data: { status: 'APPROVED', approvedBy: approverUserId, approvedAt: new Date() },
      });
    });

    logger.info('Attendance correction approved', { id, approvedBy: approverUserId });
    return this.findById(id);
  }

  async reject(id: string, approverEmployeeId?: string | null, rejectionReason?: string) {
    const correction = await this.findById(id);
    if (approverEmployeeId && approverEmployeeId === correction.employeeId) {
      throw new ForbiddenError('Cannot reject your own attendance correction');
    }
    if (correction.status !== 'PENDING') {
      throw new BadRequestError('Koreksi absensi sudah diproses');
    }
    await attendanceCorrectionRepository.updateStatus(id, 'REJECTED', { rejectionReason });
    logger.info('Attendance correction rejected', { id });
    return this.findById(id);
  }
}

export const attendanceCorrectionService = new AttendanceCorrectionService();
