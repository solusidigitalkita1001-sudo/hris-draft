import { Prisma } from '@prisma/client';
import { compileFormula, evaluateFormula, FormulaInputs, resolvePayrollComponents, selectFormulaVersions, validateFormulaGraph } from './formula';
const inputs: FormulaInputs = { BASE_SALARY: '10000000', WORK_DAYS: '20', PRESENT_DAYS: '17', LEAVE_DAYS: '1', ABSENT_DAYS: '2', OVERTIME_HOURS: '4.5' };
const evaluate = (expression: string, values = inputs) => evaluateFormula(compileFormula(expression), values, () => new Prisma.Decimal('100.25')).toFixed(2);
describe('bounded payroll formula language', () => {
  it.each([
    ['0.1 + 0.2', '0.30'], ['1 + 2 * 3', '7.00'], ['(1 + 2) * 3', '9.00'], ['10 - 3 - 2', '5.00'],
    ['1--2', '3.00'], ['round(10.555, 2)', '10.56'], ['round(10.5, 0)', '11.00'],
    ['max(0, min(BASE_SALARY / 10, 500000))', '500000.00'],
    ['BASE_SALARY * PRESENT_DAYS / WORK_DAYS', '8500000.00'], ['component("MEAL") * 2', '200.50'],
    ['9999999999999.99', '9999999999999.99'],
  ])('evaluates %s deterministically to %s', (expression, expected) => expect(evaluate(expression)).toBe(expected));
  it.each(['process.exit()', 'globalThis', 'Math.random()', '1e9', 'BASE_SALARY.constructor', 'eval("1")',
    '[1,2]', '1;2', 'min(1)', 'min(1,2,3)', 'round(1,BASE_SALARY)', 'round(1,3)', '"text"',
    'component("PPH21")', 'component("LOAN_DEDUCTION_AUTO")', '', '1 +'])('rejects unsupported syntax: %s', expression => {
    expect(() => compileFormula(expression)).toThrow();
  });
  it.each(['1/0', '-1', '9999999999999.99 * 2'])('rejects invalid runtime amounts: %s', expression => expect(() => evaluate(expression)).toThrow());
  it('rejects division by zero with actual payroll inputs even after a successful different simulation', () => {
    expect(() => evaluate('BASE_SALARY / WORK_DAYS', { ...inputs, WORK_DAYS: '0' })).toThrow('division by zero');
  });
  it('enforces size, token, node, nesting and input type limits', () => {
    for (const expression of ['1'.repeat(2049), '1+'.repeat(200) + '1', '('.repeat(40) + '1' + ')'.repeat(40)]) expect(() => compileFormula(expression)).toThrow();
    expect(() => evaluate('BASE_SALARY', { ...inputs, BASE_SALARY: 'NaN' })).toThrow();
    expect(() => evaluate('PRESENT_DAYS', { ...inputs, PRESENT_DAYS: '1.5' })).toThrow('whole number');
    expect(() => evaluate('OVERTIME_HOURS', { ...inputs, OVERTIME_HOURS: '10001' })).toThrow('exceeds');
  });
  it('validates dependency existence and cycles before evaluating', () => {
    expect(() => validateFormulaGraph(new Map([['A', 'component("B")'], ['B', 'component("A")']]), new Set(['A', 'B']))).toThrow('cyclic');
    expect(() => validateFormulaGraph(new Map([['A', 'component("OTHER_COMPANY")']]), new Set(['A']))).toThrow('unavailable');
  });
  it('selects immutable historical versions by payroll period start', () => {
    const versions = [{ id: 'v1', componentId: 'bonus', expression: '100', effectiveFrom: new Date('2026-01-01'), version: 1, engineVersion: 1 },
      { id: 'v2', componentId: 'bonus', expression: '200', effectiveFrom: new Date('2026-10-01'), version: 2, engineVersion: 1 }];
    expect(selectFormulaVersions(versions, new Date('2026-09-30')).get('bonus')?.id).toBe('v1');
    expect(selectFormulaVersions(versions, new Date('2026-10-01')).get('bonus')?.id).toBe('v2');
    expect(selectFormulaVersions(versions, new Date('2025-12-31')).size).toBe(0);
  });
  it('uses rounded dependency amounts and records execution evidence, independent of allocation order', () => {
    const components = [{ id: 'B', code: 'B', method: 'FIXED', amount: '99', ratePercent: null },
      { id: 'A', code: 'A', method: 'FIXED', amount: '99', ratePercent: null }];
    const versions = new Map([['A', { id: 'vA', componentId: 'A', expression: '0.105', effectiveFrom: new Date(), version: 1, engineVersion: 1 }],
      ['B', { id: 'vB', componentId: 'B', expression: 'component("A") * 3', effectiveFrom: new Date(), version: 1, engineVersion: 1 }]]);
    const result = resolvePayrollComponents(components, inputs, versions);
    expect(result.amounts.get('B')?.toFixed(2)).toBe('0.33');
    expect(result.calculations.find(calculation => calculation.componentId === 'B')?.dependencies).toEqual({ A: '0.11' });
    expect(result.calculations[0].inputs.BASE_SALARY).toBe('10000000');
    expect(resolvePayrollComponents(components, inputs, new Map()).amounts.get('B')?.toFixed(2)).toBe('99.00');
    expect(() => resolvePayrollComponents([components[0]], inputs, versions)).toThrow('unavailable');
  });
});
