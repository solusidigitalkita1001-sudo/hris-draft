import crypto from 'node:crypto';
import prisma from '@/shared/database/prisma';
import { AuthError, BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { logger } from '@/shared/logger/WinstonLogger';
import { getCurrentUser, runInSystemContext } from '@/shared/context/RequestContext';
import { encryptSecret, decryptSecret } from '@/shared/security/secret-crypto';
import { assertDeliverableUrl } from '@/modules/webhook/webhook-url-guard';
import config from '@/config';
import { createPkcePair, discover, exchangeCode, verifyIdToken } from './oidc-client';

const ATTEMPT_TTL_MS = 10 * 60 * 1000;

export interface RegisterProviderInput {
  name: string;
  issuer: string;
  clientId: string;
  clientSecret: string;
  allowedDomains?: string[];
  autoProvision?: boolean;
}

/**
 * Single sign-on, per company (GAP-37).
 *
 * Two deliberate positions, both of which cost something and are worth it:
 *
 * 1. **SSO authenticates; it does not create accounts.** `autoProvision`
 *    defaults to false, so an identity provider proving who someone is does not
 *    decide they should have HR access. Who has an account is an HR decision,
 *    and handing it to a directory means anyone with a company mailbox — a
 *    contractor, an intern, a departed employee still in the tenant — could
 *    walk in. With it off, SSO matches an existing user by email or refuses.
 *
 * 2. **An unverified email is refused.** Providers that let a user set any
 *    email without proving it would otherwise be an account-takeover path:
 *    claim `ceo@company.com`, get matched to the CEO's user.
 */
export class SsoService {
  private redirectUri(): string {
    return `${config.app.url.replace(/\/+$/, '')}${config.app.apiPrefix}/auth/sso/callback`;
  }

  async register(companyId: string, input: RegisterProviderInput) {
    // The issuer is tenant-supplied and the server will fetch it during
    // discovery, so it is fenced like any other tenant-supplied URL.
    const issuer = assertDeliverableUrl(input.issuer);
    if (issuer.search || issuer.hash) throw new BadRequestError('Issuer must not carry a query string or fragment');

    // Prove the issuer is real and coherent before storing it, rather than
    // letting the first employee to try SSO discover it is broken.
    await discover(issuer.origin + issuer.pathname.replace(/\/+$/, ''));

    const domains = (input.allowedDomains ?? []).map((domain) => domain.trim().toLowerCase().replace(/^@/, ''));
    if (domains.some((domain) => !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain))) {
      throw new BadRequestError('Allowed domains must be bare domain names, e.g. company.com');
    }

    const provider = await prisma.ssoProvider.create({
      data: {
        companyId,
        name: input.name,
        issuer: issuer.origin + issuer.pathname.replace(/\/+$/, ''),
        clientId: input.clientId,
        clientSecretCipher: encryptSecret(input.clientSecret),
        allowedDomains: domains,
        autoProvision: input.autoProvision ?? false,
        createdBy: getCurrentUser()?.id ?? null,
      },
    });

    logger.info('SSO provider registered', { id: provider.id, companyId, issuer: provider.issuer });
    return {
      id: provider.id,
      name: provider.name,
      issuer: provider.issuer,
      clientId: provider.clientId,
      allowedDomains: provider.allowedDomains,
      autoProvision: provider.autoProvision,
      isActive: provider.isActive,
      // The integrator needs this to configure the provider's own allowlist.
      redirectUri: this.redirectUri(),
    };
  }

  async list(companyId: string) {
    return prisma.ssoProvider.findMany({
      where: { companyId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      // clientSecretCipher is absent on purpose: the secret never leaves.
      select: {
        id: true, name: true, issuer: true, clientId: true, allowedDomains: true,
        autoProvision: true, isActive: true, createdAt: true,
      },
    });
  }

  async update(companyId: string, id: string, patch: { isActive?: boolean; allowedDomains?: string[]; autoProvision?: boolean }) {
    const provider = await prisma.ssoProvider.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!provider) throw new NotFoundError('SSO provider not found');

    return prisma.ssoProvider.update({
      where: { id: provider.id },
      data: {
        ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
        ...(patch.autoProvision !== undefined ? { autoProvision: patch.autoProvision } : {}),
        ...(patch.allowedDomains
          ? { allowedDomains: patch.allowedDomains.map((domain) => domain.trim().toLowerCase().replace(/^@/, '')) }
          : {}),
      },
      select: { id: true, isActive: true, allowedDomains: true, autoProvision: true },
    });
  }

  async remove(companyId: string, id: string) {
    const provider = await prisma.ssoProvider.findFirst({ where: { id, companyId, deletedAt: null }, select: { id: true } });
    if (!provider) throw new NotFoundError('SSO provider not found');
    await prisma.ssoProvider.update({ where: { id: provider.id }, data: { deletedAt: new Date(), isActive: false } });
    return { id, deleted: true };
  }

  /**
   * Begin a login. Runs without a session — nobody is signed in yet — so it
   * reads the provider in system context and never trusts anything but the
   * company code in the URL.
   */
  async start(companyCode: string, returnTo: string | undefined, ipAddress?: string) {
    return runInSystemContext('sso-login-start', async () => {
      const company = await prisma.company.findFirst({
        where: { code: companyCode, deletedAt: null },
        select: { id: true },
      });
      if (!company) throw new NotFoundError('Company not found');

      const provider = await prisma.ssoProvider.findFirst({
        where: { companyId: company.id, isActive: true, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!provider) throw new NotFoundError('This company has no active SSO provider');

      const metadata = await discover(provider.issuer);
      const { verifier, challenge } = createPkcePair();
      const state = crypto.randomBytes(32).toString('base64url');
      const nonce = crypto.randomBytes(32).toString('base64url');
      const redirectUri = this.redirectUri();

      await prisma.ssoLoginAttempt.create({
        data: {
          companyId: company.id,
          providerId: provider.id,
          state,
          nonce,
          codeVerifier: verifier,
          redirectUri,
          // Only a path is accepted, never an absolute URL: an open redirect
          // here would let a phishing page finish a real login and land the
          // user somewhere chosen by the attacker.
          returnTo: returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo.slice(0, 300) : null,
          expiresAt: new Date(Date.now() + ATTEMPT_TTL_MS),
          ipAddress,
        },
      });

      const authorizeUrl = new URL(metadata.authorization_endpoint);
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', provider.clientId);
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('scope', 'openid email profile');
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('nonce', nonce);
      authorizeUrl.searchParams.set('code_challenge', challenge);
      authorizeUrl.searchParams.set('code_challenge_method', 'S256');

      return { authorizeUrl: authorizeUrl.toString(), state };
    });
  }

  /**
   * Finish a login: consume the attempt, verify the token, and resolve the
   * identity to a user of that company.
   *
   * Returns the matched user's email rather than a session — minting the
   * session stays in the auth service, so an SSO login and a password login end
   * up with byte-identical session semantics instead of two implementations
   * that drift.
   */
  async completeCallback(state: string, code: string, ipAddress?: string) {
    return runInSystemContext('sso-login-callback', async () => {
      const attempt = await prisma.ssoLoginAttempt.findUnique({
        where: { state },
        include: { provider: true },
      });
      if (!attempt) throw new AuthError('Unknown SSO login attempt');
      if (attempt.consumedAt) throw new AuthError('This SSO login attempt was already used');
      if (attempt.expiresAt < new Date()) throw new AuthError('This SSO login attempt has expired');

      // Consume before doing anything expensive, conditionally, so two
      // simultaneous callbacks with the same state cannot both proceed.
      const claimed = await prisma.ssoLoginAttempt.updateMany({
        where: { id: attempt.id, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      if (claimed.count !== 1) throw new AuthError('This SSO login attempt was already used');

      const provider = attempt.provider;
      if (!provider.isActive || provider.deletedAt) throw new AuthError('SSO provider is no longer active');

      const metadata = await discover(provider.issuer);
      const { idToken } = await exchangeCode({
        tokenEndpoint: metadata.token_endpoint,
        clientId: provider.clientId,
        clientSecret: decryptSecret(provider.clientSecretCipher),
        code,
        redirectUri: attempt.redirectUri,
        codeVerifier: attempt.codeVerifier,
      });

      const identity = await verifyIdToken({
        idToken,
        issuer: metadata.issuer,
        clientId: provider.clientId,
        nonce: attempt.nonce,
        jwksUri: metadata.jwks_uri,
      });

      if (!identity.emailVerified) {
        // A provider that lets a user type any address without proving it would
        // otherwise be an account-takeover path: claim the CEO's address, get
        // matched to the CEO's user.
        throw new AuthError('Identity provider reports this email as unverified');
      }

      const domains = Array.isArray(provider.allowedDomains) ? (provider.allowedDomains as string[]) : [];
      const domain = identity.email.split('@')[1] ?? '';
      if (domains.length && !domains.includes(domain)) {
        throw new AuthError('This email domain is not allowed for this company');
      }

      const user = await prisma.user.findFirst({
        where: {
          email: identity.email,
          deletedAt: null,
          // The account must have access to this company, or a login through
          // one tenant's provider could land on another tenant's user.
          companyAccesses: { some: { companyId: provider.companyId } },
        },
        select: { id: true, email: true, status: true },
      });

      if (!user) {
        if (!provider.autoProvision) {
          logger.warn('SSO login refused: no matching account', { companyId: provider.companyId, email: identity.email });
          throw new AuthError('No HRIS account matches this identity. Ask HR to create one first.');
        }
        // Auto-provisioning is off by default and remains a tenant decision;
        // even switched on, the account it would create needs a role and an
        // employee link that only HR can supply, so this refuses loudly rather
        // than inventing a half-account.
        throw new AuthError('Automatic account creation is not implemented; ask HR to create the account first.');
      }

      logger.info('SSO identity verified', { companyId: provider.companyId, userId: user.id, issuer: provider.issuer });
      return { email: user.email, companyId: provider.companyId, returnTo: attempt.returnTo, ipAddress };
    });
  }

  /** Housekeeping: expired attempts are useless and must not accumulate. */
  async purgeExpiredAttempts(now = new Date()) {
    const { count } = await prisma.ssoLoginAttempt.deleteMany({
      where: { OR: [{ expiresAt: { lt: now } }, { consumedAt: { not: null } }] },
    });
    return { purged: count };
  }
}

export const ssoService = new SsoService();
