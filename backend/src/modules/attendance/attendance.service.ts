import { attendanceRepository } from './attendance.repository';
import {
  CreateAttendanceDTO,
  UpdateAttendanceDTO,
  CreateOvertimeDTO,
  CheckoutAttendanceDTO,
} from './attendance.dto';
import { NotFoundError, BadRequestError, ForbiddenError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { calculateOvertimePay, OvertimeDayType } from '@/shared/attendance/overtime';
import { compareFaceVectors, DEFAULT_FACE_MATCH_THRESHOLD } from '@/shared/attendance/face-recognition';
import { assessLiveness, LivenessVerdict } from '@/shared/attendance/liveness';
import {
  assessGpsCompliance,
  checkRadius,
  haversineMeters,
  MockLocationVerdict,
} from '@/shared/attendance/gps-mock';
import {
  AttendanceCaptureMethod,
  AttendanceExceptionType,
  AttendanceStatus,
  LivenessVerdict as PrismaLivenessVerdict,
  MockLocationVerdict as PrismaMockVerdict,
  OutsideRadiusAction,
  Prisma,
} from '@prisma/client';
import { attendanceContextService } from './attendance-context.service';
import { workflowEngineRepository } from '@/modules/workflow-engine/workflow-engine.repository';
import type { WorkflowActionDTO } from '@/modules/workflow-engine/workflow-engine.dto';
import { getCurrentCompanyId, getCurrentRoles, getRequestContext } from '@/shared/context/RequestContext';
import prisma from '@/shared/database/prisma';

type WorkflowSource = 'WORKFLOW' | 'LEGACY';

function buildScheduledTime(baseDate: Date, time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  const scheduled = new Date(baseDate);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function buildScheduledEndTime(baseDate: Date, workStart: string | null | undefined, workEnd: string | null | undefined) {
  if (!workEnd) return null;

  const scheduledEnd = buildScheduledTime(baseDate, workEnd);
  if (workStart) {
    const scheduledStart = buildScheduledTime(baseDate, workStart);
    if (scheduledEnd <= scheduledStart) {
      scheduledEnd.setDate(scheduledEnd.getDate() + 1);
    }
  }

  return scheduledEnd;
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
      return [AttendanceCaptureMethod.MOBILE_GPS, AttendanceCaptureMethod.FACE_RECOGNITION];
    case 'BOTH':
      return [
        AttendanceCaptureMethod.FINGERPRINT,
        AttendanceCaptureMethod.MOBILE_GPS,
        AttendanceCaptureMethod.FACE_RECOGNITION,
      ];
    case 'MANUAL':
    default:
      return [AttendanceCaptureMethod.MANUAL, AttendanceCaptureMethod.FACE_RECOGNITION];
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
  latitude?: number;
  longitude?: number;
  requiresLocation: boolean;
  policyLatitude: number | null;
  policyLongitude: number | null;
  policyRadiusMeters: number | null;
  allowOutsideRadius: boolean;
  outsideRadiusAction: OutsideRadiusAction;
  phaseLabel?: string;
}) {
  const {
    method,
    latitude,
    longitude,
    requiresLocation,
    policyLatitude,
    policyLongitude,
    policyRadiusMeters,
    allowOutsideRadius,
    outsideRadiusAction,
    phaseLabel = 'attendance',
  } = options;

  const mustEvaluateLocation = method === AttendanceCaptureMethod.MOBILE_GPS || method === AttendanceCaptureMethod.FACE_RECOGNITION || requiresLocation;
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

  if (latitude === undefined || longitude === undefined) {
    throw new BadRequestError(`${phaseLabel} latitude and longitude are required for this attendance method`);
  }

  if (policyLatitude === null || policyLongitude === null || policyRadiusMeters === null) {
    throw new BadRequestError('GPS policy is not configured for the resolved branch attendance policy');
  }

  const distanceMeters =
    typeof haversineMeters === 'function'
      ? Math.round(
          haversineMeters(
            { latitude, longitude },
            { latitude: policyLatitude, longitude: policyLongitude },
          ),
        )
      : calculateDistanceMeters(latitude, longitude, policyLatitude, policyLongitude);
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
  private buildPolicySnapshot(
    context: Awaited<ReturnType<typeof attendanceContextService.resolve>>,
    allowedMethods: AttendanceCaptureMethod[],
    warnings: string[],
  ) {
    return {
      policyId: context.policy.id,
      calendarId: context.calendarId,
      scheduleSource: context.schedule.scheduleSource,
      shiftFormulaId: context.schedule.shiftFormulaId ?? null,
      shiftFormulaCode: context.schedule.shiftFormulaCode ?? null,
      shiftFormulaName: context.schedule.shiftFormulaName ?? null,
      crossesMidnight: context.schedule.crossesMidnight ?? false,
      branchId: context.branchId,
      branchName: context.branch?.name ?? null,
      branchCode: context.branch?.code ?? null,
      policyMethod: context.policy.attendanceMethod,
      allowedMethods,
      lateToleranceMinutes: context.policy.lateToleranceMinutes,
      earlyCheckoutToleranceMinutes: context.policy.earlyCheckoutToleranceMinutes,
      requiresLocation: context.policy.requiresLocation,
      requiresSelfie: context.policy.requiresSelfie,
      gpsLatitude: context.policy.gpsLatitude,
      gpsLongitude: context.policy.gpsLongitude,
      gpsRadiusMeters: context.policy.gpsRadiusMeters,
      allowOutsideRadius: context.policy.allowOutsideRadius,
      outsideRadiusAction: context.policy.outsideRadiusAction,
      dayType: context.schedule.dayType,
      workStart: context.schedule.workStart ?? null,
      workEnd: context.schedule.workEnd ?? null,
      warnings,
    } as Prisma.InputJsonValue;
  }

  async findAll(companyId: string, filters?: any) {
    return attendanceRepository.findAll(companyId, filters);
  }

  async findById(id: string) {
    const record = await attendanceRepository.findById(id);
    if (!record) throw new NotFoundError('Attendance record not found');
    return record;
  }

  async getResolvedContext(employeeId: string, attendanceDate: string, companyId?: string) {
    const resolvedDate = new Date(attendanceDate);
    const context = await attendanceContextService.resolve(employeeId, resolvedDate, companyId);
    const allowedMethods = resolveAllowedMethods(context.policy.attendanceMethod);

    return {
      ...context,
      allowedMethods,
      policySnapshot: this.buildPolicySnapshot(context, allowedMethods, context.warnings),
    };
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
      latitude: data.checkInLatitude,
      longitude: data.checkInLongitude,
      requiresLocation: context.policy.requiresLocation,
      policyLatitude: context.policy.gpsLatitude,
      policyLongitude: context.policy.gpsLongitude,
      policyRadiusMeters: context.policy.gpsRadiusMeters,
      allowOutsideRadius: context.policy.allowOutsideRadius,
      outsideRadiusAction: context.policy.outsideRadiusAction,
      phaseLabel: 'Check-in',
    });

    /// B.7 Face Recognition Backend Ready: compute similarity + isMatch (jika method FACE_RECOGNITION ataupun data faceRecognition diisi)
    const faceInput = data.faceRecognition;
    const hasFacePayload = method === AttendanceCaptureMethod.FACE_RECOGNITION || !!faceInput;

    const employeeForFace = hasFacePayload
      ? await prisma.employee.findUnique({
          where: { id: data.employeeId, companyId: context.companyId },
          select: { id: true, companyId: true, referencePhotoUrl: true, referencePhotoUpdatedAt: true },
        })
      : null;

    let similarity = 0;
    let isFaceMatch = false;
    if (hasFacePayload && faceInput) {
      const refRaw = (faceInput.referencePhotoUrl ? [] : null) ?? null;
      const refVec = Array.isArray((faceInput as any).referenceVector) ? (faceInput as any).referenceVector : refRaw;
      const selfieVec = Array.isArray((faceInput as any).selfieVector) ? (faceInput as any).selfieVector : null;
      if (refVec && selfieVec && refVec.length > 0 && selfieVec.length > 0) {
        const cmp = compareFaceVectors(refVec, selfieVec, DEFAULT_FACE_MATCH_THRESHOLD);
        similarity = cmp.score;
        isFaceMatch = cmp.isMatch;
      } else if (typeof faceInput.similarityScore === 'number' && Number.isFinite(faceInput.similarityScore)) {
        similarity = faceInput.similarityScore;
        isFaceMatch = faceInput.isFaceMatch ?? similarity >= DEFAULT_FACE_MATCH_THRESHOLD;
      } else {
        similarity = -1;
        isFaceMatch = false;
      }
      if (method === AttendanceCaptureMethod.FACE_RECOGNITION && !isFaceMatch) {
        throw new BadRequestError(`Wajah tidak cocok dengan foto referensi (skor=${similarity.toFixed(3)} < threshold ${DEFAULT_FACE_MATCH_THRESHOLD}). Silakan coba lagi dengan pencahayaan cukup.`);
      }
    }

    /// B.8 Liveness verdict
    const livenessInput = data.liveness ?? null;
    const livenessAssess = hasFacePayload ? assessLiveness(livenessInput as any) : null;
    const prismaLiveness: PrismaLivenessVerdict = (livenessAssess?.verdict ?? 'NO_DATA') as PrismaLivenessVerdict;
    if (method === AttendanceCaptureMethod.FACE_RECOGNITION && livenessAssess) {
      if (livenessAssess.verdict === LivenessVerdict.STATIC) {
        throw new BadRequestError(`Liveness gagal: foto terdeteksi dari galeri / bukan kamera real-time.`);
      }
      if (livenessAssess.verdict === LivenessVerdict.MANIPULATED) {
        throw new BadRequestError(`Liveness gagal: metadata menunjukan gambar sudah diedit.`);
      }
      if (livenessAssess.verdict === LivenessVerdict.BLUR) {
        throw new BadRequestError(`Liveness gagal: gambar terlalu blur, harap foto ulang.`);
      }
    }

    /// B.9 GPS fake detection enrich
    const gpsCompliance = assessGpsCompliance(
      { latitude: data.checkInLatitude, longitude: data.checkInLongitude },
      {
        latitude: context.policy.gpsLatitude,
        longitude: context.policy.gpsLongitude,
        radiusMeters: context.policy.gpsRadiusMeters,
        name: context.branch?.name ?? null,
      },
      (data.deviceGps ?? null) as any,
    );
    const prismaMock: PrismaMockVerdict = (gpsCompliance.mockVerdict ?? 'LIKELY_REAL') as PrismaMockVerdict;
    if (
      method === AttendanceCaptureMethod.FACE_RECOGNITION &&
      gpsCompliance.mockVerdict === MockLocationVerdict.CONFIRMED_FAKE
    ) {
      throw new BadRequestError(`Lokasi terdeteksi palsu (Mock Location). Matikan fake GPS app untuk clock-in.`);
    }

    const mergedWarnings = [
      ...context.warnings,
      ...(gpsEvaluation.exceptionType ? [gpsEvaluation.exceptionType] : []),
      ...gpsCompliance.warnings,
      ...(livenessAssess && livenessAssess.verdict !== LivenessVerdict.PASS ? [`liveness:${livenessAssess.verdict}`] : []),
    ];

    const snapshot = this.buildPolicySnapshot(context, allowedMethods, mergedWarnings) as unknown as Record<string, unknown>;
    snapshot.faceRecognition = hasFacePayload
      ? {
          similarity,
          isFaceMatch,
          threshold: DEFAULT_FACE_MATCH_THRESHOLD,
          hasReferencePhoto: !!employeeForFace?.referencePhotoUrl,
        }
      : null;
    snapshot.liveness = livenessAssess
      ? { verdict: livenessAssess.verdict, reasons: livenessAssess.reasons }
      : null;
    snapshot.gpsCompliance = {
      distance: gpsCompliance.distance,
      mockVerdict: gpsCompliance.mockVerdict,
      warnings: gpsCompliance.warnings,
    };

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
      isException: gpsEvaluation.isException || context.warnings.length > 0 || gpsCompliance.warnings.length > 0,
      exceptionType: gpsEvaluation.exceptionType ?? (context.warnings[0] as AttendanceExceptionType | undefined),
      exceptionReason: gpsEvaluation.exceptionReason ?? (context.warnings.length > 0 ? 'Attendance context requires branch review' : gpsCompliance.warnings[0] ?? null),
      requiresReview:
        gpsEvaluation.requiresReview ||
        context.warnings.length > 0 ||
        (hasFacePayload && !isFaceMatch) ||
        gpsCompliance.mockVerdict === MockLocationVerdict.SUSPICIOUS ||
        gpsCompliance.mockVerdict === MockLocationVerdict.CONFIRMED_FAKE,
      policySnapshot: snapshot as Prisma.InputJsonValue,
      notes: data.notes,
    });

    if (hasFacePayload) {
      try {
        await prisma.attendanceFaceLog.create({
          data: {
            attendanceId: record.id,
            employeeId: data.employeeId,
            companyId: context.companyId,
            selfieUrl: (faceInput?.selfieUrl ?? null) as any,
            similarityScore: similarity,
            isFaceMatch,
            livenessVerdict: prismaLiveness,
            mockVerdict: prismaMock,
            notes: livenessAssess?.reasons?.join('; ') ?? gpsCompliance.warnings.join('; ') ?? null,
          },
        });
      } catch (e) {
        logger.error('Failed create AttendanceFaceLog (ignored)', { err: e as Error });
      }
    }

    logger.info('Attendance recorded', {
      employeeId: data.employeeId,
      method,
      similarity,
      isFaceMatch,
      liveness: prismaLiveness,
      mock: prismaMock,
    });
    return record;
  }

  async checkOut(id: string, data: CheckoutAttendanceDTO) {
    const record = await this.findById(id);

    if (!record.checkIn) {
      throw new BadRequestError('Attendance record has no check-in time');
    }

    if (record.checkOut) {
      throw new BadRequestError('Attendance record has already been checked out');
    }

    const context = await attendanceContextService.resolve(record.employeeId, new Date(record.date), record.companyId);
    const method = (data.method ?? record.method) as AttendanceCaptureMethod;
    const allowedMethods = resolveAllowedMethods(context.policy.attendanceMethod);

    if (!allowedMethods.includes(method)) {
      throw new BadRequestError('Attendance method is not allowed for the resolved branch attendance policy');
    }

    const gpsEvaluation = evaluateGpsAttendance({
      method,
      latitude: data.checkOutLatitude,
      longitude: data.checkOutLongitude,
      requiresLocation: context.policy.requiresLocation,
      policyLatitude: context.policy.gpsLatitude,
      policyLongitude: context.policy.gpsLongitude,
      policyRadiusMeters: context.policy.gpsRadiusMeters,
      allowOutsideRadius: context.policy.allowOutsideRadius,
      outsideRadiusAction: context.policy.outsideRadiusAction,
      phaseLabel: 'Check-out',
    });

    const checkOutTime = new Date(data.checkOut);
    const scheduledEnd = buildScheduledEndTime(record.date, context.schedule.workStart, context.schedule.workEnd);
    let earlyLeaveMinutes = 0;

    if (scheduledEnd) {
      const toleratedEnd = new Date(scheduledEnd);
      toleratedEnd.setMinutes(toleratedEnd.getMinutes() - context.policy.earlyCheckoutToleranceMinutes);
      if (checkOutTime < toleratedEnd) {
        earlyLeaveMinutes = calculateMinutesDifference(scheduledEnd, checkOutTime);
      }
    }

    const workDuration = Math.max(
      0,
      Math.round((checkOutTime.getTime() - new Date(record.checkIn).getTime()) / 60000),
    );

    const mergedWarnings = [
      ...context.warnings,
      ...(gpsEvaluation.exceptionType ? [gpsEvaluation.exceptionType] : []),
    ];

    return attendanceRepository.update(id, {
      checkOut: data.checkOut,
      method,
      checkOutLatitude: data.checkOutLatitude,
      checkOutLongitude: data.checkOutLongitude,
      workDuration,
      earlyLeaveMinutes,
      distanceMeters: record.distanceMeters ?? gpsEvaluation.distanceMeters,
      isWithinRadius: record.isWithinRadius ?? gpsEvaluation.isWithinRadius,
      isException: record.isException || gpsEvaluation.isException || earlyLeaveMinutes > 0 || context.warnings.length > 0,
      exceptionType:
        record.exceptionType ??
        gpsEvaluation.exceptionType ??
        (context.warnings[0] as AttendanceExceptionType | undefined),
      exceptionReason:
        record.exceptionReason ??
        gpsEvaluation.exceptionReason ??
        (earlyLeaveMinutes > 0
          ? 'Employee checked out earlier than the tolerated schedule'
          : context.warnings.length > 0
            ? 'Attendance context requires branch review'
            : null),
      requiresReview: record.requiresReview || gpsEvaluation.requiresReview || earlyLeaveMinutes > 0 || context.warnings.length > 0,
      policySnapshot: {
        ...((record.policySnapshot as Record<string, unknown> | null) ?? {}),
        ...((this.buildPolicySnapshot(context, allowedMethods, mergedWarnings) as unknown as Record<string, unknown>) ?? {}),
        checkout: {
          evaluatedAt: checkOutTime.toISOString(),
          latitude: data.checkOutLatitude ?? null,
          longitude: data.checkOutLongitude ?? null,
          distanceMeters: gpsEvaluation.distanceMeters,
          isWithinRadius: gpsEvaluation.isWithinRadius,
          earlyLeaveMinutes,
          workDuration,
        },
      },
      notes: data.notes ?? record.notes ?? undefined,
    });
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

  async findOvertimeById(id: string) {
    const record = await attendanceRepository.findOvertimeById(id);
    if (!record) throw new NotFoundError('Overtime request not found');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && record.companyId !== currentCompanyId) {
      throw new NotFoundError('Overtime request not found');
    }

    return record;
  }

  private async resolveDefaultOvertimeTemplate(companyId: string) {
    return workflowEngineRepository.findDefaultTemplate(
      companyId,
      'OVERTIME_REQUEST',
      'attendance',
    );
  }

  private async findWorkflowInstanceByOvertimeId(id: string) {
    return prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'OVERTIME_REQUEST',
        referenceId: id,
      },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: { select: { id: true, name: true, approvalType: true } },
      },
    });
  }

  async createOvertime(data: CreateOvertimeDTO) {
    const ctx = getRequestContext();
    const currentUser = ctx?.user;
    const roles = currentUser?.roles ?? [];
    const hasElevatedRole = roles.some((r) =>
      ['SUPER_ADMIN', 'GROUP_ADMIN', 'HR_MANAGER', 'HR_STAFF', 'MANAGER'].includes(r)
    );

    if (currentUser?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      if (data.employeeId !== currentUser.employeeId) {
        throw new ForbiddenError('IDOR: Employee cannot create overtime request for other employees');
      }
    }

    const requesterId = currentUser?.id ?? undefined;

    return prisma.$transaction(async (tx) => {
      const overtime = await attendanceRepository.createOvertime(data);

      try {
        const template = await this.resolveDefaultOvertimeTemplate(data.companyId);
        if (template) {
          await workflowEngineRepository.startInstance(requesterId ?? 'system', {
            templateId: template.id,
            companyId: data.companyId,
            approvalType: 'OVERTIME_REQUEST',
            referenceType: 'OVERTIME_REQUEST',
            referenceId: overtime.id,
            payload: {
              date: data.date,
              durationHours: data.durationHours,
              reason: data.reason,
              multiplier: data.multiplier,
              employeeId: data.employeeId,
              companyId: data.companyId,
            },
          });
        } else {
          logger.warn('No default overtime workflow template configured for company', {
            companyId: data.companyId,
          });
        }
      } catch (wfErr: any) {
        logger.error('Failed to start workflow for overtime request', {
          overtimeRequestId: overtime.id,
          error: wfErr?.message,
        });
      }

      logger.info('Overtime request created with workflow', {
        employeeId: data.employeeId,
        date: data.date,
      });
      return overtime;
    });
  }

  async finalizeOvertimeApprovalEffects(id: string, approverUserId: string) {
    return attendanceRepository.updateOvertimeStatus(id, 'APPROVED', approverUserId);
  }

  async finalizeOvertimeRejectEffects(id: string, approverUserId: string, reason?: string) {
    return attendanceRepository.updateOvertimeStatus(id, 'REJECTED');
  }

  async applyOvertimeWorkflowAction(
    id: string,
    userId: string,
    roles: string[],
    action: WorkflowActionDTO & { source?: WorkflowSource },
  ) {
    const overtime = await this.findOvertimeById(id);

    const instance = await this.findWorkflowInstanceByOvertimeId(id);

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this overtime request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    const updatedInstance = await workflowEngineRepository.applyAction(
      instance.id,
      userId,
      roles,
      { action: action.action, comment: action.comment },
    );

    if (!updatedInstance) {
      throw new NotFoundError('Failed to update workflow instance');
    }

    if (updatedInstance.status === 'APPROVED') {
      await this.finalizeOvertimeApprovalEffects(id, userId);
    }

    if (action.action === 'REJECT') {
      await this.finalizeOvertimeRejectEffects(id, userId, action.comment);
    }

    const finalOvertime = await attendanceRepository.findOvertimeById(id);
    return { overtimeRequest: finalOvertime, workflowInstance: updatedInstance };
  }

  async getOvertimeWorkflow(overtimeId: string) {
    await this.findOvertimeById(overtimeId);

    const instance = await this.findWorkflowInstanceByOvertimeId(overtimeId);

    if (!instance) {
      throw new NotFoundError('Workflow instance not found for this overtime request');
    }

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    if (!isAdmin && currentCompanyId && instance.companyId !== currentCompanyId) {
      throw new NotFoundError('Workflow instance not found');
    }

    return instance;
  }

  async approveOvertime(id: string, userId: string) {
    await this.findOvertimeById(id);
    const roles = getCurrentRoles();
    return this.applyOvertimeWorkflowAction(id, userId, roles, {
      action: 'APPROVE',
      comment: 'Legacy approve endpoint',
      source: 'LEGACY',
    });
  }

  async rejectOvertime(id: string, reason?: string) {
    const ctx = getRequestContext();
    const userId = ctx?.user?.id ?? 'legacy';
    const roles = ctx?.user?.roles ?? [];

    await this.findOvertimeById(id);
    return this.applyOvertimeWorkflowAction(id, userId, roles, {
      action: 'REJECT',
      comment: reason ?? 'Legacy reject endpoint',
      source: 'LEGACY',
    });
  }

  /**
   * Hitung upah lembur sesuai UU Pasal 78 / PP 35/2021 (Business Rule Gap Attendance).
   * dayType: WORKDAY (jam-1 1,5× lalu 2×) atau HOLIDAY (2×/3×/4× bertingkat).
   */
  async calculateOvertimePay(
    id: string,
    opts?: { dayType?: OvertimeDayType; workweekDays?: 5 | 6 }
  ) {
    const data = await attendanceRepository.findOvertimeWithWage(id);
    if (!data) throw new NotFoundError('Overtime request not found');
    if (!data.salary) throw new BadRequestError('Data gaji aktif karyawan tidak ditemukan');

    const result = calculateOvertimePay({
      monthlyWage: Number(data.salary.baseSalary),
      hours: Number(data.overtime.durationHours),
      dayType: opts?.dayType ?? 'WORKDAY',
      workweekDays: opts?.workweekDays ?? 5,
    });

    return {
      overtimeId: id,
      employee: data.overtime.employee,
      durationHours: Number(data.overtime.durationHours),
      dayType: opts?.dayType ?? 'WORKDAY',
      ...result,
    };
  }
}

export const attendanceService = new AttendanceService();
