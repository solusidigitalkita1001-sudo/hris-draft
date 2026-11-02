import { resolveAdminPassword } from './admin-password';
import { ValidationError } from '@/shared/exceptions/AppError';
import config from '@/config';

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
  it('uses SEED_ADMIN_PASSWORD when it is set and meets the password policy', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: 'Op3rator-Chosen!' });
    expect(result).toEqual({ password: 'Op3rator-Chosen!', wasGenerated: false });
  });

  it('generates a random password meeting the password policy when env is unset', () => {
    const result = resolveAdminPassword({ SEED_ADMIN_PASSWORD: undefined });
    expect(result.wasGenerated).toBe(true);
    expect(result.password.length).toBeGreaterThanOrEqual(config.password.minLength);
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

  /**
   * Fix-review I1: an env-supplied value used to be trusted verbatim, so
   * `SEED_ADMIN_PASSWORD=a` would have become a valid, login-usable password
   * for the global SUPER_ADMIN account — `passwordHandler.validate()` is
   * normally only enforced on self-service change/reset, never on login.
   */
  describe('rejects a SEED_ADMIN_PASSWORD that fails the repo password policy', () => {
    it.each([
      ['a', 'too short, no uppercase/digit/special'],
      ['alllowercase', 'no uppercase/digit/special'],
      ['ALLUPPERCASE1!', 'no lowercase'],
      ['NoSpecialChar1', 'no special character'],
      ['NoDigits!!', 'no digit'],
    ])('rejects %s (%s)', (candidate) => {
      expect(() => resolveAdminPassword({ SEED_ADMIN_PASSWORD: candidate })).toThrow(ValidationError);
    });

    it('carries a per-field message naming the SEED_ADMIN_PASSWORD/password policy failure', () => {
      expect.assertions(2);
      try {
        resolveAdminPassword({ SEED_ADMIN_PASSWORD: 'a' });
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect((err as ValidationError).errors?.length ?? 0).toBeGreaterThan(0);
      }
    });
  });

  /**
   * Fix-review M2: a padded value is REJECTED outright, never silently
   * trimmed — see the long comment in admin-password.ts for why trimming
   * would be the more dangerous choice here (it would seed a different
   * password than the operator believes they set, with no signal that
   * anything changed).
   */
  describe('rejects a SEED_ADMIN_PASSWORD with leading/trailing whitespace padding', () => {
    it.each([
      [' Valid-Pass1!', 'leading space'],
      ['Valid-Pass1! ', 'trailing space'],
      [' Valid-Pass1! ', 'both sides'],
      ['\tValid-Pass1!', 'leading tab'],
    ])('rejects %j (%s) instead of trimming it', (candidate) => {
      expect(() => resolveAdminPassword({ SEED_ADMIN_PASSWORD: candidate })).toThrow(ValidationError);
    });

    it('does not quietly use the trimmed password instead', () => {
      // If this ever silently trimmed, it would return successfully here —
      // it must not.
      expect(() => resolveAdminPassword({ SEED_ADMIN_PASSWORD: ' Valid-Pass1! ' })).toThrow();
    });
  });
});
