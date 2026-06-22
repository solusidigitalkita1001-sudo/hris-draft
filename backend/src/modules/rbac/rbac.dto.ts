import { z } from 'zod';

export const createRoleSchema = z.object({
  companyId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  name: z.string().min(2, 'Role name must be at least 2 characters').max(255),
  code: z.string().min(2, 'Role code must be at least 2 characters').max(50).toUpperCase(),
  description: z.string().optional(),
  scope: z.enum(['GLOBAL', 'GROUP', 'COMPANY']).default('COMPANY'),
  priority: z.number().int().min(0).default(0),
});

export const updateRoleSchema = createRoleSchema.partial();

export const assignPermissionsSchema = z.object({
  permissionIds: z.array(z.string().uuid()).min(1, 'At least one permission is required'),
});

export const assignUserRolesSchema = z.object({
  roleIds: z.array(z.string().uuid()).min(1, 'At least one role is required'),
  companyId: z.string().uuid().optional(),
  groupId: z.string().uuid().optional(),
  scopeType: z.enum(['GLOBAL', 'GROUP', 'COMPANY']).default('COMPANY'),
});

export type CreateRoleDTO = z.infer<typeof createRoleSchema>;
export type UpdateRoleDTO = z.infer<typeof updateRoleSchema>;
export type AssignPermissionsDTO = z.infer<typeof assignPermissionsSchema>;
export type AssignUserRolesDTO = z.infer<typeof assignUserRolesSchema>;
