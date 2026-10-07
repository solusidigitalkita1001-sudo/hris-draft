/**
 * Data upah untuk SIPP Online BPJS Ketenagakerjaan (GAP-33).
 *
 * WHY THIS IS NOT AN UPLOAD FILE, which is the whole design decision.
 *
 * SIPP's own workflow is: log in, choose Upload Upah, press Download Template,
 * fill the template, upload it. The template is issued by the portal per
 * company and it is the template that defines the structure — the guidance
 * that comes with it says to change only the wage column and not to alter the
 * file's structure or its name, because a changed structure fails the upload.
 *
 * So generating a file from a guessed layout is precisely the thing that does
 * not work, and the honest deliverable is different: produce the FIGURES and
 * the identifiers SIPP asks for, so an operator can fill the template the
 * portal gave them, and surface the data problems that would make the upload
 * fail BEFORE they spend a trip to find out.
 *
 * The fields are the ones SIPP's wage upload asks for: NIK, nomor KPJ, kode
 * tenaga kerja, nama lengkap, tanggal lahir, upah, and the month being
 * reported.
 *
 * NOT VERIFIED AGAINST A REAL TEMPLATE. Nobody has placed this next to a
 * template downloaded from SIPP. `verified: false` says so in the payload.
 */

export interface SippWageRow {
  /** Kode tenaga kerja as the employer knows them. */
  employeeNumber: string;
  fullName: string;
  /** NIK — SIPP matches participants on it. */
  nik: string | null;
  /** Nomor KPJ (BPJS Ketenagakerjaan membership number). */
  kpj: string | null;
  /** `yyyy-mm-dd`, or null when the employee record has no date of birth. */
  dateOfBirth: string | null;
  /** The wage SIPP should record, as a plain decimal string. */
  wage: string;
  /** Why this row would be rejected, if it would be. */
  blockers: string[];
}

export interface SippWageExport {
  /** `mm-yyyy`, the month being reported. */
  period: string;
  rows: SippWageRow[];
  /** Rows SIPP would reject as they stand. */
  unusableRows: number;
  verified: false;
  warnings: string[];
}

export interface SippWageInput {
  month: number;
  year: number;
  employees: ReadonlyArray<{
    employeeNumber: string;
    fullName: string;
    nik: string | null;
    kpj: string | null;
    dateOfBirth: Date | string | null;
    wage: string | number;
  }>;
}

function isoDate(value: Date | string | null): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : null;
}

export function buildSippWageExport(input: SippWageInput): SippWageExport {
  if (input.month < 1 || input.month > 12) {
    throw new Error(`Month must be 1..12, received ${input.month}`);
  }

  const rows: SippWageRow[] = input.employees.map((employee) => {
    const blockers: string[] = [];
    // These three are what SIPP matches a participant on. A row missing any of
    // them is a trip to the portal that ends in an error, so it is named here.
    if (!employee.nik) blockers.push('NIK_MISSING');
    if (!employee.kpj) blockers.push('KPJ_MISSING');
    const dateOfBirth = isoDate(employee.dateOfBirth);
    if (!dateOfBirth) blockers.push('DATE_OF_BIRTH_MISSING');
    const wage = Number(employee.wage);
    if (!Number.isFinite(wage) || wage <= 0) blockers.push('WAGE_NOT_PAYABLE');

    return {
      employeeNumber: employee.employeeNumber,
      fullName: employee.fullName,
      nik: employee.nik,
      kpj: employee.kpj,
      dateOfBirth,
      wage: Number.isFinite(wage) ? wage.toFixed(2) : '0.00',
      blockers,
    };
  });

  const unusableRows = rows.filter((row) => row.blockers.length > 0).length;
  const warnings: string[] = [];
  if (unusableRows) warnings.push(`sipp:${unusableRows}_ROWS_WOULD_BE_REJECTED`);
  if (!rows.length) warnings.push('sipp:NO_EMPLOYEES_IN_PERIOD');
  warnings.push('sipp:FILL_THE_TEMPLATE_DOWNLOADED_FROM_SIPP');

  return {
    period: `${String(input.month).padStart(2, '0')}-${input.year}`,
    rows,
    unusableRows,
    verified: false,
    warnings,
  };
}

/**
 * A spreadsheet to copy into the downloaded template, not a file to upload.
 *
 * Tenant-supplied names are neutralised against formula injection the same way
 * `journal.ts` does: a leading '=', '+', '-' or '@' is executed when the file
 * is opened, and this file is opened in a spreadsheet by definition.
 */
export function sippWageExportToCsv(data: SippWageExport): string {
  const header = ['Kode Tenaga Kerja', 'Nama Lengkap', 'NIK', 'No KPJ', 'Tanggal Lahir', 'Upah', 'Periode', 'Catatan'];
  const escape = (field: string) => {
    const guarded = /^[=+\-@]/.test(field) ? `'${field}` : field;
    return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
  };
  const lines = [header.map(escape).join(',')];
  for (const row of data.rows) {
    lines.push([
      row.employeeNumber, row.fullName, row.nik ?? '', row.kpj ?? '',
      row.dateOfBirth ?? '', row.wage, data.period, row.blockers.join(' '),
    ].map(escape).join(','));
  }
  return lines.join('\n');
}
