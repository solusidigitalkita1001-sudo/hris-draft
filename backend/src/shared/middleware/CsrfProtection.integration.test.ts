import express from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './ErrorHandler';
import {
  CSRF_COOKIE,
  CSRF_HEADER,
  csrfProtection,
  issueCsrfToken,
} from './CsrfProtection';

// supertest does not bundle declarations and this repository intentionally
// keeps the runtime-only test dependency lightweight.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const request = require('supertest');

function testApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(csrfProtection);
  app.get('/auth/csrf', (_req, res) => {
    issueCsrfToken(res);
    res.status(200).json({ success: true });
  });
  app.post('/mutation', (_req, res) => {
    res.status(200).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

function csrfTokenFrom(response: { headers: Record<string, unknown> }): string {
  const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
  const csrfCookie = cookies?.find((cookie) => cookie.startsWith(`${CSRF_COOKIE}=`));
  if (!csrfCookie) throw new Error('CSRF bootstrap did not set its cookie');
  return decodeURIComponent(csrfCookie.slice(CSRF_COOKIE.length + 1).split(';', 1)[0]);
}

describe('CSRF bootstrap over HTTP', () => {
  it('issues a browser-readable signed cookie and accepts it on a cookie-authenticated mutation', async () => {
    const app = testApp();
    const bootstrap = await request(app).get('/auth/csrf').expect(200);
    const token = csrfTokenFrom(bootstrap);

    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect((bootstrap.headers['set-cookie'] as unknown as string[]).join(';')).not.toContain('HttpOnly');

    await request(app)
      .post('/mutation')
      .set('Cookie', `${CSRF_COOKIE}=${encodeURIComponent(token)}; rt=refresh-cookie`)
      .set(CSRF_HEADER, token)
      .expect(200, { success: true });
  });

  it('rejects a cookie-authenticated mutation without the matching header', async () => {
    const app = testApp();
    const bootstrap = await request(app).get('/auth/csrf').expect(200);
    const token = csrfTokenFrom(bootstrap);

    const response = await request(app)
      .post('/mutation')
      .set('Cookie', `${CSRF_COOKIE}=${encodeURIComponent(token)}; rt=refresh-cookie`)
      .expect(403);

    expect(response.body).toMatchObject({
      success: false,
      code: 'FORBIDDEN',
      message: 'Invalid or missing CSRF token',
    });
  });
});
