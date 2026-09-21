import express from 'express';
import type { NextFunction, Request, Response } from 'express';

jest.mock('./auth.service', () => ({ authService: {} }));
jest.mock('./password-reset.service', () => ({ passwordResetService: {
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
} }));
jest.mock('@/shared/middleware/Authenticate', () => ({
  authenticate: (_req: Request, _res: Response, next: NextFunction) => next(),
}));

import authRoutes from './auth.routes';
import { passwordResetService } from './password-reset.service';
import { errorHandler } from '@/shared/middleware/ErrorHandler';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const reset = jest.mocked(passwordResetService);

function app() {
  const instance = express();
  instance.use(express.json());
  instance.use('/api/v1/auth', authRoutes);
  instance.use(errorHandler);
  return instance;
}

describe('password reset HTTP contract', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns a generic accepted response and normalizes the requested email', async () => {
    const response = await request(app())
      .post('/api/v1/auth/forgot-password')
      .send({ email: ' USER@Example.COM ' })
      .expect(202);

    expect(reset.requestPasswordReset).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      expect.anything(),
    );
    expect(response.body.data).toBeNull();
    expect(response.body.message).not.toMatch(/user@example/i);
    expect(JSON.stringify(response.body)).not.toMatch(/token/i);
  });

  it('resets without authentication and clears any browser auth cookies', async () => {
    const response = await request(app())
      .post('/api/v1/auth/reset-password')
      .send({ token: 'opaque-token', password: 'NewPassword1!' })
      .expect(200);

    expect(reset.resetPassword).toHaveBeenCalledWith({
      token: 'opaque-token',
      password: 'NewPassword1!',
    });
    const cookies = response.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((cookie) => cookie.startsWith('at=;'))).toBe(true);
    expect(cookies.some((cookie) => cookie.startsWith('rt=;'))).toBe(true);
  });

  it('rejects malformed email, weak password, and a missing token before the service', async () => {
    await request(app()).post('/api/v1/auth/forgot-password').send({ email: 'invalid' }).expect(422);
    await request(app()).post('/api/v1/auth/reset-password').send({ token: '', password: 'weak' }).expect(422);
    expect(reset.requestPasswordReset).not.toHaveBeenCalled();
    expect(reset.resetPassword).not.toHaveBeenCalled();
  });
});
