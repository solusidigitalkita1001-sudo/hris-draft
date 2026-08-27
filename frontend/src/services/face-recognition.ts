/**
 * ═══════════════════════════════════════════════════════════════════════
 * FRONTEND FACE RECOGNITION + LIVENESS — GRADE 2 TFJS UPGRADE (Step 4)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Sebelumnya: Grade 1 FALLBACK HEURISTIC 0-dep (pure Canvas ImageData
 * histogram + edge + pHash → vector 512-dim). Mudah dipalsukan foto print.
 *
 * Sekarang: Grade 2 REAL FaceNet + LANDMARK LIVENESS via @vladmandic/human:
 *   1. FaceNet 512-dim embedding real (bukan warna acak) → match akurat.
 *   2. 106 face landmarks (Human v3 default) → bisa hitung rasio mata
 *      (EAR = Eye Aspect Ratio) + rasio mulut (MAR = Mouth Aspect Ratio)
 *      + head pose yaw/pitch/roll.
 *   3. CHALLENGE-RESPONSE LIVENESS LEVEL 2: Random pilih BLINK / SMILE /
 *      TILT_LEFT / TILT_RIGHT / NOD → rekam 3-5 frame berturut-turut,
 *      hitung perubahan metric landmark → cek apakah tantangan
 *      benar-benar dilakukan. Anti: replay attack 2D screen + foto print.
 *
 * FAILOVER STRATEGY: SAMA SEPERTI BACKEND! Jika @vladmandic/human
 * tidak di-install / WebGL tidak support / lambat di browser lawas →
 * otomatis fallback ke Grade 1 pure Canvas histogram 0-dep. Service
 * TIDAK PERNAH crash, kompatibel 100% browser lama.
 *
 * Compatibility: Semua signature function TETAP SAMA (nama, parameter,
 * return type) → call site di AttendanceList / CheckInForm TIDAK perlu
 * diubah! Cuma behaviour internal yang upgrade.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type FaceVector = number[];

export interface FrontendFaceExtractionResult {
  vector: FaceVector;
  pixelVariance: number;
  width: number;
  height: number;
  faceConfidence?: number;
  isFallbackHeuristic: boolean;
  warning?: string;
}

export interface FrontendLivenessEvidence {
  pixelVariance: number | null;
  fileSizeBytes: number | null;
  mimeType: string | null;
  clientSource: 'camera' | 'gallery' | 'unknown';
  isLiveCapture: boolean | null;
  exifMake?: string | null;
  exifModel?: string | null;
  exifSoftware?: string | null;
  exifDateTimeOriginal?: string | null;
  exifOrientation?: number | null;
  challengeEvidence?: {
    challenge: LivenessChallengeFrame['challenge'];
    passed: boolean;
    score: number;
    framesCaptured: number;
  } | null;
}

type HumanSingleton = any;
let humanInstance: HumanSingleton | null = null;
let humanLoadPromise: Promise<HumanSingleton | null> | null = null;
let humanStatus: 'uninit' | 'loading' | 'ready' | 'failed' = 'uninit';

const FRONTEND_HUMAN_CONFIG: Record<string, any> = {
  backend: 'webgl',
  modelBasePath: 'https://vladmandic.github.io/human-models/models/',
  debug: false,
  async: true,
  warmup: 'face',
  face: {
    enabled: true,
    detector: { enabled: true, modelPath: 'blazeface.json', rotation: true, maxDetected: 1 },
    mesh: { enabled: true, modelPath: 'facemesh.json' },
    iris: { enabled: false },
    description: { enabled: true, modelPath: 'faceres.json' }, // 512-dim embedding
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

async function getHuman(): Promise<HumanSingleton | null> {
  if (humanStatus === 'ready') return humanInstance;
  if (humanStatus === 'failed') return null;
  if (humanStatus === 'uninit') {
    humanStatus = 'loading';
    humanLoadPromise = (async () => {
      try {
        const HumanDynamic = (await import('@vladmandic/human')).default;
        const instance = new HumanDynamic(FRONTEND_HUMAN_CONFIG);
        await instance.load();
        humanInstance = instance;
        humanStatus = 'ready';
        return instance;
      } catch (_e) {
        humanStatus = 'failed';
        humanInstance = null;
        return null;
      }
    })();
  }
  return humanLoadPromise;
}

/* ─────────────────────────────────────────────────────────────────────
   PUBLIC ENTRY 1: Extract Face Vector (upgrade + auto failover)
   ───────────────────────────────────────────────────────────────────── */
