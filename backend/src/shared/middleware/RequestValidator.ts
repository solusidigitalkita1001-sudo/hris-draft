import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@/shared/exceptions/AppError';

type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Request validation middleware factory
 * Validates request data against Zod schemas
 */
export function validate(schema: ZodSchema, target: ValidationTarget = 'body') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req[target]);
      // Replace with parsed (sanitized) data
      (req as any)[target] = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      throw error;
    }
  };
}

/**
 * Validate multiple targets at once
 */
export function validateRequest(
  schemas: {
    body?: ZodSchema;
    query?: ZodSchema;
    params?: ZodSchema;
  }
) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      for (const [target, schema] of Object.entries(schemas)) {
        if (schema) {
          const parsed = schema.parse(req[target as ValidationTarget]);
          (req as any)[target as ValidationTarget] = parsed;
        }
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map((e) => ({
          field: e.path.join('.'),
          message: e.message,
        }));
        throw new ValidationError('Validation failed', errors);
      }
      throw error;
    }
  };
}
