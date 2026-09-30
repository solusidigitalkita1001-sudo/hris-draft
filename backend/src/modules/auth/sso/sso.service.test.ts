type Row = Record<string, unknown>;

const state: {
  company: Row | null;
  provider: Row | null;
  attempt: Row | null;
  user: Row | null;
  created: Row[];
  updates: Array<{ table: string; where: Row; data: Row }>;
  claimCount: number;
  identity: Row;
  userQueries: Row[];
} = {
  company: null, provider: null, attempt: null, user: null,
  created: [], updates: [], claimCount: 1, identity: {}, userQueries: [],
};

jest.mock('@/shared/database/prisma', () => {
  const client = {
    company: { findFirst: jest.fn(async () => state.company) },
    ssoProvider: {
      findFirst: jest.fn(async () => state.provider),
      findMany: jest.fn(async () => (state.provider ? [state.provider] : [])),
      create: jest.fn(async ({ data }: { data: Row }) => {
        const row = { id: 'provider-new', isActive: true, ...data };
        state.created.push(row);
        return row;
      }),
      update: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'provider', where, data });
        return { id: where.id, ...data };
      }),
    },
    ssoLoginAttempt: {
      create: jest.fn(async ({ data }: { data: Row }) => {
        state.created.push(data);
        return { id: 'attempt-1', ...data };
      }),
      findUnique: jest.fn(async () => state.attempt),
      updateMany: jest.fn(async ({ where, data }: { where: Row; data: Row }) => {
        state.updates.push({ table: 'attempt', where, data });
        return { count: state.claimCount };
      }),
      deleteMany: jest.fn(async () => ({ count: 3 })),
    },
    user: {
      findFirst: jest.fn(async ({ where }: { where: Row }) => {
        state.userQueries.push(where);
        return state.user;
      }),
    },
  };
  return { __esModule: true, default: client, prisma: client };
});

jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/context/RequestContext', () => ({
  getCurrentUser: () => ({ id: 'user-admin' }),
  runInSystemContext: (_reason: string, work: () => unknown) => work(),
}));
jest.mock('@/shared/security/secret-crypto', () => ({
  encryptSecret: (value: string) => `enc(${value})`,
  decryptSecret: () => 'client-secret',
}));
jest.mock('@/modules/webhook/webhook-url-guard', () => ({
  assertDeliverableUrl: (raw: string) => new URL(raw),
  assertResolvesPublicly: jest.fn(async () => undefined),
}));
jest.mock('./oidc-client', () => ({
  discover: jest.fn(async (issuer: string) => ({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
  })),
  createPkcePair: () => ({ verifier: 'verifier-value', challenge: 'challenge-value' }),
  exchangeCode: jest.fn(async () => ({ idToken: 'id-token' })),
  verifyIdToken: jest.fn(async () => state.identity),
}));

import { SsoService } from './sso.service';
import { exchangeCode, verifyIdToken } from './oidc-client';

const service = new SsoService();
const COMPANY = 'company-a';

function providerRow(over: Row = {}) {
  return {
    id: 'provider-1', companyId: COMPANY, name: 'Google Workspace',
    issuer: 'https://accounts.google.com', clientId: 'client-id',
    clientSecretCipher: 'cipher', allowedDomains: [], autoProvision: false,
    isActive: true, deletedAt: null, ...over,
  };
}

function attemptRow(over: Row = {}) {
  return {
    id: 'attempt-1', companyId: COMPANY, providerId: 'provider-1',
    state: 'state-value', nonce: 'nonce-value', codeVerifier: 'verifier-value',
    redirectUri: 'https://app.example.com/api/v1/auth/sso/callback',
    returnTo: '/dashboard', expiresAt: new Date(Date.now() + 60_000), consumedAt: null,
    provider: providerRow(), ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.company = { id: COMPANY };
  state.provider = providerRow();
  state.attempt = attemptRow();
  state.user = { id: 'user-1', email: 'maya@example.com', status: 'ACTIVE' };
  state.created = [];
  state.updates = [];
  state.claimCount = 1;
  state.userQueries = [];
  state.identity = { subject: 'idp-sub', email: 'maya@example.com', emailVerified: true };
});

describe('starting an SSO login', () => {
  it('stores state, nonce and the PKCE verifier, and sends the user to the provider', async () => {
    const { authorizeUrl } = await service.start('COMPANY-CODE', '/leave', '1.2.3.4');

    const attempt = state.created[0];
    expect(attempt).toMatchObject({ providerId: 'provider-1', nonce: expect.any(String), codeVerifier: 'verifier-value', returnTo: '/leave' });

    const url = new URL(authorizeUrl);
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/authorize');
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('code_challenge')).toBe('challenge-value');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('state')).toBe(attempt.state);
    expect(url.searchParams.get('nonce')).toBe(attempt.nonce);
  });

  /**
   * An open redirect here would let a phishing page start a real login and land
   * the user, now authenticated, on a page the attacker chose.
   */
  it.each([
    ['an absolute URL', 'https://evil.example.com/steal'],
    ['a protocol-relative URL', '//evil.example.com/steal'],
    ['a javascript URL', 'javascript:alert(1)'],
  ])('drops %s as a return destination', async (_label, returnTo) => {
    await service.start('COMPANY-CODE', returnTo);
    expect(state.created[0].returnTo).toBeNull();
  });

  it('refuses when the company has no active provider', async () => {
    state.provider = null;
    await expect(service.start('COMPANY-CODE', undefined)).rejects.toThrow(/no active SSO provider/i);
  });

  it('refuses an unknown company code', async () => {
    state.company = null;
    await expect(service.start('NOPE', undefined)).rejects.toThrow(/Company not found/i);
  });
});

