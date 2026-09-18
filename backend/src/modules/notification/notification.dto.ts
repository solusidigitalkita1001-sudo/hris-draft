import { z } from 'zod';

export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  title: z.string().min(1).max(255),
  message: z.string().optional(),
  type: z.enum(['INFO', 'SUCCESS', 'WARNING', 'ERROR']).default('INFO'),
  resource: z.string().max(100).optional(),
  action: z.string().max(50).optional(),
  referenceId: z.string().uuid().optional(),
});

export const markReadSchema = z.object({
  ids: z.array(z.string().uuid()).min(1),
});

export const notificationListQuerySchema = z.object({
  unreadOnly: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type CreateNotificationDTO = z.infer<typeof createNotificationSchema>;
export type MarkReadDTO = z.infer<typeof markReadSchema>;
