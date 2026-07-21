import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  employeeId: z.string().uuid().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  employeeId: z.string().uuid().optional().nullable(),
});

export const createUserCompanyAccessSchema = z.object({
  companyId: z.string().uuid(),
  groupId: z.string().uuid().optional().nullable(),
  accessScope: z.enum(['GROUP_WIDE', 'SINGLE_COMPANY']).default('SINGLE_COMPANY'),
  roleOverride: z.string().max(50).optional().nullable(),
});

export const updateUserCompanyAccessSchema = z.object({
  companyId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional().nullable(),
  accessScope: z.enum(['GROUP_WIDE', 'SINGLE_COMPANY']).optional(),
  roleOverride: z.string().max(50).optional().nullable(),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
export type UpdateUserDTO = z.infer<typeof updateUserSchema>;
export type CreateUserCompanyAccessDTO = z.infer<typeof createUserCompanyAccessSchema>;
export type UpdateUserCompanyAccessDTO = z.infer<typeof updateUserCompanyAccessSchema>;
