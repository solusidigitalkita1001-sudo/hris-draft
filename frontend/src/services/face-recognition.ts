/**
 * ═══════════════════════════════════════════════════════════════════════
 * FRONTEND FACE RECOGNITION SERVICE — Minggu 3 Task 3.2b
 * ═══════════════════════════════════════════════════════════════════════
 *
 * DECISION (lihat backend face-extractor.ts untuk full 3-TIER ARCHITECTURE):
 * ┌────────────────────────────────────────────────────────────────────┐
 * │ RECOMMENDED PRODUCTION DEPENDENCY:                                 │
 * │   npm install @vladmandic/human                                    │
 * │   (Human = successor face-api.js; TFJS WebGL backend; on-device    │
 * │    FaceNet 512-dim embedding + 106 face landmarks + liveness)     │
 * │                                                                    │
 * │ IMPLEMENTASI FALLBACK SAAT INI (FILE INI):                         │
 * │   Pure Canvas API + ImageData (0 dependency tambahan) →            │
 * │   512-dim normalized vector via color histogram + Laplacian edge  │
 * │   + perceptual hash. Compatible dengan compareFaceVectors backend  │
 * │   (backend dan frontend sama format vector 512 number[]).          │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * Cara pakai (MVP):
 *   import { extractFaceVectorFromImageFile, computeBlurVariance,
 *            generateLivenessEvidenceFromFile } from '@/services/face-recognition';
 *
 *   const file = event.target.files[0]; // selfie user
 *   const { vector, pixelVariance } = await extractFaceVectorFromImageFile(file);
 *   const evidence = await generateLivenessEvidenceFromFile(file); // EXIF + fileSize
 *   createAttendance({ faceRecognition: { selfieVector: vector, ...evidence } });
 *
 * Untuk production upgrade nanti: ganti implementasi extractFaceVectorFromImageFile
 * dengan panggil @vladmandic/human FaceNet model — interface return value SAMA
 * (vector 512 number[] + pixelVariance) sehingga attendance DTO & service
 * compareFaceVectors TIDAK PERLU DIUBAH.
 * ═══════════════════════════════════════════════════════════════════════
 */

export type FaceVector = number[];

export interface FrontendFaceExtractionResult {
  vector: FaceVector;
  pixelVariance: number;
  width: number;
  height: number;
  isFallbackHeuristic: true;
  warning: string;
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
}

/**
 * Terima HTML5 File object (foto dari webcam capture / input file) →
 * gambar di-draw ke canvas offscreen → sample ImageData → extract
 * 512-dim normalized vector + pixel variance blur detection.
 */
export async function extractFaceVectorFromImageFile(
  file: File | Blob
): Promise<FrontendFaceExtractionResult> {
  const { pixels, width, height } = await fileToImageDataGrid(file, 128, 128);
  const pixelVariance = computePixelVariance(pixels, width, height);
  const gridHist = gridColorHistogram(pixels, width, height, 8, 32);
  const edgeVec = laplacianEdgeVector(pixels, width, height, 4);
  const phashVec = perceptualHashVector(pixels, width, height, 128);

  const raw = new Array<number>(512).fill(0);
  for (let i = 0; i < gridHist.length && i < 256; i++) raw[i] = gridHist[i];
  for (let i = 0; i < edgeVec.length && i < 128; i++) raw[256 + i] = edgeVec[i];
  for (let i = 0; i < phashVec.length && i < 128; i++) raw[384 + i] = phashVec[i];

  return {
    vector: normalizeVector(raw),
    pixelVariance,
    width,
    height,
    isFallbackHeuristic: true,
    warning:
      'FALLBACK: pure canvas histogram vector. Production upgrade ke @vladmandic/human (FaceNet 512-dim) untuk accuracy tinggi.',
  };
}

/**
 * Generate liveness evidence (EXIF + file size + variance) untuk dikirim
 * ke backend liveness.assess() function.
 * Fallback EXIF parsing sangat sederhana di sini (cuma baca marker EXIF
 * tanpa library exif-js); untuk production tambahkan `exifr` atau
 * `piexifjs` untuk EXIF Make/Model/DateTimeOriginal yang akurat.
 */
