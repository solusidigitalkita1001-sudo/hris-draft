import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Result } from './Result';
import {
  AppError, BadRequestError, AuthError, TokenExpiredError, ForbiddenError, NotFoundError,
  ConflictError, TooManyRequestsError, ValidationError, DatabaseError, ServiceUnavailableError,
} from '@/shared/exceptions/AppError';

/**
 * Frontend and mobile both read one envelope and one error-code catalogue, so
 * both are pinned here: a controller that hand-builds a response, or a renamed
 * code, has to fail a test rather than reach a client. The catalogue below is
 * the contract published in docs/api-contract.md.
 */

const ERROR_CATALOGUE: Array<[new (message?: string) => AppError, number, string]> = [
  [BadRequestError, 400, 'BAD_REQUEST'],
  [AuthError, 401, 'AUTHENTICATION_FAILED'],
  [TokenExpiredError, 401, 'TOKEN_EXPIRED'],
  [ForbiddenError, 403, 'FORBIDDEN'],
  [NotFoundError, 404, 'NOT_FOUND'],
  [ConflictError, 409, 'CONFLICT'],
  [ValidationError, 422, 'VALIDATION_ERROR'],
  [TooManyRequestsError, 429, 'TOO_MANY_REQUESTS'],
  [DatabaseError, 500, 'DATABASE_ERROR'],
  [ServiceUnavailableError, 503, 'SERVICE_UNAVAILABLE'],
];

function controllerSources(): Array<{ file: string; source: string }> {
  const modulesRoot = join(__dirname, '..', '..', 'modules');
  const found: Array<{ file: string; source: string }> = [];
  const walk = (directory: string) => {
    for (const entry of readdirSync(directory)) {
      const full = join(directory, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith('.controller.ts')) found.push({ file: entry, source: readFileSync(full, 'utf8') });
    }
  };
  walk(modulesRoot);
  return found;
}

describe('success envelope', () => {
  it.each([
    ['success', Result.success({ id: 'x' })],
    ['created', Result.created({ id: 'x' })],
    ['updated', Result.updated({ id: 'x' })],
    ['deleted', Result.deleted()],
    ['noContent', Result.noContent()],
  ])('%s carries success, a message, and data', (_name, response) => {
    expect(response.success).toBe(true);
    expect(typeof response.message).toBe('string');
    expect(response.message.length).toBeGreaterThan(0);
    expect(response).toHaveProperty('data');
  });

  it('paginated reports totals the client can page with', () => {
    const response = Result.paginated([{ id: 'a' }], 25, 2, 10);
    expect(response.meta).toEqual({
      page: 2, limit: 10, total: 25, totalPages: 3, hasNextPage: true, hasPreviousPage: true,
    });
  });

  it.each([
    [1, 10, 25, { totalPages: 3, hasNextPage: true, hasPreviousPage: false }],
    [3, 10, 25, { totalPages: 3, hasNextPage: false, hasPreviousPage: true }],
    [1, 10, 0, { totalPages: 0, hasNextPage: false, hasPreviousPage: false }],
  ])('page %i of limit %i over %i rows', (page, limit, total, expected) => {
    expect(Result.paginated([], total, page, limit).meta).toMatchObject(expected);
  });
});

describe('error envelope', () => {
  it.each(ERROR_CATALOGUE)('$name maps to one documented status and code', (Exception, statusCode, code) => {
    const error = new Exception();
    expect(error.statusCode).toBe(statusCode);
    expect(error.code).toBe(code);
    expect(error.toJSON()).toEqual({ success: false, code, message: error.message });
  });

  it('keeps field errors on the validation response only', () => {
    const withFields = new ValidationError('Validation failed', [{ field: 'email', message: 'required' }]);
    expect(withFields.toJSON()).toEqual({
      success: false, code: 'VALIDATION_ERROR', message: 'Validation failed',
      errors: [{ field: 'email', message: 'required' }],
    });
    expect(new NotFoundError().toJSON()).not.toHaveProperty('errors');
  });

  it('marks only genuine server faults as non-operational', () => {
    expect(new DatabaseError().isOperational).toBe(false);
    for (const [Exception] of ERROR_CATALOGUE.filter(([E]) => E !== DatabaseError)) {
      expect(new Exception().isOperational).toBe(true);
    }
  });
});

describe('controllers do not build their own envelope', () => {
  const sources = controllerSources();

  it('found the controllers it claims to check', () => {
    expect(sources.length).toBeGreaterThan(20);
  });

  it('routes every response through Result', () => {
    // A hand-built envelope drifts: the ones this replaced omitted `message`
    // entirely, and company-settings invented a success-side `code` field.
    const offenders = sources
      .filter(({ source }) => /res\.(status\([0-9]+\)\.)?json\(\s*\{\s*success:/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it('never invents a success-side code field', () => {
    const offenders = sources.filter(({ source }) => /code: 'OK'/.test(source)).map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
