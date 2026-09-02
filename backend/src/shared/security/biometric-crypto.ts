import crypto from 'crypto';
import config from '@/config';
import { normalizeVector, type FaceVector } from '@/shared/attendance/face-recognition';

const FORMAT_VERSION = 'v1';
const IV_BYTES = 12;

export type FaceEmbeddingContext = {
  companyId: string;
  employeeId: string;
  modelVersion: string;
};

function buildAad(context: FaceEmbeddingContext): Buffer {
  return Buffer.from(
    `employee-face-profile:${FORMAT_VERSION}:${context.companyId}:${context.employeeId}:${context.modelVersion}`,
    'utf8',
  );
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret, 'utf8').digest();
}

function validateEmbedding(vector: unknown): FaceVector {
  if (
    !Array.isArray(vector) ||
    vector.length < 128 ||
    vector.length > 2048 ||
    vector.some((value) => !Number.isFinite(Number(value)))
  ) {
    throw new Error('Stored face embedding is invalid');
  }
  const normalized = normalizeVector(vector.map(Number));
  if (!normalized.some((value) => Math.abs(value) > 1e-12)) {
    throw new Error('Stored face embedding is empty');
  }
  return normalized;
}

export function encryptFaceEmbedding(
  vector: FaceVector,
  context: FaceEmbeddingContext,
): string {
  const normalized = validateEmbedding(vector);
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(config.encryption.key), iv);
  cipher.setAAD(buildAad(context));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(normalized), 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    FORMAT_VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptFaceEmbedding(
  payload: string,
  context: FaceEmbeddingContext,
): FaceVector {
  const [version, encodedIv, encodedTag, encodedCiphertext, ...extra] = payload.split('.');
  if (
    version !== FORMAT_VERSION ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error('Stored face embedding has an unsupported format');
  }

  const iv = Buffer.from(encodedIv, 'base64url');
  const tag = Buffer.from(encodedTag, 'base64url');
  if (iv.length !== IV_BYTES || tag.length !== 16) {
    throw new Error('Stored face embedding metadata is invalid');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(config.encryption.key),
    iv,
  );
  decipher.setAAD(buildAad(context));
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(encodedCiphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
  return validateEmbedding(JSON.parse(plaintext));
}