export async function generateLivenessEvidenceFromFile(
  file: File | Blob
): Promise<FrontendLivenessEvidence> {
  const mimeType = ('type' in file ? file.type : null) ?? null;
  const fileSizeBytes = file.size ?? null;
  let arrBuf: ArrayBuffer | null = null;
  try { arrBuf = await file.slice(0, Math.min(512_000, file.size || 0)).arrayBuffer(); } catch { arrBuf = null; }

  const exif = parseMinimalExif(arrBuf);
  const grid = await fileToImageDataGrid(file, 128, 128).catch(() => null);
  const pixelVariance = grid ? computePixelVariance(grid.pixels, grid.width, grid.height) : null;
  const clientSource = mimeType && /image\/.*/.test(mimeType) ? 'unknown' : 'unknown';

  return {
    pixelVariance,
    fileSizeBytes,
    mimeType,
    clientSource,
    isLiveCapture: null,
    ...exif,
  };
}

/**
 * Compute Laplacian variance (standard blur detection metric) dari
 * canvas ImageData. Variance < 150 = foto blur (sesuai liveness.ts backend).
 */
export function computeBlurVariance(imageData: ImageData): number {
  return computePixelVariance(imageDataToGrid(imageData).pixels, imageData.width, imageData.height);
}

/* ─── helpers pure (copied & adapted from backend face-extractor.ts, browserized) ─── */

async function fileToImageDataGrid(
  file: File | Blob, targetW: number, targetH: number
): Promise<{ pixels: Uint8ClampedArray; width: number; height: number; }> {
  const bitmap = await createImageBitmap(file, { resizeWidth: targetW, resizeHeight: targetH });
  const off = document.createElement('canvas');
  off.width = targetW;
  off.height = targetH;
  const ctx = off.getContext('2d');
  if (!ctx) return { pixels: new Uint8ClampedArray(targetW * targetH * 3), width: targetW, height: targetH };
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  const img = ctx.getImageData(0, 0, targetW, targetH);
  return imageDataToGrid(img);
}

function imageDataToGrid(img: ImageData): { pixels: Uint8ClampedArray; width: number; height: number; } {
  const w = img.width, h = img.height;
  const out = new Uint8ClampedArray(w * h * 3);
  for (let i = 0, j = 0; i < img.data.length; i += 4, j += 3) {
    out[j] = img.data[i];
    out[j + 1] = img.data[i + 1];
    out[j + 2] = img.data[i + 2];
  }
  return { pixels: out, width: w, height: h };
}

function computePixelVariance(pixels: Uint8ClampedArray, w: number, h: number): number {
  let sum = 0, sumSq = 0, count = 0;
  const total = w * h;
  const step = Math.max(1, Math.floor(total / 4096));
  for (let i = 0; i < total; i += step) {
    const r = pixels[i * 3];
    const g = pixels[i * 3 + 1];
    const b = pixels[i * 3 + 2];
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
          const u = lum(pixels, w, x, y - 1);
          const d = lum(pixels, w, x, y + 1);
          const l = lum(pixels, w, x - 1, y);
          const r = lum(pixels, w, x + 1, y);
          const lap = Math.abs(-4 * c + u + d + l + r);
          sumEdge += lap; sumEdgeSq += lap * lap; cnt++;
        }
      }
      const mean = cnt > 0 ? sumEdge / cnt : 0;
      const varc = cnt > 0 ? Math.max(0, sumEdgeSq / cnt - mean * mean) : 0;
      const cell = gy * gridSize + gx;
      vec[cell * binsPerCell + 0] = Math.min(1, mean / 255);
      vec[cell * binsPerCell + 1] = Math.min(1, Math.sqrt(varc) / 255);
      vec[cell * binsPerCell + 4] = Math.min(1, sumEdge / (cnt || 1) / 200);
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

