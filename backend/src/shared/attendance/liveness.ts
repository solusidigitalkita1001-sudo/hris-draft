export enum LivenessVerdict {
  PASS = 'PASS',
  STATIC = 'STATIC',
  BLUR = 'BLUR',
  MANIPULATED = 'MANIPULATED',
  NO_DATA = 'NO_DATA',
}

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
