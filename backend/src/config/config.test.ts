import { buildConfig, loadEnv } from './index';

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
    const missing: NodeJS.ProcessEnv = { ...validEnv };
    delete missing.ENCRYPTION_KEY;
    expect(() => loadEnv(missing)).toThrow(/ENCRYPTION_KEY/);
  });

  it('rejects a too-short encryption key (no insecure fallback)', () => {
    expect(() => loadEnv({ ...validEnv, ENCRYPTION_KEY: 'short' })).toThrow(/ENCRYPTION_KEY/);
  });

  it('throws when JWT secrets are absent', () => {
    const missing: NodeJS.ProcessEnv = { ...validEnv };
    delete missing.JWT_ACCESS_SECRET;
    expect(() => loadEnv(missing)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('defaults to secure cookies in production, including an HTTP APP_URL', () => {
    expect(buildConfig(loadEnv({ ...validEnv, NODE_ENV: 'production', APP_URL: 'http://example.test' })).cookies.secure).toBe(true);
    expect(buildConfig(loadEnv({ ...validEnv, NODE_ENV: 'development' })).cookies.secure).toBe(false);
  });

  it.each(['true', 'false'])('parses explicit COOKIE_SECURE=%s without boolean coercion', (value) => {
    expect(buildConfig(loadEnv({ ...validEnv, NODE_ENV: 'production', COOKIE_SECURE: value })).cookies.secure).toBe(value === 'true');
  });

  it.each(['', '0', 'no', 'FALSE'])('rejects an ambiguous COOKIE_SECURE value %s', (value) => {
    expect(() => loadEnv({ ...validEnv, COOKIE_SECURE: value })).toThrow(/COOKIE_SECURE/);
  });

  it.each([
    ['REDIS_ENABLED', 'redis'],
    ['RABBITMQ_ENABLED', 'rabbitmq'],
    ['QUEUE_ENABLED', 'queue'],
  ] as const)('parses explicit %s=false without truthy string coercion', (key, section) => {
    const parsed = buildConfig(loadEnv({ ...validEnv, NODE_ENV: 'production', [key]: 'false' }));
    expect(parsed[section].enabled).toBe(false);
  });

  it.each(['REDIS_ENABLED', 'RABBITMQ_ENABLED', 'QUEUE_ENABLED'] as const)(
    'rejects ambiguous %s values',
    (key) => {
      expect(() => loadEnv({ ...validEnv, [key]: '0' })).toThrow(new RegExp(key));
    },
  );
});

describe('production placeholder secret guard', () => {
  const prodEnv: NodeJS.ProcessEnv = { ...validEnv, NODE_ENV: 'production' };

  it.each([
    ['JWT_ACCESS_SECRET', 'dev-access-secret-key-min-32-chars-long'],
    ['JWT_REFRESH_SECRET', 'dev-refresh-secret-key-min-32-chars-long'],
    ['SESSION_SECRET', 'your-session-secret-key-min-32-chars'],
    ['CSRF_SECRET', 'your-csrf-secret-key-min-32-chars'],
    ['ENCRYPTION_KEY', 'your-32-char-encryption-key-here-1234'],
  ] as const)('rejects placeholder %s in production', (key, value) => {
    expect(() => loadEnv({ ...prodEnv, [key]: value })).toThrow(new RegExp(key));
  });

  it('lists every offending secret at once', () => {
    expect(() =>
      loadEnv({
        ...prodEnv,
        JWT_ACCESS_SECRET: 'dev-access-secret-key-min-32-chars-long',
        ENCRYPTION_KEY: 'your-32-char-encryption-key-here-1234',
      })
    ).toThrow(/JWT_ACCESS_SECRET[\s\S]*ENCRYPTION_KEY/);
  });

  it('still accepts dev placeholders outside production', () => {
    expect(() => loadEnv({ ...validEnv, JWT_ACCESS_SECRET: 'dev-access-secret-key-min-32-chars-long' })).not.toThrow();
  });

  it('accepts strong secrets in production', () => {
    expect(() => loadEnv(prodEnv)).not.toThrow();
  });
});
