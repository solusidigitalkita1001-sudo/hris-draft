import { buildPayslipAvailableMessage } from '@/shared/mail/MailService';

/**
 * GAP-13. The decision was an email with a secure link that still asks for the
 * PIN, and "secure" here means the link carries no credential: a one-click
 * token sitting in an inbox would turn email access into payslip access, which
 * is precisely what the PIN gate exists to prevent.
 *
 * These assertions are about what must NOT be in the message. An amount that
 * reaches a mailbox has left the system for good — a mailbox that may be shared,
 * synced to a personal phone, or read over someone's shoulder.
 */
describe('payslip availability email', () => {
  const message = buildPayslipAvailableMessage('September 2026');

  it('names the period so the employee knows which slip is ready', () => {
    expect(message.subject).toContain('September 2026');
    expect(message.text).toContain('periode September 2026');
  });

  it('says a payslip is ready without saying what it is worth', () => {
    const body = `${message.subject} ${message.text} ${message.html}`;
    // Any run of digits long enough to be money, with or without separators.
    expect(body).not.toMatch(/\d[\d.,]{4,}/);
    expect(body).not.toMatch(/rp\b/i);
    expect(body).not.toMatch(/netto|take.?home|gaji bersih|total/i);
  });

  it('carries a plain deep link, never a token or credential', () => {
    const body = `${message.text} ${message.html}`;
    expect(body).toContain('/my-payslips');
    for (const credential of ['token=', 'access=', 'key=', 'signature=', 'pin=', 'otp=']) {
      expect(body.toLowerCase()).not.toContain(credential);
    }
  });

  it('tells the employee a login and a PIN are still required, so the email is not mistaken for access', () => {
    expect(message.text).toMatch(/PIN slip gaji/);
    expect(message.html).toMatch(/PIN slip gaji/);
  });

  it('tells a wrong recipient what to do instead of leaving them guessing', () => {
    expect(message.text).toMatch(/hubungi HR/i);
  });

  it('falls back to a period-less wording rather than printing null', () => {
    const anonymous = buildPayslipAvailableMessage(null);
    expect(anonymous.subject).toBe('Slip gaji terbaru sudah tersedia');
    expect(`${anonymous.subject} ${anonymous.text}`).not.toMatch(/null|undefined/);
  });

  it('escapes a period name so a crafted name cannot inject markup', () => {
    const crafted = buildPayslipAvailableMessage('<img src=x onerror=alert(1)>');
    expect(crafted.html).not.toContain('<img');
    expect(crafted.html).toContain('&lt;img');
  });
});
