import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import config from '@/config';

/**
 * At-rest encryption for small server-held secrets (e.g. TOTP secrets) so a
 * database read alone cannot yield a working second factor. AES-256-GCM keyed
 * from ENCRYPTION_KEY. Values without the prefix are returned verbatim so
 * legacy plaintext rows keep verifying and can be upgraded in place.
 */
const PREFIX = 'enc:v1:';

function key(): Buffer {
  return createHash('sha256').update(config.encryption.key).digest();
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
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

export function isEncryptedSecret(stored: string | null | undefined): boolean {
  return Boolean(stored?.startsWith(PREFIX));
}
