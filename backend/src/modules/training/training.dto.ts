import { z } from 'zod';

export const createCategorySchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
});

export const createCourseSchema = z.object({
  categoryId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  description: z.string().optional(),
  duration: z.number().int().positive().optional(),
  durationUnit: z.string().optional(),
  provider: z.string().optional(),
  isMandatory: z.boolean().default(false),
});

export const updateCourseSchema = createCourseSchema
  .partial()
  .omit({ companyId: true, code: true })
  .extend({
    categoryId: z.string().uuid().nullable().optional(),
    isActive: z.boolean().optional(),
  });

export const createSessionSchema = z.object({
  courseId: z.string().uuid(),
  trainer: z.string().optional(),
  location: z.string().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  maxParticipants: z.number().int().positive().optional(),
  notes: z.string().optional(),
});

export const createEnrollmentSchema = z.object({
  courseId: z.string().uuid(),
  employeeId: z.string().uuid(),
  companyId: z.string().uuid(),
});

export const updateEnrollmentSchema = z.object({
  status: z.enum(['ENROLLED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'DROPPED']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export type CreateCategoryDTO = z.infer<typeof createCategorySchema>;
export type CreateCourseDTO = z.infer<typeof createCourseSchema>;
export type UpdateCourseDTO = z.infer<typeof updateCourseSchema>;
export type CreateSessionDTO = z.infer<typeof createSessionSchema>;
export type CreateEnrollmentDTO = z.infer<typeof createEnrollmentSchema>;
export type UpdateEnrollmentDTO = z.infer<typeof updateEnrollmentSchema>;
