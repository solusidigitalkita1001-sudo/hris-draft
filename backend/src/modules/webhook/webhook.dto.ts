import { z } from 'zod';

export const createWebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string().min(1).max(100)).min(1).max(50),
  description: z.string().max(255).optional(),
});

export const updateWebhookSchema = z
  .object({
    events: z.array(z.string().min(1).max(100)).min(1).max(50).optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(255).optional(),
  })
  .refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const webhookDeliveryQuerySchema = z.object({
  subscriptionId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'SENT', 'FAILED', 'DEAD']).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type CreateWebhookDTO = z.infer<typeof createWebhookSchema>;
export type UpdateWebhookDTO = z.infer<typeof updateWebhookSchema>;
export type WebhookDeliveryQueryDTO = z.infer<typeof webhookDeliveryQuerySchema>;
