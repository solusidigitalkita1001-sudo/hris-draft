import { z } from 'zod';
import {
  isValidNIK,
  isValidNPWP,
  isValidBPJSKetenagakerjaan,
  isValidBPJSKesehatan,
  normalizePhoneID,
} from '@/shared/validators/indonesian-identity';

// Normalizes to E.164 (+62...) on input; rejects invalid Indonesian numbers (VAL-001/002).
const phoneField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === '') return v;
    const normalized = normalizePhoneID(v);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nomor HP tidak valid' });
      return z.NEVER;
    }
    return normalized;
  });

export const createEmployeeSchema = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  subDepartmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  employeeNumber: z.string().min(1).max(50).optional(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: phoneField,
  idNumber: z
    .string()
    .refine(isValidNIK, 'NIK harus 16 digit dengan kode provinsi & tanggal lahir valid')
    .optional(),
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
  employeeCategory: z.enum(['OFFICE', 'FACTORY', 'FIELD', 'REMOTE']).default('OFFICE'),
  shiftFormulaId: z.string().uuid().optional().nullable(),
  shiftStartDate: z.string().datetime().optional().nullable(),
  bankName: z.string().optional(),
  bankAccount: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  taxId: z
    .string()
    .refine(isValidNPWP, 'NPWP harus 15 digit (format 9.999.999.9-999.999)')
    .optional(),
  bpjsKetenagakerjaan: z
    .string()
    .refine(isValidBPJSKetenagakerjaan, 'BPJS Ketenagakerjaan harus 11 digit')
    .optional(),
  bpjsKesehatan: z
    .string()
    .refine(isValidBPJSKesehatan, 'BPJS Kesehatan harus 13 digit')
    .optional(),
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

export const createEmployeeCompanyAssignmentSchema = z.object({
  companyId: z.string().uuid(),
  assignmentType: z.enum(['PRIMARY', 'SECONDMENT', 'TRANSFER']).default('PRIMARY'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional().nullable(),
  reason: z.string().optional(),
  approvedBy: z.string().uuid().optional().nullable(),
});

export const updateEmployeeCompanyAssignmentSchema = z.object({
  companyId: z.string().uuid().optional(),
  assignmentType: z.enum(['PRIMARY', 'SECONDMENT', 'TRANSFER']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional().nullable(),
  reason: z.string().optional(),
  approvedBy: z.string().uuid().optional().nullable(),
});

// ============================================================
// Employee Family / Dependent
// ============================================================
export const RELATIONSHIP_OPTIONS = ['SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER'] as const;
export const GENDER_OPTIONS = ['MALE', 'FEMALE'] as const;
export const EDUCATION_LEVELS = ['SD', 'SMP', 'SMA', 'D1', 'D2', 'D3', 'S1', 'S2', 'S3'] as const;

export const createEmployeeFamilySchema = z.object({
  fullName: z.string().min(1).max(255),
  relationship: z.enum(RELATIONSHIP_OPTIONS),
  idNumber: z.string().optional(),
  placeOfBirth: z.string().optional(),
  dateOfBirth: z.string().datetime().optional(),
  gender: z.string().optional(),
  religion: z.string().optional(),
  occupation: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  isEmergencyContact: z.boolean().optional().default(false),
  isDependent: z.boolean().optional().default(true),
  maritalStatus: z.string().optional(),
  educationLevel: z.string().optional(),
  orderSequence: z.number().int().optional().default(0),
});

export const updateEmployeeFamilySchema = createEmployeeFamilySchema.partial();

// ============================================================
// Employee Education
// ============================================================
export const createEmployeeEducationSchema = z.object({
  level: z.enum(EDUCATION_LEVELS),
  institutionName: z.string().min(1).max(255),
  major: z.string().optional(),
  degree: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  isGraduated: z.boolean().optional().default(true),
  gpa: z.number().min(0).max(4).optional(),
  city: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEmployeeEducationSchema = createEmployeeEducationSchema.partial();

// ============================================================
// Employee Emergency Contact
// ============================================================
export const createEmployeeEmergencyContactSchema = z.object({
  fullName: z.string().min(1).max(255),
  relationship: z.string().min(1).max(50),
  phone: z.string().min(1).max(50),
  alternativePhone: z.string().optional(),
  address: z.string().optional(),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const updateEmployeeEmergencyContactSchema = createEmployeeEmergencyContactSchema.partial();

// ============================================================
// Employee Training Record
// ============================================================
export const TRAINING_TYPES = ['INTERNAL', 'EXTERNAL', 'CERTIFICATION', 'SEMINAR', 'WORKSHOP', 'OTHER'] as const;

export const createEmployeeTrainingSchema = z.object({
  trainingName: z.string().min(1).max(255),
  organizer: z.string().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  duration: z.string().optional(),
  trainingType: z.enum(TRAINING_TYPES).optional(),
  description: z.string().optional(),
  certificateUrl: z.string().optional(),
  notes: z.string().optional(),
});

export const updateEmployeeTrainingSchema = createEmployeeTrainingSchema.partial();

// ============================================================
// Employee Skill
// ============================================================
export const SKILL_CATEGORIES = ['TECHNICAL', 'SOFT_SKILL', 'LANGUAGE', 'MANAGEMENT', 'OTHER'] as const;
export const PROFICIENCY_LEVELS = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'] as const;

export const createEmployeeSkillSchema = z.object({
  skillName: z.string().min(1).max(255),
  category: z.enum(SKILL_CATEGORIES).optional(),
  proficiencyLevel: z.enum(PROFICIENCY_LEVELS).optional(),
  yearsOfExperience: z.number().min(0).optional(),
  lastUsedDate: z.string().datetime().optional(),
  isCertified: z.boolean().optional().default(false),
  notes: z.string().optional(),
});

export const updateEmployeeSkillSchema = createEmployeeSkillSchema.partial();

// ============================================================
// Employee Work Experience
// ============================================================
export const createEmployeeExperienceSchema = z.object({
  companyName: z.string().min(1).max(255),
  position: z.string().min(1).max(255),
  startDate: z.string().datetime(),
  endDate: z.string().datetime().optional(),
  isCurrentPosition: z.boolean().optional().default(false),
  jobDescription: z.string().optional(),
  achievements: z.string().optional(),
  industry: z.string().optional(),
  city: z.string().optional(),
  reasonForLeaving: z.string().optional(),
  referenceName: z.string().optional(),
  referencePhone: z.string().optional(),
});

export const updateEmployeeExperienceSchema = createEmployeeExperienceSchema.partial();

// ============================================================
// Employee Attachment
// ============================================================
export const ATTACHMENT_CATEGORIES = ['FAMILY', 'EDUCATION', 'EMERGENCY_CONTACT', 'TRAINING', 'SKILL', 'EXPERIENCE', 'OTHER'] as const;

export const createEmployeeAttachmentSchema = z.object({
  category: z.enum(ATTACHMENT_CATEGORIES),
  fileName: z.string().min(1).max(255),
  fileUrl: z.string().min(1).max(500),
  originalName: z.string().optional(),
  fileSize: z.number().int().optional(),
  mimeType: z.string().optional(),
  description: z.string().optional(),
});

export const updateEmployeeAttachmentSchema = createEmployeeAttachmentSchema.partial();

// ============================================================
// Type Exports
// ============================================================
export type CreateEmployeeDTO = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeDTO = z.infer<typeof updateEmployeeSchema>;
export type EmployeeQueryDTO = z.infer<typeof employeeQuerySchema>;
export type CreateCareerTransactionDTO = z.infer<typeof createCareerTransactionSchema>;
export type CreateEmployeeCompanyAssignmentDTO = z.infer<typeof createEmployeeCompanyAssignmentSchema>;
export type UpdateEmployeeCompanyAssignmentDTO = z.infer<typeof updateEmployeeCompanyAssignmentSchema>;

export type CreateEmployeeFamilyDTO = z.infer<typeof createEmployeeFamilySchema>;
export type UpdateEmployeeFamilyDTO = z.infer<typeof updateEmployeeFamilySchema>;
export type CreateEmployeeEducationDTO = z.infer<typeof createEmployeeEducationSchema>;
export type UpdateEmployeeEducationDTO = z.infer<typeof updateEmployeeEducationSchema>;
export type CreateEmployeeEmergencyContactDTO = z.infer<typeof createEmployeeEmergencyContactSchema>;
export type UpdateEmployeeEmergencyContactDTO = z.infer<typeof updateEmployeeEmergencyContactSchema>;
export type CreateEmployeeTrainingDTO = z.infer<typeof createEmployeeTrainingSchema>;
export type UpdateEmployeeTrainingDTO = z.infer<typeof updateEmployeeTrainingSchema>;
export type CreateEmployeeSkillDTO = z.infer<typeof createEmployeeSkillSchema>;
export type UpdateEmployeeSkillDTO = z.infer<typeof updateEmployeeSkillSchema>;
export type CreateEmployeeExperienceDTO = z.infer<typeof createEmployeeExperienceSchema>;
export type UpdateEmployeeExperienceDTO = z.infer<typeof updateEmployeeExperienceSchema>;
export type CreateEmployeeAttachmentDTO = z.infer<typeof createEmployeeAttachmentSchema>;
export type UpdateEmployeeAttachmentDTO = z.infer<typeof createEmployeeAttachmentSchema>;
