export type ESignatureProvider = 'INTERNAL' | 'PRIVY_ID' | 'DIGISIGN' | 'PERURI' | 'OTHER';
export type ESignatureStatus =
  | 'DRAFT'
  | 'REQUESTED'
  | 'SIGNED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'EXPIRED'
  | 'FAILED'
  | 'CANCELLED';
export type ESignatureVerificationLevel = 'BASIC' | 'AUDIT_TRAIL' | 'CERTIFIED';

export interface ProviderRequirements {
  needEKYC?: boolean;       // Perlu verifikasi e-KTP / NIK asli
  needCertifiedLegal?: boolean; // Harus legally binding UU ITE (kontrak kerja wajib)
  needAuditTrail?: boolean; // Perlu hash chain timestamp + signer log
  preferGovernment?: boolean; // Prefer provider pemerintah (Peruri)
  budgetPerDocumentMaxRupiah?: number | null; // Maksimal biaya per dokumen (null = unlimited)
  volumeMonthly?: number | null;
}

export interface ProviderRecommendation {
  recommended: ESignatureProvider;
  reason: string;
  estimatedCostPerDocumentRupiah: number;
  pros: string[];
  cons: string[];
  alternatives: ESignatureProvider[];
}

export const DEFAULT_SIGN_EXPIRY_DAYS = 30;

const PROVIDER_COST: Record<ESignatureProvider, number> = {
  INTERNAL: 0,
  PRIVY_ID: 15_000,
  DIGISIGN: 12_000,
  PERURI: 25_000,
  OTHER: 10_000,
};

const VALID_PROVIDERS = new Set(Object.keys(PROVIDER_COST) as ESignatureProvider[]);
const VALID_STATUSES = new Set([
  'DRAFT', 'REQUESTED', 'SIGNED', 'VERIFIED', 'REJECTED', 'EXPIRED', 'FAILED', 'CANCELLED',
] as ESignatureStatus[]);

export function isValidESignatureProvider(p: unknown): p is ESignatureProvider {
  return typeof p === 'string' && VALID_PROVIDERS.has(p as ESignatureProvider);
}

export function isValidESignatureStatus(s: unknown): s is ESignatureStatus {
  return typeof s === 'string' && VALID_STATUSES.has(s as ESignatureStatus);
}

const TRANSITIONS: Record<ESignatureStatus, ESignatureStatus[]> = {
  DRAFT:     ['REQUESTED', 'CANCELLED'],
  REQUESTED: ['SIGNED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED'],
  SIGNED:    ['VERIFIED', 'FAILED'],
  VERIFIED:  [],
  REJECTED:  [],
  EXPIRED:   [],
  FAILED:    ['REQUESTED', 'CANCELLED'],
  CANCELLED: [],
};

export interface TransitionResult {
  allowed: boolean;
  reason: string | null;
}

export function isSignatureStatusTransitionValid(
  from: unknown,
  to: unknown,
  opts?: { byPass?: boolean },
): TransitionResult {
  if (opts?.byPass) return { allowed: true, reason: 'Admin bypass: status paksa berubah.' };
  if (!isValidESignatureStatus(from)) return { allowed: false, reason: `Status awal tidak valid: ${String(from ?? 'NULL')}` };
  if (!isValidESignatureStatus(to))   return { allowed: false, reason: `Status tujuan tidak valid: ${String(to ?? 'NULL')}` };
  if (from === to) return { allowed: true, reason: 'Status sama, tidak butuh update.' };
  const allowed = TRANSITIONS[from];
  if (!allowed.includes(to)) {
    return {
      allowed: false,
      reason: `Transisi E-Signature ${from} → ${to} tidak diizinkan. Pilihan valid: ${allowed.length ? allowed.join(', ') : 'tidak ada (status final).'}`,
    };
  }
  return { allowed: true, reason: null };
}

export interface SignerPayload {
  signerNik?: string | null;
  signerEmail?: string | null;
  signerPhone?: string | null;
  fullName?: string | null;
}

export interface SignerValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  normalizedNik: string | null;
  normalizedEmail: string | null;
  normalizedPhone: string | null;
}

const NIK_REGEX = /^\d{16}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ID_PHONE_REGEX = /^(\+62|62|0)8[1-9][0-9]{7,12}$/;

function onlyDigits(s: string): string { return s.replace(/\D/g, ''); }

export function validateSignerPayload(input: SignerPayload): SignerValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let normalizedNik: string | null = null;
  let normalizedEmail: string | null = null;
  let normalizedPhone: string | null = null;

  if (input.signerNik && typeof input.signerNik === 'string') {
    const raw = onlyDigits(input.signerNik);
    if (NIK_REGEX.test(raw)) normalizedNik = raw;
    else errors.push('NIK harus 16 digit angka (KTP).');
  }
  if (input.signerEmail && typeof input.signerEmail === 'string') {
    const e = input.signerEmail.trim().toLowerCase();
    if (EMAIL_REGEX.test(e)) normalizedEmail = e;
    else errors.push('Format email signer tidak valid.');
  } else if (!input.signerEmail) {
    warnings.push('Email signer tidak diisi (OTP via email tidak akan berfungsi).');
  }
  if (input.signerPhone && typeof input.signerPhone === 'string') {
    const p = input.signerPhone.trim();
    const normalizeValidate = p.replace(/[\s\-()]/g, ''); // Remove spaces/dash/paren/plus keep prefix + if any
    if (ID_PHONE_REGEX.test(normalizeValidate)) {
      normalizedPhone = p;
    } else {
      errors.push('Nomor HP signer tidak valid (harus format Indonesia 08xx atau +628xx, panjang 10-14 digit).');
    }
  } else if (!input.signerPhone) {
    warnings.push('Nomor HP signer tidak diisi (OTP via WA tidak akan berfungsi).');
  }
  if (!input.fullName || typeof input.fullName !== 'string' || input.fullName.trim().length < 2) {
    warnings.push('Nama lengkap signer kosong atau terlalu pendek.');
  }
  return { valid: errors.length === 0, errors, warnings, normalizedNik, normalizedEmail, normalizedPhone };
}

