import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateCalendarDTO, UpdateCalendarDTO, BulkUpdateDaysDTO, CreateHolidayDTO, UpdateHolidayDTO } from './work-calendar.dto';

type WorkDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

interface WorkDayRule {
  enabled: boolean;
  workStart: string | null;
  workEnd: string | null;
}

interface ResolvedEmployeeDaySchedule {
  calendarId: string;
  dayType: string;
  workStart: string | null;
  workEnd: string | null;
  isWorkingDay: boolean;
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
  async findEmployeeCalendar(employeeId: string) {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { companyId: true, branchId: true, departmentId: true },
    });
    if (!employee) return null;

    // Hierarchy: try employee-level first, then department, branch, company
    const { companyId, branchId, departmentId } = employee;

    // Try department calendar
    if (departmentId) {
      const deptCal = await prisma.workCalendar.findFirst({
        where: { companyId, departmentId, deletedAt: null, isActive: true },
        orderBy: { year: 'desc' },
      });
      if (deptCal) return deptCal;
    }

    // Try branch calendar
    if (branchId) {
      const branchCal = await prisma.workCalendar.findFirst({
        where: { companyId, branchId, departmentId: null, deletedAt: null, isActive: true },
        orderBy: { year: 'desc' },
      });
      if (branchCal) return branchCal;
    }

    // Fallback to company calendar
    return prisma.workCalendar.findFirst({
      where: { companyId, branchId: null, departmentId: null, deletedAt: null, isActive: true },
      orderBy: { year: 'desc' },
    });
  }

  async findEmployeeDaySchedule(employeeId: string, date: Date): Promise<ResolvedEmployeeDaySchedule | null> {
    const calendar = await this.findEmployeeCalendar(employeeId);
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
