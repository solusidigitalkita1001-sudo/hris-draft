import { z } from 'zod';
import type { DailyActivityType } from '@/shared/operations/daily-activity';

const DAILY_ACTIVITY_TYPES: readonly [DailyActivityType, ...DailyActivityType[]] = [
  'WORK',
  'SITE_VISIT',
  'SITE_INSPECTION',
  'MEETING',
  'OTHER',
];

export const createDailyActivitySchema = z.object({
  employeeId: z.string().min(1).optional(),
  branchId: z.string().min(1, { message: 'Lokasi site / branch wajib dipilih' }),
  activityDate: z.coerce.date({ required_error: 'Tanggal aktivitas wajib diisi' }),
  activityType: z.enum(DAILY_ACTIVITY_TYPES, { required_error: 'Tipe aktivitas wajib dipilih' }).default('WORK'),
  title: z.string().min(3, { message: 'Judul aktivitas minimal 3 karakter' }),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
  latitude: z.coerce.number({ required_error: 'Latitude GPS wajib diisi' }),
  longitude: z.coerce.number({ required_error: 'Longitude GPS wajib diisi' }),
  geoAccuracyMeters: z.coerce.number().min(0).optional(),
  startTime: z.coerce.date({ required_error: 'Waktu mulai wajib diisi' }),
  endTime: z.coerce.date({ required_error: 'Waktu selesai wajib diisi' }),
  notes: z.string().optional(),
});

export const updateDailyActivitySchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().optional(),
  photoUrl: z.string().optional(),
  notes: z.string().optional(),
  startTime: z.coerce.date().optional(),
  endTime: z.coerce.date().optional(),
});

export const completeDailyActivitySchema = z.object({
  actualEndTime: z.coerce.date().optional(),
  notes: z.string().optional(),
});

export const listDailyActivitiesSchema = z.object({
  employeeId: z.string().optional(),
  branchId: z.string().optional(),
  activityType: z.enum(DAILY_ACTIVITY_TYPES).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type CreateDailyActivityDTO = z.infer<typeof createDailyActivitySchema>;
export type UpdateDailyActivityDTO = z.infer<typeof updateDailyActivitySchema>;
export type CompleteDailyActivityDTO = z.infer<typeof completeDailyActivitySchema>;
export type ListDailyActivitiesDTO = z.infer<typeof listDailyActivitiesSchema>;
