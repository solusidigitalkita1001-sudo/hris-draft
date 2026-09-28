import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Tenant enforcement is an allowlist: the Prisma middleware skips any model
 * that is absent from COMPANY_SCOPED_MODELS, so a forgotten entry means a
 * table with a real companyId gets zero enforcement and depends on every call
 * site remembering to filter by hand. That has already happened more than once
 * in this repository, so the allowlist is verified against the schema here
 * instead of by review.
 *
 * The lists are module-private, and importing prisma.ts would construct a real
 * client, so they are read from source. Each parse asserts a plausible size so
 * a rename cannot quietly turn this suite into a no-op.
 */

const root = join(__dirname, '..', '..');
const read = (relative: string) => readFileSync(join(root, relative), 'utf8');

/**
 * Models that carry a companyId but are deliberately NOT middleware-scoped.
 * Each entry needs a reason: the middleware is fail-closed, so scoping one of
 * these would break a flow that legitimately runs before or across tenant
 * context.
 */
const DELIBERATE_EXEMPTIONS: Record<string, string> = {
  UserCompanyAccess:
    'Resolves which companies a user may select, which has to be readable before an active company exists.',
  UserRole:
    'Role membership is read during authentication, before tenant context is established.',
};

function parseModels(): Map<string, string> {
  const schema = read('database/prisma/schema.prisma');
  const models = new Map<string, string>();
  for (const match of schema.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) models.set(match[1], match[2]);
  expect(models.size).toBeGreaterThan(100);
  return models;
}

function parseSet(source: string, opener: string, closer: string): string[] {
  const [, rest] = source.split(opener);
  expect(rest).toBeDefined();
  const block = rest.split(closer)[0];
  return [...block.matchAll(/'([A-Za-z]+)'/g)].map((match) => match[1]);
}

const models = parseModels();
const companyOwned = [...models.entries()]
  .filter(([, body]) => /^\s*companyId\s+/m.test(body))
  .map(([name]) => name);
const prismaSource = read('shared/database/prisma.ts');
const tenantScopeSource = read('shared/database/tenant-scope.ts');
const allowlist = parseSet(prismaSource, 'COMPANY_SCOPED_MODELS = new Set([', ']);');
const platformFallback = parseSet(tenantScopeSource, 'PLATFORM_FALLBACK_MODELS = new Set([', ']);');
const parentScopes = [
  ...tenantScopeSource
    .split('PARENT_SCOPES: Record<string, { relation: string; foreignKey: string }> = {')[1]
    .split('\n};')[0]
    .matchAll(/^ {2}(\w+):\s*\{/gm),
].map((match) => match[1]);

describe('tenant scope allowlist covers the schema', () => {
  it('parsed every list it asserts on', () => {
    expect(companyOwned.length).toBeGreaterThan(100);
    expect(allowlist.length).toBeGreaterThan(100);
    expect(parentScopes.length).toBeGreaterThan(20);
    expect(platformFallback.length).toBeGreaterThan(0);
  });

  it('scopes every model that carries a companyId, or exempts it with a reason', () => {
    const unscoped = companyOwned.filter(
      (model) => !allowlist.includes(model) && !(model in DELIBERATE_EXEMPTIONS),
    );
    expect(unscoped).toEqual([]);
    for (const reason of Object.values(DELIBERATE_EXEMPTIONS)) expect(reason.length).toBeGreaterThan(20);
  });

  it('keeps the exemption list honest', () => {
    for (const model of Object.keys(DELIBERATE_EXEMPTIONS)) {
      // A stale exemption hides a model that is now scoped, or one that no
      // longer exists, so both cases have to fail.
      expect(companyOwned).toContain(model);
      expect(allowlist).not.toContain(model);
    }
  });

  it('registers every parent-scoped child in the allowlist', () => {
    // The middleware returns early for models outside the allowlist, so a
    // PARENT_SCOPES entry alone enforces nothing.
    expect(parentScopes.filter((model) => !allowlist.includes(model))).toEqual([]);
  });

  it('lists only real models, and only company-owned ones as platform-fallback', () => {
    expect(allowlist.filter((model) => !models.has(model))).toEqual([]);
    expect(parentScopes.filter((model) => !models.has(model))).toEqual([]);
    expect(platformFallback.filter((model) => !allowlist.includes(model))).toEqual([]);
    for (const model of platformFallback) {
      // A platform-fallback read relaxes to companyId null, which only makes
      // sense for a nullable company column.
      expect(models.get(model)).toMatch(/companyId\s+String\?/);
    }
  });
});
