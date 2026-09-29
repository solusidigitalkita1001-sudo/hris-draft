import { test, expect, type Page } from '@playwright/test';

/**
 * Credentials come from the seeded demo data; the suite only reads and logs in,
 * and never mutates employee or payroll records.
 */
const EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? 'maya@tech.com';
const PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? 'Employee123!';

async function login(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Alamat email' }).fill(EMAIL);
  await page.getByRole('textbox', { name: 'Kata sandi' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

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

    await page.goto('/self-service');
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
