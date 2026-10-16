import { AttendanceStatus } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import {
  type ImportResult, type ImportRowError,
  dateOnly, employeeIdsByNumber, employeeNumberOf, parseImportRecords, writableRows,
} from '@/shared/import/csv-import';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';

const logger = new WinstonLogger('AttendanceImport');

/**
 * Attendance history import (GAP-44).
 *
 * Migration left attendance history behind: employee and salary masters import
 * from CSV, but a customer's past attendance — which payroll proration, late
 * reports and audits all read — had to be typed in day by day.
 *
 * Shape copies the salary importer deliberately: validate every row in memory
 * first, report per-row errors with the row number, and write only when the
 * whole file is good. `dryRun` lets the implementer see all problems in one
 * pass instead of one transaction rollback at a time.
 *
 * History only: future dates are refused. Today's attendance belongs to the
 * check-in flow, not a spreadsheet.
 */

export type AttendanceImportError = ImportRowError;
export type AttendanceImportResult = ImportResult;

interface ParsedRow {
  row: number;
  employeeId: string;
  employeeNumber: string;
  date: Date;
  status: AttendanceStatus;
  checkIn: Date | null;
  checkOut: Date | null;
  notes?: string;
}

const STATUSES = new Set<string>(Object.values(AttendanceStatus));

/** "HH:MM" or "HH:MM:SS" on the row's own date, read as UTC like `date` is. */
function timeOn(dateText: string, value: string): Date | null | undefined {
  if (!value) return null;
  if (!/^\d{2}:\d{2}(:\d{2})?$/.test(value)) return undefined;
  const timestamp = new Date(`${dateText}T${value.length === 5 ? `${value}:00` : value}.000Z`);
  return Number.isNaN(timestamp.getTime()) ? undefined : timestamp;
}

export async function importAttendanceHistory(
  companyId: string,
  file: Express.Multer.File,
  options: { dryRun?: boolean } = {},
): Promise<AttendanceImportResult> {
  const records = parseImportRecords(file);

  const errors: AttendanceImportError[] = [];
  const parsed: ParsedRow[] = [];

  const idByNumber = await employeeIdsByNumber(companyId, records);

  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00.000Z');
  const seen = new Set<string>();
  records.forEach((row, index) => {
    const rowIndex = index + 2; // row 1 is the header
    const employeeNumber = employeeNumberOf(row);
    const rawDate = row.date || row.tanggal || '';
    const rawStatus = (row.status || 'PRESENT').toUpperCase();
    const rawCheckIn = row.checkIn || row.check_in || row.jam_masuk || '';
    const rawCheckOut = row.checkOut || row.check_out || row.jam_keluar || '';

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

    const date = dateOnly(rawDate);
    if (!date) {
      errors.push({ row: rowIndex, column: 'date', value: rawDate, message: 'Tanggal harus format YYYY-MM-DD' });
      return;
    }
    if (date.getTime() >= today.getTime()) {
      errors.push({ row: rowIndex, column: 'date', value: rawDate,
        message: 'Impor riwayat hanya menerima tanggal lampau; hari ini dan seterusnya lewat alur check-in' });
      return;
    }

    if (!STATUSES.has(rawStatus)) {
      errors.push({ row: rowIndex, column: 'status', value: rawStatus,
        message: `Status tidak dikenal; gunakan ${[...STATUSES].join('/')}` });
      return;
    }

    const checkIn = timeOn(rawDate, rawCheckIn);
    const checkOut = timeOn(rawDate, rawCheckOut);
    if (checkIn === undefined || checkOut === undefined) {
      errors.push({ row: rowIndex, column: checkIn === undefined ? 'checkIn' : 'checkOut',
        value: checkIn === undefined ? rawCheckIn : rawCheckOut, message: 'Jam harus format HH:MM' });
      return;
    }
    if (checkIn && checkOut && checkOut.getTime() < checkIn.getTime()) {
      errors.push({ row: rowIndex, column: 'checkOut', value: rawCheckOut,
        message: 'Jam keluar sebelum jam masuk' });
      return;
    }

    const key = `${employeeNumber}|${rawDate}`;
    if (seen.has(key)) {
      errors.push({ row: rowIndex, column: 'date', value: rawDate,
        message: 'Baris ganda: karyawan dan tanggal yang sama sudah ada di berkas ini' });
      return;
    }
    seen.add(key);

    parsed.push({
      row: rowIndex, employeeId, employeeNumber, date,
      status: rawStatus as AttendanceStatus,
      checkIn: checkIn ?? null, checkOut: checkOut ?? null,
      notes: row.notes || row.catatan || undefined,
    });
  });

  // Clashes with rows already stored — the employeeId+date unique would abort
  // the whole write; named per row here instead.
  if (parsed.length) {
    const existing = await prisma.attendance.findMany({
      where: {
        companyId, deletedAt: null,
        employeeId: { in: [...new Set(parsed.map((row) => row.employeeId))] },
        date: { in: [...new Set(parsed.map((row) => row.date))] },
      },
      select: { employeeId: true, date: true },
    });
    const existingKeys = new Set(existing.map((row) => `${row.employeeId}|${row.date.toISOString().slice(0, 10)}`));
    for (const row of parsed) {
      if (existingKeys.has(`${row.employeeId}|${row.date.toISOString().slice(0, 10)}`)) {
        errors.push({ row: row.row, column: 'date', value: row.date.toISOString().slice(0, 10),
          message: 'Karyawan ini sudah punya catatan absensi pada tanggal itu' });
      }
    }
  }

  const writable = writableRows(parsed, errors);

  const result: AttendanceImportResult = {
    dryRun: Boolean(options.dryRun),
    totalRows: records.length,
    valid: writable.length,
    created: 0,
    errors,
  };

  if (errors.length || options.dryRun) {
    logger.info('Attendance import not written', { companyId, ...result, errors: errors.length });
    return result;
  }

  const written = await prisma.attendance.createMany({
    data: writable.map((row) => ({
      companyId,
      employeeId: row.employeeId,
      date: row.date,
      status: row.status,
      checkIn: row.checkIn,
      checkOut: row.checkOut,
      lateMinutes: 0,
      notes: row.notes ?? 'Diimpor dari berkas riwayat absensi',
    })),
  });
  result.created = written.count;

  logger.info('Attendance import written', { companyId, created: result.created });
  return result;
}
