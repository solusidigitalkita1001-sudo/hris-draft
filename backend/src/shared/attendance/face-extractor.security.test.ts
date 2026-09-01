import { extractFaceVectorFromImage } from './face-extractor';

describe('face extractor security posture', () => {
  it('fails closed instead of returning a heuristic biometric vector', async () => {
    await expect(extractFaceVectorFromImage(Buffer.alloc(128, 42))).rejects.toThrow(
      /heuristic fallback is disabled/i,
    );
  });
});
