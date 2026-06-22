import { Request, Response, NextFunction } from 'express';
import { AppError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import config from '@/config';
import { ZodError } from 'zod';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const correlationId = req.headers['x-correlation-id'] || req.headers['x-request-id'] || '';

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Validation failed',
      errors,
      ...(correlationId && { correlationId }),
    });
    return;
  }

  // Handle known application errors
  if (err instanceof AppError) {
    const response: Record<string, unknown> = {
      success: false,
      code: err.code,
      message: err.message,
    };

    if (err.errors && err.errors.length > 0) {
      response.errors = err.errors;
    }

    if (correlationId) {
      response.correlationId = correlationId;
    }

    // Log operational errors (expected) at warn level
    if (err.isOperational) {
      logger.warn(`Operational error: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        correlationId,
      });
    } else {
      // Log unexpected errors at error level
      logger.error(`Unexpected error: ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        correlationId,
        stack: err.stack,
      });
    }

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle unknown errors
  logger.error(`Unhandled error: ${err.message}`, {
    path: req.path,
    method: req.method,
    correlationId,
    stack: err.stack,
  });

  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: config.app.env === 'production'
      ? 'An unexpected error occurred'
      : err.message,
    ...(correlationId && { correlationId }),
  });
}
