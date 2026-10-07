import { loadPayrollPolicyConfig } from './payroll-policy';
import { calculatePph21, DEFAULT_PPH21_CONFIG } from './pph21';
import { calculateBpjs, DEFAULT_BPJS_CONFIG } from './bpjs';
import { DEFAULT_TER_BRACKETS } from './ter-tables';
import { terRatePercent } from './ter';

// Mirrors database/seeds/modules/07-payroll-reference-tables.seed.ts.
const seededBrackets = [
  { companyId: null, year: 2024, level: 1, upperBound: 60_000_000, ratePercent: 0.05 },
  { companyId: null, year: 2024, level: 2, upperBound: 250_000_000, ratePercent: 0.15 },
  { companyId: null, year: 2024, level: 3, upperBound: 500_000_000, ratePercent: 0.25 },
  { companyId: null, year: 2024, level: 4, upperBound: 5_000_000_000, ratePercent: 0.3 },
  { companyId: null, year: 2024, level: 5, upperBound: 999_999_999_999_999, ratePercent: 0.35 },
];
const seededPtkp = (['TK', 'K'] as const).flatMap((status) =>
  [0, 1, 2, 3].map((dependents) => ({
    companyId: null, year: 2024, maritalStatus: status, dependents,
    amount: 54_000_000 + (status === 'K' ? 4_500_000 : 0) + dependents * 4_500_000,
  })),
);
const seededBpjs = [{
  companyId: null, year: 2024, jkkRiskClass: 'I',
  jkkRatePercent: 0.24, jkmRatePercent: 0.3,
  jhtEmployerPercent: 3.7, jhtEmployeePercent: 2,
  jpEmployerPercent: 2, jpEmployeePercent: 1, jpWageCap: 10_547_400,
  jknEmployerPercent: 4, jknEmployeePercent: 1, jknWageCap: 12_000_000,
}];

/** Mirrors the TER rows the same seed writes, for kategori A only. */
const seededTerA = DEFAULT_TER_BRACKETS.A.map(([upperBound, ratePercent], index) => ({
  companyId: null, year: 2024, category: 'A' as const,
  level: index + 1, upperBound, ratePercent,
}));

function fakeDb(rows: { tax?: unknown[]; ptkp?: unknown[]; bpjs?: unknown[]; ter?: unknown[] }) {
  return {
    taxBracket: { findMany: jest.fn().mockResolvedValue(rows.tax ?? []) },
    ptkpTable: { findMany: jest.fn().mockResolvedValue(rows.ptkp ?? []) },
    bpjsReference: { findMany: jest.fn().mockResolvedValue(rows.bpjs ?? []) },
    terBracket: { findMany: jest.fn().mockResolvedValue(rows.ter ?? []) },
  } as never;
}

