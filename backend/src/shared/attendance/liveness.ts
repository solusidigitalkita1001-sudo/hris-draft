export enum LivenessVerdict {
  PASS = 'PASS',
  STATIC = 'STATIC',
  BLUR = 'BLUR',
  MANIPULATED = 'MANIPULATED',
  NO_DATA = 'NO_DATA',
}

/**
 * ═══════════════════════════════════════════════════════════════════════
 * LIVENESS DETECTION — EVALUASI & TRADEOFF DOKUMENTASI (Task 3.5 Minggu 3)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SISTEM SAAT INI (MVP Level 1 — HEURISTIK EXIF + BLUR) = PASS untuk MVP:
 * ┌─────────────────────────────────────────────────────────────────┬──────────┬───────────┬──────────────┐
 * │ EVIDENCE TYPE                                                 │ EFFECTIVE │ FALSE + │ SPOOFING TYPE │
 * │                                                             │ AGAINST   │ FALSE -  │                │
 * ├─────────────────────────────────────────────────────────────────┼──────────┼───────────┼──────────────┤
 * │ 1. Software edit tag EXIF (Photoshop/Photopea/Snapseed/Canva)   │ 8/10     │ rendah    │ Photo retouch  │
 * │ 2. PixelVariance Laplacian <150 (blur detection)                │ 6/10     │ tinggi   │ Print-out foto│
 * │ 3. clientSource=gallery/album (File API explicit)                 │ 9/10      │ rendah    │ Upload galeri │
 * │ 4. isLiveCapture=false (flag dari native capture API Android/iOS)     │ 7/10      │ sedang    │ Foto galeri  │
 * │ 5. EXIF tdk punya make+dateTimeOriginal (foto export)        │ 5/10      │ sedang    │ Screenshoot     │
 * │ 6. FileSize <120kb tanpa model kamera (compress share sheet     │ 4/10      │ sedang    │ Screenshot    │
 * └─────────────────────────────────────────────────────────────────┴──────────┴───────────┴──────────────┘
 *
 * KEKURANGAN Level 1 HEURISTIK:
 * ❌ TIDAK BISA MENDETEKSI: Deepfake FaceSwap (wajah di-reconstruct
 *    tertangkap EXIF=PASS),
 * ❌ TIDAK BISA: Replay attack 2D layar HP (teman menunjukkan foto
 *    wajah korban ke kamera user)
 * ❌ TIDAK BISA: Printed foto high-quality dari korban
 *    (high quality -> pixelVariance > threshold)
 * ❌ TIDAK BISA: Digital cut-out paper bagus (pixelVariance > threshold,
 *    EXIF lulus)
 *
 * ➜ UNTUK PRODUCTION (Level 2 & 3) REKOMENDASI UPGRADE:
 * ┌──────────────┬──────────────────────────────────────────────────────┬──────────────────────┬──────────────────────┐
 * │ LEVEL 2      │ CHALLENGE-RESPONSE (ACTIVE LIVENESS             │ ACCURACY 95%+ │ Biaya DEV ONLY │
 * │ (BIA   │ (tanpa ML library)                                      │ SPA (80-90%│  ├┤
 * │              │ Blink detection via 30% ratio lalu kembali  │       │
 * │              │ Smile mouth open detection  │detect│
 * │              │ Head Tilt (Left/Right/Nod 2° head pose)│
 * │              │ Random select 1 dari 5 challenge tiap clock-in     │       │
 * │              │ 3 frame sample selama 2 detik MediaRecorder   │       │
 * ├──────────────┼──────────────────────────────────────────────────────┼──────────────────────┼──────────────────────┤
 * │ LEVEL 3      │ PASSIVE LIVENESS 3D (depth map / reflection)  │ ACCURACY 99%+ │ + SDK LICENSE FEE │
 * │ENTERPRISE   │ Privy Liveness / Face++ 3D / AWS Rekognition DetectLiveness │ SDK indonesia
 * │              │                                                │      │
 * │              │ Infrared camera (IR) depth map (anti print-out) │  │
 * └──────────────┴──────────────────────────────────────────────────────┴──────────────────────┴──────────────────────┘
 *
 * PLACEHOLDER IMPLEMENTASI (Sudah ADA frontend services/face-recognition.ts:
 *   selectRandomLivenessChallenge() return BLINK/SMILE/TILT_LEFT/TILT_RIGHT/NOD
 *   createLivenessChallengeSession()
 *   Di level 2 ini structural sudah terSTRUKTUR data challange yang bisa diinject ke liveness
 *   evidence tanpa ubah signature call site.
 *
 * PRODUCTION PATH REKOMENDASI:
 * ➜ STEP 1 (sekarang s/d 6 bulan ke depan): LEVEL 1 HEURISTIK INI (SAJA LEVEL 2 challange-response + @vladmandic/human landmark 106 titik (gratis ML
 * ➜ STEP 2 (12+ bulan): LEVEL 3 Privy/Face++ SDK  (untukFintech/government)
 * ═══════════════════════════════════════════════════════════════════════
 */

