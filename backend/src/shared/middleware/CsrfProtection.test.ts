import type { NextFunction, Request, Response } from 'express';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfProtection,
  issueCsrfToken,
} from './CsrfProtection';

function createResponseCapture() {
  let token = '';
  const response = {
    cookie: (name: string, value: string) => {
      if (name === CSRF_COOKIE) token = value;
      return response;
    },
  } as unknown as Response;
  return { response, getToken: () => token };
}

function request(method: string, cookies: Record<string, string>, header?: string): Request {
  return {
    method,
    cookies,
    get: (name: string) => name.toLowerCase() === CSRF_HEADER ? header : undefined,
  } as Request;
}

describe('csrfProtection', () => {
  it('allows safe methods without a token', () => {
    const next = jest.fn() as NextFunction;
    csrfProtection(request('GET', { at: 'cookie-auth' }), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('allows Bearer-only mutations because they are not browser-cookie authenticated', () => {
    const next = jest.fn() as NextFunction;
    csrfProtection(request('POST', {}), {} as Response, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('accepts a valid signed double-submit token', () => {
    const capture = createResponseCapture();
    const token = issueCsrfToken(capture.response);
    const next = jest.fn() as NextFunction;

    csrfProtection(
      request('PATCH', { at: 'cookie-auth', [CSRF_COOKIE]: token }, token),
      {} as Response,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
    expect(capture.getToken()).toBe(token);
  });

  it('rejects a missing, mismatched, or forged token', () => {
    expect(() => csrfProtection(request('POST', { at: 'cookie-auth' }), {} as Response, jest.fn())).toThrow(/CSRF/);
    expect(() => csrfProtection(request('POST', { at: 'cookie-auth', csrf: 'forged.token' }, 'forged.token'), {} as Response, jest.fn())).toThrow(/CSRF/);
  });
});
