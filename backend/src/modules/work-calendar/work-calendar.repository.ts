import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import type {
  CreateCalendarDTO,
  UpdateCalendarDTO,
  BulkUpdateDaysDTO,
  CreateHolidayDTO,
  UpdateHolidayDTO,
  CreateShiftFormulaDTO,
  UpdateShiftFormulaDTO,
  CreateShiftSwapRequestDTO,
  ReviewShiftSwapRequestDTO,
} from './work-calendar.dto';

type WorkDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface WorkDayRule {
  enabled: boolean;
  workStart: string | null;
  workEnd: string | null;
}

export interface ResolvedEmployeeDaySchedule {
  calendarId: string | null;
  dayType: string;
  workStart: string | null;
  workEnd: string | null;
  isWorkingDay: boolean;
  scheduleSource: 'CALENDAR' | 'SHIFT_FORMULA';
  shiftFormulaId?: string | null;
  shiftFormulaName?: string | null;
  shiftFormulaCode?: string | null;
  crossesMidnight?: boolean;
  label?: string | null;
  notes?: string | null;
  overrideSource?: 'SHIFT_SWAP' | null;
  overrideRequestId?: string | null;
  swappedWithEmployee?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null;
}

export interface WorkCalendarResolutionContext {
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
}

export interface ResolvedWorkCalendarMonthDay extends ResolvedEmployeeDaySchedule {
  date: string;
  label: string | null;
  notes: string | null;
  absence: {
    source: 'LEAVE_REQUEST' | 'PERMISSION_REQUEST';
    category: 'CUTI' | 'IZIN' | 'SAKIT';
    requestId: string;
    label: string;
    reason: string;
    startDate: string;
    endDate: string;
    partialDay: boolean;
  } | null;
}

export interface ResolvedMyWorkCalendarMonth {
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    employeeCategory: string;
    branch: { id: string; name: string } | null;
    department: { id: string; name: string } | null;
    position: { id: string; name: string } | null;
  };
  linkedCalendar: {
    id: string;
    name: string;
    year: number;
    scope: 'COMPANY' | 'BRANCH' | 'DEPARTMENT';
  } | null;
  shiftFormula: {
    id: string;
    code: string;
    name: string;
    cycleLength: number;
    startDate: string | null;
  } | null;
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalDays: number;
    workingDays: number;
    offDays: number;
    calendarDays: number;
    shiftDays: number;
    shiftSwapDays: number;
    approvedLeaveDays: number;
    approvedPermissionDays: number;
    approvedSickDays: number;
  };
  days: ResolvedWorkCalendarMonthDay[];
}

interface ShiftOverrideSchedulePayload {
  calendarId: string | null;
  dayType: string;
  workStart: string | null;
  workEnd: string | null;
  isWorkingDay: boolean;
  scheduleSource: 'CALENDAR' | 'SHIFT_FORMULA';
  shiftFormulaId?: string | null;
  shiftFormulaName?: string | null;
  shiftFormulaCode?: string | null;
  crossesMidnight?: boolean;
  label?: string | null;
  notes?: string | null;
}

const DAY_KEYS_BY_INDEX: WorkDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

function normalizeWorkDayRule(value: unknown): WorkDayRule {
  if (typeof value === 'boolean') {
    return { enabled: value, workStart: null, workEnd: null };
  }

  if (value && typeof value === 'object') {
    const rule = value as Record<string, unknown>;
    return {
      enabled: Boolean(rule.enabled),
      workStart: typeof rule.workStart === 'string' ? rule.workStart : null,
      workEnd: typeof rule.workEnd === 'string' ? rule.workEnd : null,
    };
  }

  return { enabled: false, workStart: null, workEnd: null };
}

function normalizeWorkDaysConfig(value: unknown): Record<WorkDayKey, WorkDayRule> {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    mon: normalizeWorkDayRule(raw.mon),
    tue: normalizeWorkDayRule(raw.tue),
    wed: normalizeWorkDayRule(raw.wed),
    thu: normalizeWorkDayRule(raw.thu),
    fri: normalizeWorkDayRule(raw.fri),
    sat: normalizeWorkDayRule(raw.sat),
    sun: normalizeWorkDayRule(raw.sun),
  };
}

function isWorkingDayType(dayType: string) {
  return ['WD', 'WS', 'OT'].includes(dayType);
}

