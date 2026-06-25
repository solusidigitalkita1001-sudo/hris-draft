import { attendanceRepository } from './attendance.repository';
import { CreateAttendanceDTO, UpdateAttendanceDTO, CreateOvertimeDTO } from './attendance.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';

export class AttendanceService {
  async findAll(companyId: string, filters?: any) {
    return attendanceRepository.findAll(companyId, filters);
  }

  async findById(id: string) {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError('Attendance record not found');
    return record;
  }

  async create(data: CreateAttendanceDTO) {
    // Check for duplicate attendance on same date
    const existing = await attendanceRepository.findByEmployeeAndDate(data.employeeId, new Date(data.date));
    if (existing) throw new BadRequestError('Attendance record already exists for this date');

    // Auto-calculate late minutes if checkIn provided
    if (data.checkIn) {
      const checkIn = new Date(data.checkIn);
      const nineAM = new Date(checkIn);
      nineAM.setHours(9, 0, 0, 0);
      if (checkIn > nineAM) {
        const lateMin = Math.round((checkIn.getTime() - nineAM.getTime()) / 60000);
        const record = await attendanceRepository.create(data);
        await attendanceRepository.update(record.id, { ...data, status: 'LATE' as any });
        return attendanceRepository.findById(record.id);
      }
    }

    const record = await attendanceRepository.create(data);
    logger.info('Attendance recorded', { employeeId: data.employeeId });
    return record;
  }

  async checkOut(id: string, checkOutTime: string) {
    await this.findById(id);
    return attendanceRepository.update(id, { checkOut: checkOutTime });
  }

  async delete(id: string) {
    await this.findById(id);
    await attendanceRepository.delete(id);
  }

  // Overtime
  async findAllOvertime(companyId: string, filters?: { employeeId?: string; status?: string }) {
    return attendanceRepository.findAllOvertime(companyId, filters);
  }

  async createOvertime(data: CreateOvertimeDTO) {
    const overtime = await attendanceRepository.createOvertime(data);
    logger.info('Overtime request created', { employeeId: data.employeeId });
    return overtime;
  }

  async approveOvertime(id: string, userId: string) {
    await this.findById(id);
    return attendanceRepository.updateOvertimeStatus(id, 'APPROVED', userId);
  }

  async rejectOvertime(id: string) {
    return attendanceRepository.updateOvertimeStatus(id, 'REJECTED');
  }
}

export const attendanceService = new AttendanceService();
