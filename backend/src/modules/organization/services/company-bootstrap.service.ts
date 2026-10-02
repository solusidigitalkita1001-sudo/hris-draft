import { Prisma, SalaryType } from '@prisma/client';
import prisma from '@/shared/database/prisma';
import { NotFoundError } from '@/shared/exceptions/AppError';

const logger = new WinstonLogger('CompanyBootstrap');
import { WinstonLogger } from '@/shared/logger/WinstonLogger';

/**
 * A newly created company used to be born unusable: it had a head-office
 * branch and nothing else. No leave types, so no employee could request
 * leave; and no salary components, so payroll could not even be calculated —
 * the engine recognises `GP`, `BPJS-KES`, `BPJS-TK` and `PPH21` by code, and
 * an allocation missing `PPH21` has no tax withheld at all (which is also
 * what makes the gross-up setting silently do nothing). Every tenant was
 * therefore finished by hand in the database, which is not something a product
 * sold to other companies can require.
 *
 * This seeds the structure a company cannot work without, and nothing else.
 */

/** The statutory and customary Indonesian leave catalogue. */
export const DEFAULT_LEAVE_TYPES = [
  { code: 'ANNUAL', name: 'Cuti Tahunan', isPaid: true, isAnnual: true, maxDays: 12, requiresAttachment: false },
  { code: 'SICK', name: 'Cuti Sakit', isPaid: true, isAnnual: false, maxDays: 14, requiresAttachment: false },
  { code: 'MATERNITY', name: 'Cuti Melahirkan', isPaid: true, isAnnual: false, maxDays: 90, requiresAttachment: true },
  { code: 'PATERNITY', name: 'Cuti Mendampingi Melahirkan', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
  { code: 'MARRIAGE', name: 'Cuti Menikah', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: true },
  { code: 'BEREAVEMENT', name: 'Cuti Duka', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
  { code: 'UNPAID', name: 'Cuti Tidak Dibayar', isPaid: false, isAnnual: false, maxDays: 30, requiresAttachment: false },
] as const;

/**
 * Only the four components the payroll engine resolves by code. Allowances
 * such as meal or transport are deliberately absent: their amounts are the
 * tenant's own policy, and seeding another company's rupiah figures would be
 * a number nobody chose quietly becoming the default.
 */
export const DEFAULT_SALARY_COMPONENTS = [
  { code: 'GP', name: 'Gaji Pokok', type: 'ALLOWANCE', calculationMethod: 'FIXED', isTaxable: true },
  { code: 'BPJS-KES', name: 'BPJS Kesehatan', type: 'DEDUCTION', calculationMethod: 'FIXED', isTaxable: false },
  { code: 'BPJS-TK', name: 'BPJS Ketenagakerjaan', type: 'DEDUCTION', calculationMethod: 'FIXED', isTaxable: false },
  { code: 'PPH21', name: 'PPh 21', type: 'DEDUCTION', calculationMethod: 'FIXED', isTaxable: false },
] as const;

export interface BootstrapSummary {
  companyId: string;
  leaveTypesCreated: number;
  leaveTypesExisting: number;
  salaryComponentsCreated: number;
  salaryComponentsExisting: number;
}

/**
 * Idempotent: safe to call on a company that was already set up, and safe to
 * re-run after a partial failure. Existing rows are left exactly as the tenant
 * configured them — this never overwrites a renamed leave type or an edited
 * component, it only fills in what is absent.
 *
 * Approval workflow templates are deliberately NOT seeded. A template whose
 * stage names a role with no member in this company resolves to no approver,
 * and the engine rejects such a stage — so a helpfully pre-seeded template
 * would make every leave request fail. With no template the domain falls back
 * to direct approval, which works. Templates are a deliberate HR setup step.
 */
export async function bootstrapCompany(
  companyId: string,
  db: Prisma.TransactionClient = prisma,
): Promise<BootstrapSummary> {
  const company = await db.company.findFirst({ where: { id: companyId, deletedAt: null }, select: { id: true } });
  if (!company) throw new NotFoundError('Company not found');

  const summary: BootstrapSummary = {
    companyId,
    leaveTypesCreated: 0,
    leaveTypesExisting: 0,
    salaryComponentsCreated: 0,
    salaryComponentsExisting: 0,
  };

  for (const [index, type] of DEFAULT_LEAVE_TYPES.entries()) {
    const existing = await db.leaveType.findUnique({
      where: { companyId_code: { companyId, code: type.code } },
      select: { id: true },
    });
    if (existing) { summary.leaveTypesExisting += 1; continue; }
    await db.leaveType.create({ data: { ...type, companyId, sortOrder: index, isActive: true } });
    summary.leaveTypesCreated += 1;
  }

  for (const [index, component] of DEFAULT_SALARY_COMPONENTS.entries()) {
    const existing = await db.salaryComponent.findUnique({
      where: { companyId_code: { companyId, code: component.code } },
      select: { id: true },
    });
    if (existing) { summary.salaryComponentsExisting += 1; continue; }
    await db.salaryComponent.create({
      data: {
        companyId,
        code: component.code,
        name: component.name,
        type: component.type as SalaryType,
        calculationMethod: component.calculationMethod,
        isTaxable: component.isTaxable,
        isActive: true,
        sortOrder: index,
      },
    });
    summary.salaryComponentsCreated += 1;
  }

  logger.info('Company bootstrapped', { ...summary });
  return summary;
}