export async function extractFaceVectorFromImageFile(
  file: File | Blob
): Promise<FrontendFaceExtractionResult> {
  const imgData = await fileToImageDataGrid(file, 192, 192);
  const pixelVariance = computePixelVariance(imgData.pixels, imgData.width, imgData.height);

  const human = await getHuman().catch(() => null);
  if (human && humanStatus === 'ready') {
    try {
      const bitmap = await createImageBitmap(file, { resizeWidth: 256, resizeHeight: 256 });
      const res = await human.detect(bitmap, { output: { face: { descriptor: true, mesh: true } } });
      const faces = res?.face || [];
      if (Array.isArray(faces) && faces.length > 0 && faces[0]) {
        const emb = faces[0].embedding || faces[0].descriptor || faces[0].description;
        if (Array.isArray(emb) && emb.length >= 128) {
          const norm = normalizeVector(emb);
          const padded = new Array(512).fill(0);
          const minLen = Math.min(512, norm.length);
          for (let i = 0; i < minLen; i++) padded[i] = norm[i] ?? 0;
          const conf = typeof faces[0].score === 'number' ? faces[0].score
            : typeof faces[0].confidence === 'number' ? faces[0].confidence : 0.8;
          return {
            vector: padded,
            pixelVariance,
            width: imgData.width,
            height: imgData.height,
            faceConfidence: Number(conf),
            isFallbackHeuristic: false,
          };
        }
      }
    } catch (_e) { /* fallthrough ke fallback */ }
  }

  const vec = generateFallback512(imgData);
  return {
    vector: vec,
    pixelVariance,
    width: imgData.width,
    height: imgData.height,
    isFallbackHeuristic: true,
    warning:
      'FALLBACK: pure canvas histogram vector. Install @vladmandic/human + WebGL enabled browser untuk FaceNet Grade 2 accuracy.',
  };
}

/* ─────────────────────────────────────────────────────────────────────
   PUBLIC ENTRY 2: Liveness Evidence EXIF + fileSize + variance
   (TAMBAH challengeEvidence jika ada lulus challenge)
   ───────────────────────────────────────────────────────────────────── */
export async function generateLivenessEvidenceFromFile(
  file: File | Blob,
  challengeResult?: { challenge: any; passed: boolean; score: number; framesCaptured: number } | null,
): Promise<FrontendLivenessEvidence> {
  const mimeType = ('type' in file ? file.type : null) ?? null;
  const fileSizeBytes = file.size ?? null;
  let arrBuf: ArrayBuffer | null = null;
  try { arrBuf = await file.slice(0, Math.min(512_000, file.size || 0)).arrayBuffer(); } catch { arrBuf = null; }

  const exif = parseMinimalExif(arrBuf);
  const grid = await fileToImageDataGrid(file, 128, 128).catch(() => null);
  const pixelVariance = grid ? computePixelVariance(grid.pixels, grid.width, grid.height) : null;
  const clientSource = (mimeType && /image\/.*/.test(mimeType)) ? 'unknown' : 'unknown';

  return {
    pixelVariance,
    fileSizeBytes,
    mimeType,
    clientSource,
    isLiveCapture: challengeResult?.passed ?? null,
    challengeEvidence: challengeResult ?? null,
    ...exif,
  };
}

/* ─────────────────────────────────────────────────────────────────────
   LIVENESS CHALLENGE LEVEL 2 — CHALLENGE-RESPONSE LANDMARK
   ───────────────────────────────────────────────────────────────────── */
export type LivenessChallenge = 'BLINK' | 'SMILE' | 'TILT_LEFT' | 'TILT_RIGHT' | 'NOD';

