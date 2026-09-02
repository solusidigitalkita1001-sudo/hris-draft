import {
  decryptFaceEmbedding,
  encryptFaceEmbedding,
} from './biometric-crypto';

const context = {
  companyId: 'company-1',
  employeeId: 'employee-1',
  modelVersion: 'human-3.3.6/faceres',
};

describe('biometric embedding encryption', () => {
  const vector = Array.from({ length: 256 }, (_, index) => Math.sin(index + 1));

  it('round-trips a normalized embedding without storing plaintext JSON', () => {
    const encrypted = encryptFaceEmbedding(vector, context);
    expect(encrypted).toMatch(/^v1\./);
    expect(encrypted).not.toContain(JSON.stringify(vector).slice(0, 20));

    const decrypted = decryptFaceEmbedding(encrypted, context);
    expect(decrypted).toHaveLength(256);
    expect(Math.sqrt(decrypted.reduce((sum, value) => sum + value * value, 0))).toBeCloseTo(1, 8);
  });

  it('binds ciphertext to the employee and rejects cross-employee decryption', () => {
    const encrypted = encryptFaceEmbedding(vector, context);
    expect(() => decryptFaceEmbedding(encrypted, {
      ...context,
      employeeId: 'employee-2',
    })).toThrow();
  });

  it('rejects tampered ciphertext', () => {
    const encrypted = encryptFaceEmbedding(vector, context);
    const tampered = `${encrypted.slice(0, -1)}${encrypted.endsWith('A') ? 'B' : 'A'}`;
    expect(() => decryptFaceEmbedding(tampered, context)).toThrow();
  });
});
