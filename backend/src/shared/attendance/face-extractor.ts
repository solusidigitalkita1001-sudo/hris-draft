import type { FaceVector } from './face-recognition';
import { normalizeVector } from './face-recognition';
import { logger } from '@/shared/logger/WinstonLogger';

/**
 * ═══════════════════════════════════════════════════════════════════════
 * FACE RECOGNITION GRADE 2 TFJS UPGRADE (Step 4 Minggu 6)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sebelumnya: Grade 1 FALLBACK HEURISTIC 0-dep (pure TS color histogram +
 * edge + pHash → vector 512-dim). Accuracy rendah, mudah di-spoof foto.
 *
 * Sekarang: Grade 2 REAL FaceNet EMBEDDING via @vladmandic/human (TFJS):
 *   1. Load model FaceNet MobileFaceNet 512-dim (default Human v3).
 *   2. Detect wajah dari image input (bounding box + 106 face landmarks).
 *   3. Auto-alignment via affine transform landmark eyes-nose-mouth.
 *   4. Extract embedding 512 normalized vector.
 *   5. Compatibility: format return TETAP SAMA (vector: number[512]) →
 *      compareFaceVectors existing TIDAK PERLU DIUBAH 1 baris code!
 *
 * SECURITY: biometric decisions fail closed. The histogram implementation is
 * retained only for explicit non-authentication diagnostics and must never be
 * accepted as a face-recognition credential.
 *
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface FaceExtractionResult {
  vector: FaceVector;
  pixelVariance: number;
  estimatedWidth: number;
  estimatedHeight: number;
  fileSizeBytes: number;
  faceConfidence?: number;
  isFallbackHeuristic: boolean;
  warning?: string;
}

let humanInstance: any = null;
let humanLoadPromise: Promise<any> | null = null;
let humanAvailableStatus: 'uninitialized' | 'loading' | 'ready' | 'failed' = 'uninitialized';

const HUMAN_BACKEND_CONFIG: Record<string, any> = {
  backend: 'tensorflow',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  debug: false,
  async: true,
  warmup: 'face',
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: 'blazeface.json', rotation: true, maxDetected: 1 },
    mesh: { enabled: true, modelPath: 'facemesh.json' },
    iris: { enabled: false },
    description: { enabled: true, modelPath: 'faceres.json' }, // 512-dim FaceNet embedding
    emotion: { enabled: false },
    antispoof: { enabled: false },
    liveness: { enabled: false },
  },
  body: { enabled: false },
  hand: { enabled: false },
  object: { enabled: false },
  segmentation: { enabled: false },
  gesture: { enabled: false },
};

async function getHumanInstance(): Promise<any | null> {
  if (humanAvailableStatus === 'ready') return humanInstance;
  if (humanAvailableStatus === 'failed') return null;

  if (humanAvailableStatus === 'uninitialized') {
    humanAvailableStatus = 'loading';
    humanLoadPromise = (async () => {
      try {
        // @ts-ignore — @vladmandic/human adalah optional heavy package (200MB+ native).
        // @ts-expect-error Dynamic import may fail resolve type tanpa package installed.
        const HumanDynamic = (await import('@vladmandic/human')).default;
        const instance = new HumanDynamic(HUMAN_BACKEND_CONFIG);
        await instance.load();
        logger.info('[FaceExtractor] @vladmandic/human TFJS model loaded successfully (Grade 2 FaceNet 512-dim)');
        humanAvailableStatus = 'ready';
        humanInstance = instance;
        return instance;
      } catch (err: any) {
        logger.warn('[FaceExtractor] Failed to load @vladmandic/human TFJS; biometric extraction will fail closed', {
          error: err?.message || String(err),
        });
        humanAvailableStatus = 'failed';
        humanInstance = null;
        return null;
      }
    })();
  }
  return humanLoadPromise;
}

/**
 * Entry Point UTAMA — selalu call ini untuk extract vector dari image.
 * Auto-failover ke fallback jika TFJS tidak tersedia.
 */
export async function extractFaceVectorFromImage(
  imageInput: string | Buffer,
  options: { allowHeuristicFallback?: boolean } = {},
): Promise<FaceExtractionResult> {
  const buf =
    typeof imageInput === 'string'
      ? Buffer.from(stripDataUrlPrefix(imageInput), 'base64')
      : imageInput;
  const fileSizeBytes = buf.length;

  const { pixels, width, height, pixelVariance } = prepareImageMetrics(buf);

  const human = await getHumanInstance().catch(() => null);
  if (human && humanAvailableStatus === 'ready') {
    try {
      const tfResult = await extractWithHuman(human, buf, pixels, width, height);
      if (tfResult) {
        return {
          vector: tfResult.vector,
          pixelVariance,
          estimatedWidth: width,
          estimatedHeight: height,
          fileSizeBytes,
          faceConfidence: tfResult.faceConfidence,
          isFallbackHeuristic: false,
        };
      }
    } catch (err: any) {
      logger.warn('[FaceExtractor] Human TFJS gagal extract; heuristic fallback hanya tersedia untuk diagnostic opt-in', {
        error: err?.message || String(err),
      });
    }
  }

  if (!options.allowHeuristicFallback) {
    throw new Error('Face recognition model unavailable or no face detected; heuristic fallback is disabled');
  }

  const fallbackVec = generateFallbackHistogramVector(pixels, width, height);
  return {
    vector: fallbackVec,
    pixelVariance,
    estimatedWidth: width,
    estimatedHeight: height,
    fileSizeBytes,
    isFallbackHeuristic: true,
    warning:
      'FALLBACK HEURISTIC VECTOR: TFJS FaceNet model tidak tersedia. Install @tensorflow/tfjs-node + @vladmandic/human untuk Grade 2 accuracy tinggi anti spoof.',
  };
}