function startOfDateOnly(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function endOfDateOnly(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(23, 59, 59, 999);
  return normalized;
}

function getCalendarScope(calendar: { departmentId?: string | null; branchId?: string | null }) {
  if (calendar.departmentId) return 'DEPARTMENT' as const;
  if (calendar.branchId) return 'BRANCH' as const;
  return 'COMPANY' as const;
}

function toDateKey(date: Date) {
  const normalized = startOfDateOnly(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toDateKeyInTimezone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month = parts.find((part) => part.type === 'month')?.value ?? '01';
  const day = parts.find((part) => part.type === 'day')?.value ?? '01';

  return `${year}-${month}-${day}`;
}

function buildCalendarSchedule(
  calendar: {
    id: string;
    workDays: Prisma.JsonValue;
  },
  date: Date,
  calendarDay?: {
    dayType: string;
    workStart: string | null;
    workEnd: string | null;
    name: string | null;
    notes: string | null;
  } | null
): ResolvedWorkCalendarMonthDay {
  if (calendarDay) {
    return {
      date: toDateKey(date),
      calendarId: calendar.id,
      dayType: calendarDay.dayType,
      workStart: calendarDay.workStart,
      workEnd: calendarDay.workEnd,
      isWorkingDay: isWorkingDayType(calendarDay.dayType),
      scheduleSource: 'CALENDAR',
      shiftFormulaId: null,
      shiftFormulaName: null,
      shiftFormulaCode: null,
      crossesMidnight: false,
      label: calendarDay.name,
      notes: calendarDay.notes,
      absence: null,
      overrideSource: null,
      overrideRequestId: null,
      swappedWithEmployee: null,
    };
  }

  const workDays = normalizeWorkDaysConfig(calendar.workDays);
  const rule = workDays[DAY_KEYS_BY_INDEX[date.getDay()]];

  return {
    date: toDateKey(date),
    calendarId: calendar.id,
    dayType: rule.enabled ? 'WD' : 'WE',
    workStart: rule.enabled ? rule.workStart : null,
    workEnd: rule.enabled ? rule.workEnd : null,
    isWorkingDay: rule.enabled,
    scheduleSource: 'CALENDAR',
    shiftFormulaId: null,
    shiftFormulaName: null,
    shiftFormulaCode: null,
    crossesMidnight: false,
    label: null,
    notes: null,
    absence: null,
    overrideSource: null,
    overrideRequestId: null,
    swappedWithEmployee: null,
  };
}

function buildShiftSchedule(
  formula: {
    id: string;
    code: string;
    name: string;
    days: Array<{
      sequence: number;
      label: string | null;
      dayType: string;
      workStart: string | null;
      workEnd: string | null;
      crossesMidnight: boolean;
    }>;
  },
  startDate: Date,
  date: Date
): ResolvedWorkCalendarMonthDay {
  const normalizedTarget = startOfDateOnly(date);
  const normalizedStart = startOfDateOnly(startDate);
  const diffDays = Math.floor((normalizedTarget.getTime() - normalizedStart.getTime()) / 86400000);
  const rotationIndex = ((diffDays % formula.days.length) + formula.days.length) % formula.days.length;
  const activeDay = formula.days[rotationIndex];

  return {
    date: toDateKey(date),
    calendarId: null,
    dayType: activeDay.dayType,
    workStart: activeDay.workStart,
    workEnd: activeDay.workEnd,
    isWorkingDay: isWorkingDayType(activeDay.dayType),
    scheduleSource: 'SHIFT_FORMULA',
    shiftFormulaId: formula.id,
    shiftFormulaName: formula.name,
    shiftFormulaCode: formula.code,
    crossesMidnight: activeDay.crossesMidnight,
    label: activeDay.label,
    notes: null,
    absence: null,
    overrideSource: null,
    overrideRequestId: null,
    swappedWithEmployee: null,
  };
}

function buildAbsenceCategoryFromPermissionType(type: string): 'IZIN' | 'SAKIT' {
  return type === 'SICK' ? 'SAKIT' : 'IZIN';
}

function applyApprovedAbsence(
  day: ResolvedWorkCalendarMonthDay,
  absence: ResolvedWorkCalendarMonthDay['absence']
) {
  return {
    ...day,
    absence,
  };
}

function toShiftOverridePayload(
  schedule: ResolvedEmployeeDaySchedule | ResolvedWorkCalendarMonthDay
): ShiftOverrideSchedulePayload {
  return {
    calendarId: schedule.calendarId,
    dayType: schedule.dayType,
    workStart: schedule.workStart ?? null,
    workEnd: schedule.workEnd ?? null,
    isWorkingDay: schedule.isWorkingDay,
    scheduleSource: schedule.scheduleSource,
    shiftFormulaId: schedule.shiftFormulaId ?? null,
    shiftFormulaName: schedule.shiftFormulaName ?? null,
    shiftFormulaCode: schedule.shiftFormulaCode ?? null,
    crossesMidnight: schedule.crossesMidnight ?? false,
    label: schedule.label ?? null,
    notes: schedule.notes ?? null,
  };
}

function parseShiftOverridePayload(value: Prisma.JsonValue): ShiftOverrideSchedulePayload {
  const payload = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};

  return {
    calendarId: typeof payload.calendarId === 'string' ? payload.calendarId : null,
    dayType: typeof payload.dayType === 'string' ? payload.dayType : 'WE',
    workStart: typeof payload.workStart === 'string' ? payload.workStart : null,
    workEnd: typeof payload.workEnd === 'string' ? payload.workEnd : null,
    isWorkingDay: Boolean(payload.isWorkingDay),
    scheduleSource: payload.scheduleSource === 'SHIFT_FORMULA' ? 'SHIFT_FORMULA' : 'CALENDAR',
    shiftFormulaId: typeof payload.shiftFormulaId === 'string' ? payload.shiftFormulaId : null,
    shiftFormulaName: typeof payload.shiftFormulaName === 'string' ? payload.shiftFormulaName : null,
    shiftFormulaCode: typeof payload.shiftFormulaCode === 'string' ? payload.shiftFormulaCode : null,
    crossesMidnight: Boolean(payload.crossesMidnight),
    label: typeof payload.label === 'string' ? payload.label : null,
    notes: typeof payload.notes === 'string' ? payload.notes : null,
  };
}

function buildShiftOverrideSchedule(
  date: Date,
  override: {
    overrideSchedule: Prisma.JsonValue;
    notes: string | null;
    shiftSwapRequestId: string | null;
  },
  counterpart?: {
    id: string;
    fullName: string;
    employeeNumber: string;
  } | null
): ResolvedWorkCalendarMonthDay {
  const schedule = parseShiftOverridePayload(override.overrideSchedule);
  const swapNotes = counterpart
    ? `Tukar shift dengan ${counterpart.fullName} (${counterpart.employeeNumber})`
    : null;

  return {
    date: toDateKey(date),
    calendarId: schedule.calendarId,
    dayType: schedule.dayType,
    workStart: schedule.workStart,
    workEnd: schedule.workEnd,
    isWorkingDay: schedule.isWorkingDay,
    scheduleSource: schedule.scheduleSource,
    shiftFormulaId: schedule.shiftFormulaId ?? null,
    shiftFormulaName: schedule.shiftFormulaName ?? null,
    shiftFormulaCode: schedule.shiftFormulaCode ?? null,
    crossesMidnight: schedule.crossesMidnight ?? false,
    label: schedule.label ?? 'Tukar Shift',
    notes: [schedule.notes, override.notes, swapNotes].filter(Boolean).join(' • ') || null,
    absence: null,
    overrideSource: 'SHIFT_SWAP',
    overrideRequestId: override.shiftSwapRequestId,
    swappedWithEmployee: counterpart ?? null,
  };
}

function validateShiftFormulaDays(days: Array<{
  sequence: number;
  label?: string;
  dayType: string;
  workStart?: string | null;
  workEnd?: string | null;
  crossesMidnight?: boolean;
}>) {
  const sorted = [...days].sort((left, right) => left.sequence - right.sequence);

  if (sorted.length === 0) {
    throw new BadRequestError('Shift formula harus memiliki minimal 1 hari pola');
  }

  sorted.forEach((day, index) => {
    const expectedSequence = index + 1;
    if (day.sequence !== expectedSequence) {
      throw new BadRequestError('Urutan hari shift formula harus berurutan mulai dari 1 tanpa loncat');
    }

    const isWorkingDay = isWorkingDayType(day.dayType);
    if (isWorkingDay && (!day.workStart || !day.workEnd)) {
      throw new BadRequestError(`Hari ke-${day.sequence} wajib memiliki jam masuk dan jam pulang`);
    }

    if (!isWorkingDay && (day.workStart || day.workEnd)) {
      throw new BadRequestError(`Hari non-kerja pada urutan ${day.sequence} tidak boleh memiliki jam kerja`);
    }
  });

  return sorted;
}

export class WorkCalendarRepository {
  // ─── Calendars ───────────────────────────────────────────
  async findAll(companyId: string) {
    return prisma.workCalendar.findMany({
      where: { companyId, deletedAt: null },
      include: {
        _count: { select: { days: true } },
      },
      orderBy: [{ year: 'desc' }, { name: 'asc' }],
    });
  }

  async findById(id: string) {
    return prisma.workCalendar.findFirst({
      where: { id, deletedAt: null },
      include: {
        _count: { select: { days: true } },
      },
    });
  }

  async create(data: CreateCalendarDTO & { createdBy: string }) {
    return prisma.workCalendar.create({ data: data as any });
  }

  async update(id: string, data: UpdateCalendarDTO) {
    return prisma.workCalendar.update({ where: { id }, data });
  }

  async delete(id: string) {
    return prisma.workCalendar.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  // ─── Calendar Days ───────────────────────────────────────
  async findDays(calendarId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);
    return prisma.workCalendarDay.findMany({
      where: {
        calendarId,
        date: { gte: start, lte: end },
      },
      orderBy: { date: 'asc' },
    });
  }

  async bulkUpdateDays(calendarId: string, days: BulkUpdateDaysDTO['days']) {
    // Upsert each day
    const ops = days.map((d) =>
      prisma.workCalendarDay.upsert({
        where: {
          calendarId_date: { calendarId, date: new Date(d.date) },
        },
        create: {
          calendarId,
          date: new Date(d.date),
          dayType: d.dayType,
          name: d.name,
          notes: d.notes,
          workStart: d.workStart,
          workEnd: d.workEnd,
          isMandatory: d.isMandatory,
        },
        update: {
          dayType: d.dayType,
          name: d.name,
          notes: d.notes,
          workStart: d.workStart,
          workEnd: d.workEnd,
          isMandatory: d.isMandatory,
        },
      })
    );
    return prisma.$transaction(ops);
  }

  async generateDefaultDays(calendarId: string, year: number, workDaysConfig: Record<string, unknown>) {
    const workDays = normalizeWorkDaysConfig(workDaysConfig);
    const days: { calendarId: string; date: Date; dayType: string; workStart?: string | null; workEnd?: string | null }[] = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = DAY_KEYS_BY_INDEX[d.getDay()];
      const rule = workDays[dow];
      const isWorkDay = rule.enabled;
      days.push({
        calendarId,
        date: new Date(d),
        dayType: isWorkDay ? 'WD' : 'WE',
        workStart: isWorkDay ? rule.workStart : null,
        workEnd: isWorkDay ? rule.workEnd : null,
      });
    }

    // Bulk create
    await prisma.workCalendarDay.deleteMany({ where: { calendarId } });
    return prisma.workCalendarDay.createMany({ data: days });
  }

  // ─── Copy Calendar ───────────────────────────────────────
  async copyCalendar(sourceId: string, newName: string, targetYear: number) {
    const source = await prisma.workCalendar.findUnique({
      where: { id: sourceId },
      include: { days: true },
    });
    if (!source) return null;

    // Create new calendar
    const newCal = await prisma.workCalendar.create({
      data: {
        companyId: source.companyId,
        branchId: source.branchId,
        departmentId: source.departmentId,
        name: newName || `${source.name} ${targetYear}`,
        year: targetYear,
        workDays: source.workDays as any,
        description: source.description,
        createdBy: source.createdBy,
      },
    });

    // Copy days, shifting dates to new year
    const days = source.days.map((d) => {
      const oldDate = new Date(d.date);
      const newDate = new Date(targetYear, oldDate.getMonth(), oldDate.getDate());
      return {
        calendarId: newCal.id,
        date: newDate,
        dayType: d.dayType,
        name: d.name,
        notes: d.notes,
        workStart: d.workStart,
        workEnd: d.workEnd,
        isMandatory: d.isMandatory,
      };
    });

    if (days.length > 0) {
      await prisma.workCalendarDay.createMany({ data: days });
    }

    return newCal;
  }

  // ─── National Holidays ───────────────────────────────────
  async findAllHolidays(companyId: string, year?: number) {
    const where: Prisma.NationalHolidayWhereInput = { companyId };
    if (year) where.year = year;
    return prisma.nationalHoliday.findMany({
      where,
      orderBy: { date: 'asc' },
    });
  }

  async findHolidayById(id: string) {
    return prisma.nationalHoliday.findUnique({ where: { id } });
  }

  async createHoliday(data: CreateHolidayDTO & { companyId: string }) {
    return prisma.nationalHoliday.create({ data: { ...data, date: new Date(data.date) } as any });
  }

  async updateHoliday(id: string, data: UpdateHolidayDTO) {
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    return prisma.nationalHoliday.update({ where: { id }, data: updateData });
  }

  async deleteHoliday(id: string) {
    return prisma.nationalHoliday.delete({ where: { id } });
  }

  // ─── Shift Formula ────────────────────────────────────────
  async findAllShiftFormulas(companyId: string) {
    return prisma.shiftFormula.findMany({
      where: { companyId, deletedAt: null },
      include: {
        days: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { employees: true },
        },
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async findShiftFormulaById(id: string) {
    return prisma.shiftFormula.findFirst({
      where: { id, deletedAt: null },
      include: {
        days: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async findShiftFormulaByCode(companyId: string, code: string) {
    return prisma.shiftFormula.findFirst({
      where: {
        companyId,
        code,
        deletedAt: null,
      },
    });
  }

  async createShiftFormula(data: CreateShiftFormulaDTO & { createdBy: string; code: string }) {
    const days = validateShiftFormulaDays(data.days);

    return prisma.shiftFormula.create({
      data: {
        companyId: data.companyId,
        code: data.code,
        name: data.name,
        description: data.description,
        createdBy: data.createdBy,
        isActive: data.isActive,
        cycleLength: days.length,
        days: {
          create: days.map((day) => ({
            sequence: day.sequence,
            label: day.label,
            dayType: day.dayType,
            workStart: day.workStart ?? null,
            workEnd: day.workEnd ?? null,
            crossesMidnight: day.crossesMidnight ?? false,
          })),
        },
      },
      include: {
        days: {
          orderBy: { sequence: 'asc' },
        },
        _count: {
          select: { employees: true },
        },
      },
    });
  }

  async updateShiftFormula(id: string, data: UpdateShiftFormulaDTO) {
    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.ShiftFormulaUpdateInput = {};

      if (data.code !== undefined) updateData.code = data.code;
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      if (data.days) {
        const days = validateShiftFormulaDays(data.days);
        updateData.cycleLength = days.length;
        updateData.days = {
          deleteMany: {},
          create: days.map((day) => ({
            sequence: day.sequence,
            label: day.label,
            dayType: day.dayType,
            workStart: day.workStart ?? null,
            workEnd: day.workEnd ?? null,
            crossesMidnight: day.crossesMidnight ?? false,
          })),
        };
      }

      return tx.shiftFormula.update({
        where: { id },
        data: updateData,
        include: {
          days: {
            orderBy: { sequence: 'asc' },
          },
          _count: {
            select: { employees: true },
          },
        },
      });
    });
  }

  async deleteShiftFormula(id: string) {
    return prisma.shiftFormula.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  private async findEmployeeByUserId(userId: string) {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        employee: {
          select: {
            id: true,
            companyId: true,
            branchId: true,
            departmentId: true,
            positionId: true,
            employeeNumber: true,
            fullName: true,
            employeeCategory: true,
            shiftFormulaId: true,
            shiftStartDate: true,
            status: true,
            position: {
              select: {
                id: true,
                code: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!user?.employee) {
      throw new NotFoundError('User tidak terhubung ke data employee');
    }

    return user.employee;
  }

  private async resolveShiftSwapApprover(employee: {
    id: string;
    companyId: string;
    branchId: string | null;
    departmentId: string | null;
  }) {
    if (!employee.branchId || !employee.departmentId) {
      throw new BadRequestError('Pegawai belum memiliki branch atau department untuk alur tukar shift');
    }

    const approver = await prisma.employee.findFirst({
      where: {
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        employeeCategory: 'FACTORY',
        status: 'ACTIVE',
        deletedAt: null,
        id: { not: employee.id },
        position: {
          code: 'OPSL',
        },
      },
      select: {
        id: true,
        fullName: true,
        employeeNumber: true,
        position: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!approver) {
      throw new BadRequestError('Kepala regu untuk tim ini belum tersedia');
    }

    return approver;
  }

  private async resolveBaseScheduleForShiftSwap(employee: {
    id: string;
    companyId: string;
    branchId: string | null;
    departmentId: string | null;
    employeeCategory: string;
  }, date: Date): Promise<ResolvedEmployeeDaySchedule | null> {
    if (employee.employeeCategory === 'FACTORY') {
      const shiftSchedule = await this.resolveShiftFormulaSchedule(employee.id, date);
      if (shiftSchedule) {
        return shiftSchedule;
      }
    }

    return this.findDayScheduleForContext({
      companyId: employee.companyId,
      branchId: employee.branchId,
      departmentId: employee.departmentId,
    }, date);
  }

  async findEmployeeShiftOverrideSchedule(employeeId: string, date: Date): Promise<ResolvedEmployeeDaySchedule | null> {
    const override = await prisma.employeeShiftOverride.findFirst({
      where: {
        employeeId,
        deletedAt: null,
        date: {
          gte: startOfDateOnly(date),
          lte: endOfDateOnly(date),
        },
      },
      include: {
        shiftSwapRequest: {
          select: {
            id: true,
            requesterEmployeeId: true,
            targetEmployeeId: true,
            requesterEmployee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
            targetEmployee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
          },
        },
      },
    });

    if (!override) {
      return null;
    }

    const counterpart = override.shiftSwapRequest
      ? override.shiftSwapRequest.requesterEmployeeId === employeeId
        ? override.shiftSwapRequest.targetEmployee
        : override.shiftSwapRequest.requesterEmployee
      : null;

    return buildShiftOverrideSchedule(date, {
      overrideSchedule: override.overrideSchedule,
      notes: override.notes,
      shiftSwapRequestId: override.shiftSwapRequestId,
    }, counterpart);
  }

  async findShiftSwapCandidatesForUser(userId: string, shiftDate?: string) {
    const employee = await this.findEmployeeByUserId(userId);
    const approver = await this.resolveShiftSwapApprover(employee);

    if (employee.employeeCategory !== 'FACTORY') {
      return {
        requester: employee,
        approver,
        candidates: [],
      };
    }

    const targetDate = shiftDate ? startOfDateOnly(new Date(shiftDate)) : null;

    const candidates = await prisma.employee.findMany({
      where: {
        companyId: employee.companyId,
        branchId: employee.branchId,
        departmentId: employee.departmentId,
        employeeCategory: 'FACTORY',
        status: 'ACTIVE',
        deletedAt: null,
        id: {
          notIn: [employee.id, approver.id],
        },
      },
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        shiftFormulaId: true,
        shiftStartDate: true,
        position: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
      orderBy: [
        { fullName: 'asc' },
      ],
    });

    const requesterSchedule = targetDate
      ? await this.resolveBaseScheduleForShiftSwap(employee, targetDate)
      : null;

    const candidateSchedules = targetDate
      ? await Promise.all(
          candidates.map(async (candidate) => ({
            employeeId: candidate.id,
            schedule: await this.resolveBaseScheduleForShiftSwap({
              id: candidate.id,
              companyId: employee.companyId,
              branchId: employee.branchId,
              departmentId: employee.departmentId,
              employeeCategory: 'FACTORY',
            }, targetDate),
          }))
        )
      : [];

    const candidateScheduleMap = new Map(candidateSchedules.map((entry) => [entry.employeeId, entry.schedule]));

    return {
      requester: {
        ...employee,
        schedule: requesterSchedule,
      },
      approver,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        schedule: candidateScheduleMap.get(candidate.id) ?? null,
      })),
    };
  }

  async findMyShiftSwapRequests(userId: string, status?: string) {
    const employee = await this.findEmployeeByUserId(userId);

    return prisma.shiftSwapRequest.findMany({
      where: {
        requesterEmployeeId: employee.id,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        requesterEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        targetEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        approverEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
      orderBy: [
        { shiftDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async findMyShiftSwapApprovals(userId: string, status?: string) {
    const employee = await this.findEmployeeByUserId(userId);

    return prisma.shiftSwapRequest.findMany({
      where: {
        approverEmployeeId: employee.id,
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
      },
      include: {
        requesterEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        targetEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        approverEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
      orderBy: [
        { status: 'asc' },
        { shiftDate: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async createShiftSwapRequest(userId: string, data: CreateShiftSwapRequestDTO) {
    const requester = await this.findEmployeeByUserId(userId);

    if (requester.employeeCategory !== 'FACTORY') {
      throw new BadRequestError('Request tukar shift hanya tersedia untuk pegawai pabrik');
    }

    const shiftDate = startOfDateOnly(new Date(data.shiftDate));
    const target = await prisma.employee.findFirst({
      where: {
        id: data.targetEmployeeId,
        companyId: requester.companyId,
        branchId: requester.branchId,
        departmentId: requester.departmentId,
        employeeCategory: 'FACTORY',
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        employeeCategory: true,
        fullName: true,
        employeeNumber: true,
      },
    });

    if (!target) {
      throw new BadRequestError('Pegawai tujuan tukar shift tidak ditemukan dalam regu yang sama');
    }

    if (target.id === requester.id) {
      throw new BadRequestError('Pegawai tidak bisa mengajukan tukar shift dengan dirinya sendiri');
    }

    const approver = await this.resolveShiftSwapApprover(requester);

    const [requesterSchedule, targetSchedule, existingPendingRequest, existingOverrides] = await Promise.all([
      this.resolveBaseScheduleForShiftSwap(requester, shiftDate),
      this.resolveBaseScheduleForShiftSwap(target, shiftDate),
      prisma.shiftSwapRequest.findFirst({
        where: {
          deletedAt: null,
          status: 'PENDING',
          shiftDate,
          OR: [
            { requesterEmployeeId: { in: [requester.id, target.id] } },
            { targetEmployeeId: { in: [requester.id, target.id] } },
          ],
        },
        select: { id: true },
      }),
      prisma.employeeShiftOverride.findMany({
        where: {
          employeeId: { in: [requester.id, target.id] },
          deletedAt: null,
          date: shiftDate,
        },
        select: { id: true },
      }),
    ]);

    if (existingPendingRequest) {
      throw new BadRequestError('Sudah ada request tukar shift yang masih pending pada tanggal tersebut');
    }

    if (existingOverrides.length > 0) {
      throw new BadRequestError('Jadwal pada tanggal tersebut sudah memiliki override resmi');
    }

    if (!requesterSchedule || !targetSchedule || !requesterSchedule.isWorkingDay || !targetSchedule.isWorkingDay) {
      throw new BadRequestError('Kedua pegawai harus sama-sama memiliki jadwal kerja aktif pada tanggal tukar shift');
    }

    const isSameSchedule = requesterSchedule.workStart === targetSchedule.workStart
      && requesterSchedule.workEnd === targetSchedule.workEnd
      && requesterSchedule.dayType === targetSchedule.dayType
      && requesterSchedule.shiftFormulaCode === targetSchedule.shiftFormulaCode;

    if (isSameSchedule) {
      throw new BadRequestError('Shift kedua pegawai sama, jadi tidak perlu tukar shift');
    }

    return prisma.shiftSwapRequest.create({
      data: {
        companyId: requester.companyId,
        requesterEmployeeId: requester.id,
        targetEmployeeId: target.id,
        approverEmployeeId: approver.id,
        shiftDate,
        reason: data.reason,
      },
      include: {
        requesterEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        targetEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        approverEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async cancelShiftSwapRequest(userId: string, requestId: string) {
    const employee = await this.findEmployeeByUserId(userId);

    const result = await prisma.shiftSwapRequest.updateMany({
      where: {
        id: requestId,
        requesterEmployeeId: employee.id,
        status: 'PENDING',
        deletedAt: null,
      },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundError('Request tukar shift tidak ditemukan atau sudah diproses');
    }

    return { count: result.count };
  }

  async approveShiftSwapRequest(userId: string, requestId: string, data: ReviewShiftSwapRequestDTO) {
    const approver = await this.findEmployeeByUserId(userId);
    const request = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
        approverEmployeeId: true,
      },
    });

    if (!request || request.approverEmployeeId !== approver.id) {
      throw new NotFoundError('Request tukar shift tidak ditemukan untuk kepala regu ini');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestError('Request tukar shift sudah diproses sebelumnya');
    }

    return this.finalizeShiftSwapApprovalEffects(requestId, userId, approver.id, data.approvalNotes);
  }

  async rejectShiftSwapRequest(userId: string, requestId: string, data: ReviewShiftSwapRequestDTO) {
    const approver = await this.findEmployeeByUserId(userId);
    const request = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: requestId,
        approverEmployeeId: approver.id,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!request) {
      throw new NotFoundError('Request tukar shift tidak ditemukan untuk kepala regu ini');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestError('Request tukar shift sudah diproses sebelumnya');
    }

    return this.finalizeShiftSwapRejectEffects(requestId, userId, data.approvalNotes);
  }

  async findShiftSwapRequestById(id: string) {
    return prisma.shiftSwapRequest.findFirst({
      where: { id, deletedAt: null },
      include: {
        requesterEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        targetEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        approverEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async findDefaultShiftSwapTemplate(companyId: string) {
    return prisma.workflowTemplate.findFirst({
      where: {
        companyId,
        approvalType: 'SHIFT_SWAP',
        resource: 'work-calendar',
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        stages: {
          orderBy: { level: 'asc' },
          include: { conditionRules: true },
        },
      },
    });
  }

  async findWorkflowInstanceByShiftSwapId(requestId: string) {
    return prisma.workflowInstance.findFirst({
      where: {
        referenceType: 'SHIFT_SWAP_REQUEST',
        referenceId: requestId,
      },
      include: {
        steps: { orderBy: { level: 'asc' } },
        logs: { orderBy: { createdAt: 'desc' } },
        template: { select: { id: true, name: true, approvalType: true } },
      },
    });
  }

  async finalizeShiftSwapApprovalEffects(
    requestId: string,
    approverUserId: string,
    approverEmployeeId: string,
    approvalNotes?: string,
  ) {
    const request = await prisma.shiftSwapRequest.findFirst({
      where: {
        id: requestId,
        deletedAt: null,
      },
      include: {
        requesterEmployee: {
          select: {
            id: true,
            companyId: true,
            branchId: true,
            departmentId: true,
            employeeCategory: true,
            fullName: true,
            employeeNumber: true,
          },
        },
        targetEmployee: {
          select: {
            id: true,
            companyId: true,
            branchId: true,
            departmentId: true,
            employeeCategory: true,
            fullName: true,
            employeeNumber: true,
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundError('Request tukar shift tidak ditemukan');
    }

    if (request.status === 'APPROVED') {
      return this.findShiftSwapRequestById(requestId);
    }

    const shiftDate = startOfDateOnly(request.shiftDate);
    const [requesterSchedule, targetSchedule] = await Promise.all([
      this.resolveBaseScheduleForShiftSwap(request.requesterEmployee, shiftDate),
      this.resolveBaseScheduleForShiftSwap(request.targetEmployee, shiftDate),
    ]);

    if (!requesterSchedule || !targetSchedule) {
      throw new BadRequestError('Jadwal shift salah satu pegawai tidak dapat di-resolve');
    }

    return prisma.$transaction(async (tx) => {
      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_date: {
            employeeId: request.requesterEmployeeId,
            date: shiftDate,
          },
        },
        update: {
          companyId: request.companyId,
          shiftSwapRequestId: request.id,
          source: 'SHIFT_SWAP',
          originalSchedule: toShiftOverridePayload(requesterSchedule) as unknown as Prisma.InputJsonValue,
          overrideSchedule: toShiftOverridePayload(targetSchedule) as unknown as Prisma.InputJsonValue,
          notes: approvalNotes ?? null,
          deletedAt: null,
        },
        create: {
          companyId: request.companyId,
          employeeId: request.requesterEmployeeId,
          shiftSwapRequestId: request.id,
          date: shiftDate,
          source: 'SHIFT_SWAP',
          originalSchedule: toShiftOverridePayload(requesterSchedule) as unknown as Prisma.InputJsonValue,
          overrideSchedule: toShiftOverridePayload(targetSchedule) as unknown as Prisma.InputJsonValue,
          notes: approvalNotes ?? null,
        },
      });

      await tx.employeeShiftOverride.upsert({
        where: {
          employeeId_date: {
            employeeId: request.targetEmployeeId,
            date: shiftDate,
          },
        },
        update: {
          companyId: request.companyId,
          shiftSwapRequestId: request.id,
          source: 'SHIFT_SWAP',
          originalSchedule: toShiftOverridePayload(targetSchedule) as unknown as Prisma.InputJsonValue,
          overrideSchedule: toShiftOverridePayload(requesterSchedule) as unknown as Prisma.InputJsonValue,
          notes: approvalNotes ?? null,
          deletedAt: null,
        },
        create: {
          companyId: request.companyId,
          employeeId: request.targetEmployeeId,
          shiftSwapRequestId: request.id,
          date: shiftDate,
          source: 'SHIFT_SWAP',
          originalSchedule: toShiftOverridePayload(targetSchedule) as unknown as Prisma.InputJsonValue,
          overrideSchedule: toShiftOverridePayload(requesterSchedule) as unknown as Prisma.InputJsonValue,
          notes: approvalNotes ?? null,
        },
      });

      return tx.shiftSwapRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          approvalNotes,
          reviewedAt: new Date(),
        },
        include: {
          requesterEmployee: {
            select: { id: true, fullName: true, employeeNumber: true },
          },
          targetEmployee: {
            select: { id: true, fullName: true, employeeNumber: true },
          },
          approverEmployee: {
            select: { id: true, fullName: true, employeeNumber: true },
          },
        },
      });
    });
  }

  async finalizeShiftSwapRejectEffects(
    requestId: string,
    approverUserId: string,
    rejectionNotes?: string,
  ) {
    const request = await prisma.shiftSwapRequest.findFirst({
      where: { id: requestId, deletedAt: null },
      select: { id: true, status: true },
    });

    if (!request) {
      throw new NotFoundError('Request tukar shift tidak ditemukan');
    }

    if (request.status === 'APPROVED' || request.status === 'CANCELLED') {
      throw new BadRequestError('Request tukar shift sudah disetujui/dibatalkan, tidak bisa ditolak ulang');
    }

    return prisma.shiftSwapRequest.update({
      where: { id: request.id },
      data: {
        status: 'REJECTED',
        approvalNotes: rejectionNotes,
        reviewedAt: new Date(),
      },
      include: {
        requesterEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        targetEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
        approverEmployee: {
          select: { id: true, fullName: true, employeeNumber: true },
        },
      },
    });
  }

  async resolveShiftFormulaSchedule(employeeId: string, date: Date): Promise<ResolvedEmployeeDaySchedule | null> {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: {
        companyId: true,
        employeeCategory: true,
        shiftFormulaId: true,
        shiftStartDate: true,
      },
    });

    if (
      !employee ||
      employee.employeeCategory !== 'FACTORY' ||
      !employee.shiftFormulaId ||
      !employee.shiftStartDate
    ) {
      return null;
    }

    const formula = await prisma.shiftFormula.findFirst({
      where: {
        id: employee.shiftFormulaId,
        companyId: employee.companyId,
        deletedAt: null,
        isActive: true,
      },
      include: {
        days: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    if (!formula || formula.days.length === 0) {
      return null;
    }

    const normalizedTarget = startOfDateOnly(date);
    const normalizedStart = startOfDateOnly(employee.shiftStartDate);
    const diffDays = Math.floor((normalizedTarget.getTime() - normalizedStart.getTime()) / 86400000);
    const rotationIndex = ((diffDays % formula.days.length) + formula.days.length) % formula.days.length;
    const activeDay = formula.days[rotationIndex];

    return {
      calendarId: null,
      dayType: activeDay.dayType,
      workStart: activeDay.workStart,
      workEnd: activeDay.workEnd,
      isWorkingDay: isWorkingDayType(activeDay.dayType),
      scheduleSource: 'SHIFT_FORMULA',
      shiftFormulaId: formula.id,
      shiftFormulaName: formula.name,
      shiftFormulaCode: formula.code,
      crossesMidnight: activeDay.crossesMidnight,
      label: activeDay.label,
      notes: null,
      overrideSource: null,
      overrideRequestId: null,
      swappedWithEmployee: null,
    };
  }

  // ─── Working Days Calculation ────────────────────────────
  async countWorkingDays(calendarId: string, start: Date, end: Date) {
    return prisma.workCalendarDay.count({
      where: {
        calendarId,
        date: { gte: start, lte: end },
        dayType: { in: ['WD', 'WS', 'OT'] },
      },
    });
  }

  // ─── Employee Calendar Resolution ────────────────────────
  async findCalendarByContext(context: WorkCalendarResolutionContext) {
    const { companyId, branchId, departmentId } = context;

    if (departmentId) {
      const deptCal = await prisma.workCalendar.findFirst({
        where: { companyId, departmentId, deletedAt: null, isActive: true },
        orderBy: { year: 'desc' },
      });
      if (deptCal) return deptCal;
    }

    if (branchId) {
      const branchCal = await prisma.workCalendar.findFirst({
        where: { companyId, branchId, departmentId: null, deletedAt: null, isActive: true },
        orderBy: { year: 'desc' },
      });
      if (branchCal) return branchCal;
    }

    return prisma.workCalendar.findFirst({
      where: { companyId, branchId: null, departmentId: null, deletedAt: null, isActive: true },
      orderBy: { year: 'desc' },
    });
  }

  async findEmployeeCalendar(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true, branchId: true, departmentId: true },
    });
    if (!employee) return null;

    return this.findCalendarByContext(employee);
  }

  // [Finding #15] Fallback company default calendar: cari work calendar scope COMPANY (tanpa branchId/departmentId) + isActive + tahun terbaru.
  async findCompanyDefaultCalendar(companyId: string) {
    return this.findCalendarByContext({ companyId });
  }

  async findDayScheduleForContext(
    context: WorkCalendarResolutionContext,
    date: Date
  ): Promise<ResolvedEmployeeDaySchedule | null> {
    const calendar = await this.findCalendarByContext(context);
    if (!calendar) return null;

    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const calendarDay = await prisma.workCalendarDay.findFirst({
      where: {
        calendarId: calendar.id,
        date: { gte: start, lte: end },
      },
    });

    if (calendarDay) {
      return {
        calendarId: calendar.id,
        dayType: calendarDay.dayType,
        workStart: calendarDay.workStart,
        workEnd: calendarDay.workEnd,
        isWorkingDay: isWorkingDayType(calendarDay.dayType),
        scheduleSource: 'CALENDAR',
        shiftFormulaId: null,
        shiftFormulaName: null,
        shiftFormulaCode: null,
        crossesMidnight: false,
        label: calendarDay.name,
        notes: calendarDay.notes,
        overrideSource: null,
        overrideRequestId: null,
        swappedWithEmployee: null,
      };
    }

    const workDays = normalizeWorkDaysConfig(calendar.workDays);
    const rule = workDays[DAY_KEYS_BY_INDEX[date.getDay()]];

    return {
      calendarId: calendar.id,
      dayType: rule.enabled ? 'WD' : 'WE',
      workStart: rule.enabled ? rule.workStart : null,
      workEnd: rule.enabled ? rule.workEnd : null,
      isWorkingDay: rule.enabled,
      scheduleSource: 'CALENDAR',
      shiftFormulaId: null,
      shiftFormulaName: null,
      shiftFormulaCode: null,
      crossesMidnight: false,
      label: null,
      notes: null,
      overrideSource: null,
      overrideRequestId: null,
      swappedWithEmployee: null,
    };
  }

  async findEmployeeDaySchedule(employeeId: string, date: Date): Promise<ResolvedEmployeeDaySchedule | null> {
    const overrideSchedule = await this.findEmployeeShiftOverrideSchedule(employeeId, date);
    if (overrideSchedule) {
      return overrideSchedule;
    }

    const shiftSchedule = await this.resolveShiftFormulaSchedule(employeeId, date);
    if (shiftSchedule) {
      return shiftSchedule;
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true, branchId: true, departmentId: true },
    });
    if (!employee) return null;

    return this.findDayScheduleForContext(employee, date);
  }

  async findResolvedMyWorkCalendarMonth(userId: string, year: number, month: number): Promise<ResolvedMyWorkCalendarMonth> {
    const user = await prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: {
        employeeId: true,
      },
    });

    if (!user?.employeeId) {
      throw new NotFoundError('User tidak terhubung ke data employee');
    }

    const employee = await prisma.employee.findFirst({
      where: { id: user.employeeId, deletedAt: null },
      select: {
        id: true,
        employeeNumber: true,
        fullName: true,
        employeeCategory: true,
        companyId: true,
        branchId: true,
        departmentId: true,
        positionId: true,
        shiftFormulaId: true,
        shiftStartDate: true,
        branch: { select: { id: true, name: true } },
        company: { select: { timezone: true } },
        department: { select: { id: true, name: true } },
        position: { select: { id: true, name: true } },
      },
    });

    if (!employee) {
      throw new NotFoundError('Employee tidak ditemukan untuk user ini');
    }

    const start = startOfDateOnly(new Date(year, month - 1, 1));
    const end = endOfDateOnly(new Date(year, month, 0));
    const calendarTimezone = employee.company.timezone || 'Asia/Jakarta';

    const linkedCalendar = await this.findCalendarByContext({
      companyId: employee.companyId,
      branchId: employee.branchId,
      departmentId: employee.departmentId,
    });

    const shiftFormula = employee.employeeCategory === 'FACTORY' && employee.shiftFormulaId && employee.shiftStartDate
      ? await prisma.shiftFormula.findFirst({
          where: {
            id: employee.shiftFormulaId,
            companyId: employee.companyId,
            deletedAt: null,
            isActive: true,
          },
          include: {
            days: {
              orderBy: { sequence: 'asc' },
            },
          },
        })
      : null;

    if (!linkedCalendar && !shiftFormula) {
      throw new BadRequestError('Belum ada kalender kerja aktif atau formula shift untuk user ini');
    }

    const calendarDays = linkedCalendar
      ? await prisma.workCalendarDay.findMany({
          where: {
            calendarId: linkedCalendar.id,
            date: { gte: start, lte: end },
          },
        })
      : [];

    const shiftOverrides = await prisma.employeeShiftOverride.findMany({
      where: {
        employeeId: employee.id,
        deletedAt: null,
        date: { gte: start, lte: end },
      },
      include: {
        shiftSwapRequest: {
          select: {
            id: true,
            requesterEmployeeId: true,
            targetEmployeeId: true,
            requesterEmployee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
            targetEmployee: {
              select: {
                id: true,
                fullName: true,
                employeeNumber: true,
              },
            },
          },
        },
      },
    });

    const [approvedLeaveRequests, approvedPermissionRequests] = await Promise.all([
      prisma.leaveRequest.findMany({
        where: {
          employeeId: employee.id,
          deletedAt: null,
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          id: true,
          startDate: true,
          endDate: true,
          reason: true,
          leaveType: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      }),
      prisma.permissionRequest.findMany({
        where: {
          employeeId: employee.id,
          status: 'APPROVED',
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: {
          id: true,
          type: true,
          startDate: true,
          endDate: true,
          reason: true,
        },
      }),
    ]);

    const calendarDayMap = new Map(
      calendarDays.map((day) => [
        toDateKeyInTimezone(day.date, calendarTimezone),
        {
          dayType: day.dayType,
          workStart: day.workStart,
          workEnd: day.workEnd,
          name: day.name,
          notes: day.notes,
        },
      ])
    );
    const shiftOverrideMap = new Map(
      shiftOverrides.map((override) => [
        toDateKeyInTimezone(override.date, calendarTimezone),
        override,
      ])
    );

    const days: ResolvedWorkCalendarMonthDay[] = [];
    for (let current = new Date(start); current <= end; current.setDate(current.getDate() + 1)) {
      const currentDate = new Date(current);
      const dateKey = toDateKey(currentDate);
      let resolvedDay: ResolvedWorkCalendarMonthDay;
      const matchedOverride = shiftOverrideMap.get(dateKey);

      if (matchedOverride) {
        const counterpart = matchedOverride.shiftSwapRequest
          ? matchedOverride.shiftSwapRequest.requesterEmployeeId === employee.id
            ? matchedOverride.shiftSwapRequest.targetEmployee
            : matchedOverride.shiftSwapRequest.requesterEmployee
          : null;

        resolvedDay = buildShiftOverrideSchedule(currentDate, {
          overrideSchedule: matchedOverride.overrideSchedule,
          notes: matchedOverride.notes,
          shiftSwapRequestId: matchedOverride.shiftSwapRequestId,
        }, counterpart);
      } else if (shiftFormula && employee.shiftStartDate) {
        resolvedDay = buildShiftSchedule(shiftFormula, employee.shiftStartDate, currentDate);
      } else {
        if (!linkedCalendar) {
          throw new BadRequestError('Kalender kerja aktif tidak ditemukan');
        }

        resolvedDay = buildCalendarSchedule(linkedCalendar, currentDate, calendarDayMap.get(dateKey));
      }

      const matchedLeave = approvedLeaveRequests.find((leave) => {
        const startKey = toDateKeyInTimezone(leave.startDate, calendarTimezone);
        const endKey = toDateKeyInTimezone(leave.endDate, calendarTimezone);
        return dateKey >= startKey && dateKey <= endKey;
      });

      if (matchedLeave) {
        days.push(applyApprovedAbsence(resolvedDay, {
          source: 'LEAVE_REQUEST',
          category: 'CUTI',
          requestId: matchedLeave.id,
          label: matchedLeave.leaveType.name,
          reason: matchedLeave.reason,
          startDate: toDateKeyInTimezone(matchedLeave.startDate, calendarTimezone),
          endDate: toDateKeyInTimezone(matchedLeave.endDate, calendarTimezone),
          partialDay: false,
        }));
        continue;
      }

      const matchedPermission = approvedPermissionRequests.find((permission) => {
        const startKey = toDateKeyInTimezone(permission.startDate, calendarTimezone);
        const endKey = toDateKeyInTimezone(permission.endDate, calendarTimezone);
        return dateKey >= startKey && dateKey <= endKey;
      });

      if (matchedPermission) {
        days.push(applyApprovedAbsence(resolvedDay, {
          source: 'PERMISSION_REQUEST',
          category: buildAbsenceCategoryFromPermissionType(matchedPermission.type),
          requestId: matchedPermission.id,
          label: matchedPermission.type === 'SICK' ? 'Izin Sakit' : `Izin ${matchedPermission.type.replace(/_/g, ' ')}`,
          reason: matchedPermission.reason,
          startDate: toDateKeyInTimezone(matchedPermission.startDate, calendarTimezone),
          endDate: toDateKeyInTimezone(matchedPermission.endDate, calendarTimezone),
          partialDay: toDateKeyInTimezone(matchedPermission.startDate, calendarTimezone) === toDateKeyInTimezone(matchedPermission.endDate, calendarTimezone)
            && (matchedPermission.startDate.getHours() !== 0
              || matchedPermission.endDate.getHours() !== 0
              || matchedPermission.startDate.getMinutes() !== 0
              || matchedPermission.endDate.getMinutes() !== 0),
        }));
        continue;
      }

      days.push(resolvedDay);
    }

    const workingDays = days.filter((day) => day.isWorkingDay).length;
    const shiftDays = days.filter((day) => day.scheduleSource === 'SHIFT_FORMULA').length;
    const calendarResolvedDays = days.length - shiftDays;
    const shiftSwapDays = days.filter((day) => day.overrideSource === 'SHIFT_SWAP').length;
    const approvedLeaveDays = days.filter((day) => day.absence?.category === 'CUTI').length;
    const approvedPermissionDays = days.filter((day) => day.absence?.category === 'IZIN').length;
    const approvedSickDays = days.filter((day) => day.absence?.category === 'SAKIT').length;

    return {
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        employeeCategory: employee.employeeCategory,
        branch: employee.branch,
        department: employee.department,
        position: employee.position,
      },
      linkedCalendar: linkedCalendar
        ? {
            id: linkedCalendar.id,
            name: linkedCalendar.name,
            year: linkedCalendar.year,
            scope: getCalendarScope(linkedCalendar),
          }
        : null,
      shiftFormula: shiftFormula
        ? {
            id: shiftFormula.id,
            code: shiftFormula.code,
            name: shiftFormula.name,
            cycleLength: shiftFormula.cycleLength,
            startDate: employee.shiftStartDate ? toDateKey(employee.shiftStartDate) : null,
          }
        : null,
      period: {
        year,
        month,
        startDate: toDateKey(start),
        endDate: toDateKey(end),
      },
      summary: {
        totalDays: days.length,
        workingDays,
        offDays: days.length - workingDays,
        calendarDays: calendarResolvedDays,
        shiftDays,
        shiftSwapDays,
        approvedLeaveDays,
        approvedPermissionDays,
        approvedSickDays,
      },
      days,
    };
  }

  // ─── Team Calendar ───────────────────────────────────────
  async findTeamCalendar(managerId: string, companyId: string, year: number, month: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0);

    const team = await prisma.employee.findMany({
      where: { companyId, deletedAt: null },
      select: { id: true, fullName: true },
      take: 50,
    });

    const attendances = await prisma.attendance.findMany({
      where: {
        companyId,
        date: { gte: start, lte: end },
      },
      select: { employeeId: true, date: true, status: true },
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        companyId,
        status: 'APPROVED',
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { employeeId: true, startDate: true, endDate: true, leaveType: { select: { name: true } } },
    });

    return { team, attendances, leaves };
  }
}

export const workCalendarRepository = new WorkCalendarRepository();
