import prisma from '@/shared/database/prisma';
import {
  type ImportResult, type ImportRowError,
  employeeIdsByNumber, employeeNumberOf, parseImportRecords, writableRows,
} from '@/shared/import/csv-import';
import { WinstonLogger } from '@/shared/logger/WinstonLogger';

const logger = new WinstonLogger('LeaveBalanceImport');

/**
 * Opening leave balance import (GAP-44).
 *
 * A migrating customer arrives mid-year with balances already partly used.
 * `POST /leave/balances` sets them one employee at a time; this is the same
 * write in bulk, with the salary importer's contract: validate everything in
 * memory, report per-row errors by row number, write only when the whole file
 * is good, and `dryRun` to see every problem in one pass.
 */

export type LeaveBalanceImportError = ImportRowError;
export type LeaveBalanceImportResult = ImportResult;

interface ParsedRow {
  row: number;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  totalDays: number;
  usedDays: number;
  carryOverDays: number;
  remainingDays: number;
}

function intField(value: string, fallback: number | null): number | null {
  if (!value) return fallback;
  if (!/^\d+$/.test(value)) return null;
  return Number(value);
}

export async function importOpeningLeaveBalances(
  companyId: string,
  file: Express.Multer.File,
  options: { dryRun?: boolean } = {},
): Promise<LeaveBalanceImportResult> {
  const records = parseImportRecords(file);

  const errors: LeaveBalanceImportError[] = [];
  const parsed: ParsedRow[] = [];

  const idByNumber = await employeeIdsByNumber(companyId, records);

  const codes = [...new Set(records
    .map((row) => (row.leaveTypeCode || row.leave_type_code || row.tipe_cuti || '').toUpperCase())
    .filter(Boolean))];
  const leaveTypes = codes.length
    ? await prisma.leaveType.findMany({
        where: { companyId, code: { in: codes } },
        select: { id: true, code: true },
      })
    : [];
  const typeByCode = new Map(leaveTypes.map((row) => [row.code.toUpperCase(), row.id]));

  const seen = new Set<string>();
  records.forEach((row, index) => {
    const rowIndex = index + 2; // row 1 is the header
    const employeeNumber = employeeNumberOf(row);
    const code = (row.leaveTypeCode || row.leave_type_code || row.tipe_cuti || '').toUpperCase();
    const rawYear = row.year || row.tahun || '';

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

    if (!code) {
      errors.push({ row: rowIndex, column: 'leaveTypeCode', message: 'Kode tipe cuti wajib diisi' });
      return;
    }
    const leaveTypeId = typeByCode.get(code);
    if (!leaveTypeId) {
      errors.push({ row: rowIndex, column: 'leaveTypeCode', value: code,
        message: 'Tipe cuti tidak ditemukan di perusahaan ini' });
      return;
    }

    const year = intField(rawYear, null);
    if (year === null || year < 2000 || year > 2100) {
      errors.push({ row: rowIndex, column: 'year', value: rawYear, message: 'Tahun harus angka 2000–2100' });
      return;
    }

    const totalDays = intField(row.totalDays || row.total_days || row.jatah || '', null);
    const usedDays = intField(row.usedDays || row.used_days || row.terpakai || '', 0);
    const carryOverDays = intField(row.carryOverDays || row.carry_over_days || row.bawaan || '', 0);
    if (totalDays === null || usedDays === null || carryOverDays === null) {
      errors.push({ row: rowIndex, column: 'totalDays', message: 'Jatah, terpakai dan bawaan harus bilangan bulat ≥ 0' });
      return;
    }
    const remainingDays = totalDays + carryOverDays - usedDays;
    if (remainingDays < 0) {
      errors.push({ row: rowIndex, column: 'usedDays', value: usedDays,
        message: 'Terpakai melebihi jatah + bawaan; sisa saldo akan negatif' });
      return;
    }

    const key = `${employeeNumber}|${code}|${year}`;
    if (seen.has(key)) {
      errors.push({ row: rowIndex, column: 'leaveTypeCode', value: code,
        message: 'Baris ganda: karyawan, tipe cuti dan tahun yang sama sudah ada di berkas ini' });
      return;
    }
    seen.add(key);

    parsed.push({ row: rowIndex, employeeId, leaveTypeId, year, totalDays, usedDays, carryOverDays, remainingDays });
  });

  // The employeeId+leaveTypeId+year unique would abort the whole write; an
  // existing balance is a row-level error instead. Deliberately NOT an
  // update: overwriting a live balance that leave requests already deducted
  // from is how usage silently disappears. Fix a wrong opening balance via
  // POST /leave/balances, which audit-logs the change.
  if (parsed.length) {
    const existing = await prisma.leaveBalance.findMany({
      where: {
        companyId,
        employeeId: { in: [...new Set(parsed.map((row) => row.employeeId))] },
        year: { in: [...new Set(parsed.map((row) => row.year))] },
      },
      select: { employeeId: true, leaveTypeId: true, year: true },
    });
    const existingKeys = new Set(existing.map((row) => `${row.employeeId}|${row.leaveTypeId}|${row.year}`));
    for (const row of parsed) {
      if (existingKeys.has(`${row.employeeId}|${row.leaveTypeId}|${row.year}`)) {
        errors.push({ row: row.row, column: 'year', value: row.year,
          message: 'Karyawan ini sudah punya saldo untuk tipe cuti dan tahun itu' });
      }
    }
  }

  const writable = writableRows(parsed, errors);

  const result: LeaveBalanceImportResult = {
    dryRun: Boolean(options.dryRun),
    totalRows: records.length,
    valid: writable.length,
    created: 0,
    errors,
  };

  if (errors.length || options.dryRun) {
    logger.info('Leave balance import not written', { companyId, ...result, errors: errors.length });
    return result;
  }

  const written = await prisma.leaveBalance.createMany({
    data: writable.map((row) => ({
      companyId,
      employeeId: row.employeeId,
      leaveTypeId: row.leaveTypeId,
      year: row.year,
      totalDays: row.totalDays,
      usedDays: row.usedDays,
      carryOverDays: row.carryOverDays,
      remainingDays: row.remainingDays,
    })),
  });
  result.created = written.count;

  logger.info('Leave balance import written', { companyId, created: result.created });
  return result;
}
