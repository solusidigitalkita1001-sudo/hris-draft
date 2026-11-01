import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertTestDataSeedAllowed, ProductionTestDataSeedError } from './test-data-guard';

/**
 * S-M2: `seed.ts` gated the demo test-data seed only on the *inverse* of
 * `SKIP_TEST_DATA` — nothing stopped it from running against a production
 * database by default. `assertTestDataSeedAllowed` is the hard refusal that
 * replaces "silently runs unless someone remembers to opt out".
 */
describe('assertTestDataSeedAllowed', () => {
  it('throws a ProductionTestDataSeedError when NODE_ENV=production', () => {
    expect(() => assertTestDataSeedAllowed('production')).toThrow(ProductionTestDataSeedError);
  });

  it('carries a clear, actionable message naming the escape hatch', () => {
    expect.assertions(3);
    try {
      assertTestDataSeedAllowed('production');
    } catch (err) {
      expect(err).toBeInstanceOf(ProductionTestDataSeedError);
      expect((err as Error).message).toMatch(/production/i);
      expect((err as Error).message).toMatch(/SKIP_TEST_DATA/);
    }
  });

  it.each(['development', 'test', undefined])(
    // 'staging' was dropped from this table: the app's zod env schema
    // (`src/config/index.ts`) restricts NODE_ENV to the enum
    // development|test|production, so 'staging' can never actually reach
    // this function in the running app — asserting a "does not throw" for
    // it tested a state the app cannot be in.
    'does not throw for NODE_ENV=%s',
    (env) => {
      expect(() => assertTestDataSeedAllowed(env)).not.toThrow();
    }
  );

  /**
   * Fix-review M3: the guard normalizes with trim().toLowerCase() so it is
   * self-sufficient — correct even if ever called with a differently-cased
   * or padded value, independent of the zod schema having already
   * normalized NODE_ENV upstream.
   */
  it.each(['PRODUCTION', 'Production', ' production', 'production ', ' PRODUCTION '])(
    'also refuses NODE_ENV=%j (case/whitespace insensitive)',
    (env) => {
      expect(() => assertTestDataSeedAllowed(env)).toThrow(ProductionTestDataSeedError);
    }
  );
});

/**
 * The guard must only wrap the test-data step. Admin/roles/permissions and
 * the post-test-data seeds (workflow defaults, payroll reference tables)
 * have to keep running in production — only the demo data is refused.
 */
describe('seed.ts gates only the test-data step behind the production guard', () => {
  const source = readFileSync(join(__dirname, '..', 'seed.ts'), 'utf8');

  it('seeds the admin user unconditionally, before the guard is even consulted', () => {
    expect(source.indexOf('seedAdminUser()')).toBeGreaterThan(-1);
    expect(source.indexOf('seedAdminUser()')).toBeLessThan(source.indexOf('assertTestDataSeedAllowed()'));
  });

  it('still runs workflow defaults and payroll reference seeds unconditionally', () => {
    expect(source).toContain('seedWorkflowDefaults()');
    expect(source).toContain('seedPayrollReferences(');
  });

  it('catches the refusal so it cannot fail the rest of the seed run', () => {
    expect(source).toContain('ProductionTestDataSeedError');
  });
});

/**
 * 05-test-data.seed.ts prints its own "Login credentials" banner at the end
 * of the run, independent of 04-admin-user.seed.ts. It used to hardcode
 * `admin@hrms.com / Admin123!` there too — which became an outright lie once
 * the admin password became env-driven or randomly generated.
 */
describe('05-test-data.seed.ts no longer prints a false admin credential', () => {
  const testDataSource = readFileSync(join(__dirname, '05-test-data.seed.ts'), 'utf8');

  it('does not print the old hardcoded admin password in its credentials banner', () => {
    expect(testDataSource).not.toContain('Admin123!');
  });
});

/**
 * Fix-review M4: seed.ts already guards the call site, but a bare
 * `import { seedTestData } from '...'; await seedTestData();` from anywhere
 * else (a script, a future caller, a test) would bypass that. seedTestData
 * must refuse on its own, at its own first line, regardless of caller.
 */
describe('seedTestData() enforces the production guard on itself', () => {
  const testDataSource = readFileSync(join(__dirname, '05-test-data.seed.ts'), 'utf8');

  it('calls assertTestDataSeedAllowed() as the first statement in its body', () => {
    const fnStart = testDataSource.indexOf('export async function seedTestData');
    expect(fnStart).toBeGreaterThan(-1);
    const bodyStart = testDataSource.indexOf('{', fnStart);
    const firstCallsite = testDataSource.indexOf('assertTestDataSeedAllowed()', bodyStart);
    const firstConsoleLog = testDataSource.indexOf('console.log', bodyStart);
    expect(firstCallsite).toBeGreaterThan(-1);
    // Allowed to run before any other seeding side effect starts.
    expect(firstCallsite).toBeLessThan(firstConsoleLog);
  });
});
