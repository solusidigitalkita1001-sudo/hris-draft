import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import config from '@/config';

const logDir = path.resolve(process.cwd(), config.logging.dir);

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
  security: 5,
};

const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue',
  security: 'red',
};

winston.addColors(colors);

const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.json()
);

const transports: winston.transport[] = [
  new winston.transports.Console({
    format: consoleFormat,
    level: config.logging.level,
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: fileFormat,
    level: config.logging.level,
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '30d',
    maxSize: '20m',
    format: fileFormat,
    level: 'error',
  }),
  new DailyRotateFile({
    filename: path.join(logDir, 'security-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    maxFiles: '90d',
    maxSize: '20m',
    format: fileFormat,
    level: 'security',
  }),
];

export const logger = winston.createLogger({
  levels,
  level: config.logging.level,
  transports,
  exitOnError: false,
});

export class WinstonLogger {
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  private formatMessage(message: string): string {
    return this.context ? `[${this.context}] ${message}` : message;
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    logger.debug(this.formatMessage(message), meta);
  }

  info(message: string, meta?: Record<string, unknown>): void {
    logger.info(this.formatMessage(message), meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(this.formatMessage(message), meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    logger.error(this.formatMessage(message), meta);
  }

  http(message: string, meta?: Record<string, unknown>): void {
    logger.http(this.formatMessage(message), meta);
  }

  security(message: string, meta?: Record<string, unknown>): void {
    logger.log('security', this.formatMessage(message), meta);
  }

  logLoginAttempt(email: string, success: boolean, ip?: string, reason?: string): void {
    this.security(`Login attempt - ${success ? 'SUCCESS' : 'FAILED'}`, {
      email,
      ip,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  logSensitiveAccess(entity: string, entityId: string, userId: string, action: string): void {
    this.security(`Sensitive data access`, {
      entity,
      entityId,
      userId,
      action,
      timestamp: new Date().toISOString(),
    });
  }
}

export default WinstonLogger;
