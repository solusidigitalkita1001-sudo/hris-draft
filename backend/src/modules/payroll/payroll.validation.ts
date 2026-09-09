import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const employeeSalaryListQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});
export const employeeThrParamSchema = z.object({ employeeId: z.string().uuid() });
const calendarDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const employeeThrQuerySchema = z.object({
  date: z.union([calendarDateSchema, z.string().datetime({ offset: true })]).optional(),
});

export const payrollRunIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const payslipIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const periodIdParamSchema = z.object({
  periodId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  status: z.string().optional(),
  employeeId: z.string().uuid().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
