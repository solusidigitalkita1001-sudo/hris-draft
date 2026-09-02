import { extractFaceVectorFromImage } from './face-extractor';

describe('face extractor security posture', () => {
  it('rejects arbitrary bytes instead of returning a heuristic biometric vector', async () => {
    await expect(extractFaceVectorFromImage(Buffer.alloc(128, 42))).rejects.toThrow(
      /format foto tidak valid/i,
    );
  });

  it('rejects raw base64 without an explicit trusted image data URL', async () => {
    await expect(extractFaceVectorFromImage('a'.repeat(64))).rejects.toThrow(
      /data URL JPEG atau PNG/i,
    );
  });
});
