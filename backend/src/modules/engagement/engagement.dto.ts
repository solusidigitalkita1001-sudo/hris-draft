import { z } from 'zod';

export const createPostSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

export const feedQuerySchema = z.object({
  /// Kursor sederhana: ambil post lebih lama dari timestamp ini.
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const giveKudosSchema = z.object({
  toEmployeeId: z.string().uuid(),
  badge: z.string().trim().min(2).max(50),
  message: z.string().trim().min(3).max(500),
});

export const kudosQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreatePostDTO = z.infer<typeof createPostSchema>;
export type FeedQueryDTO = z.infer<typeof feedQuerySchema>;
export type GiveKudosDTO = z.infer<typeof giveKudosSchema>;
export type KudosQueryDTO = z.infer<typeof kudosQuerySchema>;
