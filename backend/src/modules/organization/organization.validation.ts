import { z } from 'zod';

export const orgIdParam = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const companyIdParam = z.object({
  companyId: z.string().uuid('Invalid company ID format'),
});

export const groupIdParam = z.object({
  groupId: z.string().uuid('Invalid group ID format'),
});

export const orgIdAndCompanyIdParam = z.object({
  id: z.string().uuid('Invalid ID format'),
  companyId: z.string().uuid('Invalid company ID format'),
});