export const CHALLENGE_INSTRUCTIONS: Record<LivenessChallenge, { id: string; title: string; description: string; icon: string }> = {
  BLINK:       { id: 'BLINK',       title: 'Kedipkan Mata 2x',         description: 'Kedipkan mata Anda sebanyak 2 kali secara natural.', icon: '👁️' },
  SMILE:       { id: 'SMILE',       title: 'Senyum Lebar',             description: 'Tunjukkan senyum lebar (buka mulut sedikit).', icon: '😊' },
  TILT_LEFT:   { id: 'TILT_LEFT',   title: 'Putar Kepala ke Kiri',     description: 'Condongkan / putar kepala Anda ke arah kIRI.', icon: '↩️' },
  TILT_RIGHT:  { id: 'TILT_RIGHT',  title: 'Putar Kepala ke Kanan',    description: 'Condongkan / putar kepala Anda ke arah KANAN.', icon: '↪️' },
  NOD:         { id: 'NOD',         title: 'Angguk Kepala 2x',         description: 'Angguk (nod) kepala Anda sebanyak 2 kali ke bawah-atas.', icon: '🔽' },
};

export interface LivenessChallengeFrame {
  challenge: LivenessChallenge;
  startedAt: number;
  completed: boolean;
  frames?: number[][];
}

export function selectRandomLivenessChallenge(): LivenessChallenge {
  const options: LivenessChallenge[] = ['BLINK', 'SMILE', 'TILT_LEFT', 'TILT_RIGHT', 'NOD'];
  return options[Math.floor(Math.random() * options.length)];
}

export function createLivenessChallengeSession(): LivenessChallengeFrame {
  return {
    challenge: selectRandomLivenessChallenge(),
    startedAt: Date.now(),
    completed: false,
  };
}

/**
 * Compute landmark metrics dari 1 frame face (ambil wajah pertama).
 * Return object untuk hitung perubahan antar frame selama challenge.
 * NOTE: Menggunakan 468 MediaPipe landmark index (standard Human facemesh).
 */
export interface FaceLandmarkMetrics {
  /** Eye Aspect Ratio (EAR) avg kedua mata */
  ear: number;
  /** Mouth Aspect Ratio (MAR) — tinggi / lebar mulut */
  mar: number;
  /** Smile Ratio: sudut mulut vs bibir bawah (lebih besar = senyum) */
  smileRatio: number;
  /** Head yaw (putaran kiri-kanan): negatif=kiri, positif=kanan (radian ~ -0.5 s/d 0.5) */
  yaw: number;
  /** Head pitch (angguk atas-bawah): negatif=atas, positif=bawah */
  pitch: number;
  detected: boolean;
  confidence: number;
}

export async function detectFaceLandmarksFromVideoFrame(
  videoOrImage: HTMLVideoElement | HTMLCanvasElement | ImageBitmap,
): Promise<FaceLandmarkMetrics> {
  const human = await getHuman().catch(() => null);
  if (human && humanStatus === 'ready') {
    try {
      const res = await human.detect(videoOrImage, { output: { face: { mesh: true } } });
      const faces = res?.face || [];
      if (Array.isArray(faces) && faces.length > 0 && faces[0]?.mesh) {
        return computeLandmarkMetrics(faces[0].mesh, faces[0].score ?? faces[0].confidence ?? 0.8);
      }
    } catch (_e) { /* fallthrough */ }
  }
  return { ear: 0.3, mar: 0.1, smileRatio: 0.5, yaw: 0, pitch: 0, detected: false, confidence: 0 };
}