describe('payroll policy wiring (behavior-preserving against seeds)', () => {
  const sampleInputs = [
    { monthlyGross: 8_000_000, married: false, dependents: 0, hasNpwp: true },
    { monthlyGross: 25_000_000, married: true, dependents: 2, monthlyPensionContribution: 500_000, hasNpwp: true },
    { monthlyGross: 60_000_000, married: true, dependents: 3, hasNpwp: false },
  ];

  it('seeded reference rows produce IDENTICAL pph21 results to the statutory defaults', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({ tax: seededBrackets, ptkp: seededPtkp }), 'company-A', 2026);
    for (const input of sampleInputs) {
      expect(calculatePph21(input, config.pph21)).toEqual(calculatePph21(input));
    }
    expect(config.pph21.brackets?.[4][0]).toBe(Infinity);
  });

  it('seeded BPJS rows produce IDENTICAL contributions to the defaults', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({ bpjs: seededBpjs }), 'company-A', 2026);
    for (const wage of [4_000_000, 11_000_000, 25_000_000]) {
      expect(calculateBpjs(wage, config.bpjs)).toEqual(calculateBpjs(wage));
    }
  });

  it('empty tables fall back to statutory code defaults', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({}), 'company-A', 2026);
    expect(config.pph21).toEqual({});
    expect(config.bpjs).toEqual({});
    expect(calculatePph21(sampleInputs[0], config.pph21)).toEqual(calculatePph21(sampleInputs[0]));
  });

  it('company-specific rows override globals; newer years win up to the run year', async () => {
    const companyBrackets = [
      { companyId: 'company-A', year: 2025, level: 1, upperBound: 999_999_999_999_999, ratePercent: 0.1 },
    ];
    const config = await loadPayrollPolicyConfig(
      fakeDb({ tax: [...seededBrackets, ...companyBrackets] }), 'company-A', 2026);
    expect(config.pph21.brackets).toEqual([[Infinity, 0.1]]);
    // Flat 10%: PKP × 0.1
    const result = calculatePph21({ monthlyGross: 25_000_000, married: false, dependents: 0, hasNpwp: true }, config.pph21);
    expect(result.annualTax).toBe(Math.round(result.pkp * 0.1));
  });

  it('a future-year override is ignored for an earlier run year', async () => {
    const future = [{ companyId: 'company-A', year: 2030, level: 1, upperBound: 999_999_999_999_999, ratePercent: 0.99 }];
    const config = await loadPayrollPolicyConfig(fakeDb({ tax: [...seededBrackets, ...future] }), 'company-A', 2026);
    expect(config.pph21.brackets).toHaveLength(5);
    expect(config.pph21.brackets?.[0][1]).toBe(0.05);
  });

  it('defaults still match the statutory constants (guards seed drift)', () => {
    expect(DEFAULT_PPH21_CONFIG.brackets.map(([bound]) => bound)).toEqual([60e6, 250e6, 500e6, 5e9, Infinity]);
    expect(DEFAULT_BPJS_CONFIG.jpWageCap).toBe(10_547_400);
  });
});

/**
 * TER is loaded per category on purpose. A company that overrides only
 * kategori A must keep the statutory B and C — resolving the whole table at
 * once would have dropped them, which is the quiet kind of wrong: withholding
 * would silently fall back to the annex for some employees and the override
 * for others, with nothing to show which.
 */
describe('TER bracket loading', () => {
  it('returns nothing when the table is empty, so the annex applies', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({}), 'company-A', 2026);
    expect(config.ter).toEqual({});
    // And the calculator still answers, from its own copy of the annex.
    expect(terRatePercent('A', 10_000_000, config.ter)).toBe(2);
  });

  it('reproduces the annex exactly when loaded from seeded rows', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({ ter: seededTerA }), 'company-A', 2026);
    expect(config.ter.A).toEqual(DEFAULT_TER_BRACKETS.A);
    expect(config.ter.B).toBeUndefined();
    expect(config.ter.C).toBeUndefined();
  });

  it('keeps the statutory categories a company did not override', async () => {
    const override = [
      { companyId: 'company-A', year: 2025, category: 'A' as const, level: 1, upperBound: 9_000_000, ratePercent: 1 },
      { companyId: 'company-A', year: 2025, category: 'A' as const, level: 2, upperBound: null, ratePercent: 20 },
    ];
    const config = await loadPayrollPolicyConfig(
      fakeDb({ ter: [...seededTerA, ...override] }), 'company-A', 2026);
    expect(config.ter.A).toEqual([[9_000_000, 1], [null, 20]]);
    expect(terRatePercent('A', 5_000_000, config.ter)).toBe(1);
    // B was never overridden, so it must still come from the annex.
    expect(config.ter.B).toBeUndefined();
    expect(terRatePercent('B', 6_800_000, config.ter)).toBe(0.5);
  });

  it('carries the open-ended top bracket through as null, not a sentinel', async () => {
    const config = await loadPayrollPolicyConfig(fakeDb({ ter: seededTerA }), 'company-A', 2026);
    const rows = config.ter.A as ReadonlyArray<readonly [number | null, number]>;
    expect(rows[rows.length - 1][0]).toBeNull();
    expect(rows[rows.length - 1][1]).toBe(34);
  });
});
