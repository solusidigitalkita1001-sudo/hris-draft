import { z } from 'zod';

export const createJobPostingSchema = z.object({
  companyId: z.string().uuid(),
  departmentId: z.string().uuid().optional(),
  positionId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  code: z.string().min(1).max(50),
  employmentType: z.string().default('FULL_TIME'),
  location: z.string().optional(),
  minSalary: z.number().positive().optional(),
  maxSalary: z.number().positive().optional(),
  currency: z.string().default('IDR'),
  description: z.string().optional(),
  requirements: z.string().optional(),
  responsibilities: z.string().optional(),
  vacancies: z.number().int().positive().default(1),
}).superRefine((value, ctx) => {
  if (value.minSalary !== undefined && value.maxSalary !== undefined && value.maxSalary < value.minSalary) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['maxSalary'],
      message: 'maxSalary must be greater than or equal to minSalary',
    });
  }
});

export const createCandidateSchema = z.object({
  companyId: z.string().uuid(),
  firstName: z.string().min(1).max(255),
  lastName: z.string().min(1).max(255),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  currentCompany: z.string().optional(),
  currentPosition: z.string().optional(),
  source: z.string().optional(),
  notes: z.string().optional(),
});

export const createApplicationSchema = z.object({
  jobPostingId: z.string().uuid(),
  candidateId: z.string().uuid(),
  companyId: z.string().uuid(),
  coverLetter: z.string().optional(),
  expectedSalary: z.number().positive().optional(),
  notes: z.string().optional(),
});

export const updateApplicationStatusSchema = z.object({
  status: z.enum(['NEW', 'SCREENING', 'INTERVIEW', 'OFFER', 'HIRED', 'REJECTED', 'WITHDRAWN']),
  notes: z.string().optional(),
});

export const createInterviewSchema = z.object({
  applicationId: z.string().uuid(),
  candidateId: z.string().uuid(),
  interviewerId: z.string().uuid().optional(),
  companyId: z.string().uuid(),
  type: z.string().default('ONLINE'),
  title: z.string().min(1).max(255),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().positive().default(60),
  location: z.string().optional(),
  meetingLink: z.string().optional(),
  notes: z.string().optional(),
});

export const createInterviewFeedbackSchema = z.object({
  rating: z.number().int().min(0).max(10).optional(),
  strengths: z.string().optional(),
  weaknesses: z.string().optional(),
  decision: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateJobPostingDTO = z.infer<typeof createJobPostingSchema>;
export type CreateCandidateDTO = z.infer<typeof createCandidateSchema>;
export type CreateApplicationDTO = z.infer<typeof createApplicationSchema>;
export type UpdateApplicationStatusDTO = z.infer<typeof updateApplicationStatusSchema>;
export type CreateInterviewDTO = z.infer<typeof createInterviewSchema>;
export type CreateInterviewFeedbackDTO = z.infer<typeof createInterviewFeedbackSchema>;
