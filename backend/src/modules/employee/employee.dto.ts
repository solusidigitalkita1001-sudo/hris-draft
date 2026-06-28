import { z } from 'zod';

export const createEmployeeSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  subDepartmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  employeeNumber: z.string().min(1).max(50),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  idNumber: z.string().optional(),
  placeOfBirth: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.string().optional(),
  religion: z.string().optional(),
  maritalStatus: z.string().optional(),
  bloodType: z.string().optional(),
  nationality: z.string().default('Indonesia'),
  address: z.string().optional(),
  avatar: z.string().optional(),
  joinDate: z.string().datetime().optional(),
  employmentType: z.enum(['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING']).default('PERMANENT'),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  taxId: z.string().optional(),
  bpjsKetenagakerjaan: z.string().optional(),
  bpjsKesehatan: z.string().optional(),
});

export const updateEmployeeSchema = createEmployeeSchema.partial().omit({ companyId: true, employeeNumber: true });

export const employeeQuerySchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  status: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const createCareerTransactionSchema = z.object({
  effectiveDate: z.string().datetime(),
  transactionType: z.enum([
    'PROMOTION',
    'DEMOTION',
    'MUTATION',
    'TRANSFER',
    'ROTATION',
    'ACTING_ASSIGNMENT',
    'STATUS_CHANGE',
  ]),
  toBranchId: z.string().uuid().optional().nullable(),
  toDepartmentId: z.string().uuid().optional().nullable(),
  toPositionId: z.string().uuid().optional().nullable(),
  toEmploymentType: z.enum(['PERMANENT', 'CONTRACT', 'INTERN', 'PROBATION', 'FREELANCE', 'OUTSOURCING']).optional().nullable(),
  referenceNumber: z.string().max(100).optional(),
  reason: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateEmployeeDTO = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryDTO = z.infer<typeof employeeQuerySchema>;
export type CreateCareerTransactionDTO = z.infer<typeof createCareerTransactionSchema>;
