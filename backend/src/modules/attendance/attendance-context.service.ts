import {
  AttendanceExceptionType,
  AttendancePolicyMethod,
  BranchAttendancePolicy,
  OutsideRadiusAction,
} from '@prisma/client';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { prisma } from '@/shared/database/prisma';
import {
  ResolvedEmployeeDaySchedule,
  WorkCalendarResolutionContext,
  workCalendarRepository,
} from '@/modules/work-calendar/work-calendar.repository';

export interface ResolvedAttendancePolicy {
  id: string | null;
  attendanceMethod: AttendancePolicyMethod;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsRadiusMeters: number | null;
  allowOutsideRadius: boolean;
  outsideRadiusAction: OutsideRadiusAction;
  lateToleranceMinutes: number;
  earlyCheckoutToleranceMinutes: number;
  allowHolidayAttendance: boolean;
  allowWeekendAttendance: boolean;
  autoAbsentEnabled: boolean;
  autoCheckoutEnabled: boolean;
  requiresSelfie: boolean;
  requiresLocation: boolean;
  isActive: boolean;
  notes: string | null;
}

export interface AttendanceContextResolution {
  employeeId: string;
  companyId: string;
  branchId: string | null;
  branch: {
    id: string;
    name: string;
    code: string;
    latitude: number | null;
    longitude: number | null;
  } | null;
  departmentId: string | null;
  calendarId: string | null;
  schedule: ResolvedEmployeeDaySchedule;
  policy: ResolvedAttendancePolicy;
  warnings: string[];
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function buildFallbackPolicy(policy: BranchAttendancePolicy | null, branch: { latitude: number | null; longitude: number | null } | null): ResolvedAttendancePolicy {
  return {
    id: policy?.id ?? null,
    attendanceMethod: policy?.attendanceMethod ?? AttendancePolicyMethod.MANUAL,
    gpsLatitude: policy?.gpsLatitude ?? branch?.latitude ?? null,
    gpsLongitude: policy?.gpsLongitude ?? branch?.longitude ?? null,
    gpsRadiusMeters: policy?.gpsRadiusMeters ?? null,
    allowOutsideRadius: policy?.allowOutsideRadius ?? false,
    outsideRadiusAction: policy?.outsideRadiusAction ?? OutsideRadiusAction.REVIEW,
    lateToleranceMinutes: policy?.lateToleranceMinutes ?? 0,
    earlyCheckoutToleranceMinutes: policy?.earlyCheckoutToleranceMinutes ?? 0,
    allowHolidayAttendance: policy?.allowHolidayAttendance ?? false,
    allowWeekendAttendance: policy?.allowWeekendAttendance ?? false,
    autoAbsentEnabled: policy?.autoAbsentEnabled ?? false,
    autoCheckoutEnabled: policy?.autoCheckoutEnabled ?? false,
    requiresSelfie: policy?.requiresSelfie ?? false,
    requiresLocation: policy?.requiresLocation ?? false,
    isActive: policy?.isActive ?? false,
    notes: policy?.notes ?? null,
  };
}

export class AttendanceContextService {
  async resolve(employeeId: string, attendanceDate: Date, requestedCompanyId?: string): Promise<AttendanceContextResolution> {
    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, deletedAt: null },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
      employeeCategory: true,
      shiftFormulaId: true,
      shiftStartDate: true,
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    const effectiveStart = startOfDay(attendanceDate);
    const effectiveEnd = endOfDay(attendanceDate);

    const [activeAssignment, latestCareer] = await Promise.all([
      prisma.employeeCompanyAssignment.findFirst({
        where: {
          employeeId,
          startDate: { lte: effectiveEnd },
          OR: [
            { endDate: null },
            { endDate: { gte: effectiveStart } },
          ],
        },
        orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          companyId: true,
          assignmentType: true,
        },
      }),
      prisma.employeeCareerTransaction.findFirst({
        where: {
          employeeId,
          deletedAt: null,
          effectiveDate: { lte: effectiveEnd },
        },
        orderBy: [{ effectiveDate: 'desc' }, { createdAt: 'desc' }],
        select: {
          toBranchId: true,
          toDepartmentId: true,
        },
      }),
    ]);

    const resolvedCompanyId = activeAssignment?.companyId ?? employee.companyId;

    if (requestedCompanyId && requestedCompanyId !== resolvedCompanyId) {
      throw new BadRequestError('Attendance company context does not match the employee active company');
    }

    const warnings: string[] = [];
    const rawBranchId = latestCareer?.toBranchId ?? employee.branchId ?? null;
    const rawDepartmentId = latestCareer?.toDepartmentId ?? employee.departmentId ?? null;

    const [resolvedBranch, resolvedDepartment] = await Promise.all([
      rawBranchId
        ? prisma.branch.findFirst({
            where: { id: rawBranchId, companyId: resolvedCompanyId, deletedAt: null },
            select: { id: true, name: true, code: true, latitude: true, longitude: true },
          })
        : null,
      rawDepartmentId
        ? prisma.department.findFirst({
            where: { id: rawDepartmentId, companyId: resolvedCompanyId, deletedAt: null },
            select: { id: true },
          })
        : null,
    ]);

    if (rawBranchId && !resolvedBranch) {
      warnings.push(AttendanceExceptionType.INVALID_BRANCH_CONTEXT);
    }

    const calendarContext: WorkCalendarResolutionContext = {
      companyId: resolvedCompanyId,
      branchId: resolvedBranch?.id ?? null,
      departmentId: resolvedDepartment?.id ?? null,
    };

    const overrideSchedule = await workCalendarRepository.findEmployeeShiftOverrideSchedule(employeeId, attendanceDate);
    const shiftSchedule = overrideSchedule ?? await workCalendarRepository.resolveShiftFormulaSchedule(employeeId, attendanceDate);
    const schedule = shiftSchedule ?? await workCalendarRepository.findDayScheduleForContext(calendarContext, attendanceDate);
    if (!schedule) {
      throw new BadRequestError('No active work calendar found for the employee attendance context');
    }

    const branchPolicy = resolvedBranch
      ? await prisma.branchAttendancePolicy.findFirst({
          where: { branchId: resolvedBranch.id, companyId: resolvedCompanyId, deletedAt: null, isActive: true },
        })
      : null;

    // Fallback: company-level default policy when branch has no specific policy
    const effectivePolicy = branchPolicy ?? await prisma.branchAttendancePolicy.findFirst({
      where: { companyId: resolvedCompanyId, branchId: null, deletedAt: null, isActive: true },
    });

    return {
      employeeId,
      companyId: resolvedCompanyId,
      branchId: resolvedBranch?.id ?? null,
      branch: resolvedBranch
        ? {
            id: resolvedBranch.id,
            name: resolvedBranch.name,
            code: resolvedBranch.code,
            latitude: resolvedBranch.latitude,
            longitude: resolvedBranch.longitude,
          }
        : null,
      departmentId: resolvedDepartment?.id ?? null,
      calendarId: schedule.calendarId,
      schedule,
      policy: buildFallbackPolicy(effectivePolicy, resolvedBranch),
      warnings,
    };
  }
}

export const attendanceContextService = new AttendanceContextService();
