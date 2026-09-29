import { expect, type Page } from '@playwright/test';

export const EMPLOYEE_EMAIL = process.env.E2E_EMPLOYEE_EMAIL ?? 'maya@tech.com';
export const EMPLOYEE_PASSWORD = process.env.E2E_EMPLOYEE_PASSWORD ?? 'Employee123!';

export async function login(page: Page, email = EMPLOYEE_EMAIL, password = EMPLOYEE_PASSWORD) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Alamat email' }).fill(email);
  await page.getByRole('textbox', { name: 'Kata sandi' }).fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/**
 * Mondays that a leave request may legitimately target: past the H-7 attachment
 * rule and — the part that is easy to miss — inside the current year.
 *
 * Leave balances are allocated per year and the UI refuses to submit for a year
 * with no allocation, so a date "far in the future" tests nothing: the request
 * is never sent. Several candidates are returned because the demo data (and a
 * previous run) may already hold a request on one of them; the caller walks the
 * list until one is accepted instead of depending on a clean database.
 */
export function leaveMondayCandidates(): Date[] {
  const year = new Date().getUTCFullYear();
  const first = new Date();
  first.setUTCHours(0, 0, 0, 0);
  first.setUTCDate(first.getUTCDate() + 21); // comfortably past H-7
  first.setUTCDate(first.getUTCDate() + ((8 - first.getUTCDay()) % 7));

  return [0, 1, 2, 3, 4, 5].map((weeks) => {
    const date = new Date(first);
    date.setUTCDate(date.getUTCDate() + weeks * 7);
    return date;
  }).filter((date) => {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + 1);
    // Both days must fall inside the allocation year.
    return date.getUTCFullYear() === year && next.getUTCFullYear() === year;
  });
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10);

/** dd/mm/yyyy, the format the request list renders. */
export const displayDate = (date: Date) => isoDate(date).split('-').reverse().join('/');

export const E2E_REASON = 'E2E: pengajuan otomatis';

/**
 * Cancels the pending request whose card shows `marker`, through the UI so the
 * app's own CSRF flow is used — a raw fetch would rotate the token and the next
 * submission would answer 403, making the test report its own interference.
 */
export async function cancelRequestShowing(page: import('@playwright/test').Page, marker: string) {
  const buttons = page.getByRole('button', { name: 'Batalkan' });
  for (let index = 0; index < await buttons.count(); index++) {
    const button = buttons.nth(index);
    const card = await button.evaluate((element) => {
      let node: HTMLElement | null = element as HTMLElement;
      for (let hop = 0; hop < 6 && node; hop++) {
        if ((node.textContent ?? '').length > 60) return node.textContent ?? '';
        node = node.parentElement;
      }
      return node?.textContent ?? '';
    });
    if (!card.includes(marker)) continue;

    await button.click();
    await page.getByRole('button', { name: 'Ya, Batalkan' }).click();
    return true;
  }
  return false;
}
