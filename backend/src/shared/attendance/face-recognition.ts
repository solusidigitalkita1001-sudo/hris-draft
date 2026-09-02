export const DEFAULT_FACE_MATCH_THRESHOLD = 0.6;

export type FaceVector = number[];

export interface FaceSimilarityResult {
  score: number;
  isMatch: boolean;
  threshold: number;
  details: {
    referenceDims: number;
    selfieDims: number;
    normalized: boolean;
  };
}

function vectorLength(v: FaceVector): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  return Math.sqrt(sum);
}

function safeVector(v: FaceVector, dims?: number): number[] {
  if (!Array.isArray(v) || v.length === 0) return [];
  const resolvedDimensions = dims ?? v.length;
  const result = new Array(resolvedDimensions).fill(0);
  const min = Math.min(resolvedDimensions, v.length);
  for (let i = 0; i < min; i++) {
    const n = Number(v[i]);
    result[i] = Number.isFinite(n) ? n : 0;
  }
  return result;
}

export function normalizeVector(v: FaceVector): number[] {
  const safe = safeVector(v);
  const len = vectorLength(safe);
  if (!Number.isFinite(len) || len <= 1e-12) return safe.map(() => 0);
  return safe.map((x) => x / len);
}

export function cosineSimilarity(a: FaceVector, b: FaceVector): number {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length === 0 || a.length !== b.length) {
    return -1;
  }
  const av = normalizeVector(a);
  const bv = normalizeVector(b);
  let dot = 0;
  for (let i = 0; i < av.length; i++) dot += av[i] * bv[i];
  if (!Number.isFinite(dot)) return -1;
  if (dot > 1) return 1;
  if (dot < -1) return -1;
  return dot;
}

export function compareFaceVectors(
  reference: FaceVector,
  selfie: FaceVector,
  threshold: number = DEFAULT_FACE_MATCH_THRESHOLD,
): FaceSimilarityResult {
  const safeThreshold = Math.max(-1, Math.min(1, Number(threshold) || DEFAULT_FACE_MATCH_THRESHOLD));
  if (!Array.isArray(reference) || reference.length === 0) {
    return {
      score: -1,
      isMatch: false,
      threshold: safeThreshold,
      details: { referenceDims: 0, selfieDims: Array.isArray(selfie) ? selfie.length : 0, normalized: false },
    };
  }
  if (!Array.isArray(selfie) || selfie.length === 0) {
    return {
      score: -1,
      isMatch: false,
      threshold: safeThreshold,
      details: { referenceDims: reference.length, selfieDims: 0, normalized: false },
    };
  }
  const score = cosineSimilarity(reference, selfie);
  return {
    score,
    isMatch: score >= safeThreshold,
    threshold: safeThreshold,
    details: { referenceDims: reference.length, selfieDims: selfie.length, normalized: true },
  };
}
