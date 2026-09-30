import nodemailer, { type Transporter } from 'nodemailer';
import config from '@/config';

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;',
  })[character] ?? character);
}

export function buildPasswordResetMessage(rawToken: string): { subject: string; text: string; html: string } {
  const url = new URL(config.passwordReset.url);
  url.searchParams.set('token', rawToken);
  const resetUrl = url.toString();
  const ttl = config.passwordReset.ttlMinutes;

  return {
    subject: 'Reset password HRIS',
    text: [
      'Permintaan reset password diterima.',
      `Buka tautan berikut dalam ${ttl} menit:`,
      resetUrl,
      'Jika Anda tidak meminta reset password, abaikan email ini.',
    ].join('\n\n'),
    html: [
      '<p>Permintaan reset password diterima.</p>',
      `<p>Tautan ini berlaku selama ${ttl} menit:</p>`,
      `<p><a href="${escapeHtml(resetUrl)}">Reset password</a></p>`,
      '<p>Jika Anda tidak meminta reset password, abaikan email ini.</p>',
    ].join(''),
  };
}

/**
 * "Your payslip is ready" — and nothing else.
 *
 * The decision (GAP-13) was an email with a secure link that still asks for the
 * PIN. Secure here means the link carries **no credential**: it is a deep link
 * to self-service, so reading the payslip still costs a login and the payslip
 * PIN. A one-click token in an inbox would have turned email access into payslip
 * access, which is the opposite of what the PIN gate is for.
 *
 * No figures appear, for the same reason the in-app notification carries none:
 * an amount in an email has left the system for good, into a mailbox that may be
 * shared, synced to a personal phone, or read on a screen someone else can see.
 */
export function buildPayslipAvailableMessage(periodName: string | null): { subject: string; text: string; html: string } {
  const url = config.payslip.selfServiceUrl;
  const period = periodName ? `periode ${periodName}` : 'terbaru';

  return {
    subject: periodName ? `Slip gaji ${period} sudah tersedia` : 'Slip gaji terbaru sudah tersedia',
    text: [
      `Slip gaji ${period} sudah dapat dibuka di Self Service.`,
      url,
      'Nominal tidak dikirim lewat email. Anda akan diminta masuk dan memasukkan PIN slip gaji untuk melihat rinciannya.',
      'Jika Anda merasa tidak seharusnya menerima email ini, hubungi HR.',
    ].join('\n\n'),
    html: [
      `<p>Slip gaji ${escapeHtml(period)} sudah dapat dibuka di Self Service.</p>`,
      `<p><a href="${escapeHtml(url)}">Buka slip gaji saya</a></p>`,
      '<p>Nominal tidak dikirim lewat email. Anda akan diminta masuk dan memasukkan PIN slip gaji untuk melihat rinciannya.</p>',
      '<p>Jika Anda merasa tidak seharusnya menerima email ini, hubungi HR.</p>',
    ].join(''),
  };
}

export class MailService {
  private transporter: Transporter | null = null;

  private getTransporter(): Transporter {
    this.transporter ??= nodemailer.createTransport({
      host: config.mail.host,
      port: config.mail.port,
      secure: config.mail.secure,
      auth: config.mail.user && config.mail.pass
        ? { user: config.mail.user, pass: config.mail.pass }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
    return this.transporter;
  }

  /** Returns false when delivery is intentionally disabled by configuration. */
  async sendPayslipAvailable(recipient: string, periodName: string | null): Promise<boolean> {
    if (!config.mail.enabled) return false;
    await this.getTransporter().sendMail({
      from: { name: config.mail.fromName, address: config.mail.from },
      to: recipient,
      ...buildPayslipAvailableMessage(periodName),
    });
    return true;
  }

  /** Returns false when delivery is intentionally disabled by configuration. */
  async sendPasswordReset(recipient: string, rawToken: string): Promise<boolean> {
    if (!config.mail.enabled) return false;
    const message = buildPasswordResetMessage(rawToken);
    await this.getTransporter().sendMail({
      from: { name: config.mail.fromName, address: config.mail.from },
      to: recipient,
      ...message,
    });
    return true;
  }
}

export const mailService = new MailService();
