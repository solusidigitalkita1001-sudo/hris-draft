import crypto from 'crypto';
import config from '@/config';

// Task 1.3 (SEC-010): short-lived HMAC-signed document URLs so files can be
// embedded without exposing the raw path or requiring a bearer token per request.
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes

function sign(id: string, expires: number): string {
  return crypto
    .createHmac('sha256', config.encryption.key)
    .update(`${id}.${expires}`)
    .digest('hex');
}

export function generateSignedDocumentPath(
  id: string,
  ttlMs = DEFAULT_TTL_MS
): { path: string; expiresAt: number } {
  const expiresAt = Date.now() + ttlMs;
  const sig = sign(id, expiresAt);
  return {
    path: `${config.app.apiPrefix}/documents/${id}/file?expires=${expiresAt}&sig=${sig}`,
    expiresAt,
  };
}

export function verifyDocumentSignature(
  id: string,
  expires: string | number | undefined,
  sig: string | undefined
): boolean {
  if (!expires || !sig) return false;
  const exp = Number(expires);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = Buffer.from(sign(id, exp));
  const provided = Buffer.from(sig);
  return expected.length === provided.length && crypto.timingSafeEqual(expected, provided);
}
