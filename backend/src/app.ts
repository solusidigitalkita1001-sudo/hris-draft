import 'express';
export {};

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from '@/config';
import { errorHandler } from '@/shared/middleware/ErrorHandler';
import { logger } from '@/shared/logger/WinstonLogger';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { rabbitMQBroker } from '@/infrastructure/messaging/RabbitMQBroker';
import { queueManager } from '@/infrastructure/queue/QueueManager';

// Route imports
import authRoutes from '@/modules/auth/auth.routes';
import organizationRoutes from '@/modules/organization/organization.routes';
import rbacRoutes from '@/modules/rbac/rbac.routes';
import userRoutes from '@/modules/user/user.routes';
import payrollRoutes from '@/modules/payroll/payroll.routes';
import benefitRoutes from '@/modules/benefit/benefit.routes';
import performanceRoutes from '@/modules/performance/performance.routes';
import trainingRoutes from '@/modules/training/training.routes';
import recruitmentRoutes from '@/modules/recruitment/recruitment.routes';
import employeeRoutes from '@/modules/employee/employee.routes';
import attendanceRoutes from '@/modules/attendance/attendance.routes';
import leaveRoutes from '@/modules/leave/leave.routes';
import onboardingRoutes from '@/modules/onboarding/onboarding.routes';
import assetRoutes from '@/modules/asset/asset.routes';
import reportsRoutes from '@/modules/reports/reports.routes';
import auditLogRoutes from '@/modules/audit-log/audit-log.routes';
import workCalendarRoutes from '@/modules/work-calendar/work-calendar.routes';
import notificationRoutes from '@/modules/notification/notification.routes';
import permissionRequestRoutes from '@/modules/permission-request/permission-request.routes';
import employeeLoanRoutes from '@/modules/employee-loan/employee-loan.routes';
import travelExpenseRoutes from '@/modules/travel-expense/travel-expense.routes';
import workflowEngineRoutes from '@/modules/workflow-engine/workflow-engine.routes';
import documentManagementRoutes from '@/modules/document-management/document-management.routes';

const app = express();

// ==================== Security Middleware ====================

// Trust proxy for rate limiting behind Nginx
app.set('trust proxy', 1);

// Helmet security headers
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", config.app.url],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS
app.use(
  cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With'],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: 86400, // 24 hours
  })
);

// Global rate limiter
const globalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.app.env === 'development' ? Number.MAX_SAFE_INTEGER : config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.app.env === 'development',
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many requests, please try again later.',
  },
});

app.use(globalLimiter);

// ==================== Body Parsing Middleware ====================
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser(config.session.secret));

// ==================== Request Logging ====================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`, {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
    });
  });
  next();
});

// ==================== Health Check ====================
app.get('/health', async (_req, res) => {
  const [redisHealthy, rabbitHealthy, queueHealthy] = await Promise.all([
    config.redis.enabled ? redisCache.ping() : Promise.resolve(false),
    config.rabbitmq.enabled ? rabbitMQBroker.isHealthy() : Promise.resolve(false),
    config.queue.enabled ? queueManager.isHealthy() : Promise.resolve(false),
  ]);

  const enabledChecks = [
    !config.redis.enabled || redisHealthy,
    !config.rabbitmq.enabled || rabbitHealthy,
    !config.queue.enabled || queueHealthy,
  ];
  const isHealthy = enabledChecks.every(Boolean);

  res.status(isHealthy ? 200 : 503).json({
    success: isHealthy,
    message: isHealthy
      ? 'HRMS Enterprise API is running'
      : 'HRMS Enterprise API is degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      redis: config.redis.enabled ? (redisHealthy ? 'up' : 'down') : 'disabled',
      rabbitmq: config.rabbitmq.enabled ? (rabbitHealthy ? 'up' : 'down') : 'disabled',
      queue: config.queue.enabled ? (queueHealthy ? 'up' : 'down') : 'disabled',
    },
  });
});

// ==================== API Routes ====================
const apiPrefix = config.app.apiPrefix;

app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/organization`, organizationRoutes);
app.use(`${apiPrefix}/roles`, rbacRoutes);
app.use(`${apiPrefix}/users`, userRoutes);
app.use(`${apiPrefix}/payroll`, payrollRoutes);
app.use(`${apiPrefix}/benefits`, benefitRoutes);
app.use(`${apiPrefix}/performance`, performanceRoutes);
app.use(`${apiPrefix}/training`, trainingRoutes);
app.use(`${apiPrefix}/recruitment`, recruitmentRoutes);
app.use(`${apiPrefix}/employees`, employeeRoutes);
app.use(`${apiPrefix}/attendance`, attendanceRoutes);
app.use(`${apiPrefix}/leave`, leaveRoutes);
app.use(`${apiPrefix}/onboarding`, onboardingRoutes);
app.use(`${apiPrefix}/assets`, assetRoutes);
app.use(`${apiPrefix}/reports`, reportsRoutes);
app.use(`${apiPrefix}/audit-logs`, auditLogRoutes);
app.use(`${apiPrefix}/work-calendars`, workCalendarRoutes);
app.use(`${apiPrefix}/notifications`, notificationRoutes);
app.use(`${apiPrefix}/permission-requests`, permissionRequestRoutes);
app.use(`${apiPrefix}/employee-loans`, employeeLoanRoutes);
app.use(`${apiPrefix}/travel-expenses`, travelExpenseRoutes);
app.use(`${apiPrefix}/workflow-engine`, workflowEngineRoutes);
app.use(`${apiPrefix}/documents`, documentManagementRoutes);

// ==================== 404 Handler ====================
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    code: 'NOT_FOUND',
    message: 'The requested resource was not found',
  });
});

// ==================== Global Error Handler ====================
app.use(errorHandler);

export default app;
