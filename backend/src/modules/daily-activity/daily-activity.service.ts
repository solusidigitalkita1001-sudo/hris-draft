import { dailyActivityRepository } from './daily-activity.repository';
import prisma from '@/shared/database/prisma';
import {
  validateOverlapHours,
  validateActivityGeoRadius,
  calculateTotalMinutes,
  type DailyActivityRow,
} from '@/shared/operations/daily-activity';
import {
  getRequestContext,
  getCurrentCompanyId,
  getCurrentRoles,
} from '@/shared/context/RequestContext';
import { logger } from '@/shared/logger/WinstonLogger';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ValidationError,
} from '@/shared/exceptions/AppError';
import type {
  CreateDailyActivityDTO,
  UpdateDailyActivityDTO,
  CompleteDailyActivityDTO,
  ListDailyActivitiesDTO,
} from './daily-activity.dto';
import type { DailyActivityType } from '@prisma/client';

const EMPLOYEE_ELEVATED_HR_ROLES = [
  'HR_STAFF',
  'HR_MANAGER',
  'COMPANY_ADMIN',
  'GROUP_ADMIN',
  'SUPER_ADMIN',
];

export class DailyActivityService {
  async findAll(companyId: string, filters: ListDailyActivitiesDTO) {
    return dailyActivityRepository.findAllCompany(companyId, {
      employeeId: filters.employeeId,
      branchId: filters.branchId,
      activityType: filters.activityType as DailyActivityType | undefined,
      startDate: filters.startDate,
      endDate: filters.endDate,
    });
  }

  async findMyActivities(employeeId: string, startDate?: Date, endDate?: Date) {
    return dailyActivityRepository.findMyActivities(employeeId, startDate, endDate);
  }

  async findById(id: string) {
    const activity = await dailyActivityRepository.findById(id);
    if (!activity) throw new NotFoundError('Daily activity tidak ditemukan');

    const currentCompanyId = getCurrentCompanyId();
    const roles = getCurrentRoles();
    const isAdmin = roles.includes('SUPER_ADMIN') || roles.includes('GROUP_ADMIN');
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId && ctx.user.employeeId === activity.employeeId;

    if (!isAdmin && currentCompanyId && activity.companyId !== currentCompanyId) {
      throw new NotFoundError('Daily activity tidak ditemukan');
    }
    if (!isAdmin && !mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Anda tidak memiliki akses daily activity ini');
    }
    return activity;
  }

