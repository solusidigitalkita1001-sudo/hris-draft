jest.mock('@/config', () => ({
  __esModule: true,
  default: { encryption: { key: 'test-encryption-key-32-characters!!' } },
}));

import { decryptSecret, encryptSecret, isEncryptedSecret } from './secret-crypto';

describe('secret-crypto (TOTP secret at-rest encryption)', () => {
  it('round-trips a secret and never stores it in clear', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(stored).not.toContain('JBSWY3DPEHPK3PXP');
    expect(isEncryptedSecret(stored)).toBe(true);
    expect(decryptSecret(stored)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces a different ciphertext per call (random IV)', () => {
    expect(encryptSecret('same-value')).not.toBe(encryptSecret('same-value'));
  });

  it('returns legacy plaintext rows verbatim', () => {
    expect(decryptSecret('JBSWY3DPEHPK3PXP')).toBe('JBSWY3DPEHPK3PXP');
    expect(isEncryptedSecret('JBSWY3DPEHPK3PXP')).toBe(false);
  });

  it('rejects tampered ciphertext', () => {
    const stored = encryptSecret('JBSWY3DPEHPK3PXP');
    const tampered = stored.slice(0, -4) + (stored.endsWith('AAAA') ? 'BBBB' : 'AAAA');
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
