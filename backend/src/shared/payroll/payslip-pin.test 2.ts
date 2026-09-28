import {
  PAYSLIP_PIN_LOCK_MINUTES,
  PAYSLIP_PIN_MAX_ATTEMPTS,
  createSelfPayslipUnlockToken,
  isValidPayslipPin,
  pinLockRemainingSeconds,
  registerFailedPinAttempt,
  resetPinLockState,
  verifySelfPayslipUnlockToken,
} from './payslip-pin';

const NOW = new Date('2026-09-27T08:00:00.000Z');
const IDENTITY = { userId: 'user-1', employeeId: 'emp-1', companyId: 'co-1' };
const SECRET = 'test-secret';

describe('payslip PIN format', () => {
  it('accepts exactly six digits', () => {
    expect(isValidPayslipPin('012345')).toBe(true);
    expect(isValidPayslipPin('999999')).toBe(true);
  });
  it('rejects wrong length, letters, spaces, and signs', () => {
    for (const bad of ['12345', '1234567', '12a456', '12 456', '-12345', '12345\n', '']) {
      expect(isValidPayslipPin(bad)).toBe(false);
    }
  });
});

describe('failed attempt / lockout state', () => {
  it('increments without locking below the threshold', () => {
    let state = resetPinLockState();
    for (let attempt = 1; attempt < PAYSLIP_PIN_MAX_ATTEMPTS; attempt++) {
      state = registerFailedPinAttempt(state, NOW);
      expect(state.failedAttempts).toBe(attempt);
      expect(state.lockedUntil).toBeNull();
    }
  });

  it(`locks for ${PAYSLIP_PIN_LOCK_MINUTES} minutes on attempt #${PAYSLIP_PIN_MAX_ATTEMPTS}`, () => {
    let state = resetPinLockState();
    for (let attempt = 0; attempt < PAYSLIP_PIN_MAX_ATTEMPTS; attempt++) {
      state = registerFailedPinAttempt(state, NOW);
    }
    expect(state.failedAttempts).toBe(PAYSLIP_PIN_MAX_ATTEMPTS);
    expect(state.lockedUntil).toEqual(new Date(NOW.getTime() + PAYSLIP_PIN_LOCK_MINUTES * 60_000));
  });

  it('keeps extending the lock on further failures past the threshold', () => {
    const later = new Date(NOW.getTime() + 60_000);
    const locked = registerFailedPinAttempt({ failedAttempts: PAYSLIP_PIN_MAX_ATTEMPTS, lockedUntil: NOW }, later);
    expect(locked.failedAttempts).toBe(PAYSLIP_PIN_MAX_ATTEMPTS + 1);
    expect(locked.lockedUntil).toEqual(new Date(later.getTime() + PAYSLIP_PIN_LOCK_MINUTES * 60_000));
  });

  it('reset clears counter and lock', () => {
    expect(resetPinLockState()).toEqual({ failedAttempts: 0, lockedUntil: null });
  });

  it('computes remaining lock seconds and treats the past as unlocked', () => {
    const lockedUntil = new Date(NOW.getTime() + 90_500);
    expect(pinLockRemainingSeconds(lockedUntil, NOW)).toBe(91);
    expect(pinLockRemainingSeconds(NOW, new Date(NOW.getTime() + 1))).toBe(0);
    expect(pinLockRemainingSeconds(null, NOW)).toBe(0);
  });
});

describe('self-payslip unlock token', () => {
  it('round-trips a valid token before expiry', () => {
    const { token, expiresAt } = createSelfPayslipUnlockToken(SECRET, IDENTITY, NOW);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + 15 * 60_000);
    const claims = verifySelfPayslipUnlockToken(SECRET, token, IDENTITY, new Date(expiresAt.getTime() - 1));
    expect(claims).toMatchObject(IDENTITY);
  });

  it('rejects an expired token (expiry is exclusive)', () => {
    const { token, expiresAt } = createSelfPayslipUnlockToken(SECRET, IDENTITY, NOW);
    expect(verifySelfPayslipUnlockToken(SECRET, token, IDENTITY, expiresAt)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, token, IDENTITY, new Date(expiresAt.getTime() + 1))).toBeNull();
  });

  it('rejects a token for a different user, employee, or company', () => {
    const { token } = createSelfPayslipUnlockToken(SECRET, IDENTITY, NOW);
    expect(verifySelfPayslipUnlockToken(SECRET, token, { ...IDENTITY, userId: 'user-2' }, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, token, { ...IDENTITY, employeeId: 'emp-2' }, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, token, { ...IDENTITY, companyId: 'co-2' }, NOW)).toBeNull();
  });

  it('rejects tampering, wrong secret, and malformed tokens', () => {
    const { token } = createSelfPayslipUnlockToken(SECRET, IDENTITY, NOW);
    const [payload, signature] = [token.slice(0, token.lastIndexOf('.')), token.slice(token.lastIndexOf('.') + 1)];
    const forgedPayload = Buffer.from(
      JSON.stringify({ ...IDENTITY, expiresAt: NOW.getTime() + 60 * 60_000 }), 'utf8',
    ).toString('base64url');
    expect(verifySelfPayslipUnlockToken(SECRET, `${forgedPayload}.${signature}`, IDENTITY, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken('other-secret', token, IDENTITY, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, payload, IDENTITY, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, undefined, IDENTITY, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, '', IDENTITY, NOW)).toBeNull();
    expect(verifySelfPayslipUnlockToken(SECRET, 'not-a-token', IDENTITY, NOW)).toBeNull();
  });
});
