import { attendanceRepository } from './attendance.repository';
import { CreateAttendanceDTO, UpdateAttendanceDTO, CreateOvertimeDTO } from './attendance.dto';
import { NotFoundError, BadRequestError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import {
  AttendanceCaptureMethod,
  AttendanceExceptionType,
  AttendanceStatus,
  OutsideRadiusAction,
  Prisma,
} from '@prisma/client';
import { attendanceContextService } from './attendance-context.service';

function buildScheduledTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function calculateMinutesDifference(laterDate: Date, earlierDate: Date) {
  return Math.max(0, Math.round((laterDate.getTime() - earlierDate.getTime()) / 60000));
}

function calculateDistanceMeters(
  latitudeA: number,
  longitudeA: number,
  latitudeB: number,
  longitudeB: number,
) {
  const earthRadiusMeters = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;

  const latitudeDelta = toRadians(latitudeB - latitudeA);
  const longitudeDelta = toRadians(longitudeB - longitudeA);
  const latitudeARadians = toRadians(latitudeA);
  const latitudeBRadians = toRadians(latitudeB);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(latitudeARadians) *
      Math.cos(latitudeBRadians) *
      Math.sin(longitudeDelta / 2) ** 2;

  return Math.round(2 * earthRadiusMeters * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine)));
}

function resolveAllowedMethods(policyMethod: string): AttendanceCaptureMethod[] {
  switch (policyMethod) {
    case 'FINGERPRINT':
      return [AttendanceCaptureMethod.FINGERPRINT];
    case 'MOBILE_GPS':
      return [AttendanceCaptureMethod.MOBILE_GPS];
    case 'BOTH':
      return [AttendanceCaptureMethod.FINGERPRINT, AttendanceCaptureMethod.MOBILE_GPS];
    case 'MANUAL':
    default:
      return [AttendanceCaptureMethod.MANUAL];
  }
}

function isHolidayLikeDayType(dayType: string) {
  return ['NH', 'JL', 'CH', 'RH'].includes(dayType);
}

function isWeekendLikeDayType(dayType: string) {
  return dayType === 'WE';
}

