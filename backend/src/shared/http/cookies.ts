import type { CookieOptions } from 'express';
import config from '@/config';

/**
 * Task 1.7 (SEC-015): the mandated default options for every cookie this app
 * sets. Use it for ALL `res.cookie(...)` calls (CSRF token, refresh token, etc.)
 * so cookies are HttpOnly, Secure in production, and SameSite-protected.
 *
 * ponytail: no cookies are set yet (auth is Bearer). This is the secure primitive
 * the upcoming CSRF / refresh-token-in-cookie work must reuse — not dead code,
 * a guardrail so the first cookie added isn't insecure by omission.
 */
export function secureCookieOptions(overrides: CookieOptions = {}): CookieOptions {
  return {
    httpOnly: true,
    secure: config.app.env === 'production',
    sameSite: 'lax',
    signed: true,
    path: '/',
    ...overrides,
  };
}
