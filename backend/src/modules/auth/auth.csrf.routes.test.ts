import express from 'express';
import cookieParser from 'cookie-parser';
import type { Request, Response, NextFunction } from 'express';

jest.mock('@/config', () => {
  const actual = jest.requireActual('@/config');
  return { ...actual, __esModule: true, default: { ...actual.default, cookies: { secure: false } } };
});

jest.mock('./auth.service', () => ({ authService: {
  login: jest.fn(), refreshTokens: jest.fn(), getProfile: jest.fn(), logout: jest.fn(),
} }));
jest.mock('@/shared/middleware/Authenticate', () => ({
  authenticate: (req: Request & { user?: { id: string } }, _res: Response, next: NextFunction) => {
    req.user = { id: 'test-user' };
    next();
  },
}));

import authRoutes from './auth.routes';
import { authService } from './auth.service';
import { csrfProtection } from '@/shared/middleware/CsrfProtection';
import { errorHandler } from '@/shared/middleware/ErrorHandler';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');
const BASE = '/api/v1/auth';
const session = {
  user: { id: 'test-user' },
  tokens: { accessToken: 'access-secret', refreshToken: 'refresh-secret', expiresIn: 900 },
};

function testApp() {
  const app = express();
  app.use(express.json(), cookieParser(), csrfProtection);
  app.use(BASE, authRoutes);
  app.use(errorHandler);
  return app;
}

function cookieToken(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'] as string[];
  const csrf = cookies.find((cookie) => cookie.startsWith('csrf='));
  if (!csrf) throw new Error('Expected a CSRF cookie');
  return decodeURIComponent(csrf.split(';')[0].slice('csrf='.length));
}

describe('auth CSRF cache and cookie contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(authService.login).mockResolvedValue(session as Awaited<ReturnType<typeof authService.login>>);
    jest.mocked(authService.refreshTokens).mockResolvedValue(session as Awaited<ReturnType<typeof authService.refreshTokens>>);
    jest.mocked(authService.getProfile).mockResolvedValue(session.user as Awaited<ReturnType<typeof authService.getProfile>>);
  });

  it('returns the signed cookie token in non-cacheable JSON', async () => {
    const response = await request(testApp()).get(`${BASE}/csrf`).expect(200);
    expect(response.headers['content-type']).toMatch(/application\/json/);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers.pragma).toBe('no-cache');
    expect(response.headers.expires).toBe('0');
    expect(response.body.data.csrfToken).toBe(cookieToken(response));
    expect(response.body.data.csrfToken).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
  });

  it.each(['previous-etag', '*', 'modified-since'])('always returns a full token for %s validators', async (validator) => {
    const app = testApp();
    const previous = await request(app).get(`${BASE}/csrf`).expect(200);
    const conditional = request(app).get(`${BASE}/csrf`);
    if (validator === 'modified-since') conditional.set('If-Modified-Since', new Date().toUTCString());
    else conditional.set('If-None-Match', validator === '*' ? '*' : previous.headers.etag);
    const response = await conditional.expect(200);
    expect(response.body.data.csrfToken).toBe(cookieToken(response));
    expect(response.body.data.csrfToken).not.toBe(previous.body.data.csrfToken);
  });

  it('keeps profile responses private even with a matching validator', async () => {
    const app = testApp();
    const previous = await request(app).get(`${BASE}/me`).expect(200);
    const response = await request(app).get(`${BASE}/me`).set('If-None-Match', previous.headers.etag).expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data).toEqual(session.user);
  });

  it('supports an HTTP browser session through bootstrap, login, refresh and logout', async () => {
    // The fixture explicitly uses HTTP cookies; supertest's browser agent
    // enforces cookie storage and sends them back on refresh/logout.
    const agent = request.agent(testApp());
    const bootstrap = await agent.get(`${BASE}/csrf`).expect(200);
    const login = await agent.post(`${BASE}/login`)
      .set('X-CSRF-Token', bootstrap.body.data.csrfToken)
      .send({ email: 'test@example.com', password: 'Valid-password1!' }).expect(200);
    expect(login.body.data.csrfToken).toBe(cookieToken(login));
    expect(login.body.data.tokens).toEqual({ expiresIn: 900 });
    const cookies = login.headers['set-cookie'] as string[];
    expect(cookies.every((cookie) => !cookie.includes('; Secure'))).toBe(true);
    expect(cookies.filter((cookie) => /^(at|rt)=/.test(cookie)).every((cookie) => cookie.includes('HttpOnly'))).toBe(true);

    await agent.post(`${BASE}/refresh`).set('X-CSRF-Token', bootstrap.body.data.csrfToken).send({}).expect(403);
    const refreshed = await agent.post(`${BASE}/refresh`).set('X-CSRF-Token', login.body.data.csrfToken).send({}).expect(200);
    expect(refreshed.body.data.csrfToken).toBe(cookieToken(refreshed));
    expect(authService.refreshTokens).toHaveBeenCalledWith('refresh-secret', expect.anything(), undefined);
    await agent.post(`${BASE}/logout`).set('X-CSRF-Token', refreshed.body.data.csrfToken).send({}).expect(200);
    expect(authService.logout).toHaveBeenCalledWith('refresh-secret');
  });

  it('keeps cookie validation enabled when the header token exists without its cookie', async () => {
    const app = testApp();
    const bootstrap = await request(app).get(`${BASE}/csrf`).expect(200);
    await request(app).post(`${BASE}/refresh`)
      .set('Cookie', 'rt=refresh-secret')
      .set('X-CSRF-Token', bootstrap.body.data.csrfToken).send({}).expect(403);
    expect(authService.refreshTokens).not.toHaveBeenCalled();
  });
});
