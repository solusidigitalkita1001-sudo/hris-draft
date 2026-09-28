import type { Router } from 'express';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { readPermissions, readRequestSchemas } from './route-metadata';

/**
 * Builds an OpenAPI 3.1 description by walking the live Express router, so the
 * document cannot drift from the server: paths, methods, request schemas and
 * required permissions all come from the stack that actually serves requests.
 *
 * ponytail: response bodies are described by the shared envelope rather than
 * per-endpoint payload schemas. Payload shapes live in services and Prisma
 * models, which have no single validated boundary to read them from; add
 * per-route response schemas only when clients need more than the envelope.
 */

interface Layer {
  name: string;
  handle?: { stack?: Layer[] };
  regexp?: RegExp & { fast_slash?: boolean };
  route?: { path: string; stack: Array<{ method?: string; handle: unknown; name: string }> };
}

export interface CollectedRoute {
  method: string;
  path: string;
  permissions: Array<{ resource: string; action: string }>;
  requiresAuth: boolean;
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

/**
 * Express stores a mounted router's prefix as a regular expression. Decoding it
 * back to a path is the only way to reconstruct the full route; `fast_slash`
 * marks a router mounted at the root, which contributes no prefix.
 */
function mountPrefix(layer: Layer): string {
  const expression = layer.regexp;
  if (!expression || expression.fast_slash) return '';
  return expression.source
    .replace(/^\^/, '')
    .replace('\\/?(?=\\/|$)', '')
    .replace(/\\\//g, '/')
    .replace(/\$$/, '');
}

/**
 * Express path params (`:id`) become OpenAPI template params (`{id}`). A router
 * mounted at a prefix reports its index route as `/prefix/`, which OpenAPI
 * would treat as a different path from `/prefix`.
 */
function toTemplate(path: string): string {
  const template = path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
  return template.length > 1 ? template.replace(/\/$/, '') : template;
}

function jsonSchema(schema: unknown): unknown {
  if (!schema) return undefined;
  const converted = zodToJsonSchema(schema as never, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<string, unknown>;
  delete converted.$schema;
  return converted;
}

export function collectRoutes(router: Router): CollectedRoute[] {
  const routes: CollectedRoute[] = [];

  const walk = (stack: Layer[], base: string, inherited: CollectedRoute['permissions'], authenticated: boolean) => {
    // A `router.use(authenticate)` or `router.use(authorize(...))` applies to
    // every route declared after it in the same router, so guards accumulate
    // as the walk descends.
    let permissions = inherited;
    let requiresAuth = authenticated;

    for (const layer of stack) {
      if (layer.route) {
        const routePermissions = [...permissions];
        let routeAuth = requiresAuth;
        const schemas: { body?: unknown; query?: unknown; params?: unknown } = {};
        for (const handler of layer.route.stack) {
          const declared = readPermissions(handler.handle);
          if (declared) routePermissions.push(...declared);
          if (handler.name === 'authenticate') routeAuth = true;
          const requestSchemas = readRequestSchemas(handler.handle);
          if (requestSchemas) {
            if (requestSchemas.body) schemas.body = requestSchemas.body;
            if (requestSchemas.query) schemas.query = requestSchemas.query;
            if (requestSchemas.params) schemas.params = requestSchemas.params;
          }
        }
        for (const handler of layer.route.stack) {
          if (!handler.method) continue;
          routes.push({
            method: handler.method.toUpperCase(),
            path: toTemplate(base + layer.route.path),
            permissions: routePermissions,
            requiresAuth: routeAuth || routePermissions.length > 0,
            body: jsonSchema(schemas.body),
            query: jsonSchema(schemas.query),
            params: jsonSchema(schemas.params),
          });
        }
        continue;
      }

      if (layer.handle?.stack) {
        walk(layer.handle.stack, base + mountPrefix(layer), permissions, requiresAuth);
        continue;
      }

      const declared = readPermissions(layer.handle);
      if (declared) permissions = [...permissions, ...declared];
      if (layer.name === 'authenticate') requiresAuth = true;
    }
  };

  // An Express application keeps its stack behind `_router`; a Router exposes
  // `stack` directly. Accept either so the caller can pass the app itself.
  const host = router as unknown as { stack?: Layer[]; _router?: { stack?: Layer[] } };
  walk(host.stack ?? host._router?.stack ?? [], '', [], false);
  return routes.sort((a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method));
}

const ENVELOPE_COMPONENTS = {
  SuccessEnvelope: {
    type: 'object',
    required: ['success', 'message'],
    properties: {
      success: { type: 'boolean', const: true },
      message: { type: 'string' },
      data: { description: 'Endpoint payload; null for delete and no-content responses.' },
      meta: { $ref: '#/components/schemas/PaginationMeta' },
    },
  },
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'total', 'totalPages', 'hasNextPage', 'hasPreviousPage'],
    properties: {
      page: { type: 'integer' },
      limit: { type: 'integer' },
      total: { type: 'integer' },
      totalPages: { type: 'integer', description: 'ceil(total / limit); 0 for an empty result.' },
      hasNextPage: { type: 'boolean' },
      hasPreviousPage: { type: 'boolean' },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    required: ['success', 'code', 'message'],
    properties: {
      success: { type: 'boolean', const: false },
      code: {
        type: 'string',
        enum: [
          'BAD_REQUEST', 'AUTHENTICATION_FAILED', 'TOKEN_EXPIRED', 'FORBIDDEN', 'NOT_FOUND',
          'CONFLICT', 'VALIDATION_ERROR', 'TOO_MANY_REQUESTS', 'DATABASE_ERROR',
          'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR',
        ],
      },
      message: { type: 'string' },
      errors: {
        type: 'array',
        description: 'Present on VALIDATION_ERROR only.',
        items: {
          type: 'object',
          required: ['field', 'message'],
          properties: { field: { type: 'string' }, message: { type: 'string' } },
        },
      },
    },
  },
} as const;

function errorResponse(description: string) {
  return {
    description,
    content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorEnvelope' } } },
  };
}

export interface OpenApiOptions {
  title: string;
  version: string;
  serverUrl: string;
}

export function buildOpenApiDocument(router: Router, options: OpenApiOptions): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};