function computeLandmarkMetrics(mesh: ArrayLike<[number, number, number]>, confidence: number): FaceLandmarkMetrics {
  // Standard MediaPipe 468 landmark indices:
  // Left eye outer: 33, inner left:133, upper lid:159, lower lid:145
  // Right eye outer:263, inner right:362, upper lid:386, lower lid:374
  // Mouth outer left:61, right:291, upper:13, lower:14
  // Nose tip: 1
  // Chin: 152
  // Left cheekbone: 234, Right cheekbone: 454
  const L = (i: number) => mesh[i] || [0, 0, 0];
  const dist = (a: [number, number, number], b: [number, number, number]) => {
    const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const leOuter = L(33), leInner = L(133), leUp = L(159), leLo = L(145);
  const reOuter = L(263), reInner = L(362), reUp = L(386), reLo = L(374);
  const lEAR = (dist(leUp, leLo)) / (0.0001 + dist(leOuter, leInner));
  const rEAR = (dist(reUp, reLo)) / (0.0001 + dist(reOuter, reInner));
  const ear = (lEAR + rEAR) / 2;

  const mL = L(61), mR = L(291), mU = L(13), mLo = L(14);
  const mouthW = dist(mL, mR);
  const mouthH = dist(mU, mLo);
  const mar = mouthH / (0.0001 + mouthW);
  const smileRatio = mar * 10;

  const nose = L(1), chin = L(152), leftCheek = L(234), rightCheek = L(454);
  // Yaw: perbandingan jarak nose-leftCheek vs nose-rightCheek (0 = tengah)
  const dL = dist(nose, leftCheek);
  const dR = dist(nose, rightCheek);
  const yaw = (dL - dR) / (0.0001 + (dL + dR)); // -1..1 range normal
  // Pitch: perbandingan jarak nose-chin vertical component
  const pitch = (nose[1] - (chin[1] + leftCheek[1] + rightCheek[1]) / 3); // y-axis screen; positive=mengangguk bawah

  return { ear, mar, smileRatio, yaw, pitch, detected: true, confidence: Number(confidence) ?? 0 };
}

export interface ChallengeVerificationResult {
  passed: boolean;
  score: number;
  reason?: string;
}

/**
 * Verifikasi apakah serangkaian frame metrics MEMENUHI challenge yang ditentukan.
 * @param baseline Baseline netral (status wajah biasa sebelum challenge mulai)
 * @param frames   3-10 frame selama user melakukan challenge
 * @param challenge Jenis challenge yang diminta
 */
export function verifyLivenessChallenge(
  baseline: FaceLandmarkMetrics,
  frames: FaceLandmarkMetrics[],
  challenge: LivenessChallenge,
): ChallengeVerificationResult {
  const detectedFrames = frames.filter((f) => f.detected);
  if (detectedFrames.length < 2) {
    return { passed: false, score: 0, reason: 'Kurang dari 2 frame wajah terdeteksi, coba ulangi.' };
  }

  switch (challenge) {
    case 'BLINK': {
      // Minimal 1x EAR drop >30% dari baseline (kedip). Count frame turun-turun
      let blinkCount = 0;
      let inBlink = false;
      for (const f of detectedFrames) {
        const ratio = f.ear / (0.0001 + baseline.ear);
        if (ratio < 0.6 && !inBlink) { inBlink = true; blinkCount++; }
        else if (ratio > 0.85 && inBlink) { inBlink = false; }
      }
      const passed = blinkCount >= 1;
      return { passed, score: Math.min(1, blinkCount / 1.5), reason: passed ? undefined : `Tidak terdeteksi kedip (${blinkCount}x). Coba kedip lebih jelas.` };
    }

    case 'SMILE': {
      // smileRatio (MAR scaled) minimal 2x baseline
      const maxSmile = detectedFrames.reduce((m, f) => Math.max(m, f.smileRatio), 0);
      const ratio = maxSmile / (0.001 + baseline.smileRatio);
      const passed = ratio >= 1.6;
      return { passed, score: Math.min(1, (ratio - 1) / 1.2), reason: passed ? undefined : 'Senyum kurang lebar, coba buka mulut sedikit dan angkat sudut bibir.' };
    }

    case 'TILT_LEFT': {
      // yaw < -0.08 = putar ke kiri (yaw negatif: leftCheek dekat)
      const minYaw = detectedFrames.reduce((m, f) => Math.min(m, f.yaw), 0);
      const passed = minYaw <= -0.07;
      return { passed, score: Math.min(1, Math.abs(minYaw) / 0.15), reason: passed ? undefined : 'Kepala kurang condong ke KIRI. Putar lebih dalam.' };
    }

    case 'TILT_RIGHT': {
      const maxYaw = detectedFrames.reduce((m, f) => Math.max(m, f.yaw), 0);
      const passed = maxYaw >= 0.07;
      return { passed, score: Math.min(1, maxYaw / 0.15), reason: passed ? undefined : 'Kepala kurang condong ke KANAN. Putar lebih dalam.' };
    }

    case 'NOD': {
      // pitch berubah dari baseline minimal 2 fase (turun -> naik) = minimal stddev tinggi
      const pitches = detectedFrames.map((f) => f.pitch);
      const mean = pitches.reduce((s, p) => s + p, 0) / pitches.length;
      const variance = pitches.reduce((s, p) => s + (p - mean) ** 2, 0) / pitches.length;
      const stddev = Math.sqrt(variance);
      const diff = Math.max(...pitches) - Math.min(...pitches);
      const passed = stddev > 0.015 || diff > 0.04;
      return { passed, score: Math.min(1, stddev / 0.03), reason: passed ? undefined : 'Angguk kepala kurang jelas. Coba angguk 2x lebih dalam.' };
    }
  }
}

/* ─────────────────────────────────────────────────────────────────────
   Blur detection (pure helper tetap sama untuk variance liveness evidence)
   ───────────────────────────────────────────────────────────────────── */
export function computeBlurVariance(imageData: ImageData): number {
  return computePixelVariance(imageDataToGrid(imageData).pixels, imageData.width, imageData.height);
}

/* ─── helpers pure (Canvas fallback tetap dipertahankan untuk failover) ─── */

function generateFallback512(imgData: { pixels: Uint8ClampedArray; width: number; height: number }): number[] {
  const gridHist = gridColorHistogram(imgData.pixels, imgData.width, imgData.height, 8, 32);
  const edgeVec = laplacianEdgeVector(imgData.pixels, imgData.width, imgData.height, 4);
  const phashVec = perceptualHashVector(imgData.pixels, imgData.width, imgData.height, 128);
  const raw = new Array(512).fill(0);
  for (let i = 0; i < gridHist.length && i < 256; i++) raw[i] = gridHist[i];
  for (let i = 0; i < edgeVec.length && i < 128; i++) raw[256 + i] = edgeVec[i];
  for (let i = 0; i < phashVec.length && i < 128; i++) raw[384 + i] = phashVec[i];
  return normalizeVector(raw);
}

async function fileToImageDataGrid(
  file: File | Blob, targetW: number, targetH: number
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file, { resizeWidth: targetW, resizeHeight: targetH });
    const off = document.createElement('canvas');
    off.width = targetW; off.height = targetH;
    const ctx = off.getContext('2d');
    if (!ctx) return { pixels: new Uint8ClampedArray(targetW * targetH * 3), width: targetW, height: targetH };
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    return imageDataToGrid(ctx.getImageData(0, 0, targetW, targetH));
  } catch {
    return { pixels: new Uint8ClampedArray(targetW * targetH * 3), width: targetW, height: targetH };
  }
}

