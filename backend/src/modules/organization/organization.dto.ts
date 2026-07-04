import { z } from 'zod';

// ==================== Company Group ====================
export const createGroupSchema = z.object({
  name: z.string().min(2, 'Group name must be at least 2 characters').max(255),
  code: z.string().min(2, 'Group code must be at least 2 characters').max(50).toUpperCase(),
  taxId: z.string().max(50).optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  website: z.string().url().max(500).optional(),
});

export const updateGroupSchema = createGroupSchema.partial();

// ==================== Company ====================
export const createCompanySchema = z.object({
  groupId: z.string().uuid(),
  name: z.string().min(2, 'Company name must be at least 2 characters').max(255),
  code: z.string().min(2, 'Company code must be at least 2 characters').max(50).toUpperCase(),
  taxId: z.string().max(50).optional(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  website: z.string().url().max(500).optional(),
  timezone: z.string().max(50).default('Asia/Jakarta'),
  dateFormat: z.string().max(20).default('DD/MM/YYYY'),
  fiscalYearStart: z.string().max(5).default('01-01'),
  currency: z.string().max(10).default('IDR'),
});

export const updateCompanySchema = createCompanySchema.partial().omit({ groupId: true });

// ==================== Branch ====================
export const createBranchSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  address: z.string().optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().max(255).optional(),
  timezone: z.string().max(50).default('Asia/Jakarta'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const updateBranchSchema = createBranchSchema.partial().omit({ companyId: true });

export const branchAttendancePolicyMethodSchema = z.enum(['FINGERPRINT', 'MOBILE_GPS', 'BOTH', 'MANUAL']);
export const branchOutsideRadiusActionSchema = z.enum(['REJECT', 'FLAG', 'REVIEW']);

export const upsertBranchAttendancePolicySchema = z.object({
  attendanceMethod: branchAttendancePolicyMethodSchema,
  gpsLatitude: z.number().min(-90).max(90).optional(),
  gpsLongitude: z.number().min(-180).max(180).optional(),
  gpsRadiusMeters: z.number().int().min(1).max(100000).optional(),
  allowOutsideRadius: z.boolean().optional(),
  outsideRadiusAction: branchOutsideRadiusActionSchema.optional(),
  lateToleranceMinutes: z.number().int().min(0).max(1440).optional(),
  earlyCheckoutToleranceMinutes: z.number().int().min(0).max(1440).optional(),
  allowHolidayAttendance: z.boolean().optional(),
  allowWeekendAttendance: z.boolean().optional(),
  autoAbsentEnabled: z.boolean().optional(),
  autoCheckoutEnabled: z.boolean().optional(),
  requiresSelfie: z.boolean().optional(),
  requiresLocation: z.boolean().optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
});

// ==================== Division ====================
export const createDivisionSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  headId: z.string().uuid().optional(),
  description: z.string().optional(),
});

export const updateDivisionSchema = createDivisionSchema.partial().omit({ companyId: true });

// ==================== Department ====================
export const createDepartmentSchema = z.object({
  divisionId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  parentId: z.string().uuid().optional(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  headId: z.string().uuid().optional(),
  description: z.string().optional(),
  costCenter: z.string().max(50).optional(),
});

export const updateDepartmentSchema = createDepartmentSchema.partial().omit({ companyId: true });

// ==================== SubDepartment ====================
export const createSubDepartmentSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  headId: z.string().uuid().optional(),
  description: z.string().optional(),
});

export const updateSubDepartmentSchema = createSubDepartmentSchema.partial().omit({ departmentId: true });

// ==================== Position ====================
export const createPositionSchema = z.object({
  departmentId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  name: z.string().min(2).max(255),
  code: z.string().min(2).max(50).toUpperCase(),
  gradeLevel: z.number().int().min(1).max(99).optional(),
  minSalary: z.number().min(0).optional(),
  maxSalary: z.number().min(0).optional(),
  reportsToId: z.string().uuid().optional(),
  description: z.string().optional(),
  requirements: z.string().optional(),
});

export const updatePositionSchema = createPositionSchema.partial().omit({ companyId: true });

// Types
export type CreateGroupDTO = z.infer<typeof createGroupSchema>;
export type UpdateGroupDTO = z.infer<typeof updateGroupSchema>;
export type CreateCompanyDTO = z.infer<typeof createCompanySchema>;
export type UpdateCompanyDTO = z.infer<typeof updateCompanySchema>;
export type CreateBranchDTO = z.infer<typeof createBranchSchema>;
export type UpdateBranchDTO = z.infer<typeof updateBranchSchema>;
export type UpsertBranchAttendancePolicyDTO = z.infer<typeof upsertBranchAttendancePolicySchema>;
export type CreateDivisionDTO = z.infer<typeof createDivisionSchema>;
export type UpdateDivisionDTO = z.infer<typeof updateDivisionSchema>;
export type CreateDepartmentDTO = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDTO = z.infer<typeof updateDepartmentSchema>;
export type CreateSubDepartmentDTO = z.infer<typeof createSubDepartmentSchema>;
export type UpdateSubDepartmentDTO = z.infer<typeof updateSubDepartmentSchema>;
export type CreatePositionDTO = z.infer<typeof createPositionSchema>;
export type UpdatePositionDTO = z.infer<typeof updatePositionSchema>;