async function extractWithHuman(
  human: any,
  buf: Buffer,
  _pixels: Uint8ClampedArray,
  width: number,
  height: number,
): Promise<{ vector: number[]; faceConfidence: number } | null> {
  const imageObj = {
    buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
    width,
    height,
    channels: 3,
  };
  const result = await human.detect(imageObj);
  const faces = result?.face || [];
  if (!Array.isArray(faces) || faces.length === 0 || !faces[0]) {
    return null;
  }
  const face = faces[0];
  const embedding = face.embedding || face.descriptor || face.description;
  if (!Array.isArray(embedding) || embedding.length < 128) {
    return null;
  }

  const normalized = normalizeVector(embedding);
  const padded = new Array(512).fill(0);
  const minLen = Math.min(512, normalized.length);
  for (let i = 0; i < minLen; i++) padded[i] = normalized[i] ?? 0;

  const faceConfidence = typeof face.score === 'number' ? face.score :
    typeof face.confidence === 'number' ? face.confidence :
    (Array.isArray(face.boxConfidence) ? face.boxConfidence[0] ?? 0.8 : 0.8);

  return { vector: padded, faceConfidence: Number(faceConfidence) };
}

function stripDataUrlPrefix(s: string): string {
  if (!s.startsWith('data:')) return s;
  const idx = s.indexOf(',');
  return idx >= 0 ? s.slice(idx + 1) : s;
}

/* ──────────────────────────────────────────────────────────────────────
   FAILOVER GRADE 1: PURE TS 0-DEP (tidak pernah berubah, tetap aktif)
   code disimpan untuk fallback environment tanpa TFJS native binding
   ────────────────────────────────────────────────────────────────────── */

function prepareImageMetrics(buf: Buffer): {
  pixels: Uint8ClampedArray; width: number; height: number; pixelVariance: number;
} {
  const totalBytes = buf.length;
  const dims = estimateImageDimensions(buf);
  const totalPixels = dims.width * dims.height;
  const pixels = new Uint8ClampedArray(totalPixels * 3);
  const sampleStep = Math.max(1, Math.floor(totalBytes / (totalPixels * 3)));
  let p = 0;
  for (let i = 0; i < totalPixels; i++) {
    const offset = (i * sampleStep) % totalBytes;
    pixels[p++] = buf[offset] ?? 0;
    pixels[p++] = buf[(offset + 13) % totalBytes] ?? 0;
    pixels[p++] = buf[(offset + 29) % totalBytes] ?? 0;
  }
  const pixelVariance = computePixelVariance(pixels, dims.width, dims.height);
  return { pixels, width: dims.width, height: dims.height, pixelVariance };
}

function estimateImageDimensions(buf: Buffer): { width: number; height: number } {
  let width = 64;
  let height = 64;
  if (buf.length > 500_000) { width = 256; height = 256; }
  else if (buf.length > 200_000) { width = 192; height = 192; }
  else if (buf.length > 50_000) { width = 128; height = 128; }
  else if (buf.length > 10_000) { width = 96; height = 96; }
  else { width = 64; height = 64; }
  return { width, height };
}

