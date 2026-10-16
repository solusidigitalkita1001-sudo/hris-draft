import { parse } from 'csv-parse/sync';
import prisma from '@/shared/database/prisma';
import { BadRequestError } from '@/shared/exceptions/AppError';

/**
 * Scaffold bersama ketiga importer CSV migrasi (GAP-44): master gaji, riwayat
 * absensi, dan saldo cuti awal. Kontraknya satu dan dikunci di sini: validasi
 * seluruh berkas di memori, laporkan error per baris dengan nomor barisnya
 * (baris 1 adalah header), tulis hanya bila seluruh berkas bersih, dan
 * `dryRun` memperlihatkan semua masalah dalam satu kali jalan. Aturan per
 * domain tetap hidup di importer masing-masing.
 */

export interface ImportRowError {
  row: number;
  column?: string;
  value?: unknown;
  message: string;
}

export interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  valid: number;
  created: number;
  errors: ImportRowError[];
}

export function parseImportRecords(file: Express.Multer.File): Record<string, string>[] {
  const records = parse(file.buffer, {
    columns: true, skip_empty_lines: true, trim: true, relax_column_count: true,
  }) as Record<string, string>[];
  if (!records.length) throw new BadRequestError('Berkas tidak berisi satu baris data pun');
  return records;
}

export function employeeNumberOf(row: Record<string, string>): string {
  return row.employeeNumber || row.employee_number || row.nik || '';
}

/** One query for the whole file rather than one per row. */
export async function employeeIdsByNumber(
  companyId: string,
  records: Record<string, string>[],
): Promise<Map<string, string>> {
  const numbers = [...new Set(records.map(employeeNumberOf).filter(Boolean))];
  if (!numbers.length) return new Map();
  const employees = await prisma.employee.findMany({
    where: { companyId, deletedAt: null, employeeNumber: { in: numbers } },
    select: { id: true, employeeNumber: true },
  });
  return new Map(employees.map((row) => [row.employeeNumber, row.id]));
}

export function dateOnly(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A parsed row can still have been rejected by clash checks after parsing, so
 * what gets written is parsed-minus-flagged rather than parsed.
 */
export function writableRows<T extends { row: number }>(parsed: T[], errors: ImportRowError[]): T[] {
  const flagged = new Set(errors.map((error) => error.row));
  return parsed.filter((row) => !flagged.has(row.row));
}