  for (const route of collectRoutes(router)) {
    const operation: Record<string, unknown> = {
      operationId: `${route.method.toLowerCase()}${route.path.replace(/[^A-Za-z0-9]+/g, '_')}`,
      responses: {
        '200': {
          description: 'Success envelope',
          content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessEnvelope' } } },
        },
        '401': errorResponse('Missing or invalid credentials'),
        '403': errorResponse('Authenticated but not permitted, or outside the active company'),
        '404': errorResponse('Missing, or outside the caller tenant and data scope'),
        '422': errorResponse('Schema validation failed'),
      },
    };

    if (route.permissions.length) {
      operation['x-required-permissions'] = route.permissions.map((p) => `${p.resource}:${p.action}`);
    }
    if (route.requiresAuth) operation.security = [{ bearerAuth: [] }];

    const parameters: unknown[] = [];
    for (const name of route.path.match(/\{([A-Za-z0-9_]+)\}/g)?.map((m) => m.slice(1, -1)) ?? []) {
      parameters.push({ name, in: 'path', required: true, schema: { type: 'string' } });
    }
    if (route.query) operation['x-query-schema'] = route.query;
    if (route.params) operation['x-path-schema'] = route.params;
    if (parameters.length) operation.parameters = parameters;
    if (route.body) {
      operation.requestBody = {
        required: true,
        content: { 'application/json': { schema: route.body } },
      };
    }

    paths[route.path] = { ...(paths[route.path] ?? {}), [route.method.toLowerCase()]: operation };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: options.title,
      version: options.version,
      description:
        'Generated from the live Express router: every path, method, request schema and required permission '
        + 'is read from the middleware that serves the request. Response bodies follow the shared envelope '
        + 'documented in docs/api-contract.md.',
    },
    servers: [{ url: options.serverUrl }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
      schemas: ENVELOPE_COMPONENTS,
    },
    paths,
  };
}
