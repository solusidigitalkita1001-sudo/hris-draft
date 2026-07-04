import { z } from 'zod';

const timeSchema = z.string().regex(/^\d{2}:\d{2}$/);
const dayTypeSchema = z.enum(['WD', 'WS', 'WE', 'NH', 'JL', 'CH', 'RH', 'OT']);

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
  dayType: dayTypeSchema,
  name: z.string().max(150).optional(),
  notes: z.string().optional(),
  workStart: timeSchema.nullable().optional(),
  workEnd: timeSchema.nullable().optional(),
  isMandatory: z.boolean().optional(),
});

export const bulkUpdateDaysSchema = z.object({
  days: z.array(z.object({
    date: z.string(), // YYYY-MM-DD
    dayType: dayTypeSchema,
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

const shiftFormulaDaySchema = z.object({
  sequence: z.number().int().min(1),
  label: z.string().max(100).optional(),
  dayType: dayTypeSchema,
  workStart: timeSchema.nullable().optional(),
  workEnd: timeSchema.nullable().optional(),
  crossesMidnight: z.boolean().optional().default(false),
});

export const createShiftFormulaSchema = z.object({
  companyId: z.string().uuid(),
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  isActive: z.boolean().optional().default(true),
  days: z.array(shiftFormulaDaySchema).min(1),
});

export const updateShiftFormulaSchema = createShiftFormulaSchema.partial().extend({
  days: z.array(shiftFormulaDaySchema).min(1).optional(),
});

export type CreateCalendarDTO = z.infer<typeof createCalendarSchema>;
export type UpdateCalendarDTO = z.infer<typeof updateCalendarSchema>;
export type UpdateDayDTO = z.infer<typeof updateDaySchema>;
export type BulkUpdateDaysDTO = z.infer<typeof bulkUpdateDaysSchema>;
export type CreateHolidayDTO = z.infer<typeof createHolidaySchema>;
export type UpdateHolidayDTO = z.infer<typeof updateHolidaySchema>;
export type CopyCalendarDTO = z.infer<typeof copyCalendarSchema>;
export type CreateShiftFormulaDTO = z.infer<typeof createShiftFormulaSchema>;
export type UpdateShiftFormulaDTO = z.infer<typeof updateShiftFormulaSchema>;
