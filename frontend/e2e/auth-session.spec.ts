import { test, expect } from '@playwright/test';
import { login } from './helpers';

/**
 * Credentials come from the seeded demo data; this suite only reads and logs in,
 * and never mutates employee or payroll records.
 */

test.describe('auth session in a browser', () => {
  test('signs in and lands on the dashboard', async ({ page }) => {
    await login(page);
  });

  test('keeps the session tokens out of reach of JavaScript', async ({ page, context }) => {
    await login(page);

    // The tokens must exist as cookies…
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names).toContain('at');
    expect(names).toContain('rt');

    // …and must not be reachable from page scripts, so an XSS cannot lift the
    // session. Only the CSRF cookie is deliberately readable.
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).toContain('csrf=');
    expect(readable).not.toContain('at=');
    expect(readable).not.toContain('rt=');

    // No token may be parked in web storage either.
    const stored = await page.evaluate(() => JSON.stringify({
      local: Object.entries(localStorage), session: Object.entries(sessionStorage),
    }));
    expect(stored).not.toMatch(/eyJ[A-Za-z0-9_-]{10,}/); // a JWT would look like this
  });

  test('replaces an expired access token without sending the user back to login', async ({ page, context }) => {
    await login(page);

    // Let the dashboard finish loading first. Removing `at` while its requests
    // are still in flight makes one of them 401, the client starts a refresh,
    // and the navigation below aborts that request mid-flight — the server has
    // already rotated the refresh token by then, so the browser is left holding
    // one the server will never accept again. That is a real behaviour worth
    // knowing (see docs/auth-e2e-verification.md), but it is not what this test
    // is about, and it made the test fail in CI while passing locally purely on
    // timing.
    await page.waitForLoadState('networkidle');

    // Drop only the access cookie: the refresh cookie survives, which is the
    // state a user is in once their access token has aged out.
    const kept = (await context.cookies()).filter((cookie) => cookie.name !== 'at');
    await context.clearCookies();
    await context.addCookies(kept);

    const refresh = page.waitForResponse((response) =>
      response.url().includes('/auth/refresh') && response.status() === 200);
    await page.goto('/self-service');
    await refresh;

    await expect(page).toHaveURL(/\/self-service/);
    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names).toContain('at');
  });

  test('sends the user to login with a reason when the session cannot be refreshed', async ({ page, context }) => {
    await login(page);

    // No access and no refresh cookie: nothing left to recover the session
    // with, which is what a revoked or expired refresh token looks like.
    await context.clearCookies();

    // `goto` defaults to waiting for `load`, but the behaviour under test is
    // that the app redirects immediately. When the redirect wins the race the
    // navigation is cancelled and `goto` rejects with net::ERR_ABORTED — the
    // app having done exactly the right thing. Who wins depends on timing, so
    // the same commit passed on one CI run and failed on another.
    //
    // `waitUntil: 'commit'` resolves as soon as the response starts, which was
    // not enough: when the redirect fires BEFORE the response commits, there
    // is no commit to wait for and `goto` still rejects with ERR_ABORTED. The
    // abort is the app behaving correctly, so it is tolerated by name — any
    // other navigation error still fails loudly, and the assertion below is
    // what decides where we ended up. Not a retry: this suite sets retries to
    // 0 on purpose, so a flaky result has to be fixed rather than re-rolled.
    await page.goto('/self-service', { waitUntil: 'commit' }).catch((error: unknown) => {
      if (!String(error).includes('net::ERR_ABORTED')) throw error;
    });
    await expect(page).toHaveURL(/\/login\?reason=expired/);
  });

  test('logout clears the session cookies', async ({ page, context }) => {
    await login(page);

    await page.goto('/profile');
    const logout = page.getByRole('button', { name: /keluar|logout/i }).first();
    if (await logout.count()) {
      await logout.click();
    } else {
      // The control lives behind the profile menu in some layouts; fall back to
      // the API the button calls, still through the browser session.
      await page.evaluate(async () => {
        const csrf = document.cookie.split('; ').find((c) => c.startsWith('csrf='))?.slice(5) ?? '';
        await fetch('/api/v1/auth/logout', {
          method: 'POST', credentials: 'include',
          headers: { 'X-CSRF-Token': decodeURIComponent(csrf), 'content-type': 'application/json' },
          body: '{}',
        });
      });
    }

    await expect.poll(async () => (await context.cookies()).map((cookie) => cookie.name))
      .not.toContain('rt');
  });
});