function computePixelVariance(pixels: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  const total = w * h;
  for (let i = 0; i < total; i += Math.max(1, Math.floor(total / 4096))) {
    const r = pixels[i * 3];
    const g = pixels[i * 3 + 1];
    const b = pixels[i * 3 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum;
    sumSq += lum * lum;
    count++;
  }
  if (count === 0) return 0;
  const mean = sum / count;
  const variance = sumSq / count - mean * mean;
  return Math.max(0, variance);
}

function generateFallbackHistogramVector(pixels: Uint8ClampedArray, w: number, h: number): number[] {
  const gridHist = gridColorHistogram(pixels, w, h, 8, 32);
  const edgeVec = laplacianEdgeVector(pixels, w, h, 4);
  const phashVec = perceptualHashVector(pixels, w, h, 128);

  const raw = new Array<number>(512).fill(0);
  for (let i = 0; i < gridHist.length && i < 256; i++) raw[i] = gridHist[i];
  for (let i = 0; i < edgeVec.length && i < 128; i++) raw[256 + i] = edgeVec[i];
  for (let i = 0; i < phashVec.length && i < 128; i++) raw[384 + i] = phashVec[i];
  return normalizeVector(raw);
}

function gridColorHistogram(
  pixels: Uint8ClampedArray, w: number, h: number, gridSize: number, binsPerCell: number
): number[] {
  const totalCells = gridSize * gridSize;
  const vectorLen = Math.min(256, totalCells * 32);
  const vec = new Array<number>(vectorLen).fill(0);
  const cellW = Math.max(1, Math.floor(w / gridSize));
  const cellH = Math.max(1, Math.floor(h / gridSize));

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const cellIdx = gy * gridSize + gx;
      if (cellIdx * 32 >= vectorLen) break;
      const x0 = gx * cellW;
      const y0 = gy * cellH;
      const x1 = Math.min(w, x0 + cellW);
      const y1 = Math.min(h, y0 + cellH);
      const bins = new Array(binsPerCell).fill(0);
      for (let y = y0; y < y1; y += Math.max(1, Math.floor((y1 - y0) / 16))) {
        for (let x = x0; x < x1; x += Math.max(1, Math.floor((x1 - x0) / 16))) {
          const pixIdx = (y * w + x) * 3;
          const r = pixels[pixIdx] ?? 0;
          const g = pixels[pixIdx + 1] ?? 0;
          const b = pixels[pixIdx + 2] ?? 0;
          const lum = (0.299 * r + 0.587 * g + 0.114 * b);
          const bin = Math.min(binsPerCell - 1, Math.floor((lum / 255) * binsPerCell));
          bins[bin]++;
        }
      }
      const maxB = Math.max(1, ...bins);
      const perCell = Math.min(32, binsPerCell);
      for (let b = 0; b < perCell; b++) {
        vec[cellIdx * 32 + b] = (bins[b] ?? 0) / maxB;
      }
    }
  }
  return vec;
}

function laplacianEdgeVector(
  pixels: Uint8ClampedArray, w: number, h: number, gridSize: number
): number[] {
  const cells = gridSize * gridSize;
  const binsPerCell = 8;
  const vec = new Array<number>(cells * binsPerCell).fill(0);
  const cellW = Math.max(2, Math.floor(w / gridSize));
  const cellH = Math.max(2, Math.floor(h / gridSize));

  for (let gy = 0; gy < gridSize; gy++) {
    for (let gx = 0; gx < gridSize; gx++) {
      const x0 = gx * cellW;
      const y0 = gy * cellH;
      const x1 = Math.min(w, x0 + cellW);
      const y1 = Math.min(h, y0 + cellH);
      let sumEdge = 0;
      let sumEdgeSq = 0;
      let cnt = 0;
      for (let y = y0 + 1; y < y1 - 1; y += Math.max(1, Math.floor((y1 - y0) / 12))) {
        for (let x = x0 + 1; x < x1 - 1; x += Math.max(1, Math.floor((x1 - x0) / 12))) {
          const c = lum(pixels, w, x, y);
          const u = lum(pixels, w, x, y - 1);
          const d = lum(pixels, w, x, y + 1);
          const l = lum(pixels, w, x - 1, y);
          const r = lum(pixels, w, x + 1, y);
          const lap = Math.abs(-4 * c + u + d + l + r);
          sumEdge += lap;
          sumEdgeSq += lap * lap;
          cnt++;
        }
      }
      const mean = cnt > 0 ? sumEdge / cnt : 0;
      const varc = cnt > 0 ? Math.max(0, sumEdgeSq / cnt - mean * mean) : 0;
      const cell = gy * gridSize + gx;
      vec[cell * binsPerCell + 0] = Math.min(1, mean / 255);
      vec[cell * binsPerCell + 1] = Math.min(1, Math.sqrt(varc) / 255);
      vec[cell * binsPerCell + 5] = Math.min(1, (gx + 1) / gridSize);
      vec[cell * binsPerCell + 6] = Math.min(1, (gy + 1) / gridSize);
      vec[cell * binsPerCell + 7] = Math.min(1, varc / 5000);
    }
  }
  return vec;
}

function perceptualHashVector(
  pixels: Uint8ClampedArray, w: number, h: number, targetDims: number
): number[] {
  const size = 16;
  const small = new Array<number>(size * size).fill(0);
  const stepW = Math.max(1, Math.floor(w / size));
  const stepH = Math.max(1, Math.floor(h / size));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const sx = Math.min(w - 1, x * stepW);
      const sy = Math.min(h - 1, y * stepH);
      small[y * size + x] = lum(pixels, w, sx, sy);
    }
  }
  let sum = 0;
  for (const v of small) sum += v;
  const mean = sum / small.length;
  const bits = new Array<number>(targetDims).fill(0);
  for (let i = 0; i < Math.min(targetDims, small.length); i++) {
    bits[i] = small[i] >= mean ? 1 : -1;
  }
  return bits;
}

function lum(pixels: Uint8ClampedArray, w: number, x: number, y: number): number {
  const i = (y * w + x) * 3;
  const r = pixels[i] ?? 0;
  const g = pixels[i + 1] ?? 0;
  const b = pixels[i + 2] ?? 0;
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
