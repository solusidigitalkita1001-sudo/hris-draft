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

describe('CSRF lifetime and origin', () => {
  afterEach(() => jest.restoreAllMocks());
  it('rejects an expired signed token', () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    const capture = createResponseCapture();
    issueCsrfToken(capture.response);
    const token = capture.getToken();
    clock.mockReturnValue(now + 2 * 60 * 60 * 1000 + 1);
    expect(() => csrfProtection(request('POST', { at: 'session', csrf: token }, token), {} as Response, jest.fn())).toThrow();
  });
  it('rejects an unauthorized origin even with a matching token', () => {
    const capture = createResponseCapture();
    issueCsrfToken(capture.response);
    const token = capture.getToken();
    const req = request('POST', { at: 'session', csrf: token }, token);
    req.get = ((name: string) => name === 'origin' ? 'https://attacker.invalid' : token) as Request['get'];
    expect(() => csrfProtection(req, {} as Response, jest.fn())).toThrow('origin');
  });
});
