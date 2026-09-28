import crypto from 'node:crypto';

/**
 * Aturan PIN slip gaji self-service (pure, tanpa I/O) sehingga format PIN,
 * increment percobaan gagal/lockout, dan masa berlaku token unlock dapat
 * diuji unit tanpa database.
 *
 * Token unlock self-payslip sengaja BUKAN PayrollUnlockSession: sesi tersebut
 * adalah bukti reauthentikasi password(+TOTP) untuk jalur admin
 * (X-Payroll-Unlock-Token). Menerbitkan sesi yang sama dari verifikasi PIN
 * akan membuat PIN 6 digit diterima di jalur admin (pelonggaran) dan unlock
 * PIN akan mencabut sesi admin aktif milik user yang sama. Token HMAC pendek
 * yang terikat user+employee+company dan hanya diterima header
 * X-Payslip-Unlock menjaga kedua jalur tetap terpisah.
 */

export const PAYSLIP_PIN_LENGTH = 6;
export const PAYSLIP_PIN_MAX_ATTEMPTS = 5;
export const PAYSLIP_PIN_LOCK_MINUTES = 15;
export const PAYSLIP_UNLOCK_TTL_MINUTES = 15;

/** PIN valid: tepat 6 digit angka. */
export function isValidPayslipPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}

export interface PinLockState {
  failedAttempts: number;
  lockedUntil: Date | null;
}

/** Sisa detik lock; 0 berarti tidak sedang terkunci. */
export function pinLockRemainingSeconds(lockedUntil: Date | null | undefined, now: Date): number {
  if (!lockedUntil) return 0;
  const remainingMs = lockedUntil.getTime() - now.getTime();
  return remainingMs > 0 ? Math.ceil(remainingMs / 1000) : 0;
}

/**
 * State berikutnya setelah satu percobaan PIN salah.
 * Percobaan ke-PAYSLIP_PIN_MAX_ATTEMPTS (dan sesudahnya) mengunci
 * PAYSLIP_PIN_LOCK_MINUTES menit dari `now`.
 */
export function registerFailedPinAttempt(current: PinLockState, now: Date): PinLockState {
  const failedAttempts = current.failedAttempts + 1;
  if (failedAttempts >= PAYSLIP_PIN_MAX_ATTEMPTS) {
    return { failedAttempts, lockedUntil: new Date(now.getTime() + PAYSLIP_PIN_LOCK_MINUTES * 60_000) };
  }
  return { failedAttempts, lockedUntil: current.lockedUntil ?? null };
}

/** State setelah PIN benar / PIN baru diset: counter dan lock direset. */
export function resetPinLockState(): PinLockState {
  return { failedAttempts: 0, lockedUntil: null };
}

// ==================== Token unlock self-payslip (HMAC, stateless) ====================

export interface SelfPayslipTokenClaims {
  userId: string;
  employeeId: string;
  companyId: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

const TOKEN_PURPOSE = 'self-payslip-unlock.v1';

function signPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(`${TOKEN_PURPOSE}.${payload}`, 'utf8').digest('base64url');
}

/** Buat token unlock: payload base64url + tanda tangan HMAC-SHA256. */
export function createSelfPayslipUnlockToken(
  secret: string,
  identity: { userId: string; employeeId: string; companyId: string },
  now: Date,
  ttlMinutes: number = PAYSLIP_UNLOCK_TTL_MINUTES,
): { token: string; expiresAt: Date } {
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60_000);
  const claims: SelfPayslipTokenClaims = { ...identity, expiresAt: expiresAt.getTime() };
  const payload = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  return { token: `${payload}.${signPayload(secret, payload)}`, expiresAt };
}

/**
 * Verifikasi token unlock terhadap identitas pemanggil saat ini.
 * Mengembalikan claims saat valid, atau null saat tanda tangan salah,
 * kedaluwarsa, atau identitas tidak cocok.
 */
export function verifySelfPayslipUnlockToken(
  secret: string,
  token: string | undefined,
  expected: { userId: string; employeeId: string; companyId: string },
  now: Date,
): SelfPayslipTokenClaims | null {
  if (!token || token.length > 1024) return null;
  const separator = token.lastIndexOf('.');
  if (separator <= 0) return null;
  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);
  const expectedSignature = signPayload(secret, payload);
  const given = Buffer.from(signature);
  const wanted = Buffer.from(expectedSignature);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) return null;

  let claims: SelfPayslipTokenClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (typeof claims.expiresAt !== 'number' || claims.expiresAt <= now.getTime()) return null;
  if (claims.userId !== expected.userId) return null;
  if (claims.employeeId !== expected.employeeId) return null;
  if (claims.companyId !== expected.companyId) return null;
  return claims;
}
