import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(__dirname, '04-admin-user.seed.ts'), 'utf8');

/**
 * S-M2: the seed hashed a hardcoded `'Admin123!'` and set
 * `mustChangePassword: false` for the `admin@hrms.com` account it creates.
 * That is the exact credential pair the README used to publish. These are
 * source assertions (belt-and-suspenders alongside the behavioural
 * `resolveAdminPassword` unit tests) so a future edit cannot silently
 * reintroduce the literal.
 */
describe('04-admin-user.seed.ts no longer ships a predictable admin password', () => {
  it('does not hardcode the old default password', () => {
    expect(source).not.toContain('Admin123!');
  });

  it('forces a password change on first login', () => {
    expect(source).toContain('mustChangePassword: true');
  });

  it('resolves the password via the env-overridable resolver', () => {
    expect(source).toContain('resolveAdminPassword');
  });

  /**
   * Fix-review M7: the previous version of this test compared the position
   * of two unrelated indexOf calls (skip-check vs. resolver call), which did
   * not actually prove the password is printed once. This counts the
   * literal interpolation site in source instead.
   */
  it('interpolates the resolved password into a console.log exactly once', () => {
    const occurrences = source.split('${password}').length - 1;
    expect(occurrences).toBe(1);
  });

  it('only reaches password resolution/printing after the exists-check returns', () => {
    // The skip-if-exists branch returns before any password is touched.
    const existingUserSkip = source.indexOf('already exists');
    const passwordResolution = source.indexOf('resolveAdminPassword(');
    expect(existingUserSkip).toBeGreaterThan(-1);
    expect(passwordResolution).toBeGreaterThan(existingUserSkip);
  });

  // Fix-review M5: skipping (admin already exists) must say so explicitly,
  // including that an env override had no effect, instead of silently
  // doing nothing with it.
  it('logs that SEED_ADMIN_PASSWORD is ignored when an existing admin is kept', () => {
    const skipBranchStart = source.indexOf('if (existingUser)');
    expect(skipBranchStart).toBeGreaterThan(-1);
    const skipBranchEnd = source.indexOf('return;', skipBranchStart);
    const skipBranch = source.slice(skipBranchStart, skipBranchEnd);
    expect(skipBranch).toContain('SEED_ADMIN_PASSWORD ignored');
  });

  // Fix-review M6: mustChangePassword only drives a UI notice, not a
  // server-side gate — the console output must not overclaim otherwise.
  it('does not claim the admin is "forced" to change the password', () => {
    expect(source.toLowerCase()).not.toContain('forced to change');
  });
});
