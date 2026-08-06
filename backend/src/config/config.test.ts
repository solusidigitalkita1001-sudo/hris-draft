import { loadEnv } from './index';

const validEnv: NodeJS.ProcessEnv = {
  DATABASE_URL: 'mysql://root:pw@localhost:3306/hris',
  JWT_ACCESS_SECRET: 'a'.repeat(16),
  JWT_REFRESH_SECRET: 'b'.repeat(16),
  SESSION_SECRET: 'c'.repeat(16),
  CSRF_SECRET: 'd'.repeat(16),
  ENCRYPTION_KEY: 'e'.repeat(32),
};

describe('loadEnv (Task 0.1 env validation)', () => {
  it('accepts a valid env and applies defaults', () => {
    const env = loadEnv(validEnv);
    expect(env.APP_PORT).toBe(3000); // default
    expect(env.NODE_ENV).toBe('development'); // default
  });

  it('throws listing the missing required secret', () => {
    const { ENCRYPTION_KEY, ...missing } = validEnv;
    expect(() => loadEnv(missing)).toThrow(/ENCRYPTION_KEY/);
  });

  it('rejects a too-short encryption key (no insecure fallback)', () => {
    expect(() => loadEnv({ ...validEnv, ENCRYPTION_KEY: 'short' })).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when JWT secrets are absent', () => {
    const { JWT_ACCESS_SECRET, ...missing } = validEnv;
    expect(() => loadEnv(missing)).toThrow(/JWT_ACCESS_SECRET/);
  });
});
