import { z } from 'zod';
import { Prisma } from '@prisma/client';

// ==================== Salary Components ====================
export const createSalaryComponentSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  type: z.enum(['ALLOWANCE', 'DEDUCTION']),
  calculationMethod: z.enum(['FIXED', 'PERCENTAGE', 'FORMULA']).default('FIXED'),
  amount: z.number().positive().optional(),
  ratePercent: z.number().min(0).max(100).optional(),
  isTaxable: z.boolean().default(true),
  isProrated: z.boolean().default(false),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const updateSalaryComponentSchema = createSalaryComponentSchema.partial().omit({ companyId: true, code: true });

// ==================== Employee Salaries ====================
const salaryMoneySchema = z.number().finite().positive().max(9999999999999.99)
  .refine(value => new Prisma.Decimal(value).decimalPlaces() <= 2, 'Amount must have at most two decimal places');
const salaryDateSchema = z.string().datetime().refine(value => {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value.slice(0, 10);
}, 'Invalid salary effective date');
export const salaryComponentAllocationSchema = z.object({
  salaryComponentId: z.string().uuid(),
  amount: salaryMoneySchema,
});
const salaryAllocationsSchema = z.array(salaryComponentAllocationSchema).max(512)
  .refine(rows => new Set(rows.map(row => row.salaryComponentId)).size === rows.length, 'Salary components must be unique');

export const createEmployeeSalarySchema = z.object({
  employeeId: z.string().uuid(),
  companyId: z.string().uuid().optional(),
  effectiveDate: salaryDateSchema,
  baseSalary: salaryMoneySchema,
  currency: z.literal('IDR').default('IDR'),
  notes: z.string().optional(),
  components: salaryAllocationsSchema.optional(),
});

export const updateEmployeeSalarySchema = z.object({
  baseSalary: salaryMoneySchema.optional(),
  currency: z.literal('IDR').optional(),
  isActive: z.boolean().optional(),
  notes: z.string().optional(),
  effectiveDate: salaryDateSchema.optional(),
  components: salaryAllocationsSchema.optional(),
}).refine(data => Object.values(data).some(value => value !== undefined), 'At least one salary field is required');

// ==================== Payroll Periods ====================
export const createPayrollPeriodSchema = z.object({
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().min(1).max(50).optional(),
  frequency: z.enum(['MONTHLY', 'BIWEEKLY', 'WEEKLY']).default('MONTHLY'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  payDate: z.string().datetime(),
  notes: z.string().optional(),
});

export const updatePayrollPeriodSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  notes: z.string().optional(),
});

// ==================== Payroll Runs ====================
export const createPayrollRunSchema = z.object({
  periodId: z.string().uuid(),
  companyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  notes: z.string().optional(),
});

export const approvePayrollRunSchema = z.object({
  notes: z.string().optional(),
});

// ==================== Standalone Calculation Endpoints (B.1, B.2, B.3) ====================

export const calculatePph21Schema = z.object({
  monthlyGross: z.number().min(0).max(1_000_000_000_000),
  married: z.boolean().default(false),
  dependents: z.number().int().min(0).max(20).default(0),
  monthlyPensionContribution: z.number().min(0).max(1_000_000_000_000).default(0),
  hasNpwp: z.boolean().default(true),
});

export const calculateThrStandaloneSchema = z.object({
  monthlyWage: z.number().min(0).max(1_000_000_000_000),
  joinDate: z.string().datetime(),
  referenceDate: z.string().datetime().optional(),
});

export const calculateBpjsSchema = z.object({
  monthlyWage: z.number().min(0).max(1_000_000_000_000),
  jkkRiskClass: z.enum(['I','II','III','IV','V']).default('I'),
  customRates: z.object({
    jkkRatePercent: z.number().min(0).max(100).optional(),
    jkmRatePercent: z.number().min(0).max(100).optional(),
    jhtEmployerPercent: z.number().min(0).max(100).optional(),
    jhtEmployeePercent: z.number().min(0).max(100).optional(),
    jpEmployerPercent: z.number().min(0).max(100).optional(),
    jpEmployeePercent: z.number().min(0).max(100).optional(),
    jpWageCap: z.number().min(0).max(1_000_000_000_000).optional(),
    jknEmployerPercent: z.number().min(0).max(100).optional(),
    jknEmployeePercent: z.number().min(0).max(100).optional(),
    jknWageCap: z.number().min(0).max(1_000_000_000_000).optional(),
  }).optional(),
});

export const calculateJknSchema = z.object({
  monthlyWage: z.number().min(0).max(1_000_000_000_000),
  customRates: z.object({
    jknEmployerPercent: z.number().min(0).max(100).optional(),
    jknEmployeePercent: z.number().min(0).max(100).optional(),
    jknWageCap: z.number().min(0).max(1_000_000_000_000).optional(),
  }).optional(),
});

// ==================== Type Inference ====================
export type CreateSalaryComponentDTO = z.infer<typeof createSalaryComponentSchema>;
export type UpdateSalaryComponentDTO = z.infer<typeof updateSalaryComponentSchema>;
export type SalaryComponentAllocationDTO = z.infer<typeof salaryComponentAllocationSchema>;
export type CreateEmployeeSalaryDTO = z.infer<typeof createEmployeeSalarySchema>;
export type UpdateEmployeeSalaryDTO = z.infer<typeof updateEmployeeSalarySchema>;
export type CreatePayrollPeriodDTO = z.infer<typeof createPayrollPeriodSchema>;
export type UpdatePayrollPeriodDTO = z.infer<typeof updatePayrollPeriodSchema>;
export type CreatePayrollRunDTO = z.infer<typeof createPayrollRunSchema>;
export type ApprovePayrollRunDTO = z.infer<typeof approvePayrollRunSchema>;
export type CalculatePph21DTO = z.infer<typeof calculatePph21Schema>;
export type CalculateThrStandaloneDTO = z.infer<typeof calculateThrStandaloneSchema>;
export type CalculateBpjsDTO = z.infer<typeof calculateBpjsSchema>;
export type CalculateJknDTO = z.infer<typeof calculateJknSchema>;
