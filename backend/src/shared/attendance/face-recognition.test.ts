import { cosineSimilarity, compareFaceVectors, DEFAULT_FACE_MATCH_THRESHOLD } from './face-recognition';

describe('face-recognition similarity pure functions (B.7)', () => {
  it('B.7 CASE1: vectors identik (dot product ==1) => score >= 0.6 PASS match', () => {
    const a = new Array(512).fill(0).map((_, i) => Math.sin(i * 0.01 + 1));
    const result = compareFaceVectors(a, a);
    expect(result.score).toBeGreaterThan(0.999);
    expect(result.isMatch).toBe(true);
    expect(result.threshold).toBe(DEFAULT_FACE_MATCH_THRESHOLD);
  });

  it('B.7 CASE2: near-identik (reference + small noise 0.01 magnitude) => PASS match', () => {
    const ref = new Array(512).fill(0).map((_, i) => Math.cos(i * 0.013 - 0.7));
    const selfie = ref.map((v) => v + (Math.sin(i512()) * 0.01));
    const res = compareFaceVectors(ref, selfie, 0.55);
    expect(res.score).toBeGreaterThan(0.75);
    expect(res.isMatch).toBe(true);
  });

  it('B.7 CASE3: unrelated / random vector orthogonal => score < 0.6 REJECT no match', () => {
    const a = new Array(512).fill(0).map((_, i) => (i % 2 === 0 ? 1 : -1));
    const b = new Array(512).fill(0).map((_, i) => (i % 4 < 2 ? 1 : -1));
    const res = compareFaceVectors(a, b);
    expect(typeof res.score).toBe('number');
    expect(res.score).toBeLessThan(0.5);
    expect(res.isMatch).toBe(false);
  });

  it('B.7 CASE4: reference / selfie kosong => score -1, no match (safety guard)', () => {
    expect(compareFaceVectors([], [1, 2, 3]).score).toBe(-1);
    expect(compareFaceVectors([1, 2, 3], null as unknown as number[]).score).toBe(-1);
    expect(compareFaceVectors([1], [2]).isMatch).toBeDefined();
  });

  it('B.7 CASE5: cosine normalize clamp -1..1. NaN/infinity input safe -> return finite number', () => {
    const bad = [NaN, Infinity, -Infinity, Number.POSITIVE_INFINITY, 1];
    expect(Number.isFinite(cosineSimilarity(bad, [1, 2, 3, 4, 5]))).toBe(true);
    expect(cosineSimilarity([1, 0, 0], [0, 1, 0])).toBeCloseTo(0, 6);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 6);
  });
});

function i512(): number {
  return (Math.random() * 2 - 1);
}
