import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { validate } from '@/shared/middleware/RequestValidator';
import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redisCache } from '@/infrastructure/cache/RedisCache';
import config from '@/config';
import {
  validateLogin,
  validateRefreshToken,
  validateChangePassword,
  validateMfaCode,
} from './auth.validation';

const router = Router();

// Auth responses rotate cookies and must always include a fresh body. Ignore
// validators left by older deployments, including If-None-Match: *.
router.use((req, res, next) => {
  res.set({ 'Cache-Control': 'private, no-store', Pragma: 'no-cache', Expires: '0' });
  delete req.headers['if-none-match'];
  delete req.headers['if-modified-since'];
  next();
});

// Rate limiters — Redis-backed when available so counters survive restarts
// and are shared across instances; memory store is the degraded fallback.
function redisStore(prefix: string): RedisStore | undefined {
  if (!config.redis.enabled) return undefined;
  const client = redisCache.getClient();
  return new RedisStore({
    prefix: `ratelimit:${prefix}:`,
    sendCommand: (...args: string[]) => client.call(...args) as never,
  });
}

const tooManyAttempts = {
  success: false,
  code: 'TOO_MANY_REQUESTS',
  message: 'Too many authentication attempts. Please try again later.',
};

const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  // Failed attempts are what brute force looks like; legitimate refreshes
  // from a NATed office must not exhaust the bucket.
  skipSuccessfulRequests: true,
  store: redisStore('auth-ip'),
  message: tooManyAttempts,
});

// Per-account throttle: credential stuffing across many IPs still lands on
// one email bucket. The DB lockout (5 fails / 15 min) remains the backstop.
const loginEmailLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: false,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  store: redisStore('auth-email'),
  keyGenerator: (req) => String(req.body?.email ?? '').trim().toLowerCase() || (req.ip ?? 'unknown'),
  message: tooManyAttempts,
});

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  store: redisStore('auth-general'),
});

// Public routes (no auth required)
router.get('/csrf', generalLimiter, authController.csrfToken.bind(authController));
router.post('/login', authLimiter, loginEmailLimiter, validate(validateLogin), authController.login.bind(authController));
router.post('/refresh', authLimiter, validate(validateRefreshToken), authController.refresh.bind(authController));

// Logout must work with an EXPIRED access token — it only needs the refresh
// cookie, and refusing it would leave the 7-day refresh token alive.
router.post('/logout', authController.logout.bind(authController));
router.post('/change-password', authenticate, validate(validateChangePassword), authController.changePassword.bind(authController));
router.post('/mfa/setup', authenticate, authController.setupMfa.bind(authController));
router.post('/mfa/enable', authenticate, validate(validateMfaCode), authController.enableMfa.bind(authController));
router.post('/mfa/disable', authenticate, validate(validateMfaCode), authController.disableMfa.bind(authController));
router.get('/me', authenticate, authController.getProfile.bind(authController));
router.get('/sessions', authenticate, authController.getSessions.bind(authController));
router.delete('/sessions/:id', authenticate, authController.revokeSession.bind(authController));

export default router;
