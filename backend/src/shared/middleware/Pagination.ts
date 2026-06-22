import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  search?: string;
  filters: Record<string, unknown>;
}

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
});

/**
 * Pagination middleware - parses and validates pagination query params
 */
export function parsePagination(req: Request, _res: Response, next: NextFunction): void {
  const parsed = paginationSchema.parse(req.query);

  // Extract filter params (everything that's not pagination or sort)
  const filterParams = { ...req.query };
  delete filterParams.page;
  delete filterParams.limit;
  delete filterParams.sortBy;
  delete filterParams.sortOrder;
  delete filterParams.search;

  req.pagination = {
    page: parsed.page,
    limit: parsed.limit,
    skip: (parsed.page - 1) * parsed.limit,
    sortBy: parsed.sortBy,
    sortOrder: parsed.sortOrder,
    search: parsed.search,
    filters: filterParams,
  };

  next();
}

declare global {
  namespace Express {
    interface Request {
      pagination?: PaginationParams;
    }
  }
}
