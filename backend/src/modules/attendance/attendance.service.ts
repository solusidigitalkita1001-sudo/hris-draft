import { attendanceRepository } from './attendance.repository';
import { CreateAttendanceDTO, UpdateAttendanceDTO, CreateOvertimeDTO } from './attendance.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { workCalendarRepository } from '@/modules/work-calendar/work-calendar.repository';

function buildScheduledTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

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

    let status = data.status;

    // Resolve expected check-in time from employee calendar instead of hardcoding 09:00
    if (data.checkIn && data.status === 'PRESENT') {
      const checkIn = new Date(data.checkIn);
      const schedule = await workCalendarRepository.findEmployeeDaySchedule(data.employeeId, new Date(data.date));

      if (schedule?.isWorkingDay && schedule.workStart) {
        const scheduledStart = buildScheduledTime(checkIn, schedule.workStart);
        if (checkIn > scheduledStart) {
          status = 'LATE';
        }
      }
    }

    const record = await attendanceRepository.create({ ...data, status });
    logger.info('Attendance recorded', { employeeId: data.employeeId });
    return record;
  }

  async checkOut(id: string, checkOutTime: string) {
    await this.findById(id);
    return attendanceRepository.update(id, { checkOut: checkOutTime });
  }

  async correction(id: string, data: { status: string; notes?: string }) {
    const record = await this.findById(id);
    return attendanceRepository.update(record.id, {
      status: data.status as any,
      notes: data.notes ?? record.notes ?? undefined,
    });
  }

  async getSummary(companyId: string, month: string, year: string, departmentId?: string) {
    return attendanceRepository.getSummary(companyId, Number(month), Number(year), departmentId);
  }

  async getReport(companyId: string, month: string, year: string, departmentId?: string) {
    // Convert month/year to date range
    const startDate = `${year}-${month.padStart(2, '0')}-01`;
    const endMonth = Number(month);
    const endYear = Number(year);
    const lastDay = new Date(endYear, endMonth, 0).getDate();
    const endDate = `${year}-${month.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const result = await attendanceRepository.getReport(companyId, { startDate, endDate, departmentId });
    return result.csv;
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
