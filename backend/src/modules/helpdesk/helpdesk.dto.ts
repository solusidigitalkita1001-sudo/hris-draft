import { z } from 'zod';

export const createTicketSchema = z.object({
  category: z.string().trim().min(2).max(50),
  subject: z.string().trim().min(3).max(200),
  description: z.string().trim().min(10).max(5000),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
});

export const ticketQuerySchema = z.object({
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
  category: z.string().trim().max(50).optional(),
  assigneeUserId: z.string().uuid().optional(),
  /// Antrian default menyembunyikan CLOSED; arsip diminta eksplisit.
  includeClosed: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  /// Kursor = id tiket terakhir dari halaman sebelumnya.
  cursor: z.string().uuid().optional(),
});

export const updateTicketSchema = z.object({
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'CLOSED', 'OPEN']).optional(),
  assigneeUserId: z.string().uuid().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
}).refine((data) => Object.values(data).some((value) => value !== undefined), 'At least one field is required');

export const commentSchema = z.object({
  body: z.string().trim().min(1).max(5000),
});

export type CreateTicketDTO = z.infer<typeof createTicketSchema>;
export type TicketQueryDTO = z.infer<typeof ticketQuerySchema>;
export type UpdateTicketDTO = z.infer<typeof updateTicketSchema>;
export type CommentDTO = z.infer<typeof commentSchema>;
