import { z } from 'zod';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);

const workDayRuleSchema = z.union([
  z.boolean(),
  z.object({
    enabled: z.boolean(),
    workStart: timeSchema.nullable().optional(),
    workEnd: timeSchema.nullable().optional(),
  }),
]);

export const createCalendarSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  year: z.number().int().min(2000).max(2100),
  workDays: z.object({
    mon: workDayRuleSchema,
    tue: workDayRuleSchema,
    wed: workDayRuleSchema,
    thu: workDayRuleSchema,
    fri: workDayRuleSchema,
    sat: workDayRuleSchema.default(false),
    sun: workDayRuleSchema.default(false),
  }),
  description: z.string().optional(),
});

export const updateCalendarSchema = createCalendarSchema.partial();

export const updateDaySchema = z.object({
  dayType: z.enum(['WD', 'WS', 'WE', 'NH', 'JL', 'CH', 'RH', 'OT']),
  name: z.string().max(150).optional(),
  notes: z.string().optional(),
  workStart: timeSchema.nullable().optional(),
  workEnd: timeSchema.nullable().optional(),
  isMandatory: z.boolean().optional(),
});

export const bulkUpdateDaysSchema = z.object({
  days: z.array(z.object({
    date: z.string(), // YYYY-MM-DD
    dayType: z.enum(['WD', 'WS', 'WE', 'NH', 'JL', 'CH', 'RH', 'OT']),
    name: z.string().max(150).optional(),
    notes: z.string().optional(),
    workStart: timeSchema.nullable().optional(),
    workEnd: timeSchema.nullable().optional(),
    isMandatory: z.boolean().optional(),
  })),
});

export const createHolidaySchema = z.object({
  date: z.string(), // YYYY-MM-DD
  name: z.string().min(1).max(150),
  type: z.enum(['NH', 'JL']),
  year: z.number().int(),
  source: z.string().max(100).optional(),
});

export const updateHolidaySchema = createHolidaySchema.partial();

export const copyCalendarSchema = z.object({
  targetYear: z.number().int().min(2000).max(2100),
  name: z.string().min(1).max(100).optional(),
});

export type CreateCalendarDTO = z.infer<typeof createCalendarSchema>;
export type UpdateCalendarDTO = z.infer<typeof updateCalendarSchema>;
export type UpdateDayDTO = z.infer<typeof updateDaySchema>;
export type BulkUpdateDaysDTO = z.infer<typeof bulkUpdateDaysSchema>;
export type CreateHolidayDTO = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayDTO = z.infer<typeof updateHolidaySchema>;
export type CopyCalendarDTO = z.infer<typeof copyCalendarSchema>;
