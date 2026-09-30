import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { AuthError, BadRequestError } from '@/shared/exceptions/AppError';
import { assertDeliverableUrl, assertResolvesPublicly } from '@/modules/webhook/webhook-url-guard';

/**
 * Just enough OpenID Connect to sign someone in, with no new dependency.
 *
 * Node imports a JWK directly (`createPublicKey({ format: 'jwk' })`) and
 * `jsonwebtoken` verifies RS256 against it, so a JWKS client would be a
 * dependency earning its keep on about fifteen lines. `openid-client` would
 * bring a great deal more than the authorization-code flow this needs.
 *
 * What is NOT skipped, because each one is a real attack if dropped: issuer and
 * audience checks, nonce binding, signature verification against the provider's
 * published keys, and SSRF fencing on every provider-supplied URL — a tenant
 * configures the issuer, so discovery fetches an address they chose.
 */

const FETCH_TIMEOUT_MS = 8_000;
const DISCOVERY_CACHE_MS = 10 * 60 * 1000;
const JWKS_CACHE_MS = 10 * 60 * 1000;

export interface OidcMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

interface Jwk {
  kid?: string;
  kty: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
}

const discoveryCache = new Map<string, { at: number; metadata: OidcMetadata }>();
const jwksCache = new Map<string, { at: number; keys: Jwk[] }>();

async function fetchJson(url: string): Promise<unknown> {
  // Every URL here came from tenant configuration, so it is fenced exactly like
  // a webhook target: no private ranges, no loopback, no cloud metadata.
  const parsed = assertDeliverableUrl(url);
  await assertResolvesPublicly(parsed.hostname);

  const response = await fetch(parsed, {
    headers: { accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'manual',
  });
  if (!response.ok) throw new BadRequestError(`Identity provider returned HTTP ${response.status} for ${parsed.pathname}`);
  return response.json();
}

export async function discover(issuer: string, now = Date.now()): Promise<OidcMetadata> {
  const cached = discoveryCache.get(issuer);
  if (cached && now - cached.at < DISCOVERY_CACHE_MS) return cached.metadata;

  const base = issuer.replace(/\/+$/, '');
  const document = (await fetchJson(`${base}/.well-known/openid-configuration`)) as Partial<OidcMetadata>;

  for (const field of ['issuer', 'authorization_endpoint', 'token_endpoint', 'jwks_uri'] as const) {
    if (typeof document[field] !== 'string' || !document[field]) {
      throw new BadRequestError(`Identity provider discovery is missing ${field}`);
    }
  }
  const metadata = document as OidcMetadata;

  // The document must claim the issuer we asked for. Without this, a provider
  // could hand us metadata for someone else's issuer and every later `iss`
  // check would pass against the wrong authority.
  if (metadata.issuer.replace(/\/+$/, '') !== base) {
    throw new BadRequestError('Identity provider issuer does not match its discovery document');
  }

  discoveryCache.set(issuer, { at: now, metadata });
  return metadata;
}

async function getSigningKey(jwksUri: string, kid: string | undefined, now = Date.now()): Promise<crypto.KeyObject> {
  const cached = jwksCache.get(jwksUri);
  const stale = !cached || now - cached.at >= JWKS_CACHE_MS;
  const missingKid = Boolean(cached && kid && !cached.keys.some((key) => key.kid === kid));

  // Refetch on a kid we have never seen: providers rotate keys, and a cached
  // set must not turn a rotation into every login failing for ten minutes.
  let entry = cached;
  if (stale || missingKid) {
    const document = (await fetchJson(jwksUri)) as { keys?: Jwk[] };
    if (!Array.isArray(document.keys)) throw new BadRequestError('Identity provider JWKS has no keys');
    entry = { at: now, keys: document.keys };
    jwksCache.set(jwksUri, entry);
  }
  if (!entry) throw new AuthError('Identity provider keys are unavailable');

  const candidates = entry.keys.filter((key) => key.kty === 'RSA' && (!kid || key.kid === kid));
  const key = candidates[0];
  if (!key) throw new AuthError('Identity provider key for this token was not found');

  try {
    return crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: 'jwk' });
  } catch {
    throw new AuthError('Identity provider key could not be read');
  }
}

export interface VerifiedIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name?: string;
}

/**
 * Verify an ID token the way the spec requires, then hand back only the claims
 * we act on.
 */
export async function verifyIdToken(options: {
  idToken: string;
  issuer: string;
  clientId: string;
  nonce: string;
  jwksUri: string;
}): Promise<VerifiedIdentity> {
  const decoded = jwt.decode(options.idToken, { complete: true });
  if (!decoded || typeof decoded === 'string') throw new AuthError('ID token could not be read');

  // Refuse `alg: none` and HMAC algorithms outright. An HMAC-signed token would
  // be verified with the client secret, and a provider that accepts both leaves
  // the door open to an algorithm-confusion forgery.
  if (!['RS256', 'RS384', 'RS512'].includes(decoded.header.alg)) {
    throw new AuthError(`Unsupported ID token algorithm: ${decoded.header.alg}`);
  }

  const key = await getSigningKey(options.jwksUri, decoded.header.kid);

  let claims: jwt.JwtPayload;
  try {
    claims = jwt.verify(options.idToken, key, {
      algorithms: ['RS256', 'RS384', 'RS512'],
      issuer: options.issuer,
      audience: options.clientId,
      clockTolerance: 30,
    }) as jwt.JwtPayload;
  } catch (error) {
    throw new AuthError(`ID token verification failed: ${error instanceof Error ? error.message : 'unknown reason'}`);
  }

  // Nonce binds the token to the login attempt this server started. Without it,
  // an ID token obtained elsewhere for the same client could be replayed here.
  if (claims.nonce !== options.nonce) throw new AuthError('ID token nonce does not match this login attempt');

  const email = typeof claims.email === 'string' ? claims.email.trim().toLowerCase() : '';
  if (!email) throw new AuthError('Identity provider did not return an email address');
  if (typeof claims.sub !== 'string' || !claims.sub) throw new AuthError('ID token has no subject');

  return {
    subject: claims.sub,
    email,
    // Providers spell this as a boolean or the string "true"; anything else is
    // treated as unverified rather than assumed.
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name: typeof claims.name === 'string' ? claims.name : undefined,
  };
}

export interface PkcePair {
  verifier: string;
  challenge: string;
}

export function createPkcePair(): PkcePair {
  const verifier = crypto.randomBytes(48).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** Exchange the authorization code, proving possession of the PKCE verifier. */
export async function exchangeCode(options: {
  tokenEndpoint: string;
  clientId: string;
  clientSecret: string;
  code: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<{ idToken: string }> {
  const endpoint = assertDeliverableUrl(options.tokenEndpoint);
  await assertResolvesPublicly(endpoint.hostname);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
    client_id: options.clientId,
    client_secret: options.clientSecret,
    code_verifier: options.codeVerifier,
  });

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: body.toString(),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: 'manual',
  });

  const payload = (await response.json().catch(() => ({}))) as { id_token?: string; error?: string; error_description?: string };
  if (!response.ok) {
    // The provider's own error text is the useful part; the client secret is
    // never in it, so it is safe to surface.
    throw new AuthError(`Token exchange failed: ${payload.error_description ?? payload.error ?? `HTTP ${response.status}`}`);
  }
  if (!payload.id_token) throw new AuthError('Token exchange returned no id_token');

  return { idToken: payload.id_token };
}

/** Exposed for tests: caches are process-wide and would leak between cases. */
export function resetOidcCaches(): void {
  discoveryCache.clear();
  jwksCache.clear();
}
