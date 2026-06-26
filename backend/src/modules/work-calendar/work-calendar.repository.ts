import { prisma } from '@/shared/database/prisma';
import { Prisma } from '@prisma/client';
import type { CreateCalendarDTO, UpdateCalendarDTO, BulkUpdateDaysDTO, CreateHolidayDTO, UpdateHolidayDTO } from './work-calendar.dto';

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
        },
        update: {
          dayType: d.dayType,
          name: d.name,
          notes: d.notes,
        },
      })
    );
    return prisma.$transaction(ops);
  }

  async generateDefaultDays(calendarId: string, year: number, workDays: Record<string, boolean>) {
    const days: { calendarId: string; date: Date; dayType: string }[] = [];
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const dayMap = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = dayMap[d.getDay()];
      const isWorkDay = workDays[dow] ?? false;
      days.push({
        calendarId,
        date: new Date(d),
        dayType: isWorkDay ? 'WD' : 'WE',
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
