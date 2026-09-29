import { test, expect, type Locator, type Page } from '@playwright/test';
import { cancelRequestShowing, displayDate, E2E_REASON, isoDate, leaveMondayCandidates, login } from './helpers';

/**
 * The employee's most-used journey: submit leave, see it listed, cancel it.
 *
 * It mutates data on purpose — a leave request is the thing under test — so it
 * cancels what it created. It also does not assume a clean database: the demo
 * seed and any earlier run hold requests of their own, and the overlap rule is
 * real, so the test walks candidate dates until one is accepted rather than
 * failing on a rule working correctly.
 */
async function openLeaveDialog(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Ajukan Cuti' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Ajukan Cuti' });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function fillLeave(page: Page, dialog: Locator, start: Date, end: Date) {
  // The leave type is a custom combobox whose options render in a portal.
  await dialog.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /Annual Leave/ }).click();
  await dialog.locator('input[type=date]').first().fill(isoDate(start));
  await dialog.locator('input[type=date]').nth(1).fill(isoDate(end));
  await dialog.getByRole('textbox', { name: /Jelaskan alasan/ }).fill(E2E_REASON);
}

async function submitLeave(page: Page, dialog: Locator): Promise<number> {
  const response = page.waitForResponse((r) =>
    r.url().includes('/api/v1/leave') && r.request().method() === 'POST');
  await dialog.getByRole('button', { name: 'Ajukan Cuti' }).click();
  return (await response).status();
}

/** Exact name: "Batal" also matches the list's "Batalkan". */
const closeDialog = (dialog: Locator) =>
  dialog.getByRole('button', { name: 'Batal', exact: true }).click();

test.describe('leave self-service', () => {
  test('submits leave, lists it as pending, refuses an overlapping second request, then cancels it', async ({ page }) => {
    const candidates = leaveMondayCandidates();
    test.skip(candidates.length === 0, 'no eligible Monday left in the current allocation year');

    await login(page);
    await page.goto('/self-service');
    await page.getByRole('tab', { name: 'Cuti' }).click();

    let accepted: Date | null = null;
    for (const start of candidates) {
      const end = new Date(start);
      end.setUTCDate(end.getUTCDate() + 1); // Monday–Tuesday, two working days

      const dialog = await openLeaveDialog(page);
      await fillLeave(page, dialog, start, end);
      const status = await submitLeave(page, dialog);

      if (status === 201) { accepted = start; break; }
      // 409 means an existing request already covers these dates — the rule
      // working, not a failure. Try the next week.
      expect(status).toBe(409);
      await closeDialog(dialog);
    }
    expect(accepted, 'every candidate week was already taken').not.toBeNull();

    const start = accepted as Date;
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);
    const dateLabel = `${displayDate(start)} — ${displayDate(end)}`;
    // `.first()`: cancelled requests from earlier runs stay in the list, so the
    // same date label can legitimately appear more than once.
    await expect(page.locator('main').getByText(dateLabel).first()).toBeVisible();

    // The same dates again must be refused: two pending requests over one period
    // would each deduct the balance on approval.
    const duplicate = await openLeaveDialog(page);
    await fillLeave(page, duplicate, start, end);
    expect(await submitLeave(page, duplicate)).toBe(409);
    await closeDialog(duplicate);

    // Clean up what this test created, and prove the cancellation landed.
    expect(await cancelRequestShowing(page, dateLabel)).toBe(true);
    await expect(page.locator('main').getByText('Dibatalkan').first()).toBeVisible();
  });

  test('explains why a year with no allocation cannot be requested, instead of failing silently', async ({ page }) => {
    const nextYear = new Date();
    nextYear.setUTCFullYear(nextYear.getUTCFullYear() + 1, 5, 14); // mid-June next year

    await login(page);
    await page.goto('/self-service');
    await page.getByRole('tab', { name: 'Cuti' }).click();
    const dialog = await openLeaveDialog(page);
    await fillLeave(page, dialog, nextYear, nextYear);

    // The client refuses before sending anything, and says why — naming the year
    // and pointing at HR — rather than letting it fail server-side.
    await expect(dialog.getByText(/belum punya alokasi saldo .* untuk tahun \d{4}/)).toBeVisible();

    let posted = false;
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/api/v1/leave')) posted = true;
    });
    await dialog.getByRole('button', { name: 'Ajukan Cuti' }).click();
    await page.waitForTimeout(1000);
    expect(posted).toBe(false);
  });

  test('shows the remaining balance for the leave type being requested', async ({ page }) => {
    await login(page);
    await page.goto('/self-service');
    await page.getByRole('tab', { name: 'Cuti' }).click();
    const dialog = await openLeaveDialog(page);

    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Annual Leave/ }).click();

    // An employee deciding whether to request leave needs the number in front of
    // them, not on another screen.
    await expect(dialog.getByText(/Saldo Annual Leave tahun \d{4}: \d+ hari tersisa/)).toBeVisible();
  });
});
