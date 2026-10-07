import { Prisma } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { BadRequestError, NotFoundError } from '@/shared/exceptions/AppError';
import { assertEmployeeInScope } from '@/shared/security/employee-data-scope';
import { buildPayslipBreakdown } from '@/shared/payroll/payslip-breakdown';
import { buildForm1721A1 } from '@/shared/payroll/form-1721-a1';
import { calculateAnnualPph21 } from '@/shared/payroll/pph21-annual';
import { DEFAULT_PPH21_CONFIG } from '@/shared/payroll/pph21';
import { loadPayrollPolicyConfig } from '@/shared/payroll/payroll-policy';

export interface MonthlyTaxRow {
  month: number;
  periodCode: string;
  grossEarnings: string;
  pph21: string;
  bpjsEmployee: string;
  netPay: string;
}

export interface AnnualTaxRecap {
  year: number;
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    taxId: string | null;
    maritalStatus: string | null;
    dependents: number;
    /** PTKP code in the usual Indonesian notation, e.g. K/2 or TK/0. */
    ptkpStatus: string;
    joinDate: string | null;
  };
  company: { id: string; name: string; taxId: string | null };
  months: MonthlyTaxRow[];
  totals: { grossEarnings: string; pph21: string; bpjsEmployee: string; netPay: string; monthsPaid: number };
  /** Anything that would make the figures wrong if read as final. */
  warnings: string[];
}

function decimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value ?? 0);
}

/**
 * The annual PPh21 recap — the content of a bukti potong 1721-A1 (GAP-32).
 *
 * Scope note, stated plainly because it decides what this is useful for: this
 * assembles and totals the **figures**, per employee per year, from the
 * payslips that were actually approved. It does not render the official DJP
 * form, because the form's layout has changed more than once and guessing a
 * layout produces a document a tax office rejects — the shape of the official
 * file has to come from a real example.
 *
 * The figures are the part that is expensive to get right and the part that is
 * format-independent, so they exist now and the form can be laid over them.
 *
 * Only APPROVED and DISBURSED runs count. A draft or rejected run is not money
 * anybody received, and a recap that included one would overstate both income
 * and tax withheld. This comment used to say APPROVED alone, which is how a
 * paid run — settlement moves it to DISBURSED — came to be missed by the
 * year-end readers once before.
 */
