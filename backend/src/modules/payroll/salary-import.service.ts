import { parse } from 'csv-parse/sync';
import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError } from '@/shared/exceptions/AppError';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';

const logger = new WinstonLogger('SalaryImport');

/**
 * Salary master import (GAP-44).
 *
 * The only migration path into this system was one CSV of the employee
 * master. Everything downstream — salaries, payroll history, schedules — had
 * to be typed in. Onboarding a customer with five hundred employees therefore
 * meant five hundred salaries entered by hand, which is both the slowest part
 * of an implementation and the part most likely to be wrong.
 *
 * Shape follows the employee importer deliberately: validate every row in
 * memory first, report per-row errors with the row number, and write only if
 * the whole file is good. A half-imported salary master is worse than none,
 * because the half that landed will be paid.
 *
 * `dryRun` exists because that guarantee is not enough on its own. An
 * implementer wants to see all 500 problems in one pass, fix the spreadsheet,
 * and try again — not discover them one transaction rollback at a time.
 */

export interface SalaryImportError {
  row: number;
  column?: string;
  value?: unknown;
  message: string;
}

export interface SalaryImportResult {
  dryRun: boolean;
  totalRows: number;
  valid: number;
  created: number;
  superseded: number;
  errors: SalaryImportError[];
}

interface ParsedRow {
  row: number;
  employeeNumber: string;
  employeeId: string;
  baseSalary: Prisma.Decimal;
  effectiveDate: Date;
  currency: string;
  notes?: string;
}

/** Decimal(15,2) — anything larger is a typo, not a salary. */
const MAX_BASE_SALARY = new Prisma.Decimal('9999999999999.99');

function dateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function importSalaryMaster(
  companyId: string,
  file: Express.Multer.File,
  options: { dryRun?: boolean } = {},
): Promise<SalaryImportResult> {
  const records = parse(file.buffer, {
    columns: true, skip_empty_lines: true, trim: true, relax_column_count: true,
  }) as Record<string, string>[];
  if (!records.length) throw new BadRequestError('Berkas tidak berisi satu baris data pun');

  const errors: SalaryImportError[] = [];
  const parsed: ParsedRow[] = [];

  // One query for the whole file rather than one per row: a 500-row import
  // should not be 500 round trips.
  const numbers = [...new Set(records
    .map((row) => row.employeeNumber || row.employee_number || row.nik || '')
    .filter(Boolean))];
  const employees = numbers.length
    ? await prisma.employee.findMany({
        where: { companyId, deletedAt: null, employeeNumber: { in: numbers } },
        select: { id: true, employeeNumber: true },
      })
    : [];
  const idByNumber = new Map(employees.map((row) => [row.employeeNumber, row.id]));

  const seen = new Set<string>();
  records.forEach((row, index) => {
    const rowIndex = index + 2; // row 1 is the header
    const employeeNumber = row.employeeNumber || row.employee_number || row.nik || '';
    const rawSalary = row.baseSalary || row.base_salary || row.gaji_pokok || '';
    const rawDate = row.effectiveDate || row.effective_date || row.tanggal_berlaku || '';

    if (!employeeNumber) {
      errors.push({ row: rowIndex, column: 'employeeNumber', message: 'Nomor karyawan wajib diisi' });
      return;
    }
    const employeeId = idByNumber.get(employeeNumber);
    if (!employeeId) {
      errors.push({ row: rowIndex, column: 'employeeNumber', value: employeeNumber,
        message: 'Karyawan tidak ditemukan di perusahaan ini' });
      return;
    }

    const effectiveDate = dateOnly(rawDate);
    if (!effectiveDate) {
      errors.push({ row: rowIndex, column: 'effectiveDate', value: rawDate,
        message: 'Tanggal berlaku harus format YYYY-MM-DD' });
      return;
    }

    let baseSalary: Prisma.Decimal;
    try {
      baseSalary = new Prisma.Decimal(rawSalary.replace(/[.\s]/g, '').replace(',', '.'));
    } catch {
      errors.push({ row: rowIndex, column: 'baseSalary', value: rawSalary, message: 'Gaji pokok bukan angka' });
      return;
    }
    if (!baseSalary.isFinite() || baseSalary.lessThanOrEqualTo(0)) {
      errors.push({ row: rowIndex, column: 'baseSalary', value: rawSalary, message: 'Gaji pokok harus lebih besar dari nol' });
      return;
    }
    if (baseSalary.greaterThan(MAX_BASE_SALARY)) {
      errors.push({ row: rowIndex, column: 'baseSalary', value: rawSalary,
        message: 'Gaji pokok melewati batas kolom; periksa pemisah ribuan' });
      return;
    }

    const currency = (row.currency || 'IDR').toUpperCase();
    if (currency !== 'IDR') {
      // The payroll engine refuses non-IDR allocations, so accepting one here
      // would import a row that can never be paid.
      errors.push({ row: rowIndex, column: 'currency', value: currency,
        message: 'Payroll saat ini hanya mendukung IDR' });
      return;
    }

    const key = `${employeeNumber}|${rawDate}`;
    if (seen.has(key)) {
      errors.push({ row: rowIndex, column: 'employeeNumber', value: employeeNumber,
        message: 'Baris ganda: karyawan dan tanggal berlaku yang sama sudah ada di berkas ini' });
      return;
    }
    seen.add(key);

    parsed.push({ row: rowIndex, employeeNumber, employeeId, baseSalary, effectiveDate, currency,
      notes: row.notes || row.catatan || undefined });
  });

  // Clashes with what is already stored, checked before any write.
  if (parsed.length) {
    const existing = await prisma.employeeSalary.findMany({
      where: {
        companyId, deletedAt: null,
        employeeId: { in: [...new Set(parsed.map((row) => row.employeeId))] },
      },
      select: { employeeId: true, effectiveDate: true },
    });
    const existingKeys = new Set(existing.map((row) => `${row.employeeId}|${row.effectiveDate.toISOString().slice(0, 10)}`));
    for (const row of parsed) {
      const key = `${row.employeeId}|${row.effectiveDate.toISOString().slice(0, 10)}`;
      if (existingKeys.has(key)) {
        errors.push({ row: row.row, column: 'effectiveDate', value: row.effectiveDate.toISOString().slice(0, 10),
          message: 'Karyawan ini sudah punya gaji dengan tanggal berlaku yang sama' });
      }
    }
  }

  // A parsed row can still have been rejected by the clash check above, so
  // "valid" is parsed-minus-flagged rather than parsed.
  const flaggedRows = new Set(errors.map((error) => error.row));
  const writable = parsed.filter((row) => !flaggedRows.has(row.row));

  const result: SalaryImportResult = {
    dryRun: Boolean(options.dryRun),
    totalRows: records.length,
    valid: writable.length,
    created: 0,
    superseded: 0,
    errors,
  };

  if (errors.length || options.dryRun) {
    logger.info('Salary import not written', { companyId, ...result, errors: errors.length });
    return result;
  }

  await prisma.$transaction(async (tx) => {
    for (const row of parsed) {
      // An earlier active row is superseded, matching how a career-movement
      // raise behaves — the history stays readable, only the current row moves.
      const superseded = await tx.employeeSalary.updateMany({
        where: {
          companyId, employeeId: row.employeeId, deletedAt: null, isActive: true,
          effectiveDate: { lt: row.effectiveDate },
        },
        data: { isActive: false },
      });
      result.superseded += superseded.count;

      await tx.employeeSalary.create({
        data: {
          companyId, employeeId: row.employeeId,
          effectiveDate: row.effectiveDate,
          baseSalary: row.baseSalary,
          currency: row.currency,
          isActive: true,
          notes: row.notes ?? 'Diimpor dari berkas master gaji',
        },
      });
      result.created += 1;
    }
  });

  logger.info('Salary import written', { companyId, created: result.created, superseded: result.superseded });
  return result;
}
