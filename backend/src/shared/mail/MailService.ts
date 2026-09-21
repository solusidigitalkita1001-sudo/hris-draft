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