export class AnnualTaxRecapService {
  /**
   * The payslips a tax year counts, for both the recap and the bukti potong.
   *
   * Shared on purpose: when the status filter lived in two places, a paid run —
   * settlement moves it to DISBURSED, not APPROVED — was missed by one of
   * them, and the December reconciliation refunded nearly a whole month of
   * tax. One query, one answer.
   */
  private countedPayslips(companyId: string, employeeId: string, year: number) {
    return prisma.payslip.findMany({
      where: {
        employeeId,
        companyId,
        payrollRun: {
          // Paid runs are DISBURSED; see payroll-payment-settlement.ts:34.
          status: { in: ['APPROVED', 'DISBURSED'] },
          period: {
            startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
            endDate: { lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) },
          },
        },
      },
      select: {
        id: true, baseSalary: true, totalEarnings: true, totalDeductions: true, netPay: true,
        components: {
          select: { name: true, type: true, amount: true, isTaxable: true, salaryComponent: { select: { code: true } } },
        },
        payrollRun: { select: { period: { select: { code: true, startDate: true } } } },
      },
    });
  }

  async build(companyId: string, employeeId: string, year: number): Promise<AnnualTaxRecap> {
    if (year < 2000 || year > 2100) throw new BadRequestError('Year is out of range');
    await assertEmployeeInScope(employeeId, 'payroll');

    const employee = await prisma.employee.findFirst({
      where: { id: employeeId, companyId, deletedAt: null },
      select: {
        id: true, employeeNumber: true, fullName: true, taxId: true,
        maritalStatus: true, joinDate: true,
        // Counted the way the payroll run counts them. Without the filter this
        // included every family member, dependent or not, so the recap could
        // state a larger PTKP than the one the tax was actually withheld with
        // — and the bukti potong would carry that wrong figure on line 16.
        _count: { select: { families: { where: { isDependent: true } } } },
        company: { select: { id: true, name: true, taxId: true } },
      },
    });
    if (!employee) throw new NotFoundError('Employee not found in the active company');

    const payslips = await this.countedPayslips(companyId, employeeId, year);

    const months: MonthlyTaxRow[] = [];
    let grossTotal = decimal(0);
    let pphTotal = decimal(0);
    let bpjsTotal = decimal(0);
    let netTotal = decimal(0);

    for (const payslip of payslips) {
      const breakdown = buildPayslipBreakdown({
        baseSalary: payslip.baseSalary.toString(),
        totalEarnings: payslip.totalEarnings.toString(),
        totalDeductions: payslip.totalDeductions.toString(),
        netPay: payslip.netPay.toString(),
        components: payslip.components.map((component) => ({
          name: component.name,
          type: component.type,
          amount: component.amount.toString(),
          isTaxable: component.isTaxable,
          salaryComponent: component.salaryComponent,
        })),
      });

      const bpjsEmployee = decimal(breakdown.statutorySummary.bpjsTK).plus(breakdown.statutorySummary.bpjsKesehatan);
      const gross = decimal(payslip.totalEarnings);
      const pph21 = decimal(breakdown.statutorySummary.pph21);
      const net = decimal(payslip.netPay);

      grossTotal = grossTotal.plus(gross);
      pphTotal = pphTotal.plus(pph21);
      bpjsTotal = bpjsTotal.plus(bpjsEmployee);
      netTotal = netTotal.plus(net);

      months.push({
        month: new Date(payslip.payrollRun.period.startDate).getUTCMonth() + 1,
        periodCode: payslip.payrollRun.period.code,
        grossEarnings: gross.toFixed(2),
        pph21: pph21.toFixed(2),
        bpjsEmployee: bpjsEmployee.toFixed(2),
        netPay: net.toFixed(2),
      });
    }

    months.sort((a, b) => a.month - b.month || a.periodCode.localeCompare(b.periodCode));

    const dependents = employee._count.families;
    const married = employee.maritalStatus === 'MARRIED';
    // Indonesian PTKP notation: K for married, TK for single, then the number
    // of dependents counted for tax.
    const ptkpStatus = `${married ? 'K' : 'TK'}/${Math.min(dependents, 3)}`;

    const warnings: string[] = [];
    if (!employee.taxId) {
      // Without an NPWP the withholding rate is higher, and the form needs the
      // number. Better surfaced here than discovered at filing time.
      warnings.push('employee:NPWP_MISSING');
    }
    if (!employee.company.taxId) warnings.push('company:NPWP_MISSING');
    if (months.length === 0) warnings.push('payroll:NO_APPROVED_PAYSLIPS_IN_YEAR');
    if (months.length > 0 && months.length < 12) {
      // Not necessarily wrong — a mid-year joiner or leaver is normal — but the
      // reader must know the recap covers part of a year.
      warnings.push(`payroll:PARTIAL_YEAR_${months.length}_MONTHS`);
    }
    if (dependents > 3) {
      // PTKP counts at most three dependents; the extra ones are real people
      // but do not raise the allowance.
      warnings.push(`tax:DEPENDENTS_CAPPED_AT_3_OF_${dependents}`);
    }

    return {
      year,
      employee: {
        id: employee.id,
        employeeNumber: employee.employeeNumber,
        fullName: employee.fullName,
        taxId: employee.taxId,
        maritalStatus: employee.maritalStatus,
        dependents,
        ptkpStatus,
        joinDate: employee.joinDate ? employee.joinDate.toISOString() : null,
      },
      company: employee.company,
      months,
      totals: {
        grossEarnings: grossTotal.toFixed(2),
        pph21: pphTotal.toFixed(2),
        bpjsEmployee: bpjsTotal.toFixed(2),
        netPay: netTotal.toFixed(2),
        monthsPaid: months.length,
      },
      warnings,
    };
  }


  /**
   * The bukti potong 1721-A1 figures for one employee and year.
   *
   * The layout is PER-2/PJ/2024's; see `shared/payroll/form-1721-a1.ts` for
   * where every line number came from and what has not been verified. This
   * method's job is only to feed it the year the employee actually had.
   */
  async buildBuktiPotong(companyId: string, employeeId: string, year: number) {
    const recap = await this.build(companyId, employeeId, year);
    const payslips = await this.countedPayslips(companyId, employeeId, year);

    const components = payslips.flatMap((payslip) => payslip.components.map((component) => ({
      code: component.salaryComponent?.code ?? null,
      name: component.name,
      type: component.type as 'ALLOWANCE' | 'DEDUCTION',
      amount: Number(component.amount),
      isTaxable: component.isTaxable,
    })));

    // Taxable gross per payslip, defined the same way the December
    // reconciliation defines it, so the form and the true-up cannot disagree
    // about the year.
    const taxableOf = (slip: (typeof payslips)[number]) => slip.components
      .filter((component) => component.type === 'ALLOWANCE' && component.isTaxable)
      .reduce((sum, component) => sum + Number(component.amount), 0);
    const pensionOf = (slip: (typeof payslips)[number]) => slip.components
      .filter((component) => component.type === 'DEDUCTION' && component.salaryComponent?.code === 'BPJS-TK')
      .reduce((sum, component) => sum + Number(component.amount), 0);
    const withheldOf = (slip: (typeof payslips)[number]) => slip.components
      .filter((component) => component.type === 'DEDUCTION' && component.salaryComponent?.code === 'PPH21')
      .reduce((sum, component) => sum + Number(component.amount), 0);

    const byMonth = [...payslips].sort((a, b) =>
      new Date(a.payrollRun.period.startDate).getTime() - new Date(b.payrollRun.period.startDate).getTime());
    const monthOf = (slip: (typeof payslips)[number]) =>
      new Date(slip.payrollRun.period.startDate).getUTCMonth() + 1;

    const policy = await loadPayrollPolicyConfig(prisma, companyId, year);
    const married = recap.employee.maritalStatus === 'MARRIED';
    const dependents = recap.employee.dependents;
    const annual = calculateAnnualPph21({
      monthlyGrosses: byMonth.map(taxableOf),
      monthlyPensions: byMonth.map(pensionOf),
      married,
      dependents,
      hasNpwp: Boolean(recap.employee.taxId),
    }, policy.pph21);

    const withheldTotal = byMonth.reduce((sum, slip) => sum + withheldOf(slip), 0);
    // The last period is the one the form settles; everything before it is
    // line 22a.
    const lastMonth = byMonth.length ? monthOf(byMonth[byMonth.length - 1]) : 12;
    const firstMonth = byMonth.length ? monthOf(byMonth[0]) : 1;
    const withheldBeforeLastPeriod = byMonth
      .filter((slip) => monthOf(slip) !== lastMonth)
      .reduce((sum, slip) => sum + withheldOf(slip), 0);

    const form = buildForm1721A1({
      taxYear: year,
      firstMonth,
      lastMonth,
      components,
      ptkp: annual.ptkp,
      annualTaxDue: annual.annualTax,
      withheldTotal,
      withheldBeforeLastPeriod,
      biayaJabatanRate: policy.pph21.biayaJabatanRate ?? DEFAULT_PPH21_CONFIG.biayaJabatanRate,
      biayaJabatanMaxMonth: policy.pph21.biayaJabatanMaxMonth ?? DEFAULT_PPH21_CONFIG.biayaJabatanMaxMonth,
    });

    return {
      ...form,
      // The recap's own warnings matter here too: a missing NPWP or a partial
      // year changes what the form means.
      warnings: [...form.warnings, ...recap.warnings],
      employee: recap.employee,
      company: recap.company,
      year,
    };
  }

  /** One row per employee, for the year — what HR reconciles against before filing. */
  async buildCompanySummary(companyId: string, year: number) {
    if (year < 2000 || year > 2100) throw new BadRequestError('Year is out of range');

    const employees = await prisma.payslip.findMany({
      where: {
        companyId,
        payrollRun: {
          // Paid runs are DISBURSED; see payroll-payment-settlement.ts:34.
          status: { in: ['APPROVED', 'DISBURSED'] },
          period: {
            startDate: { gte: new Date(Date.UTC(year, 0, 1)) },
            endDate: { lte: new Date(Date.UTC(year, 11, 31, 23, 59, 59)) },
          },
        },
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });

    const rows = [];
    for (const { employeeId } of employees) {
      const recap = await this.build(companyId, employeeId, year);
      rows.push({
        employeeNumber: recap.employee.employeeNumber,
        fullName: recap.employee.fullName,
        taxId: recap.employee.taxId,
        ptkpStatus: recap.employee.ptkpStatus,
        monthsPaid: recap.totals.monthsPaid,
        grossEarnings: recap.totals.grossEarnings,
        pph21: recap.totals.pph21,
        warnings: recap.warnings,
      });
    }
    return { year, employees: rows.length, rows };
  }
}

/** CSV for the tax team's own reconciliation; deliberately not a DJP file. */
export function recapToCsv(recap: AnnualTaxRecap): string {
  const header = ['Bulan', 'Kode Periode', 'Penghasilan Bruto', 'PPh 21', 'BPJS (karyawan)', 'Take Home'];
  const lines = [header.join(',')];
  for (const row of recap.months) {
    lines.push([row.month, row.periodCode, row.grossEarnings, row.pph21, row.bpjsEmployee, row.netPay].join(','));
  }
  lines.push(['TOTAL', '', recap.totals.grossEarnings, recap.totals.pph21, recap.totals.bpjsEmployee, recap.totals.netPay].join(','));
  return lines.join('\n');
}

export const annualTaxRecapService = new AnnualTaxRecapService();