function evaluateGpsAttendance(options: {
  method: AttendanceCaptureMethod;
  checkInLatitude?: number;
  checkInLongitude?: number;
  requiresLocation: boolean;
  policyLatitude: number | null;
  policyLongitude: number | null;
  policyRadiusMeters: number | null;
  allowOutsideRadius: boolean;
  outsideRadiusAction: OutsideRadiusAction;
}) {
  const {
    method,
    checkInLatitude,
    checkInLongitude,
    requiresLocation,
    policyLatitude,
    policyLongitude,
    policyRadiusMeters,
    allowOutsideRadius,
    outsideRadiusAction,
  } = options;

  const mustEvaluateLocation = method === AttendanceCaptureMethod.MOBILE_GPS || requiresLocation;
  if (!mustEvaluateLocation) {
    return {
      distanceMeters: null as number | null,
      isWithinRadius: null as boolean | null,
      isException: false,
      exceptionType: null as AttendanceExceptionType | null,
      exceptionReason: null as string | null,
      requiresReview: false,
    };
  }

  if (checkInLatitude === undefined || checkInLongitude === undefined) {
    throw new BadRequestError('Check-in latitude and longitude are required for this attendance method');
  }

  if (policyLatitude === null || policyLongitude === null || policyRadiusMeters === null) {
    throw new BadRequestError('GPS policy is not configured for the resolved branch attendance policy');
  }

  const distanceMeters = calculateDistanceMeters(
    checkInLatitude,
    checkInLongitude,
    policyLatitude,
    policyLongitude,
  );
  const isWithinRadius = distanceMeters <= policyRadiusMeters;

  if (isWithinRadius) {
    return {
      distanceMeters,
      isWithinRadius: true,
      isException: false,
      exceptionType: null as AttendanceExceptionType | null,
      exceptionReason: null as string | null,
      requiresReview: false,
    };
  }

  if (!allowOutsideRadius || outsideRadiusAction === OutsideRadiusAction.REJECT) {
    throw new BadRequestError('Employee location is outside the allowed attendance radius');
  }

  return {
    distanceMeters,
    isWithinRadius: false,
    isException: true,
    exceptionType: AttendanceExceptionType.OUT_OF_RADIUS,
    exceptionReason: 'Attendance recorded outside the configured branch radius',
    requiresReview: outsideRadiusAction === OutsideRadiusAction.REVIEW,
  };
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
    const attendanceDate = new Date(data.date);
    const existing = await attendanceRepository.findByEmployeeAndDate(data.employeeId, attendanceDate);
    if (existing) throw new BadRequestError('Attendance record already exists for this date');

    const context = await attendanceContextService.resolve(data.employeeId, attendanceDate, data.companyId);
    const method = data.method as AttendanceCaptureMethod;
    const allowedMethods = resolveAllowedMethods(context.policy.attendanceMethod);

    if (!allowedMethods.includes(method)) {
      throw new BadRequestError('Attendance method is not allowed for the resolved branch attendance policy');
    }

    if (!context.schedule.isWorkingDay) {
      const allowedOnNonWorkingDay = isWeekendLikeDayType(context.schedule.dayType)
        ? context.policy.allowWeekendAttendance
        : isHolidayLikeDayType(context.schedule.dayType)
          ? context.policy.allowHolidayAttendance
          : false;

      if (!allowedOnNonWorkingDay) {
        throw new BadRequestError('Attendance is not allowed on this non-working day for the resolved employee schedule');
      }
    }

    let status = data.status as AttendanceStatus;
    let lateMinutes = 0;

    if (data.checkIn && status === AttendanceStatus.PRESENT && context.schedule.workStart) {
      const checkIn = new Date(data.checkIn);
      const scheduledStart = buildScheduledTime(attendanceDate, context.schedule.workStart);
      const toleratedStart = new Date(scheduledStart);
      toleratedStart.setMinutes(toleratedStart.getMinutes() + context.policy.lateToleranceMinutes);

      if (checkIn > toleratedStart) {
        status = AttendanceStatus.LATE;
        lateMinutes = calculateMinutesDifference(checkIn, scheduledStart);
      }
    }

    const gpsEvaluation = evaluateGpsAttendance({
      method,
      checkInLatitude: data.checkInLatitude,
      checkInLongitude: data.checkInLongitude,
      requiresLocation: context.policy.requiresLocation,
      policyLatitude: context.policy.gpsLatitude,
      policyLongitude: context.policy.gpsLongitude,
      policyRadiusMeters: context.policy.gpsRadiusMeters,
      allowOutsideRadius: context.policy.allowOutsideRadius,
      outsideRadiusAction: context.policy.outsideRadiusAction,
    });

    const mergedWarnings = [
      ...context.warnings,
      ...(gpsEvaluation.exceptionType ? [gpsEvaluation.exceptionType] : []),
    ];

    const record = await attendanceRepository.create({
      employeeId: data.employeeId,
      companyId: context.companyId,
      branchId: context.branchId,
      attendancePolicyId: context.policy.id,
      resolvedCalendarId: context.calendarId,
      date: attendanceDate,
      checkIn: data.checkIn ? new Date(data.checkIn) : undefined,
      checkOut: data.checkOut ? new Date(data.checkOut) : undefined,
      method,
      source: data.source,
      checkInLatitude: data.checkInLatitude,
      checkInLongitude: data.checkInLongitude,
      checkOutLatitude: data.checkOutLatitude,
      checkOutLongitude: data.checkOutLongitude,
      distanceMeters: gpsEvaluation.distanceMeters,
      isWithinRadius: gpsEvaluation.isWithinRadius,
      status,
      lateMinutes,
      scheduledWorkStart: context.schedule.workStart,
      scheduledWorkEnd: context.schedule.workEnd,
      isException: gpsEvaluation.isException || context.warnings.length > 0,
      exceptionType: gpsEvaluation.exceptionType ?? (context.warnings[0] as AttendanceExceptionType | undefined),
      exceptionReason: gpsEvaluation.exceptionReason ?? (context.warnings.length > 0 ? 'Attendance context requires branch review' : null),
      requiresReview: gpsEvaluation.requiresReview || context.warnings.length > 0,
      policySnapshot: {
        policyId: context.policy.id,
        calendarId: context.calendarId,
        scheduleSource: context.schedule.scheduleSource,
        shiftFormulaId: context.schedule.shiftFormulaId ?? null,
        shiftFormulaCode: context.schedule.shiftFormulaCode ?? null,
        shiftFormulaName: context.schedule.shiftFormulaName ?? null,
        crossesMidnight: context.schedule.crossesMidnight ?? false,
        branchId: context.branchId,
        policyMethod: context.policy.attendanceMethod,
        allowedMethods,
        lateToleranceMinutes: context.policy.lateToleranceMinutes,
        earlyCheckoutToleranceMinutes: context.policy.earlyCheckoutToleranceMinutes,
        requiresLocation: context.policy.requiresLocation,
        gpsLatitude: context.policy.gpsLatitude,
        gpsLongitude: context.policy.gpsLongitude,
        gpsRadiusMeters: context.policy.gpsRadiusMeters,
        allowOutsideRadius: context.policy.allowOutsideRadius,
        outsideRadiusAction: context.policy.outsideRadiusAction,
        dayType: context.schedule.dayType,
        warnings: mergedWarnings,
      } as Prisma.InputJsonValue,
      notes: data.notes,
    });
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
