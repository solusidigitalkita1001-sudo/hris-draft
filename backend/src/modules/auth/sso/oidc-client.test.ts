import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

jest.mock('@/modules/webhook/webhook-url-guard', () => ({
  assertDeliverableUrl: (raw: string) => new URL(raw),
  assertResolvesPublicly: jest.fn(async () => undefined),
}));

import { discover, resetOidcCaches, verifyIdToken, createPkcePair } from './oidc-client';

/**
 * Real keys and real tokens. A mocked verifier would prove nothing about the
 * checks that matter here — each of these assertions corresponds to a forgery
 * that works if the check is missing.
 */
const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const otherPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });

const KID = 'key-1';
const ISSUER = 'https://idp.example.com';
const CLIENT_ID = 'hris-client';
const NONCE = 'nonce-value';

function jwks(pair = keyPair, kid = KID) {
  const jwk = pair.publicKey.export({ format: 'jwk' }) as Record<string, string>;
  return { keys: [{ ...jwk, kid, alg: 'RS256', use: 'sig' }] };
}

function idToken(options: {
  pair?: crypto.KeyPairKeyObjectResult;
  kid?: string;
  claims?: Record<string, unknown>;
  algorithm?: jwt.Algorithm;
  key?: string | Buffer;
} = {}) {
  const claims = {
    iss: ISSUER,
    aud: CLIENT_ID,
    sub: 'idp-subject-1',
    email: 'Maya@Example.com',
    email_verified: true,
    nonce: NONCE,
    ...options.claims,
  };
  const signingKey = options.key
    ?? (options.pair ?? keyPair).privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  return jwt.sign(claims, signingKey, {
    algorithm: options.algorithm ?? 'RS256',
    keyid: options.kid ?? KID,
    expiresIn: '5m',
  });
}

const fetchQueue: Array<{ ok: boolean; status: number; json: unknown }> = [];
const fetchedUrls: string[] = [];

beforeEach(() => {
  resetOidcCaches();
  fetchQueue.length = 0;
  fetchedUrls.length = 0;
  global.fetch = jest.fn(async (url: unknown) => {
    fetchedUrls.push(String(url));
    const next = fetchQueue.shift() ?? { ok: true, status: 200, json: jwks() };
    return { ok: next.ok, status: next.status, json: async () => next.json } as Response;
  }) as unknown as typeof fetch;
});

const verify = (token: string) =>
  verifyIdToken({ idToken: token, issuer: ISSUER, clientId: CLIENT_ID, nonce: NONCE, jwksUri: `${ISSUER}/jwks` });

describe('OIDC discovery', () => {
  const metadata = {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    jwks_uri: `${ISSUER}/jwks`,
  };

  it('reads the well-known document', async () => {
    fetchQueue.push({ ok: true, status: 200, json: metadata });
    await expect(discover(ISSUER)).resolves.toMatchObject(metadata);
    expect(fetchedUrls[0]).toBe(`${ISSUER}/.well-known/openid-configuration`);
  });

  it('caches, so every login does not refetch it', async () => {
    fetchQueue.push({ ok: true, status: 200, json: metadata });
    await discover(ISSUER);
    await discover(ISSUER);
    expect(fetchedUrls).toHaveLength(1);
  });

  /**
   * Without this, a provider could hand back metadata naming a different
   * issuer, and every later `iss` check would pass against the wrong authority.
   */
  it('refuses a document that claims a different issuer', async () => {
    fetchQueue.push({ ok: true, status: 200, json: { ...metadata, issuer: 'https://evil.example.com' } });
    await expect(discover(ISSUER)).rejects.toThrow(/does not match its discovery document/i);
  });

  it.each(['authorization_endpoint', 'token_endpoint', 'jwks_uri'])('refuses a document missing %s', async (field) => {
    const incomplete = { ...metadata } as Record<string, unknown>;
    delete incomplete[field];
    fetchQueue.push({ ok: true, status: 200, json: incomplete });
    await expect(discover(ISSUER)).rejects.toThrow(new RegExp(`missing ${field}`));
  });
});

