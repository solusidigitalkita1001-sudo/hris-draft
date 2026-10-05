import { BadRequestError } from '@/shared/exceptions/AppError';

/**
 * Letter templates (GAP-46): surat keterangan kerja, SK, and the rest.
 *
 * The body is written by the tenant, and that single fact decides the design.
 * Rendering tenant-authored text through a general template engine is a
 * server-side template injection surface — the engine evaluates expressions,
 * and the person writing them is a customer's HR admin rather than a
 * developer. So this is NOT a template engine. It is substitution over a
 * **closed list** of placeholders, with no expressions, no logic, no property
 * traversal, and nothing resolved by reflection over an object.
 *
 * The same reasoning already governs `shared/payroll/formula.ts`, which parses
 * a deliberately tiny grammar rather than evaluating what it is handed.
 *
 * An unknown placeholder is refused when the template is SAVED, not quietly
 * rendered as blank. A letter with a silent hole in it gets signed and sent.
 */

/** The closed set. Key → what it means, shown to whoever writes a template. */
export const LETTER_PLACEHOLDERS: Record<string, string> = {
  'employee.fullName': 'Nama lengkap karyawan',
  'employee.employeeNumber': 'Nomor induk karyawan',
  'employee.position': 'Nama jabatan',
  'employee.department': 'Nama departemen',
  'employee.joinDate': 'Tanggal masuk (YYYY-MM-DD)',
  'employee.employmentType': 'Status kepegawaian',
  'employee.email': 'Email karyawan',
  'employee.idNumber': 'NIK — ter-mask jika pemanggil tidak berhak membaca data sensitif',
  'employee.taxId': 'NPWP — ter-mask jika pemanggil tidak berhak',
  'employee.placeOfBirth': 'Tempat lahir',
  'employee.dateOfBirth': 'Tanggal lahir (YYYY-MM-DD)',
  'company.name': 'Nama perusahaan',
  'company.address': 'Alamat perusahaan',
  'letter.date': 'Tanggal surat dibuat (YYYY-MM-DD)',
  'letter.number': 'Nomor surat, bila diberikan saat render',
};

/** `{{ key }}` — whitespace tolerated, nothing else. */
const PLACEHOLDER = /\{\{\s*([A-Za-z][A-Za-z0-9_.]*)\s*\}\}/g;
const MAX_BODY_LENGTH = 20_000;

export function extractPlaceholders(body: string): string[] {
  return [...new Set([...body.matchAll(PLACEHOLDER)].map((match) => match[1]))];
}

/**
 * Refuses a template that names something this system cannot fill. Listing the
 * unknown keys matters more than refusing: the author is an HR admin who needs
 * to know which word they got wrong, not that "the template is invalid".
 */
export function validateTemplateBody(body: string): void {
  if (!body.trim()) throw new BadRequestError('Isi surat tidak boleh kosong');
  if (body.length > MAX_BODY_LENGTH) {
    throw new BadRequestError(`Isi surat melewati batas ${MAX_BODY_LENGTH} karakter`);
  }
  // Every `{{...}}` pair must be a known key — checked against ANY content
  // between the braces, not only content shaped like a key. Matching the key
  // charset alone let `{{1+1}}`, `{{x.toUpperCase()}}` and `{{#if ...}}` slip
  // through validation and get printed verbatim onto a signed letter, which is
  // precisely what refusing at save time is supposed to prevent.
  const pairs = [...new Set([...body.matchAll(/\{\{([^{}]*)\}\}/g)].map((match) => match[1].trim()))];
  const unknown = pairs.filter((key) => !(key in LETTER_PLACEHOLDERS));
  if (unknown.length) {
    throw new BadRequestError(
      `Placeholder tidak dikenal: ${unknown.join(', ')}. Yang tersedia: ${Object.keys(LETTER_PLACEHOLDERS).join(', ')}`,
    );
  }
  // A lone `{{` that never closes is almost always a typo, and rendering it
  // verbatim puts a brace into a signed letter.
  const opens = (body.match(/\{\{/g) ?? []).length;
  const closes = (body.match(/\}\}/g) ?? []).length;
  if (opens !== closes) throw new BadRequestError('Ada placeholder yang tidak ditutup');
}

export type LetterContext = Record<string, string | null | undefined>;

/**
 * Substitutes the closed set and nothing else. A key absent from the context
 * renders as an empty string rather than leaving `{{...}}` in the output — by
 * the time this runs the template has already been validated, so an absent key
 * means the employee genuinely has no value for that field (no NPWP, say), and
 * printing the raw placeholder on a signed letter would be worse.
 */
export function renderLetter(body: string, context: LetterContext): string {
  return body.replace(PLACEHOLDER, (_match, key: string) => {
    if (!(key in LETTER_PLACEHOLDERS)) return '';
    const value = context[key];
    return value === null || value === undefined ? '' : String(value);
  });
}
