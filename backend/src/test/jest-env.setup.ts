/**
 * Central test-environment bootstrap.
 *
 * Registered via jest `setupFiles`, so it runs BEFORE any test module is
 * evaluated — and therefore before `src/config` is first imported and runs its
 * fail-fast env validation (`initConfig()` calls `process.exit(1)` when a
 * required var like DATABASE_URL / JWT secrets / ENCRYPTION_KEY is missing).
 *
 * Without this, every suite that transitively imports `@/config` crashes with
 * "process.exit called with 1" the moment it loads — which is why a large batch
 * of suites failed. This gives all suites one consistent, valid config contract
 * instead of ad-hoc per-file mocks, and it does NOT weaken production: real
 * values still win because each assignment is nullish (`??=`), so CI /
 * integration environments that export real vars are used as-is.
 */

process.env.NODE_ENV ??= 'test';

// Database — required (min 1). Points at the CI MySQL service by default; unit
// suites mock Prisma so they never open this connection.
process.env.DATABASE_URL ??= 'mysql://root:root@127.0.0.1:3306/hris_test';

// JWT / security secrets — required with minimum lengths.
process.env.JWT_ACCESS_SECRET ??= 'test-jwt-access-secret-0123456789';   // ≥16
process.env.JWT_REFRESH_SECRET ??= 'test-jwt-refresh-secret-0123456789'; // ≥16
process.env.SESSION_SECRET ??= 'test-session-secret-0123456789ab';       // ≥16
process.env.CSRF_SECRET ??= 'test-csrf-secret-0123456789abcd';           // ≥16
process.env.ENCRYPTION_KEY ??= 'test-encryption-key-0123456789abcdef0123'; // ≥32 (AES-256)

// External services off by default so unit suites never dial out.
process.env.REDIS_ENABLED ??= 'false';
process.env.RABBITMQ_ENABLED ??= 'false';
process.env.QUEUE_ENABLED ??= 'false';
