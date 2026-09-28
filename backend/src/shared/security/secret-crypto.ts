import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import config from '@/config';

/**
 * At-rest encryption for small server-held secrets (e.g. TOTP secrets) so a
 * database read alone cannot yield a working second factor. AES-256-GCM keyed
 * from ENCRYPTION_KEY. Values without the prefix are returned verbatim so
 * legacy plaintext rows keep verifying and can be upgraded in place.
 *
 * Key rotation: ENCRYPTION_KEY_PREVIOUS, when set, is tried as a fallback on
 * decryption only. Encryption always uses the current key, so a rotated
 * deployment keeps reading values written under the old key while everything it
 * rewrites moves to the new one. Without this, changing the key stranded every
 * stored TOTP secret and push token — the reason a placeholder key could not
 * simply be replaced in a running environment.
 */
const PREFIX = 'enc:v1:';

function derive(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function key(): Buffer {
  return derive(config.encryption.key);
}

function decryptionKeys(): Buffer[] {
  const previous = config.encryption.previousKey;
  // A previous key equal to the current one adds nothing but a wasted attempt.
  return previous && previous !== config.encryption.key ? [key(), derive(previous)] : [key()];
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return PREFIX + [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64')).join(':');
}

export function decryptSecret(stored: string): string {
  if (!stored.startsWith(PREFIX)) return stored; // legacy plaintext row
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(':');
  let lastError: unknown;
  for (const candidate of decryptionKeys()) {
    try {
      const decipher = createDecipheriv('aes-256-gcm', candidate, Buffer.from(ivB64, 'base64'));
      decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
    } catch (error) {
      // GCM authentication fails for the wrong key; try the previous one before
      // surfacing the failure so the caller's behaviour is unchanged.
      lastError = error;
    }
  }
  throw lastError;
}

export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return Boolean(stored?.startsWith(PREFIX));
}
