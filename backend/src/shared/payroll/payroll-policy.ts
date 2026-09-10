import { Prisma } from '@prisma/client';
import type { Pph21Config } from './pph21';
import type { BpjsConfig } from './bpjs';

/**
 * Loads the tenant's tax/BPJS reference configuration for a payroll year.
 * Resolution per table: company-specific rows for the closest year <= target,
 * else global rows (companyId null); empty tables yield {} so the statutory
 * defaults in code keep applying. Seeded global rows equal those defaults, so
 * this wiring changes results only when a company actually overrides them.
 */
export interface PayrollPolicyConfig {
  pph21: Partial<Pph21Config>;
  bpjs: Partial<BpjsConfig>;
}

// Upper bounds at or beyond the seed sentinel mean "no upper limit".
const INFINITY_SENTINEL = 9e14;

type Db = Prisma.TransactionClient;

function pickYearScope<T extends { companyId: string | null; year: number }>(rows: T[], companyId: string, year: number): T[] {
  const candidates = (scope: (row: T) => boolean) => {
    const scoped = rows.filter((row) => scope(row) && row.year <= year);
    if (!scoped.length) return [];
    const bestYear = Math.max(...scoped.map((row) => row.year));
    return scoped.filter((row) => row.year === bestYear);
  };
  const own = candidates((row) => row.companyId === companyId);
  return own.length ? own : candidates((row) => row.companyId === null);
}

export async function loadPayrollPolicyConfig(db: Db, companyId: string, year: number): Promise<PayrollPolicyConfig> {
  const [taxBrackets, ptkpRows, bpjsRows] = await Promise.all([
    db.taxBracket.findMany({
      where: { OR: [{ companyId }, { companyId: null }], year: { lte: year } },
      orderBy: [{ year: 'desc' }, { level: 'asc' }],
    }),
    db.ptkpTable.findMany({
      where: { OR: [{ companyId }, { companyId: null }], year: { lte: year } },
      orderBy: { year: 'desc' },
    }),
    db.bpjsReference.findMany({
      // ponytail: JKK risk class I for every employee; per-employee risk
      // classes need an employee-level field before they can be honored.
      where: { OR: [{ companyId }, { companyId: null }], year: { lte: year }, jkkRiskClass: 'I' },
      orderBy: { year: 'desc' },
    }),
  ]);

  const pph21: Partial<Pph21Config> = {};
  const brackets = pickYearScope(taxBrackets, companyId, year);
  if (brackets.length) {
    pph21.brackets = brackets
      .sort((a, b) => a.level - b.level)
      .map((row) => {
        const upper = Number(row.upperBound);
        return [upper >= INFINITY_SENTINEL ? Infinity : upper, Number(row.ratePercent)] as [number, number];
      });
  }
  const ptkp = pickYearScope(ptkpRows, companyId, year);
  if (ptkp.length) {
    pph21.ptkpAmounts = new Map(ptkp.map((row) => [`${row.maritalStatus}/${row.dependents}`, Number(row.amount)]));
    pph21.maxDependents = Math.max(...ptkp.map((row) => row.dependents));
  }

  const bpjsRow = pickYearScope(bpjsRows, companyId, year)[0];
  const bpjs: Partial<BpjsConfig> = bpjsRow
    ? {
        jkkRatePercent: Number(bpjsRow.jkkRatePercent),
        jkmRatePercent: Number(bpjsRow.jkmRatePercent),
        jhtEmployerPercent: Number(bpjsRow.jhtEmployerPercent),
        jhtEmployeePercent: Number(bpjsRow.jhtEmployeePercent),
        jpEmployerPercent: Number(bpjsRow.jpEmployerPercent),
        jpEmployeePercent: Number(bpjsRow.jpEmployeePercent),
        jpWageCap: Number(bpjsRow.jpWageCap),
        jknEmployerPercent: Number(bpjsRow.jknEmployerPercent),
        jknEmployeePercent: Number(bpjsRow.jknEmployeePercent),
        jknWageCap: Number(bpjsRow.jknWageCap),
      }
    : {};

  return { pph21, bpjs };
}
