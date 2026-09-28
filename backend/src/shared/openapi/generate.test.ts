import express, { Router } from 'express';
import { z } from 'zod';
import { validate, validateRequest } from '@/shared/middleware/RequestValidator';
import { authorize } from '@/shared/middleware/Authorize';
import { buildOpenApiDocument, collectRoutes } from './generate';

/**
 * The document is only trustworthy if it is read off the router, so these
 * exercise a synthetic router built with the real middleware factories rather
 * than asserting against a checked-in snapshot.
 */
function noop(_req: unknown, _res: unknown, next: () => void) { next(); }
function authenticate(_req: unknown, _res: unknown, next: () => void) { next(); }

function sampleRouter(): Router {
  const leave = Router();
  leave.use(authenticate);
  leave.get('/', authorize({ resource: 'leave', action: 'read' }), noop);
  leave.get('/:id', authorize({ resource: 'leave', action: 'read' }), noop);
  leave.post(
    '/',
    authorize({ resource: 'leave', action: 'create' }),
    validate(z.object({ leaveTypeId: z.string().uuid(), reason: z.string().min(3) })),
    noop,
  );
  leave.patch(
    '/:id/cancel',
    validateRequest({
      params: z.object({ id: z.string().uuid() }),
      query: z.object({ notify: z.enum(['true', 'false']).optional() }),
    }),
    noop,
  );

  const api = express();
  // Registered as an array on purpose: the real app mounts its health probes
  // this way, and a comma-joined path is not a path.
  api.get(['/health', '/health/ready'], noop);
  api.use('/api/v1/leave', leave);
  return api as unknown as Router;
}

describe('collectRoutes', () => {
  const routes = collectRoutes(sampleRouter());
  const find = (method: string, path: string) =>
    routes.find((route) => route.method === method && route.path === path);

  it('splits a route registered with several paths', () => {
    expect(find('GET', '/health')).toBeDefined();
    expect(find('GET', '/health/ready')).toBeDefined();
    expect(routes.some((route) => route.path.includes(','))).toBe(false);
  });

  it('reconstructs the mounted path and rewrites params as templates', () => {
    expect(find('GET', '/api/v1/leave')).toBeDefined();
    expect(find('GET', '/api/v1/leave/{id}')).toBeDefined();
    expect(find('PATCH', '/api/v1/leave/{id}/cancel')).toBeDefined();
  });

  it('reads the permission off the authorize guard', () => {
    expect(find('POST', '/api/v1/leave')?.permissions).toEqual([{ resource: 'leave', action: 'create' }]);
    expect(find('GET', '/api/v1/leave')?.permissions).toEqual([{ resource: 'leave', action: 'read' }]);
  });

  it('inherits router-level authentication', () => {
    expect(find('PATCH', '/api/v1/leave/{id}/cancel')?.requiresAuth).toBe(true);
    expect(find('GET', '/health')?.requiresAuth).toBe(false);
  });

  it('converts the validated body, query and params schemas', () => {
    const created = find('POST', '/api/v1/leave');
    expect(created?.body).toMatchObject({
      type: 'object',
      required: ['leaveTypeId', 'reason'],
      properties: { leaveTypeId: { type: 'string', format: 'uuid' } },
    });

    const cancel = find('PATCH', '/api/v1/leave/{id}/cancel');
    expect(cancel?.params).toMatchObject({ properties: { id: { type: 'string', format: 'uuid' } } });
    expect(cancel?.query).toMatchObject({ properties: { notify: { enum: ['true', 'false'] } } });
    expect(cancel?.body).toBeUndefined();
  });
});

describe('buildOpenApiDocument', () => {
  const document = buildOpenApiDocument(sampleRouter(), {
    title: 'HRIS API', version: '1.0.0', serverUrl: 'https://example.test/api/v1',
  }) as {
    openapi: string;
    paths: Record<string, Record<string, Record<string, unknown>>>;
    components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
  };

  it('emits an OpenAPI 3.1 document with the shared envelope components', () => {
    expect(document.openapi).toBe('3.1.0');
    expect(Object.keys(document.components.schemas).sort())
      .toEqual(['ErrorEnvelope', 'PaginationMeta', 'SuccessEnvelope']);
    expect(document.components.securitySchemes).toHaveProperty('bearerAuth');
  });

  it('describes a guarded mutation with its body, permission and security', () => {
    const operation = document.paths['/api/v1/leave']?.post as Record<string, unknown>;
    expect(operation['x-required-permissions']).toEqual(['leave:create']);
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.requestBody).toMatchObject({
      required: true,
      content: { 'application/json': { schema: { type: 'object' } } },
    });
  });

  it('declares path parameters and the error envelope responses', () => {
    const operation = document.paths['/api/v1/leave/{id}']?.get as Record<string, unknown>;
    expect(operation.parameters).toEqual([
      { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
    ]);
    const responses = operation.responses as Record<string, { content: Record<string, { schema: unknown }> }>;
    expect(responses['404'].content['application/json'].schema).toEqual({
      $ref: '#/components/schemas/ErrorEnvelope',
    });
  });

  it('leaves an unauthenticated route without a security requirement', () => {
    expect((document.paths['/health']?.get as Record<string, unknown>).security).toBeUndefined();
  });
});
