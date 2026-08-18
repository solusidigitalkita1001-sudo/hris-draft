import { z } from 'zod';

const uuid = z.string().uuid('Invalid UUID format');

export const upsertRoleMenuAccessSchema = z.object({
  companyId: uuid,
  roleCode: z.string().min(1, 'Role code is required'),
  menuPath: z.string().min(1, 'Menu path is required'),
  accessType: z.enum(['ALLOW', 'DENY']).default('ALLOW'),
});

export const bulkUpsertRoleMenuAccessSchema = z.object({
  companyId: uuid,
  roleCode: z.string().min(1, 'Role code is required'),
  items: z.array(
    upsertRoleMenuAccessSchema.omit({ companyId: true, roleCode: true })
  ),
});

export const upsertRoleDataScopeSchema = z.object({
  companyId: uuid,
  roleCode: z.string().min(1, 'Role code is required'),
  resource: z.string().min(1).default('ALL'),
  scopeType: z.enum([
    'ALL',
    'COMPANY_ONLY',
    'BRANCH_ONLY',
    'DEPARTMENT_ONLY',
    'SUB_DEPARTMENT_ONLY',
    'EMPLOYEE_SELF',
    'MANAGER_TEAM',
  ]),
  scopeValue: z.string().optional(),
});

export const getMyMenuAccessSchema = z.object({
  companyId: uuid,
});

export const getMyDataScopeSchema = z.object({
  companyId: uuid,
  resource: z.string().min(1).default('ALL').optional(),
});

export type UpsertRoleMenuAccessDTO = z.infer<typeof upsertRoleMenuAccessSchema>;
export type BulkUpsertRoleMenuAccessDTO = z.infer<typeof bulkUpsertRoleMenuAccessSchema>;
export type UpsertRoleDataScopeDTO = z.infer<typeof upsertRoleDataScopeSchema>;
export type GetMyMenuAccessDTO = z.infer<typeof getMyMenuAccessSchema>;
export type GetMyDataScopeDTO = z.infer<typeof getMyDataScopeSchema>;
