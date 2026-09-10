import { loadPayrollPolicyConfig } from './payroll-policy';
import { calculatePph21, DEFAULT_PPH21_CONFIG } from './pph21';
import { calculateBpjs, DEFAULT_BPJS_CONFIG } from './bpjs';

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

function fakeDb(rows: { tax?: unknown[]; ptkp?: unknown[]; bpjs?: unknown[] }) {
  return {
    taxBracket: { findMany: jest.fn().mockResolvedValue(rows.tax ?? []) },
    ptkpTable: { findMany: jest.fn().mockResolvedValue(rows.ptkp ?? []) },
    bpjsReference: { findMany: jest.fn().mockResolvedValue(rows.bpjs ?? []) },
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
