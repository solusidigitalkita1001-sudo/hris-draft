import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { calculateBpjs, DEFAULT_BPJS_CONFIG, type BpjsConfig } from '@/shared/payroll/bpjs';
import { loadPayrollPolicyConfig } from '@/shared/payroll/payroll-policy';

export interface BpjsReportRow {
  employeeNumber: string;
  fullName: string;
  nik: string | null;
  bpjsKesehatanNumber: string | null;
  bpjsKetenagakerjaanNumber: string | null;
  /** The wage the contributions were computed on — base salary, as payroll uses. */
  wageBasis: string;
  employee: { jht: string; jp: string; jkn: string; total: string };
  employer: { jkk: string; jkm: string; jht: string; jp: string; jkn: string; total: string };
  grandTotal: string;
  warnings: string[];
}

export interface BpjsReport {
  period: { id: string; code: string; name: string; startDate: string; endDate: string };
  company: { id: string; name: string; taxId: string | null };
  /** The rates and caps the figures were computed with, so a filing can be re-derived. */
  config: Record<string, number>;
  rows: BpjsReportRow[];
  totals: { employee: string; employer: string; grandTotal: string; employees: number };
  warnings: string[];
}

const money = (value: number | string | Prisma.Decimal) => new Prisma.Decimal(value ?? 0);

/**
 * Monthly BPJS contribution report (GAP-33, partial).
 *
 * Same split as the annual tax recap, for the same reason: the **figures** are
 * assembled and totalled here, while the official BPJS upload layout waits for
 * one real file. The monthly mutation formats differ between BPJS Kesehatan and
 * Ketenagakerjaan and have changed over time; a guessed layout is rejected at
 * the counter, which is the most expensive moment to find out.
 *
 * The employer share is the part payslips cannot answer. A payslip records what
 * was deducted from the employee; the company's own contribution — JKK, JKM and
 * the employer halves of JHT, JP and JKN — never appears there, and it is most
 * of what BPJS is owed. So this recomputes both sides from the same wage basis
 * and the same company policy the payroll run used, which also means the
 * employee figures here reconcile with the payslips rather than drifting from
 * them.
 *
 * That last sentence was a claim the code did not keep. It loaded the CURRENT
 * reference rates, not the ones frozen on the run that produced these
 * payslips — so editing a BPJS rate silently rewrote the contribution report
 * for every period already filed, and it no longer matched the money actually
 * deducted. `PayrollRun.policySnapshot` was written for exactly this and had
 * no reader anywhere. Each row is now computed with its own run's snapshot,
 * falling back to live rates only for runs recorded before snapshots existed —
 * and saying so in a warning when it has to.
 */
/**
 * The BPJS rates frozen on a run, or null when that run has none.
 *
 * Deliberately narrow: a snapshot is stored JSON, so every field is checked to
 * be a finite number before it can influence a contribution figure. A
 * malformed snapshot falls back to live rates and is reported, rather than
 * contributing a NaN that would surface as a blank in a filing.
 */
export function bpjsRatesFromSnapshot(snapshot: unknown): Partial<BpjsConfig> | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const bpjs = (snapshot as Record<string, unknown>).bpjs;
  if (!bpjs || typeof bpjs !== 'object' || Array.isArray(bpjs)) return null;
  const rates: Record<string, number> = {};
  for (const [key, value] of Object.entries(bpjs as Record<string, unknown>)) {
    const numeric = typeof value === 'string' ? Number(value) : value;
    if (typeof numeric !== 'number' || !Number.isFinite(numeric)) continue;
    rates[key] = numeric;
  }
  return Object.keys(rates).length ? (rates as Partial<BpjsConfig>) : null;
}