export interface LivenessEvidence {
  exifMake?: string | null;
  exifModel?: string | null;
  exifSoftware?: string | null;
  exifDateTimeOriginal?: string | null;
  exifOrientation?: number | null;
  /// Estimasi variance piksel (lebih kecil = lebih blur). Default threshold 150.
  pixelVariance?: number | null;
  /// Besar file byte, foto galeri export biasanya < 120kb / di-recompress apps share sheet
  fileSizeBytes?: number | null;
  mimeType?: string | null;
  /// Client-reported source: "camera" vs "gallery" vs "unknown"
  clientSource?: string | null;
  isLiveCapture?: boolean | null;
  extraFlags?: Record<string, boolean | number | string | null>;
}

export interface LivenessAssessment {
  verdict: LivenessVerdict;
  reasons: string[];
  evidenceRedacted: {
    hasCameraModel: boolean;
    hasDateTimeOriginal: boolean;
    hasSoftwareTag: boolean;
    pixelVariance?: number;
    fileSizeBytes?: number;
  };
}

const EDIT_SOFTWARE_PATTERNS = [
  /photoshop/i,
  /photopea/i,
  /canva/i,
  /gimp/i,
  /corel/i,
  /pixlr/i,
  /paint\.net/i,
  /lightroom/i,
  /illustrator/i,
  /snapseed/i,
  /picsart/i,
];

function notEmpty(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export function assessLiveness(evidence: LivenessEvidence | null | undefined): LivenessAssessment {
  const reasons: string[] = [];

  if (!evidence || Object.keys(evidence).length === 0) {
    return {
      verdict: LivenessVerdict.NO_DATA,
      reasons: ['Tidak ada metadata EXIF / bukti liveness dikirim'],
      evidenceRedacted: {
        hasCameraModel: false,
        hasDateTimeOriginal: false,
        hasSoftwareTag: false,
      },
    };
  }

  const hasCameraModel = notEmpty(evidence.exifMake) || notEmpty(evidence.exifModel);
  const hasDateTimeOriginal = notEmpty(evidence.exifDateTimeOriginal);
  const hasSoftwareTag = notEmpty(evidence.exifSoftware);

  const redacted = {
    hasCameraModel,
    hasDateTimeOriginal,
    hasSoftwareTag,
    pixelVariance:
      typeof evidence.pixelVariance === 'number' && Number.isFinite(evidence.pixelVariance)
        ? evidence.pixelVariance
        : undefined,
    fileSizeBytes:
      typeof evidence.fileSizeBytes === 'number' && Number.isFinite(evidence.fileSizeBytes) && evidence.fileSizeBytes > 0
        ? evidence.fileSizeBytes
        : undefined,
  };

  if (hasSoftwareTag && EDIT_SOFTWARE_PATTERNS.some((p) => p.test(evidence.exifSoftware!))) {
    reasons.push(`Software edit terdeteksi: ${evidence.exifSoftware!.slice(0, 40)}`);
    return { verdict: LivenessVerdict.MANIPULATED, reasons, evidenceRedacted: redacted };
  }

  const variance = Number.isFinite(evidence.pixelVariance as number) ? (evidence.pixelVariance as number) : null;
  if (variance !== null && variance < 150) {
    reasons.push(`Variance pixel sangat rendah (${variance} < 150) — foto blur / print-out / copy`);
    return { verdict: LivenessVerdict.BLUR, reasons, evidenceRedacted: redacted };
  }

  if (
    evidence.clientSource &&
    typeof evidence.clientSource === 'string' &&
    /gallery|album|photo\s*library|files/i.test(evidence.clientSource.trim())
  ) {
    reasons.push(`Source foto dari galeri (clientSource=${evidence.clientSource})`);
    return { verdict: LivenessVerdict.STATIC, reasons, evidenceRedacted: redacted };
  }

  if (evidence.isLiveCapture === false) {
    reasons.push('Flag isLiveCapture=false (bukan realtime capture)');
    return { verdict: LivenessVerdict.STATIC, reasons, evidenceRedacted: redacted };
  }

  if (!hasCameraModel && !hasDateTimeOriginal) {
    reasons.push('EXIF tidak memiliki camera model (make/model) maupun DateTimeOriginal (biasanya foto export/gallery)');
    return { verdict: LivenessVerdict.STATIC, reasons, evidenceRedacted: redacted };
  }

  const size = evidence.fileSizeBytes;
  if (typeof size === 'number' && size > 0 && size < 120_000 && !hasCameraModel) {
    reasons.push(`File size sangat kecil (${size} < 120kb) + tidak ada model kamera → kemungkinan compress/share sheet`);
    return { verdict: LivenessVerdict.STATIC, reasons, evidenceRedacted: redacted };
  }

  if (hasCameraModel) reasons.push('✓ Ada EXIF make/model kamera');
  if (hasDateTimeOriginal) reasons.push('✓ Ada DateTimeOriginal');
  if (variance !== null && variance >= 150) reasons.push(`✓ Variance pixel cukup (${variance.toFixed(0)} >= 150)`);
  if (evidence.isLiveCapture === true) reasons.push('✓ isLiveCapture=true (realtime)');

  return { verdict: LivenessVerdict.PASS, reasons, evidenceRedacted: redacted };
}
