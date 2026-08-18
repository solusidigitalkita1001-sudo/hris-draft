import { assessLiveness, LivenessVerdict } from './liveness';

describe('liveness basic heuristic B.8', () => {
  it('B.8 CASE1: kamera asli real-time PASS -> verdict PASS', () => {
    const res = assessLiveness({
      exifMake: 'Samsung',
      exifModel: 'SM-S908E',
      exifDateTimeOriginal: '2025:08:18 09:02:31',
      pixelVariance: 1820,
      fileSizeBytes: 1_820_000,
      mimeType: 'image/jpeg',
      clientSource: 'camera',
      isLiveCapture: true,
    });
    expect(res.verdict).toBe(LivenessVerdict.PASS);
    expect(res.reasons.some((r) => r.includes('make/model'))).toBe(true);
  });

  it('B.8 CASE2: source gallery / EXIF tidak ada make+date -> STATIC', () => {
    const res = assessLiveness({
      clientSource: 'GALLERY',
      pixelVariance: 2100,
      fileSizeBytes: 2_200_000,
    });
    expect(res.verdict).toBe(LivenessVerdict.STATIC);
  });

  it('B.8 CASE3: variance pixel 40 (blur / print out copy) -> BLUR', () => {
    const res = assessLiveness({
      exifMake: 'Xiaomi',
      exifModel: 'Redmi Note 13',
      exifDateTimeOriginal: '2025:08:18 09:10:21',
      pixelVariance: 40,
      isLiveCapture: true,
    });
    expect(res.verdict).toBe(LivenessVerdict.BLUR);
  });

  it('B.8 CASE4: software edit Adobe Photoshop -> MANIPULATED', () => {
    const res = assessLiveness({
      exifSoftware: 'Adobe Photoshop 25.5 (Macintosh)',
      exifMake: 'Canon',
      exifModel: 'EOS R6',
      pixelVariance: 3000,
    });
    expect(res.verdict).toBe(LivenessVerdict.MANIPULATED);
    expect(res.reasons.join(' ').toLowerCase()).toContain('photoshop');
  });

  it('B.8 CASE5: evidence kosong/null -> NO_DATA + no crash', () => {
    expect(assessLiveness(null).verdict).toBe(LivenessVerdict.NO_DATA);
    expect(assessLiveness({}).verdict).toBe(LivenessVerdict.NO_DATA);
    const r = assessLiveness(undefined);
    expect(r.evidenceRedacted.hasCameraModel).toBe(false);
  });
});