export function calculateDefaultExpiryDate(requestedAt?: Date | string | number, daysFallback = DEFAULT_SIGN_EXPIRY_DAYS): Date {
  const base = requestedAt ? new Date(requestedAt as any) : new Date();
  const n = Number.isNaN(base.getTime()) ? new Date() : base;
  const days = Number.isFinite(Number(daysFallback)) && Number(daysFallback) > 0 ? Number(daysFallback) : DEFAULT_SIGN_EXPIRY_DAYS;
  return new Date(n.getTime() + days * 86_400_000);
}

export function getRecommendedProvider(reqs: ProviderRequirements = {}): ProviderRecommendation {
  // Rules priority:
  // 1. needCertifiedLegal → PRIVY_ID atau PERURI (pilih PRIVY kecuali preferGovernment)
  // 2. preferGovernment + certified = PERURI
  // 3. needAuditTrail + tidak perlu certified = DIGISIGN (lebih murah dari Privy)
  // 4. budget ≤ 0 atau butuh cepat prototype = INTERNAL (warning NOT LEGAL)
  // 5. default = INTERNAL fallback, alt PRIVY/DIGISIGN
  const budget = typeof reqs.budgetPerDocumentMaxRupiah === 'number' && Number.isFinite(reqs.budgetPerDocumentMaxRupiah!) ? reqs.budgetPerDocumentMaxRupiah! : Infinity;
  let rec: ESignatureProvider = 'INTERNAL';
  const reasons: string[] = [];
  const pros: string[] = [];
  const cons: string[] = [];
  const alternatives: ESignatureProvider[] = [];

  if (reqs.needCertifiedLegal) {
    if (reqs.preferGovernment) { rec = 'PERURI'; reasons.push('Perlu certified legal + prefer provider pemerintah'); }
    else { rec = 'PRIVY_ID'; reasons.push('Perlu certified legal OJK/Kominfo registered'); }
  } else if (reqs.needEKYC || reqs.needAuditTrail) {
    // Pilih termurah audit: DIGISIGN Rp.12k
    rec = 'DIGISIGN';
    reasons.push('Perlu e-KYC / audit trail: DIGISIGN biaya termurah certified');
  } else if (budget <= 0) {
    rec = 'INTERNAL';
    reasons.push('Budget 0: pakai internal built-in sign prototype (NOT LEGAL)');
  } else {
    rec = 'INTERNAL';
    reasons.push('Tidak ada syarat ketat. Default internal (bisa ganti PRIVY_ID kapan saja).');
  }

  // Budget guard override: jika provider melebihi budget, fallback lebih murah
  const cost = PROVIDER_COST[rec];
  if (cost > budget && rec !== 'INTERNAL') {
    if (PROVIDER_COST.DIGISIGN <= budget) { rec = 'DIGISIGN'; reasons.unshift('Budget override: provider lebih murah.'); }
    else if (PROVIDER_COST.INTERNAL <= budget) { rec = 'INTERNAL'; reasons.unshift('Budget terbatas → pakai internal (NOT LEGAL).'); }
  }

  const finalCost = PROVIDER_COST[rec];
  if (rec === 'INTERNAL') { cons.push('BUKAN legally binding (tidak sesuai UU ITE No.11/2008) untuk dokumen krusial kontrak kerja.'); pros.push('GRATIS Rp. 0, cepat prototype internal.'); }
  if (rec === 'PRIVY_ID') { pros.push('OJK + Kominfo registered, audit trail + e-KYC lengkap.', 'SDK REST API matang.', 'Industry standard untuk kontrak kerja.'); cons.push('Biaya termahal kedua setelah Peruri.', 'Proses onboarding provider 1-3 minggu.'); }
  if (rec === 'DIGISIGN') { pros.push('Biaya paling ekonomis certified (≈Rp. 12k/dokumen).', 'Integrasi API cepat.'); cons.push('Brand awareness sedikit dibawah PRIVY.'); }
  if (rec === 'PERURI') { pros.push('Pemerintah (BUMN), 100% sesuai regulasi peraturan pemerintah.', 'Legal standing terkuat.'); cons.push('Biaya paling mahal.', 'Response time onboarding lama.'); }

  if (rec !== 'INTERNAL') alternatives.push('INTERNAL');
  if (rec !== 'PRIVY_ID' && PROVIDER_COST.PRIVY_ID <= budget * 1.5) alternatives.push('PRIVY_ID');
  if (rec !== 'DIGISIGN' && PROVIDER_COST.DIGISIGN <= budget * 1.5) alternatives.push('DIGISIGN');
  if (rec !== 'PERURI' && (reqs.preferGovernment || PROVIDER_COST.PERURI <= budget * 1.5)) alternatives.push('PERURI');

  return {
    recommended: rec,
    reason: reasons.join(' | '),
    estimatedCostPerDocumentRupiah: finalCost,
    pros, cons,
    alternatives: Array.from(new Set(alternatives)).filter(a => a !== rec),
  };
}
