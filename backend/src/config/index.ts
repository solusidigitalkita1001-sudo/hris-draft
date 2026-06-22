import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  app: {
    name: string;
    port: number;
    url: string;
    env: string;
    apiPrefix: string;
  };
  database: {
    url: string;
  };
  redis: {
    host: string;
    port: number;
    password: string;
  };
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessExpiresIn: string;
    refreshExpiresIn: string;
    issuer: string;
  };
  password: {
    saltRounds: number;
    minLength: number;
    maxLength: number;
    maxLoginAttempts: number;
    lockoutDurationMinutes: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMax: number;
  };
  cors: {
    origins: string[];
  };
  mail: {
    host: string;
    port: number;
    user: string;
    pass: string;
    from: string;
    fromName: string;
  };
  upload: {
    maxFileSize: number;
    allowedMimes: string[];
    uploadPath: string;
  };
  logging: {
    level: string;
    dir: string;
  };
  session: {
    secret: string;
  };
  csrf: {
    secret: string;
  };
  encryption: {
    key: string;
  };
}

function getEnv(key: string, defaultValue?: string): string {
  return process.env[key] || defaultValue || '';
}

function getEnvInt(key: string, defaultValue: number): number {
  const val = process.env[key];
  return val ? parseInt(val, 10) : defaultValue;
}

function getEnvArray(key: string, defaultValue: string[]): string[] {
  const val = process.env[key];
  return val ? val.split(',').map((s) => s.trim()) : defaultValue;
}

export const config: Config = {
  app: {
    name: getEnv('APP_NAME', 'HRMS Enterprise API'),
    port: getEnvInt('APP_PORT', 3000),
    url: getEnv('APP_URL', 'http://localhost:3000'),
    env: getEnv('NODE_ENV', 'development'),
    apiPrefix: getEnv('API_PREFIX', '/api/v1'),
  },
  database: {
    url: getEnv('DATABASE_URL', 'mysql://root:password@localhost:3306/hris_enterprise'),
  },
  redis: {
    host: getEnv('REDIS_HOST', 'localhost'),
    port: getEnvInt('REDIS_PORT', 6379),
    password: getEnv('REDIS_PASSWORD', ''),
  },
  jwt: {
    accessSecret: getEnv('JWT_ACCESS_SECRET', 'fallback-secret-not-secure'),
    refreshSecret: getEnv('JWT_REFRESH_SECRET', 'fallback-secret-not-secure'),
    accessExpiresIn: getEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
    refreshExpiresIn: getEnv('JWT_REFRESH_EXPIRES_IN', '7d'),
    issuer: getEnv('JWT_ISSUER', 'hrms-enterprise'),
  },
  password: {
    saltRounds: getEnvInt('BCRYPT_SALT_ROUNDS', 12),
    minLength: getEnvInt('PASSWORD_MIN_LENGTH', 8),
    maxLength: getEnvInt('PASSWORD_MAX_LENGTH', 128),
    maxLoginAttempts: getEnvInt('MAX_LOGIN_ATTEMPTS', 5),
    lockoutDurationMinutes: getEnvInt('LOCKOUT_DURATION_MINUTES', 15),
  },
  rateLimit: {
    windowMs: getEnvInt('RATE_LIMIT_WINDOW_MS', 900000),
    maxRequests: getEnvInt('RATE_LIMIT_MAX_REQUESTS', 100),
    authMax: getEnvInt('AUTH_RATE_LIMIT_MAX', 10),
  },
  cors: {
    origins: getEnvArray('CORS_ORIGINS', ['http://localhost:5173']),
  },
  mail: {
    host: getEnv('SMTP_HOST', 'smtp.mailtrap.io'),
    port: getEnvInt('SMTP_PORT', 2525),
    user: getEnv('SMTP_USER', ''),
    pass: getEnv('SMTP_PASS', ''),
    from: getEnv('SMTP_FROM', 'noreply@hrms.com'),
    fromName: getEnv('SMTP_FROM_NAME', 'HRMS Enterprise'),
  },
  upload: {
    maxFileSize: getEnvInt('UPLOAD_MAX_FILE_SIZE', 5242880),
    allowedMimes: getEnvArray('UPLOAD_ALLOWED_MIMES', [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
    ]),
    uploadPath: getEnv('UPLOAD_PATH', 'uploads'),
  },
  logging: {
    level: getEnv('LOG_LEVEL', 'debug'),
    dir: getEnv('LOG_DIR', 'logs'),
  },
  session: {
    secret: getEnv('SESSION_SECRET', 'fallback-session-secret'),
  },
  csrf: {
    secret: getEnv('CSRF_SECRET', 'fallback-csrf-secret'),
  },
  encryption: {
    key: getEnv('ENCRYPTION_KEY', 'fallback-encryption-key-32chars!!'),
  },
};

export default config;
