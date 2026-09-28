import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import type { PermissionCheck } from '@/shared/middleware/Authorize';

/**
 * Middleware factories tag the handler they return, so the router itself
 * becomes the source of the API description: the zod schema a route validates
 * with and the permission it demands are read back off the stack instead of
 * being restated in a hand-written spec that drifts.
 */
export interface RouteRequestSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

const SCHEMAS = Symbol.for('hris.openapi.requestSchemas');
const PERMISSIONS = Symbol.for('hris.openapi.permissions');

type Tagged = RequestHandler & {
  [SCHEMAS]?: RouteRequestSchemas;
  [PERMISSIONS]?: PermissionCheck[];
};

export function tagRequestSchemas<T extends RequestHandler>(handler: T, schemas: RouteRequestSchemas): T {
  (handler as Tagged)[SCHEMAS] = schemas;
  return handler;
}

export function tagPermissions<T extends RequestHandler>(handler: T, permissions: PermissionCheck[]): T {
  (handler as Tagged)[PERMISSIONS] = permissions;
  return handler;
}

export function readRequestSchemas(handler: unknown): RouteRequestSchemas | undefined {
  return (handler as Tagged | undefined)?.[SCHEMAS];
}

export function readPermissions(handler: unknown): PermissionCheck[] | undefined {
  return (handler as Tagged | undefined)?.[PERMISSIONS];
}