export class BpjsReportService {
  async build(companyId: string, periodId: string): Promise<BpjsReport> {
    const period = await prisma.payrollPeriod.findFirst({
      where: { id: periodId, companyId, deletedAt: null },
      select: { id: true, code: true, name: true, startDate: true, endDate: true },
    });
    if (!period) throw new NotFoundError('Payroll period not found in the active company');

    const company = await prisma.company.findFirst({
      where: { id: companyId, deletedAt: null },
      select: { id: true, name: true, taxId: true },
    });
    if (!company) throw new NotFoundError('Company not found');

    const payslips = await prisma.payslip.findMany({
      where: {
        companyId,
        payrollRun: { periodId: period.id, status: { in: ['APPROVED', 'DISBURSED'] } },
      },
      select: {
        baseSalary: true,
        // The rates this payslip was actually paid with.
        payrollRun: { select: { policySnapshot: true } },
        employee: {
          select: {
            employeeNumber: true, fullName: true, idNumber: true,
            bpjsKesehatan: true, bpjsKetenagakerjaan: true,
          },
        },
      },
      orderBy: { employee: { employeeNumber: 'asc' } },
    });

    const policy = await loadPayrollPolicyConfig(prisma, companyId, new Date(period.startDate).getUTCFullYear());
    // The EFFECTIVE rates, defaults merged with the company's overrides. A
    // company with no overrides has an empty override set, and publishing that
    // would make the report look rate-less — leaving a filing impossible to
    // re-derive a year later. A test caught exactly that.
    const liveConfig = { ...DEFAULT_BPJS_CONFIG, ...policy.bpjs } as unknown as Record<string, number>;

    const rows: BpjsReportRow[] = [];
    let employeeTotal = money(0);
    let employerTotal = money(0);

    /** Distinct rate sets the rows were computed with, to publish and to compare. */
    const rateSetsUsed = new Map<string, Partial<BpjsConfig>>();
    let rowsWithoutSnapshot = 0;

    for (const payslip of payslips) {
      const wage = Number(payslip.baseSalary);
      const snapshotRates = bpjsRatesFromSnapshot(payslip.payrollRun?.policySnapshot);
      if (!snapshotRates) rowsWithoutSnapshot += 1;
      const rates = snapshotRates ?? policy.bpjs;
      rateSetsUsed.set(JSON.stringify(rates), rates);
      const breakdown = calculateBpjs(wage, rates);

      const warnings: string[] = [];
      // A contribution without a membership number cannot be matched to a
      // participant on BPJS's side, so the filing fails for that person.
      if (!payslip.employee.bpjsKesehatan) warnings.push('bpjs:KESEHATAN_NUMBER_MISSING');
      if (!payslip.employee.bpjsKetenagakerjaan) warnings.push('bpjs:KETENAGAKERJAAN_NUMBER_MISSING');
      if (!payslip.employee.idNumber) warnings.push('employee:NIK_MISSING');

      employeeTotal = employeeTotal.plus(breakdown.employee.total);
      employerTotal = employerTotal.plus(breakdown.employer.total);

      rows.push({
        employeeNumber: payslip.employee.employeeNumber,
        fullName: payslip.employee.fullName,
        nik: payslip.employee.idNumber,
        bpjsKesehatanNumber: payslip.employee.bpjsKesehatan,
        bpjsKetenagakerjaanNumber: payslip.employee.bpjsKetenagakerjaan,
        wageBasis: money(wage).toFixed(2),
        employee: {
          jht: money(breakdown.employee.jht).toFixed(2),
          jp: money(breakdown.employee.jp).toFixed(2),
          jkn: money(breakdown.employee.jkn).toFixed(2),
          total: money(breakdown.employee.total).toFixed(2),
        },
        employer: {
          jkk: money(breakdown.employer.jkk).toFixed(2),
          jkm: money(breakdown.employer.jkm).toFixed(2),
          jht: money(breakdown.employer.jht).toFixed(2),
          jp: money(breakdown.employer.jp).toFixed(2),
          jkn: money(breakdown.employer.jkn).toFixed(2),
          total: money(breakdown.employer.total).toFixed(2),
        },
        grandTotal: money(breakdown.employee.total).plus(breakdown.employer.total).toFixed(2),
        warnings,
      });
    }

    const reportWarnings: string[] = [];
    if (rows.length === 0) reportWarnings.push('payroll:NO_APPROVED_PAYSLIPS_IN_PERIOD');
    // Say it rather than let the reader assume the figures are frozen.
    if (rowsWithoutSnapshot) {
      reportWarnings.push(`bpjs:${rowsWithoutSnapshot}_PAYSLIPS_WITHOUT_RATE_SNAPSHOT`);
    }
    // One published `config` cannot describe two sets of rates honestly.
    if (rateSetsUsed.size > 1) reportWarnings.push('bpjs:MULTIPLE_RATE_SNAPSHOTS_IN_PERIOD');
    const missingNumbers = rows.filter((row) => row.warnings.length).length;
    if (missingNumbers) reportWarnings.push(`bpjs:${missingNumbers}_EMPLOYEES_WITH_MISSING_IDENTIFIERS`);

    return {
      period: {
        id: period.id,
        code: period.code,
        name: period.name,
        startDate: new Date(period.startDate).toISOString(),
        endDate: new Date(period.endDate).toISOString(),
      },
      company,
      // The rates the rows were actually computed with. With no rows, or with
      // rows disagreeing, the live set is the only thing left to publish.
      config: rateSetsUsed.size === 1
        ? { ...DEFAULT_BPJS_CONFIG, ...[...rateSetsUsed.values()][0] } as unknown as Record<string, number>
        : liveConfig,
      rows,
      totals: {
        employee: employeeTotal.toFixed(2),
        employer: employerTotal.toFixed(2),
        grandTotal: employeeTotal.plus(employerTotal).toFixed(2),
        employees: rows.length,
      },
      warnings: reportWarnings,
    };
  }
}

/** CSV for the payroll team's own reconciliation; deliberately not a BPJS upload file. */
export function bpjsReportToCsv(report: BpjsReport): string {
  const header = [
    'No Karyawan', 'Nama', 'NIK', 'No BPJS Kesehatan', 'No BPJS Ketenagakerjaan', 'Upah Dasar',
    'JHT Karyawan', 'JP Karyawan', 'JKN Karyawan', 'Total Karyawan',
    'JKK Perusahaan', 'JKM Perusahaan', 'JHT Perusahaan', 'JP Perusahaan', 'JKN Perusahaan', 'Total Perusahaan',
    'Total', 'Catatan',
  ];
  const escape = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);
  const lines = [header.join(',')];

  for (const row of report.rows) {
    lines.push([
      row.employeeNumber, escape(row.fullName), row.nik ?? '', row.bpjsKesehatanNumber ?? '', row.bpjsKetenagakerjaanNumber ?? '',
      row.wageBasis, row.employee.jht, row.employee.jp, row.employee.jkn, row.employee.total,
      row.employer.jkk, row.employer.jkm, row.employer.jht, row.employer.jp, row.employer.jkn, row.employer.total,
      row.grandTotal, escape(row.warnings.join(' ')),
    ].join(','));
  }

  lines.push([
    'TOTAL', '', '', '', '', '', '', '', '', report.totals.employee,
    '', '', '', '', '', report.totals.employer, report.totals.grandTotal, '',
  ].join(','));
  return lines.join('\n');
}

export const bpjsReportService = new BpjsReportService();
export function assertPeriodId(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new BadRequestError('periodId is required');
  return value;
}
