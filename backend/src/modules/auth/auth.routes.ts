import { Router } from 'express';
import { authController } from './auth.controller';
import { authenticate } from '@/shared/middleware/Authenticate';
import { validate } from '@/shared/middleware/RequestValidator';
import { rateLimit } from 'express-rate-limit';
import config from '@/config';
import {
  validateLogin,
  validateRefreshToken,
  validateChangePassword,
} from './auth.validation';

const router = Router();

// Rate limiters
const authLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.authMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    code: 'TOO_MANY_REQUESTS',
    message: 'Too many authentication attempts. Please try again later.',
  },
});

const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

// Public routes (no auth required)
router.post('/login', authLimiter, validate(validateLogin), authController.login.bind(authController));
router.post('/refresh', authLimiter, validate(validateRefreshToken), authController.refresh.bind(authController));

// Protected routes (auth required)
router.post('/logout', authenticate, authController.logout.bind(authController));
router.post('/change-password', authenticate, validate(validateChangePassword), authController.changePassword.bind(authController));
router.get('/me', authenticate, authController.getProfile.bind(authController));
router.get('/sessions', authenticate, authController.getSessions.bind(authController));
router.delete('/sessions/:id', authenticate, authController.revokeSession.bind(authController));

export default router;
