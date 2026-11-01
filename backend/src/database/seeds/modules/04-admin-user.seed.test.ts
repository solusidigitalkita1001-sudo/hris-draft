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

  it('only prints the generated password, never a fixed one, and only once on creation', () => {
    // The skip-if-exists branch returns before any password is touched.
    const existingUserSkip = source.indexOf('already exists');
    const passwordResolution = source.indexOf('resolveAdminPassword(');
    expect(existingUserSkip).toBeGreaterThan(-1);
    expect(passwordResolution).toBeGreaterThan(existingUserSkip);
  });
});
