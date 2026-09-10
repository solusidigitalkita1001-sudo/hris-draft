import type { CookieOptions } from 'express';
import config from '@/config';

/**
 * Task 1.7 (SEC-015): the mandated default options for every cookie this app
 * sets. Use it for ALL `res.cookie(...)` calls (CSRF token, refresh token, etc.)
 * so cookies are HttpOnly and SameSite-protected. Secure defaults to production;
 * COOKIE_SECURE configures explicit HTTP deployments. The CSRF cookie overrides
 * httpOnly and uses its own HMAC signature in CsrfProtection.
 */
export function secureCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookies.secure,
    sameSite: 'lax',
    signed: true,
    path: '/',
    ...overrides,
  };
}
