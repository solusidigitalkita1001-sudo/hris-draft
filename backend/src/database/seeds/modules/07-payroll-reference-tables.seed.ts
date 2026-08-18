/**
 * Seed PAYROLL REFERENCE TABLES default global (companyId=null).
 * - TaxBracket 2024 (UU HPP 2022, 5 tiers)
 * - PtkpTable 2024 (PTKP base 54jt, step 4.5jt, 8 combos TK/K × 0-3 dep)
 * - BpjsReference 2024 (5 JKK Risk Class I-V, JP cap 10,547,400, JKN cap 12jt)
 *
 * Semua idempotent: findFirst unique → skip exist, else createMany.
 * Dipanggil SETELAH seedTestData di seed.ts.
 */
import { PrismaClient, JKKRiskClass } from '@prisma/client';

const TAX_YEAR = 2024;

const TAX_BRACKETS = [
  { level: 1, upperBound: 60_000_000, ratePercent: 0.05 },
  { level: 2, upperBound: 250_000_000, ratePercent: 0.15 },
  { level: 3, upperBound: 500_000_000, ratePercent: 0.25 },
  { level: 4, upperBound: 5_000_000_000, ratePercent: 0.30 },
  { level: 5, upperBound: 999_999_999_999_999, ratePercent: 0.35 }, // sentinel = Infinity
];

const PTKP_BASE = 54_000_000;
const PTKP_STEP = 4_500_000;
const PTKP_ROWS: Array<{ maritalStatus: 'TK' | 'K'; dependents: 0 | 1 | 2 | 3 }> = [
  { maritalStatus: 'TK', dependents: 0 }, { maritalStatus: 'TK', dependents: 1 }, { maritalStatus: 'TK', dependents: 2 }, { maritalStatus: 'TK', dependents: 3 },
  { maritalStatus: 'K', dependents: 0 }, { maritalStatus: 'K', dependents: 1 }, { maritalStatus: 'K', dependents: 2 }, { maritalStatus: 'K', dependents: 3 },
];
function ptkpAmount(status: 'TK'|'K', dep: number) {
  return PTKP_BASE + (status === 'K' ? PTKP_STEP : 0) + dep * PTKP_STEP;
}
function ptkpDesc(status: 'TK'|'K', dep: number) {
  return `${status}/${dep} (${status === 'K' ? 'Menikah' : 'Tidak Menikah'} ${dep} tanggungan)`;
}

const BPJS_COMMON = {
  jkmRatePercent: 0.30,
  jhtEmployerPercent: 3.70,
  jhtEmployeePercent: 2.00,
  jpEmployerPercent: 2.00,
  jpEmployeePercent: 1.00,
  jpWageCap: 10_547_400,
  jknEmployerPercent: 4.00,
  jknEmployeePercent: 1.00,
  jknWageCap: 12_000_000,
};
const BPJS_JKK_PER_CLASS: Array<[JKKRiskClass, number]> = [
  [JKKRiskClass.I, 0.24],
  [JKKRiskClass.II, 0.54],
  [JKKRiskClass.III, 0.89],
  [JKKRiskClass.IV, 1.27],
  [JKKRiskClass.V, 1.74],
];

export async function seedPayrollReferences(prisma: PrismaClient) {
  // 1. Tax Brackets UU HPP 2022
  for (const b of TAX_BRACKETS) {
    const exist = await prisma.taxBracket.findFirst({
      where: { companyId: null, year: TAX_YEAR, level: b.level },
    });
    if (!exist) {
      await prisma.taxBracket.create({
        data: {
          companyId: null,
          year: TAX_YEAR,
          level: b.level,
          upperBound: b.upperBound,
          ratePercent: b.ratePercent,
          isActive: true,
        },
      });
    }
  }

  // 2. PTKP Table
  for (const row of PTKP_ROWS) {
    const exist = await prisma.ptkpTable.findFirst({
      where: { companyId: null, year: TAX_YEAR, maritalStatus: row.maritalStatus, dependents: row.dependents },
    });
    if (!exist) {
      await prisma.ptkpTable.create({
        data: {
          companyId: null,
          year: TAX_YEAR,
          maritalStatus: row.maritalStatus,
          dependents: row.dependents,
          amount: ptkpAmount(row.maritalStatus, row.dependents),
          description: ptkpDesc(row.maritalStatus, row.dependents),
          isActive: true,
        },
      });
    }
  }

  // 3. BPJS Reference per JKK Risk Class
  for (const [riskClass, jkkRate] of BPJS_JKK_PER_CLASS) {
    const exist = await prisma.bpjsReference.findFirst({
      where: { companyId: null, year: TAX_YEAR, jkkRiskClass: riskClass },
    });
    if (!exist) {
      await prisma.bpjsReference.create({
        data: {
          companyId: null,
          year: TAX_YEAR,
          jkkRiskClass: riskClass,
          jkkRatePercent: jkkRate,
          ...BPJS_COMMON,
          isActive: true,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`[seed] Payroll reference tables OK (year=${TAX_YEAR}): 5 TaxBracket + 8 PtkpTable + 5 BpjsReference`);
}
