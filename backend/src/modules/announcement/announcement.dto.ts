import { z } from 'zod';

export const announcementListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const announcementIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;

/**
 * Write side (admin/HR). The read side shipped complete and nothing could
 * create a row for it, so the portal was a window onto seed data.
 */
const audienceIdList = z.array(z.string().uuid()).max(500).optional();

export const announcementWriteSchema = z.object({
  title: z.string().min(1).max(255),
  content: z.string().min(1).max(20000),
  /// ALL is platform-wide and refused from a company context.
  audienceType: z.enum(['COMPANY_WIDE', 'DEPARTMENT_ONLY', 'BRANCH_ONLY', 'POSITION_ONLY', 'EMPLOYEE_SPECIFIC']),
  departmentIds: audienceIdList,
  branchIds: audienceIdList,
  positionIds: audienceIdList,
  employeeIds: audienceIdList,
  coverImageUrl: z.string().max(500).optional(),
  /// PINNED pins it to the top for as long as pinnedUntil says; HIDDEN keeps a
  /// published announcement out of the list without archiving it.
  priority: z.enum(['PINNED', 'NORMAL', 'HIDDEN']).optional(),
  publishFrom: z.string().datetime().optional(),
  publishUntil: z.string().datetime().optional(),
  pinnedUntil: z.string().datetime().optional(),
  allowComment: z.boolean().optional(),
});

export const announcementAdminQuerySchema = z.object({
  status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']).optional(),
});

export type AnnouncementWriteDTO = z.infer<typeof announcementWriteSchema>;
export type AnnouncementAdminQueryDTO = z.infer<typeof announcementAdminQuerySchema>;