  async createRequest(data: CreateDailyActivityDTO) {
    const ctx = getRequestContext();
    const user = ctx?.user;
    const roles = user?.roles ?? [];
    const hasElevatedRole = roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r));

    let employeeId = data.employeeId;
    if (user?.employeeId && roles.includes('EMPLOYEE') && !hasElevatedRole) {
      employeeId = user.employeeId;
      if (data.employeeId && data.employeeId !== employeeId) {
        throw new ForbiddenError('Role EMPLOYEE tidak bisa input daily activity atas nama karyawan lain');
      }
    }
    if (!employeeId) throw new BadRequestError('employeeId wajib diisi');

    const finalCompanyId = user?.companyId ?? getCurrentCompanyId();
    if (!finalCompanyId) throw new BadRequestError('companyId tidak ditemukan dalam context');

    if (data.endTime.getTime() <= data.startTime.getTime()) {
      throw new ValidationError('Waktu selesai harus lebih besar dari waktu mulai');
    }

    const branch = await prisma.branch.findFirst({
      where: { id: data.branchId, companyId: finalCompanyId },
      select: { id: true, name: true, latitude: true, longitude: true },
    });
    if (!branch) throw new NotFoundError('Branch / site yang dipilih tidak ditemukan di company Anda');

    const geoResult = validateActivityGeoRadius(
      { latitude: data.latitude, longitude: data.longitude },
      { latitude: branch.latitude, longitude: branch.longitude, radiusMeters: null },
      200,
    );

    const durationMinutes = calculateTotalMinutes(data.startTime, data.endTime);
    if (durationMinutes <= 0) {
      throw new ValidationError('Durasi aktivitas harus lebih dari 0 menit');
    }

    const activityDateOnly = new Date(data.activityDate);
    activityDateOnly.setHours(0, 0, 0, 0);
    const nextDay = new Date(activityDateOnly);
    nextDay.setDate(nextDay.getDate() + 1);

    const existingToday = await dailyActivityRepository.findByEmployeeAndDateRange(
      finalCompanyId,
      employeeId,
      activityDateOnly,
      nextDay,
    );

    const newActivityRow: DailyActivityRow = {
      activityType: data.activityType,
      startTime: data.startTime,
      endTime: data.endTime,
      durationMinutes,
      latitude: data.latitude,
      longitude: data.longitude,
    };

    for (const existing of existingToday) {
      const existingRow: DailyActivityRow = {
        id: existing.id,
        employeeId: existing.employeeId,
        activityType: existing.activityType as DailyActivityRow['activityType'],
        startTime: existing.startTime,
        endTime: existing.endTime,
        durationMinutes: existing.durationMinutes,
        latitude: Number(existing.latitude ?? 0),
        longitude: Number(existing.longitude ?? 0),
      };
      const overlap = validateOverlapHours(existingRow, newActivityRow);
      if (overlap.overlaps) {
        throw new ValidationError(
          `Waktu aktivitas bertabrakan dengan aktivitas lain di hari yang sama (overlap ${overlap.overlapMinutes} menit). Silakan ubah waktu mulai atau selesai.`,
        );
      }
    }

    const created = await dailyActivityRepository.create({
      ...data,
      companyId: finalCompanyId,
      employeeId,
      durationMinutes,
      isOutsideRadius: !geoResult.isWithinRadius,
      distanceFromBranchMeters: geoResult.hasActivityGeo && geoResult.hasBranchGeo ? geoResult.distanceMeters : undefined,
    });

    logger.info('Daily activity created', {
      activityId: created.id,
      employeeId,
      branchId: data.branchId,
      durationMinutes,
      isOutsideRadius: !geoResult.isWithinRadius,
      distanceMeters: geoResult.distanceMeters,
    });
    return created;
  }

  async updateRequest(id: string, dto: UpdateDailyActivityDTO) {
    const activity = await this.findById(id);
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId === activity.employeeId;
    const roles = ctx?.user?.roles ?? [];
    if (!mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Hanya pembuat aktivitas atau HR / Admin yang bisa mengupdate');
    }

    let durationMinutes: number | undefined;
    if (dto.startTime || dto.endTime) {
      const newStart = dto.startTime ?? activity.startTime;
      const newEnd = dto.endTime ?? activity.endTime;
      if (newEnd.getTime() <= newStart.getTime()) {
        throw new ValidationError('Waktu selesai harus lebih besar dari waktu mulai');
      }
      durationMinutes = calculateTotalMinutes(newStart, newEnd);
    }

    const updated = await dailyActivityRepository.update(id, {
      ...dto,
      durationMinutes,
    });
    logger.info('Daily activity updated', { activityId: id });
    return updated;
  }

  async completeRequest(id: string, dto: CompleteDailyActivityDTO) {
    const activity = await this.findById(id);
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId === activity.employeeId;
    const roles = ctx?.user?.roles ?? [];
    if (!mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Hanya pembuat aktivitas atau HR / Admin yang bisa menandai selesai');
    }

    const actualEnd = dto.actualEndTime ?? new Date();
    if (actualEnd.getTime() <= activity.startTime.getTime()) {
      throw new ValidationError('Waktu selesai aktual harus lebih besar dari waktu mulai');
    }
    const finalDuration = calculateTotalMinutes(activity.startTime, actualEnd);

    const updated = await dailyActivityRepository.complete(id, actualEnd, finalDuration, dto.notes);
    logger.info('Daily activity completed', { activityId: id, durationMinutes: finalDuration });
    return updated;
  }

  async deleteRequest(id: string) {
    const activity = await this.findById(id);
    const ctx = getRequestContext();
    const mine = ctx?.user?.employeeId === activity.employeeId;
    const roles = ctx?.user?.roles ?? [];
    if (!mine && !roles.some((r) => EMPLOYEE_ELEVATED_HR_ROLES.includes(r))) {
      throw new ForbiddenError('Hanya pembuat aktivitas atau HR / Admin yang bisa menghapus');
    }
    await dailyActivityRepository.delete(id);
    logger.info('Daily activity deleted', { activityId: id });
    return { success: true };
  }
}

export const dailyActivityService = new DailyActivityService();
