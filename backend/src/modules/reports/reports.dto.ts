import { z } from 'zod';

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format. Use YYYY-MM-DD');

function withOrderedDateRange<T extends z.ZodRawShape>(shape: T) {
  return z.object(shape).superRefine((value, ctx) => {
    const startDate = 'startDate' in value ? value.startDate : undefined;
    const endDate = 'endDate' in value ? value.endDate : undefined;

    if (typeof startDate === 'string' && typeof endDate === 'string') {
      if (new Date(endDate) < new Date(startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endDate'],
          message: 'endDate must be greater than or equal to startDate',
        });
      }
    }
  });
}

export const headcountReportQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
});

export const attendanceReportQuerySchema = withOrderedDateRange({
  companyId: z.string().uuid().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const leaveReportQuerySchema = withOrderedDateRange({
  companyId: z.string().uuid().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const payrollReportQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
  periodId: z.string().uuid().optional(),
});

export const turnoverReportQuerySchema = withOrderedDateRange({
  companyId: z.string().uuid().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const recruitmentReportQuerySchema = withOrderedDateRange({
  companyId: z.string().uuid().optional(),
  startDate: isoDateSchema,
  endDate: isoDateSchema,
});

export const dashboardSummaryQuerySchema = z.object({
  companyId: z.string().uuid().optional(),
});
