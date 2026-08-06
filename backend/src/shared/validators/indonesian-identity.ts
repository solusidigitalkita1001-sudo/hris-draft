/**
 * Indonesian identity & contact validators (Fase 1: VAL-001..005).
 * Pure functions — no framework deps. Zod refinements live in DTOs.
 */

// BPS province codes (first 2 digits of NIK). Source: Permendagri wilayah codes.
const PROVINCE_CODES = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, // Sumatra
  21, // Kepulauan Riau
  31, 32, 33, 34, 35, 36, // Jakarta, Jabar, Jateng, DIY, Jatim, Banten
  51, 52, 53, // Bali, NTB, NTT
  61, 62, 63, 64, 65, // Kalimantan
  71, 72, 73, 74, 75, 76, // Sulawesi
  81, 82, // Maluku, Maluku Utara
  91, 92, 93, 94, 95, 96, // Papua (incl. pemekaran)
]);

/**
 * Validate a 16-digit NIK KTP: length, valid province prefix, and a plausible
 * date-of-birth in digits 7-12 (ddmmyy, where dd>40 encodes female).
 */
export function isValidNIK(value: string): boolean {
  if (!/^\d{16}$/.test(value)) return false;
  if (!PROVINCE_CODES.has(Number(value.slice(0, 2)))) return false;

  let dd = Number(value.slice(6, 8));
  const mm = Number(value.slice(8, 10));
  if (dd > 40) dd -= 40; // female
  if (dd < 1 || dd > 31) return false;
  if (mm < 1 || mm > 12) return false;
  return true;
}

/** Gender encoded in NIK (day-of-birth > 40 => female). Null if invalid. */
export function genderFromNIK(value: string): 'MALE' | 'FEMALE' | null {
  if (!isValidNIK(value)) return null;
  return Number(value.slice(6, 8)) > 40 ? 'FEMALE' : 'MALE';
}

/** NPWP: 15 digits (legacy). Accepts formatted 9.999.999.9-999.999 input. */
export function isValidNPWP(value: string): boolean {
  return /^\d{15}$/.test(value.replace(/[.\-\s]/g, ''));
}

/** BPJS Ketenagakerjaan (JHT/Jamsostek): 11 digits. */
export function isValidBPJSKetenagakerjaan(value: string): boolean {
  return /^\d{11}$/.test(value.replace(/\s/g, ''));
}

/** BPJS Kesehatan (JKN): 13 digits. */
export function isValidBPJSKesehatan(value: string): boolean {
  return /^\d{13}$/.test(value.replace(/\s/g, ''));
}

/**
 * Normalize an Indonesian phone number to E.164 (+62...). Returns null if it
 * cannot be a valid Indonesian mobile/landline number.
 * Accepts: 08xx, +628xx, 628xx, with spaces/dashes/parens.
 */
export function normalizePhoneID(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, '');
  if (d.startsWith('+62')) d = d.slice(3);
  else if (d.startsWith('62')) d = d.slice(2);
  else if (d.startsWith('0')) d = d.slice(1);
  else return null;

  // National significant number: 8-13 digits, must not start with 0.
  if (!/^\d{8,13}$/.test(d) || d.startsWith('0')) return null;
  return `+62${d}`;
}

export function isValidPhoneID(input: string): boolean {
  return normalizePhoneID(input) !== null;
}

// VAL-006: account-number length per bank. OTHER is lenient (8-20 digits).
export const BANK_CODES = ['BNI', 'BCA', 'MANDIRI', 'BRI', 'OTHER'] as const;
export type BankCode = (typeof BANK_CODES)[number];

const BANK_ACCOUNT_LENGTHS: Record<string, number> = {
  BNI: 10,
  BCA: 10,
  MANDIRI: 13,
  BRI: 15,
};

export function isValidBankAccount(bankCode: string, account: string): boolean {
  const digits = account.replace(/[\s-]/g, '');
  if (!/^\d+$/.test(digits)) return false;
  const len = BANK_ACCOUNT_LENGTHS[bankCode];
  if (len === undefined) return digits.length >= 8 && digits.length <= 20; // OTHER / unknown
  return digits.length === len;
}
