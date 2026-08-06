import dotenv from 'dotenv';
import path from 'path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Task 0.1 (SEC-001, SEC-002, OPS-002): validate env at bootstrap.
// Security secrets are REQUIRED with no fallback — the app must refuse to start
// rather than run on a guessable default key.
const csv = (val?: string) => (val ? val.split(',').map((s) => s.trim()).filter(Boolean) : undefined);

const envSchema = z.object({
  // App
  APP_NAME: z.string().default('HRMS Enterprise API'),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  APP_URL: z.string().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PREFIX: z.string().default('/api/v1'),

  // Database — required
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().positive().default(40),
  DB_POOL_TIMEOUT: z.coerce.number().int().positive().default(10),
  DB_SLOW_QUERY_MS: z.coerce.number().int().positive().default(2000),
  READ_REPLICA_DATABASE_URL: z.string().optional(), // Task 2.9: optional read replica

  // Redis
  REDIS_ENABLED: z.coerce.boolean().default(true),
  REDIS_URL: z.string().default(''),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().int().default(0),
  REDIS_KEY_PREFIX: z.string().default('hrms:'),

  // RabbitMQ
  RABBITMQ_URL: z.string().default('amqp://guest:guest@localhost:5672'),
  RABBITMQ_EXCHANGE: z.string().default('hrms.domain-events'),
  RABBITMQ_QUEUE_PREFIX: z.string().default('hrms'),
  RABBITMQ_PREFETCH: z.coerce.number().int().default(20),
  RABBITMQ_ENABLED: z.coerce.boolean().default(true),

  // Queue
  QUEUE_ENABLED: z.coerce.boolean().optional(),
  QUEUE_DEFAULT_ATTEMPTS: z.coerce.number().int().default(3),
  QUEUE_DEFAULT_BACKOFF_MS: z.coerce.number().int().default(5000),

  // JWT — required secrets, no fallback
  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_ISSUER: z.string().default('hrms-enterprise'),

  // Password
  BCRYPT_SALT_ROUNDS: z.coerce.number().int().default(12),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().default(8),
  PASSWORD_MAX_LENGTH: z.coerce.number().int().default(128),
  MAX_LOGIN_ATTEMPTS: z.coerce.number().int().default(5),
  LOCKOUT_DURATION_MINUTES: z.coerce.number().int().default(15),

  // Rate limit
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().int().default(100),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(10),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:5173'),

  // Mail
  SMTP_HOST: z.string().default('smtp.mailtrap.io'),
  SMTP_PORT: z.coerce.number().int().default(2525),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  SMTP_FROM: z.string().default('noreply@hrms.com'),
  SMTP_FROM_NAME: z.string().default('HRMS Enterprise'),

  // Upload
  UPLOAD_MAX_FILE_SIZE: z.coerce.number().int().default(5242880),
  UPLOAD_ALLOWED_MIMES: z.string().default('image/jpeg,image/png,image/gif,application/pdf'),
  UPLOAD_PATH: z.string().default('uploads'),

  // Logging
  LOG_LEVEL: z.string().default('debug'),
  LOG_DIR: z.string().default('logs'),

  // Security secrets — required, no fallback
  SESSION_SECRET: z.string().min(16, 'SESSION_SECRET must be at least 16 chars'),
  CSRF_SECRET: z.string().min(16, 'CSRF_SECRET must be at least 16 chars'),
  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY must be at least 32 chars (AES-256)'),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment. Throws a descriptive Error listing every
 * missing/invalid variable. Exported so tests can assert failure behavior.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return result.data;
}

function buildConfig(env: Env) {
  return {
    app: {
      name: env.APP_NAME,
      port: env.APP_PORT,
      url: env.APP_URL,
      env: env.NODE_ENV,
      apiPrefix: env.API_PREFIX,
    },
    database: {
      url: env.DATABASE_URL,
      readReplicaUrl: env.READ_REPLICA_DATABASE_URL,
      connectionLimit: env.DB_CONNECTION_LIMIT,
      poolTimeout: env.DB_POOL_TIMEOUT,
      slowQueryMs: env.DB_SLOW_QUERY_MS,
    },
    redis: {
      enabled: env.REDIS_ENABLED,
      url: env.REDIS_URL,
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD,
      db: env.REDIS_DB,
      keyPrefix: env.REDIS_KEY_PREFIX,
    },
    rabbitmq: {
      url: env.RABBITMQ_URL,
      exchange: env.RABBITMQ_EXCHANGE,
      queuePrefix: env.RABBITMQ_QUEUE_PREFIX,
      prefetch: env.RABBITMQ_PREFETCH,
      enabled: env.RABBITMQ_ENABLED,
    },
    queue: {
      enabled: env.QUEUE_ENABLED ?? env.REDIS_ENABLED,
      defaultAttempts: env.QUEUE_DEFAULT_ATTEMPTS,
      defaultBackoffMs: env.QUEUE_DEFAULT_BACKOFF_MS,
    },
    jwt: {
      accessSecret: env.JWT_ACCESS_SECRET,
      refreshSecret: env.JWT_REFRESH_SECRET,
      accessExpiresIn: env.JWT_ACCESS_EXPIRES_IN,
      refreshExpiresIn: env.JWT_REFRESH_EXPIRES_IN,
      issuer: env.JWT_ISSUER,
    },
    password: {
      saltRounds: env.BCRYPT_SALT_ROUNDS,
      minLength: env.PASSWORD_MIN_LENGTH,
      maxLength: env.PASSWORD_MAX_LENGTH,
      maxLoginAttempts: env.MAX_LOGIN_ATTEMPTS,
      lockoutDurationMinutes: env.LOCKOUT_DURATION_MINUTES,
    },
    rateLimit: {
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
      authMax: env.AUTH_RATE_LIMIT_MAX,
    },
    cors: { origins: csv(env.CORS_ORIGINS) ?? ['http://localhost:5173'] },
    mail: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.SMTP_FROM,
      fromName: env.SMTP_FROM_NAME,
    },
    upload: {
      maxFileSize: env.UPLOAD_MAX_FILE_SIZE,
      allowedMimes: csv(env.UPLOAD_ALLOWED_MIMES) ?? [],
      uploadPath: env.UPLOAD_PATH,
    },
    logging: { level: env.LOG_LEVEL, dir: env.LOG_DIR },
    session: { secret: env.SESSION_SECRET },
    csrf: { secret: env.CSRF_SECRET },
    encryption: { key: env.ENCRYPTION_KEY },
  };
}

export type Config = ReturnType<typeof buildConfig>;

function initConfig(): Config {
  try {
    return buildConfig(loadEnv());
  } catch (err) {
    // Fail fast with a clear message and non-zero exit — do NOT run on defaults.
    // eslint-disable-next-line no-console
    console.error(`\n[FATAL] ${(err as Error).message}\n`);
    process.exit(1);
  }
}

export const config: Config = initConfig();

export default config;
