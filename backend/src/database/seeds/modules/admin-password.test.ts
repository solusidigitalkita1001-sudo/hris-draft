import { resolveAdminPassword } from './admin-password';

/**
 * S-M2: the seed used to hash a hardcoded `'Admin123!'` for every
 * `admin@hrms.com` it created, with `mustChangePassword: false`. That pair is
 * now public knowledge (it shipped in the README too), so any deployment
 * that never overrode it is reachable with a published password.
 *
 * `resolveAdminPassword` is the pure decision this fix hinges on: an operator
 * who sets `SEED_ADMIN_PASSWORD` gets exactly that password seeded; one who
 * doesn't gets a fresh, unguessable one every run.
 */
describe('resolveAdminPassword', () => {
  it('uses SEED_ADMIN_PASSWORD when it is set', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: 'Op3rator-Chosen!' });
    expect(result).toEqual({ password: 'Op3rator-Chosen!', wasGenerated: false });
  });

  it('generates a random password meeting the password policy when env is unset', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: undefined });
    expect(result.wasGenerated).toBe(true);
    expect(result.password.length).toBeGreaterThanOrEqual(8);
    expect(result.password).toMatch(/[A-Z]/);
    expect(result.password).toMatch(/[a-z]/);
    expect(result.password).toMatch(/[0-9]/);
    expect(result.password).toMatch(/[^A-Za-z0-9]/);
  });

  it('generates a random password when env is an empty string', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: '' });
    expect(result.wasGenerated).toBe(true);
  });

  it('generates a random password when env is only whitespace', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: '   ' });
    expect(result.wasGenerated).toBe(true);
  });

  it('never repeats the same random password across two calls', () => {
    const first = resolveAdminPassword({ SEED_ADMIN_PASSWORD: undefined });
    const second = resolveAdminPassword({ SEED_ADMIN_PASSWORD: undefined });
    expect(first.password).not.toEqual(second.password);
  });
});
