import { z } from 'zod';

export const createPermissionSchema = z.object({
  type: z.enum(['SICK', 'PERSONAL', 'LATE', 'EARLY_LEAVE', 'LEAVE_OFFICE', 'BUSINESS_TRIP', 'WORK_FROM_HOME', 'OTHER']),
  startDate: z.string(),
  endDate: z.string(),
  duration: z.number().positive(),
  reason: z.string().min(1).max(1000),
});

export const updatePermissionSchema = z.object({
  type: z.enum(['SICK', 'PERSONAL', 'LATE', 'EARLY_LEAVE', 'LEAVE_OFFICE', 'BUSINESS_TRIP', 'WORK_FROM_HOME', 'OTHER']).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  duration: z.number().positive().optional(),
  reason: z.string().min(1).max(1000).optional(),
});

export const approvePermissionSchema = z.object({
  notes: z.string().max(500).optional(),
});

export type CreatePermissionDTO = z.infer<typeof createPermissionSchema>;
export type UpdatePermissionDTO = z.infer<typeof updatePermissionSchema>;
export type ApprovePermissionDTO = z.infer<typeof approvePermissionSchema>;