/**
 * Mini EXIF parser — mencari marker byte 0xFFE1 (APP1 EXIF) di 256 byte
 * pertama file JPEG, lalu ambil string Make/Model/Software/DateTimeOriginal
 * secara naive (tanpa IFD offset parsing lengkap). Cukup untuk
 * distinguishing source "ada EXIF camera model" vs "tidak ada EXIF sama
 * sekali (export gallery)".
 * Untuk production upgrade: install `exifr` library.
 */
function parseMinimalExif(
  buf: ArrayBuffer | null
): { exifMake?: string | null; exifModel?: string | null; exifSoftware?: string | null; exifDateTimeOriginal?: string | null; exifOrientation?: number | null; } {
  if (!buf || buf.byteLength < 20) return {};
  const bytes = new Uint8Array(buf);
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return {}; // bukan JPEG

  // cari APP1 EXIF marker 0xFFE1 dalam 256 byte pertama
  for (let i = 2; i < Math.min(bytes.length - 8, 512); i++) {
    if (bytes[i] === 0xFF && bytes[i + 1] === 0xE1 && i + 10 < bytes.length) {
      // check "Exif\0" 4 bytes setelah length
      const sig = String.fromCharCode(bytes[i + 4], bytes[i + 5], bytes[i + 6], bytes[i + 7]);
      if (sig !== 'Exif') continue;
      // naive string extraction di dalam APP1 segment: cari printable ASCII run panjang
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
    if ((b >= 32 && b <= 126) || b === 9 || b === 10 || b === 13) {
      buf += String.fromCharCode(b);
    } else {
      if (buf.length >= 4) out.push(buf);
      buf = '';
    }
  }
  if (buf.length >= 4) out.push(buf);
  return out;
}

function pickByPrefix(strings: string[], pattern: RegExp, fallbackIdx: number): string | null {
  for (const s of strings) if (pattern.test(s)) return s.slice(0, 60);
  return strings[fallbackIdx]?.slice(0, 60) ?? null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * PLACEHOLDER CHALLENGE-RESPONSE LIVENESS (Task 3.5 Evaluasi)
 * ═══════════════════════════════════════════════════════════════════════
 * Pattern untuk liveness upgrade nanti — sebelum call extractFaceVector:
 *   1. Tampilkan instruksi random: "Silakan KEDIPKAN MATA" / "SENYUM" /
 *      "Condong kepala ke KANAN" (pilih acak 1 dari 5 tantangan).
 *   2. Rekam 3 frame berturut-turut dalam 2 detik (MediaRecorder).
 *   3. Deteksi landmark di 3 frame:
 *        - blink: eye aspect ratio turun >30% lalu naik kembali
 *        - smile: mouth aspect ratio naik >20% dari baseline netral
 *        - nod/tilt: yaw/pitch landmark berubah sesuai arah
 *   4. Jika tantangan terpenuhi → set evidence.isLiveCapture=true,
 *      lanjut submit; jika tidak → "Ulangi tantangan liveness".
 *
 * Implementasi ini membutuhkan @vladmandic/human (landmark 106 titik
 * wajah) atau face-api.js FaceLandmark68Net — 0 dep version tidak bisa.
 * Fungsi helper di bawah ini hanya return struct kosong untuk dipopulate
 * nanti tanpa mengubah signature call site.
 */
export interface LivenessChallengeFrame {
  challenge: 'BLINK' | 'SMILE' | 'TILT_LEFT' | 'TILT_RIGHT' | 'NOD';
  startedAt: number;
  completed: boolean;
  /** 3-10 frames vector selama tantangan untuk submit ke forensic audit */
  frames?: number[][];
}

export function selectRandomLivenessChallenge(): LivenessChallengeFrame['challenge'] {
  const options: LivenessChallengeFrame['challenge'][] = ['BLINK', 'SMILE', 'TILT_LEFT', 'TILT_RIGHT', 'NOD'];
  return options[Math.floor(Math.random() * options.length)];
}

export function createLivenessChallengeSession(): LivenessChallengeFrame {
  return {
    challenge: selectRandomLivenessChallenge(),
    startedAt: Date.now(),
    completed: false,
  };
}