describe('completing the callback', () => {
  it('verifies the token against the stored nonce and returns the matched identity', async () => {
    const result = await service.completeCallback('state-value', 'auth-code', '1.2.3.4');

    expect(exchangeCode).toHaveBeenCalledWith(expect.objectContaining({ code: 'auth-code', codeVerifier: 'verifier-value' }));
    expect(verifyIdToken).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'nonce-value', clientId: 'client-id' }));
    expect(result).toMatchObject({ email: 'maya@example.com', companyId: COMPANY, returnTo: '/dashboard' });
  });

  /** One authorization code, one session. A replayed state must not mint a second. */
  it('consumes the attempt before anything else, and refuses a second use', async () => {
    await service.completeCallback('state-value', 'auth-code');
    expect(state.updates[0]).toMatchObject({ table: 'attempt', where: { consumedAt: null } });

    state.attempt = attemptRow({ consumedAt: new Date() });
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/already used/i);
  });

  it('refuses when a concurrent callback claimed the attempt first', async () => {
    state.claimCount = 0;
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/already used/i);
    expect(exchangeCode).not.toHaveBeenCalled();
  });

  it('refuses an expired attempt', async () => {
    state.attempt = attemptRow({ expiresAt: new Date(Date.now() - 1000) });
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/expired/i);
  });

  it('refuses an unknown state', async () => {
    state.attempt = null;
    await expect(service.completeCallback('made-up', 'auth-code')).rejects.toThrow(/Unknown SSO login attempt/i);
  });

  /**
   * The account-takeover case. A provider that lets someone type any address
   * without proving it would otherwise let them claim a colleague's email and
   * be matched to that colleague's user.
   */
  it('refuses an unverified email', async () => {
    state.identity = { subject: 'idp-sub', email: 'ceo@example.com', emailVerified: false };
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/unverified/i);
  });

  it('enforces the allowed email domains when set', async () => {
    state.attempt = attemptRow({ provider: providerRow({ allowedDomains: ['company.com'] }) });
    state.identity = { subject: 'idp-sub', email: 'someone@gmail.com', emailVerified: true };
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/domain is not allowed/i);
  });

  it('allows any domain when the list is empty', async () => {
    state.identity = { subject: 'idp-sub', email: 'someone@gmail.com', emailVerified: true };
    state.user = { id: 'user-2', email: 'someone@gmail.com', status: 'ACTIVE' };
    await expect(service.completeCallback('state-value', 'auth-code')).resolves.toMatchObject({ email: 'someone@gmail.com' });
  });

  /** A login through one tenant's provider must not resolve to another tenant's user. */
  it('looks the user up within the provider company only', async () => {
    await service.completeCallback('state-value', 'auth-code');
    expect(state.userQueries[0]).toMatchObject({
      email: 'maya@example.com',
      companyAccesses: { some: { companyId: COMPANY } },
    });
  });

  /**
   * SSO authenticates; it does not create accounts. Letting a directory decide
   * who has an HRIS account means anyone with a company mailbox — a contractor,
   * an intern, a departed employee — walks in.
   */
  it('refuses an identity with no matching account, and says what to do', async () => {
    state.user = null;
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/Ask HR to create one first/i);
  });

  it('refuses rather than half-creating an account even when auto-provision is on', async () => {
    state.user = null;
    state.attempt = attemptRow({ provider: providerRow({ autoProvision: true }) });
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/not implemented/i);
  });

  it('refuses when the provider was deactivated after the login started', async () => {
    state.attempt = attemptRow({ provider: providerRow({ isActive: false }) });
    await expect(service.completeCallback('state-value', 'auth-code')).rejects.toThrow(/no longer active/i);
  });
});

describe('provider registration', () => {
  const input = {
    name: 'Google Workspace',
    issuer: 'https://accounts.google.com',
    clientId: 'client-id',
    clientSecret: 'super-secret',
  };

  it('stores the client secret encrypted and hands back the redirect URI to configure', async () => {
    const provider = await service.register(COMPANY, input);
    expect(state.created[0].clientSecretCipher).toBe('enc(super-secret)');
    expect(provider.redirectUri).toMatch(/\/auth\/sso\/callback$/);
  });

  it('defaults auto-provisioning to off, because account creation is an HR decision', async () => {
    await service.register(COMPANY, input);
    expect(state.created[0].autoProvision).toBe(false);
  });

  it('normalises allowed domains, accepting a leading @ and mixed case', async () => {
    await service.register(COMPANY, { ...input, allowedDomains: ['@Company.COM', 'sub.company.com'] });
    expect(state.created[0].allowedDomains).toEqual(['company.com', 'sub.company.com']);
  });

  it.each([['not-a-domain'], ['company'], ['http://company.com']])('refuses %p as an allowed domain', async (domain) => {
    await expect(service.register(COMPANY, { ...input, allowedDomains: [domain] })).rejects.toThrow(/bare domain names/i);
  });

  it('refuses an issuer carrying a query string', async () => {
    await expect(service.register(COMPANY, { ...input, issuer: 'https://idp.example.com/?tenant=x' }))
      .rejects.toThrow(/query string or fragment/i);
  });

  it('never returns the stored secret when listing', async () => {
    await service.list(COMPANY);
    const { prisma } = jest.requireMock('@/shared/database/prisma') as { prisma: { ssoProvider: { findMany: jest.Mock } } };
    expect(prisma.ssoProvider.findMany.mock.calls[0][0].select.clientSecretCipher).toBeUndefined();
  });
});
