import prisma from '@/shared/database/prisma';
import type { CreateDailyActivityDTO, UpdateDailyActivityDTO } from './daily-activity.dto';
import type { DailyActivityType } from '@prisma/client';

type CreateWithMeta = CreateDailyActivityDTO & {
  companyId: string;
  employeeId: string;
  durationMinutes: number;
  isOutsideRadius: boolean;
  distanceFromBranchMeters?: number;
};

export class DailyActivityRepository {
  async create(data: CreateWithMeta) {
    return prisma.dailyActivity.create({
      data: {
        companyId: data.companyId,
        employeeId: data.employeeId,
        branchId: data.branchId,
        activityDate: data.activityDate,
        activityType: data.activityType as DailyActivityType,
        title: data.title,
        description: data.description ?? null,
        photoUrl: data.photoUrl ?? null,
        latitude: data.latitude,
        longitude: data.longitude,
        geoAccuracyMeters: data.geoAccuracyMeters ?? null,
        startTime: data.startTime,
        endTime: data.endTime,
        durationMinutes: data.durationMinutes,
        isOutsideRadius: data.isOutsideRadius,
        distanceFromBranchMeters: data.distanceFromBranchMeters ?? null,
        notes: data.notes ?? null,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async findById(id: string) {
    return prisma.dailyActivity.findFirst({
      where: { id },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true, latitude: true, longitude: true } },
      },
    });
  }

  async findByEmployeeAndDateRange(
    companyId: string,
    employeeId: string | undefined,
    startDate: Date,
    endDate: Date,
  ) {
    return prisma.dailyActivity.findMany({
      where: {
        companyId,
        employeeId: employeeId ?? undefined,
        activityDate: { gte: startDate, lte: endDate },
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ activityDate: 'desc' }, { startTime: 'desc' }],
    });
  }

  async findAllCompany(
    companyId: string,
    filters: {
      employeeId?: string;
      branchId?: string;
      activityType?: DailyActivityType;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    return prisma.dailyActivity.findMany({
      where: {
        companyId,
        employeeId: filters.employeeId ?? undefined,
        branchId: filters.branchId ?? undefined,
        activityType: filters.activityType ?? undefined,
        activityDate:
          filters.startDate || filters.endDate
            ? {
                gte: filters.startDate ?? undefined,
                lte: filters.endDate ?? undefined,
              }
            : undefined,
      },
      include: {
        employee: { select: { id: true, fullName: true, employeeNumber: true, branchId: true, departmentId: true } },
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ activityDate: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findMyActivities(employeeId: string, startDate?: Date, endDate?: Date) {
    return prisma.dailyActivity.findMany({
      where: {
        employeeId,
        activityDate:
          startDate || endDate
            ? {
                gte: startDate ?? undefined,
                lte: endDate ?? undefined,
              }
            : undefined,
      },
      include: {
        branch: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ activityDate: 'desc' }, { startTime: 'desc' }],
    });
  }

  async update(id: string, data: UpdateDailyActivityDTO & { durationMinutes?: number }) {
    return prisma.dailyActivity.update({
      where: { id },
      data: {
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        photoUrl: data.photoUrl ?? undefined,
        notes: data.notes ?? undefined,
        startTime: data.startTime ?? undefined,
        endTime: data.endTime ?? undefined,
        durationMinutes: data.durationMinutes ?? undefined,
      },
    });
  }

  async complete(id: string, actualEndTime: Date, durationMinutes: number, notes?: string) {
    return prisma.dailyActivity.update({
      where: { id },
      data: {
        endTime: actualEndTime,
        durationMinutes,
        notes: notes ?? undefined,
      },
    });
  }

  async delete(id: string) {
    return prisma.dailyActivity.delete({ where: { id } });
  }
}

export const dailyActivityRepository = new DailyActivityRepository();
