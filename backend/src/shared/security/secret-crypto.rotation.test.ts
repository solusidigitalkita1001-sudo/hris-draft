import config from '@/config';
import { encryptSecret, decryptSecret, isEncryptedSecret } from './secret-crypto';

/**
 * A single-key deployment could not replace a compromised or placeholder
 * ENCRYPTION_KEY without stranding every stored TOTP secret and push token.
 * ENCRYPTION_KEY_PREVIOUS is the rotation path: decryption tries it, encryption
 * never does.
 */
const CURRENT = 'rotation-current-key-0123456789abcdef';
const OLD = 'rotation-previous-key-0123456789abcdef';

function withKeys(current: string, previous?: string) {
  (config as { encryption: { key: string; previousKey?: string } }).encryption = {
    key: current, previousKey: previous,
  };
}

describe('encryption key rotation', () => {
  const original = { ...config.encryption };
  afterEach(() => withKeys(original.key, original.previousKey));

  it('reads a value written under the previous key', () => {
    withKeys(OLD);
    const stored = encryptSecret('TOTPSECRET123');
    expect(isEncryptedSecret(stored)).toBe(true);

    withKeys(CURRENT, OLD);
    expect(decryptSecret(stored)).toBe('TOTPSECRET123');
  });

  it('writes only under the current key', () => {
    withKeys(CURRENT, OLD);
    const stored = encryptSecret('TOTPSECRET123');

    // Dropping the previous key must not affect a freshly written value.
    withKeys(CURRENT);
    expect(decryptSecret(stored)).toBe('TOTPSECRET123');
  });

  it('still fails when neither key matches', () => {
    withKeys(OLD);
    const stored = encryptSecret('TOTPSECRET123');

    withKeys(CURRENT, 'unrelated-third-key-0123456789abcdef');
    expect(() => decryptSecret(stored)).toThrow();
  });

  it('round-trips without a previous key configured', () => {
    withKeys(CURRENT);
    expect(decryptSecret(encryptSecret('TOTPSECRET123'))).toBe('TOTPSECRET123');
  });

  it('leaves a legacy plaintext row verbatim', () => {
    withKeys(CURRENT, OLD);
    expect(decryptSecret('PLAINTEXTSECRET')).toBe('PLAINTEXTSECRET');
    expect(isEncryptedSecret('PLAINTEXTSECRET')).toBe(false);
  });
});