describe('ID token verification', () => {
  it('accepts a correctly signed token and normalises the email', async () => {
    await expect(verify(idToken())).resolves.toMatchObject({
      subject: 'idp-subject-1',
      email: 'maya@example.com', // lower-cased, so matching a user cannot miss on case
      emailVerified: true,
    });
  });

  /** A token signed by anyone else is the whole attack; the signature check is the answer. */
  it('refuses a token signed by a different key', async () => {
    await expect(verify(idToken({ pair: otherPair }))).rejects.toThrow(/verification failed/i);
  });

  it('refuses an unsigned token', async () => {
    const unsigned = jwt.sign({ iss: ISSUER, aud: CLIENT_ID, sub: 'x', email: 'a@b.com', nonce: NONCE }, '', {
      algorithm: 'none',
    });
    await expect(verify(unsigned)).rejects.toThrow(/Unsupported ID token algorithm/);
  });

  /**
   * Algorithm confusion: an HS256 token would be verified with the client
   * secret, which the provider also knows — so accepting HMAC lets anyone
   * holding it mint identities.
   */
  it('refuses an HMAC-signed token outright', async () => {
    const hmac = idToken({ algorithm: 'HS256', key: 'the-client-secret' });
    await expect(verify(hmac)).rejects.toThrow(/Unsupported ID token algorithm/);
  });

  it('refuses a token for another audience', async () => {
    await expect(verify(idToken({ claims: { aud: 'someone-elses-client' } }))).rejects.toThrow(/verification failed/i);
  });

  it('refuses a token from another issuer', async () => {
    await expect(verify(idToken({ claims: { iss: 'https://evil.example.com' } }))).rejects.toThrow(/verification failed/i);
  });

  it('refuses an expired token', async () => {
    const expired = jwt.sign(
      { iss: ISSUER, aud: CLIENT_ID, sub: 'x', email: 'a@b.com', nonce: NONCE, exp: Math.floor(Date.now() / 1000) - 600 },
      keyPair.privateKey.export({ type: 'pkcs8', format: 'pem' }) as string,
      { algorithm: 'RS256', keyid: KID },
    );
    await expect(verify(expired)).rejects.toThrow(/verification failed/i);
  });

  /** Nonce binds the token to the attempt this server started. */
  it('refuses a token whose nonce belongs to another login attempt', async () => {
    await expect(verify(idToken({ claims: { nonce: 'someone-elses-nonce' } }))).rejects.toThrow(/nonce does not match/i);
  });

  it('refuses a token with no email', async () => {
    await expect(verify(idToken({ claims: { email: undefined } }))).rejects.toThrow(/did not return an email/i);
  });

  it.each([[false], ['false'], [undefined], ['yes']])('reports email_verified=%p as unverified', async (value) => {
    const result = await verify(idToken({ claims: { email_verified: value } }));
    expect(result.emailVerified).toBe(false);
  });

  it('accepts the string "true", which some providers send instead of a boolean', async () => {
    const result = await verify(idToken({ claims: { email_verified: 'true' } }));
    expect(result.emailVerified).toBe(true);
  });

  /**
   * Providers rotate keys. Once a set is cached, a token signed by the next key
   * must trigger a refetch — otherwise every login fails until the cache
   * expires, which is an outage the provider did nothing wrong to cause.
   */
  it('refetches the cached key set when a token names a kid it has not seen', async () => {
    fetchQueue.push({ ok: true, status: 200, json: jwks(keyPair, 'old-kid') });
    fetchQueue.push({ ok: true, status: 200, json: jwks(keyPair, 'rotated-kid') });

    // Warm the cache with the old key set.
    await expect(verify(idToken({ kid: 'old-kid' }))).resolves.toMatchObject({ email: 'maya@example.com' });
    expect(fetchedUrls).toHaveLength(1);

    // The next token is signed under a kid the cache has never seen.
    await expect(verify(idToken({ kid: 'rotated-kid' }))).resolves.toMatchObject({ email: 'maya@example.com' });
    expect(fetchedUrls).toHaveLength(2);
  });

  it('serves a second login from the cached key set rather than refetching', async () => {
    fetchQueue.push({ ok: true, status: 200, json: jwks() });
    await verify(idToken());
    await verify(idToken());
    expect(fetchedUrls).toHaveLength(1);
  });

  it('fails cleanly when no key matches', async () => {
    fetchQueue.push({ ok: true, status: 200, json: { keys: [] } });
    await expect(verify(idToken())).rejects.toThrow(/key for this token was not found/i);
  });
});

describe('PKCE', () => {
  it('derives the challenge as the S256 hash of the verifier', () => {
    const { verifier, challenge } = createPkcePair();
    expect(challenge).toBe(crypto.createHash('sha256').update(verifier).digest('base64url'));
    expect(verifier).not.toBe(challenge);
    expect(verifier.length).toBeGreaterThanOrEqual(43); // RFC 7636 minimum
  });

  it('never repeats a verifier', () => {
    const verifiers = new Set(Array.from({ length: 50 }, () => createPkcePair().verifier));
    expect(verifiers.size).toBe(50);
  });
});
