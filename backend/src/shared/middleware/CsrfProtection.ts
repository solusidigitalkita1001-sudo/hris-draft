import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import config from '@/config';
import { ForbiddenError } from '@/shared/exceptions/AppError';

export const CSRF_COOKIE = 'csrf';
export const CSRF_HEADER = 'x-csrf-token';

const TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function sign(nonce: string): string {
  return crypto.createHmac('sha256', config.csrf.secret).update(nonce).digest('base64url');
}

function isValidSignedToken(token: string): boolean {
  const separator = token.indexOf('.');
  if (separator <= 0) return false;

  const nonce = token.slice(0, separator);
  const issuedAt = Number(nonce.split('-')[0]);
  if (!Number.isSafeInteger(issuedAt) || issuedAt > Date.now() || Date.now() - issuedAt > TOKEN_TTL_MS) return false;
  const suppliedSignature = token.slice(separator + 1);
  const expectedSignature = sign(nonce);
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);

  return supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
}

function tokensMatch(cookieToken: string, headerToken: string): boolean {
  const cookie = Buffer.from(cookieToken);
  const header = Buffer.from(headerToken);
  return cookie.length === header.length && crypto.timingSafeEqual(cookie, header);
}

export function issueCsrfToken(res: Response): string {
  const nonce = `${Date.now()}-${crypto.randomBytes(32).toString('base64url')}`;
  const token = `${nonce}.${sign(nonce)}`;
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    maxAge: TOKEN_TTL_MS,
    secure: config.app.env === 'production',
    sameSite: 'lax',
    path: '/',
  });
  return token;
}

export function clearCsrfToken(res: Response): void {
  res.clearCookie(CSRF_COOKIE, {
    httpOnly: false,
    secure: config.app.env === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

/**
 * Protect cookie-authenticated mutations with a signed double-submit token.
 * Bearer-only requests are intentionally exempt so native/mobile integrations
 * do not need browser CSRF semantics.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  if (SAFE_METHODS.has(req.method.toUpperCase())) {
    next();
    return;
  }

  const usesAuthCookie = Boolean(req.cookies?.at || req.cookies?.rt);
  if (!usesAuthCookie) {
    next();
    return;
  }

  const origin = req.get('origin');
  if (origin && !config.cors.origins.includes(origin)) {
    throw new ForbiddenError('Request origin is not allowed');
  }

  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  if (
    typeof cookieToken !== 'string' ||
    typeof headerToken !== 'string' ||
    !isValidSignedToken(cookieToken) ||
    !tokensMatch(cookieToken, headerToken)
  ) {
    throw new ForbiddenError('Invalid or missing CSRF token');
  }

  next();
}