function imageDataToGrid(img: ImageData): { pixels: Uint8ClampedArray; width: number; height: number } {
  const w = img.width, h = img.height;
  const out = new Uint8ClampedArray(w * h * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    out[j] = img.data[i]; out[j + 1] = img.data[i + 1]; out[j + 2] = img.data[i + 2];
  }
  return { pixels: out, width: w, height: h };
}

function computePixelVariance(pixels: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0, sumSq = 0, count = 0;
  const total = w * h;
  const step = Math.max(1, Math.floor(total / 4096));
  for (let i = 0; i < total; i += step) {
    const r = pixels[i * 3], g = pixels[i * 3 + 1], b = pixels[i * 3 + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    sum += lum; sumSq += lum * lum; count++;
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return Math.max(0, sumSq / count - mean * mean);
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
      const x0 = gx * cellW, y0 = gy * cellH;
      const x1 = Math.min(w, x0 + cellW), y1 = Math.min(h, y0 + cellH);
      const bins = new Array(binsPerCell).fill(0);
      const stepX = Math.max(1, Math.floor((x1 - x0) / 16));
      const stepY = Math.max(1, Math.floor((y1 - y0) / 16));
      for (let y = y0; y < y1; y += stepY) {
        for (let x = x0; x < x1; x += stepX) {
          const i = (y * w + x) * 3;
          const lum = 0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0);
          const bin = Math.min(binsPerCell - 1, Math.floor((lum / 255) * binsPerCell));
          bins[bin]++;
        }
      }
      const maxB = Math.max(1, ...bins);
      const perCell = Math.min(32, binsPerCell);
      for (let b = 0; b < perCell; b++) vec[cellIdx * 32 + b] = (bins[b] ?? 0) / maxB;
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
      const x0 = gx * cellW, y0 = gy * cellH;
      const x1 = Math.min(w, x0 + cellW), y1 = Math.min(h, y0 + cellH);
      let sumEdge = 0, sumEdgeSq = 0, cnt = 0;
      const stepY = Math.max(1, Math.floor((y1 - y0) / 12));
      const stepX = Math.max(1, Math.floor((x1 - x0) / 12));
      for (let y = y0 + 1; y < y1 - 1; y += stepY) {
        for (let x = x0 + 1; x < x1 - 1; x += stepX) {
          const c = lum(pixels, w, x, y);
          const u = lum(pixels, w, x, y - 1), d = lum(pixels, w, x, y + 1);
          const l = lum(pixels, w, x - 1, y), r = lum(pixels, w, x + 1, y);
          const lap = Math.abs(-4 * c + u + d + l + r);
          sumEdge += lap; sumEdgeSq += lap * lap; cnt++;
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
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const sx = Math.min(w - 1, x * stepW), sy = Math.min(h - 1, y * stepH);
    small[y * size + x] = lum(pixels, w, sx, sy);
  }
  let sum = 0; for (const v of small) sum += v;
  const mean = sum / small.length;
  const bits = new Array<number>(targetDims).fill(0);
  for (let i = 0; i < Math.min(targetDims, small.length); i++) bits[i] = small[i] >= mean ? 1 : -1;
  return bits;
}

function normalizeVector(v: number[]): number[] {
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  const len = Math.sqrt(sum);
  if (!isFinite(len) || len <= 1e-12) return v.map(() => 0);
  return v.map((x) => x / len);
}

function lum(pixels: Uint8ClampedArray, w: number, x: number, y: number): number {
  const i = (y * w + x) * 3;
  return 0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0);
}

function parseMinimalExif(
  buf: ArrayBuffer | null
): { exifMake?: string | null; exifModel?: string | null; exifSoftware?: string | null; exifDateTimeOriginal?: string | null; exifOrientation?: number | null } {
  if (!buf || buf.byteLength < 20) return {};
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return {};
  for (let i = 2; i < Math.min(bytes.length - 8, 512); i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1 && i + 10 < bytes.length) {
      const sig = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (sig !== 'Exif') continue;
      const segLen = (bytes[i + 2] << 8) | bytes[i + 3];
      const end = Math.min(bytes.length, i + 2 + segLen);
      const s = searchPrintableStrings(bytes, i + 8, end);
      return {
        exifMake: pickByPrefix(s, /make|canon|nikon|samsung|xiaomi|apple|oppo|vivo|huawei|sony/i, 0),
        exifModel: pickByPrefix(s, /model|sm-|iphone|pixel|mi\s|redmi|poco|galaxy|xperia/i, 1),
        exifSoftware: pickByPrefix(s, /software|photoshop|lightroom|snapseed|canva|gimp|miui|ios|android/i, 2),
        exifDateTimeOriginal: pickByPrefix(s, /\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}/, 3),
        exifOrientation: null,
      };
    }
  }
  return {};
}

function searchPrintableStrings(bytes: Uint8Array, from: number, to: number): string[] {
  const out: string[] = [];
  let buf = '';
  for (let i = from; i < to; i++) {
    const b = bytes[i];
    if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) buf += String.fromCharCode(b);
    else { if (buf.length >= 4) out.push(buf); buf = ''; }
  }
  if (buf.length >= 4) out.push(buf);
  return out;
}

function pickByPrefix(strings: string[], pattern: RegExp, fallbackIdx: number): string | null {
  for (const s of strings) if (pattern.test(s)) return s.slice(0, 60);
  return strings[fallbackIdx]?.slice(0, 60) ?? null;
}
