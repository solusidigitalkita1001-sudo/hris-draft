import { generateSecret, generateURI, verifySync } from 'otplib';
import qrcode from 'qrcode';
import crypto from 'crypto';

// Task 1.1 (SEC-006): TOTP + recovery codes. 30s tolerance = +/-1 time step drift.
export function generateTotpSecret(): string {
  return generateSecret();
}

export function totpAuthUrl(email: string, secret: string, issuer = 'HRMS Enterprise'): string {
  return generateURI({ strategy: 'totp', issuer, label: email, secret });
}

export function verifyTotp(secret: string, token: string): boolean {
  if (!/^\d{6}$/.test(token.trim())) return false;
  try {
    return verifySync({ strategy: 'totp', secret, token: token.trim(), epochTolerance: 30 }).valid;
  } catch {
    return false;
  }
}

export async function totpQrDataUrl(otpauthUrl: string): Promise<string> {
  return qrcode.toDataURL(otpauthUrl);
}

/** 10 human-readable one-time recovery codes (format XXXXX-XXXXX). */
export function generateRecoveryCodes(count = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(5).toString('hex').toUpperCase(); // 10 chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}
