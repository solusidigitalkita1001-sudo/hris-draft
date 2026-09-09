import { Prisma } from '@prisma/client';
import { BadRequestError } from '@/shared/exceptions/AppError';

// Isolated precision policy: do not change Prisma.Decimal's process-wide defaults.
const Decimal = Prisma.Decimal.clone({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });
export const FORMULA_ENGINE_VERSION = 1;
export const FORMULA_VARIABLES = ['BASE_SALARY', 'WORK_DAYS', 'PRESENT_DAYS', 'LEAVE_DAYS', 'ABSENT_DAYS', 'OVERTIME_HOURS'] as const;
export type FormulaVariable = typeof FORMULA_VARIABLES[number];
export type FormulaInputs = Record<FormulaVariable, string>;
export const SYSTEM_PAYROLL_CODES = new Set(['BPJS-TK', 'BPJS-KES', 'PPH21', 'LOAN_DEDUCTION_AUTO',
  'OVERTIME_EARNING_AUTO', 'LATE_DEDUCTION_AUTO', 'ABSENCE_DEDUCTION_AUTO', 'EWA-DEDUCT']);
type Node = { kind: 'literal'; value: string } | { kind: 'variable'; name: FormulaVariable }
  | { kind: 'reference'; code: string } | { kind: 'negate'; value: Node }
  | { kind: 'binary'; op: string; left: Node; right: Node }
  | { kind: 'call'; name: 'min' | 'max' | 'round'; args: Node[] };
export interface CompiledFormula { ast: Node; references: string[] }
function invalid(message: string): never { throw new BadRequestError(`Formula: ${message}`); }

export function compileFormula(expression: string): CompiledFormula {
  if (!expression.trim() || expression.length > 2048) invalid('expression must contain 1–2048 characters');
  const tokenPattern = /\s+|\d+(?:\.\d+)?|[A-Za-z_][A-Za-z_0-9]*|"[A-Za-z0-9_-]{1,50}"|[()+\-*/,]/y;
  const tokens: string[] = [];
  let cursor = 0;
  while (cursor < expression.length) {
    tokenPattern.lastIndex = cursor;
    const match = tokenPattern.exec(expression);
    if (!match) invalid(`unsupported syntax at position ${cursor + 1}`);
    cursor = tokenPattern.lastIndex;
    if (match[0].trim()) tokens.push(match[0]);
    if (tokens.length > 256) invalid('too many tokens');
  }
  const references = new Set<string>();
  let position = 0, nodes = 0;
  function take(expected: string) { if (tokens[position++] !== expected) invalid(`expected ${expected}`); }
  function counted(node: Node): Node { if (++nodes > 128) invalid('too many operations'); return node; }
  function parse(minPrecedence = 0, depth = 0): Node {
    if (depth > 32) invalid('expression is too deeply nested');
    const token = tokens[position++];
    let left: Node;
    if (token === '-') left = counted({ kind: 'negate', value: parse(3, depth + 1) });
    else if (token === '(') { left = parse(0, depth + 1); take(')'); }
    else if (token && /^\d/.test(token)) {
      if (!/^\d{1,13}(?:\.\d{1,6})?$/.test(token)) invalid('numeric literal exceeds supported precision');
      left = counted({ kind: 'literal', value: token });
    } else if (FORMULA_VARIABLES.includes(token as FormulaVariable)) {
      left = counted({ kind: 'variable', name: token as FormulaVariable });
    } else if (token === 'component') {
      take('('); const code = tokens[position++];
      if (!code || !/^"[A-Za-z0-9_-]{1,50}"$/.test(code)) invalid('component requires a quoted component code');
      take(')'); const name = code.slice(1, -1);
      if (SYSTEM_PAYROLL_CODES.has(name)) invalid('system tax, benefit, loan and attendance components cannot be formula dependencies');
      references.add(name); left = counted({ kind: 'reference', code: name });
    } else if (token === 'min' || token === 'max' || token === 'round') {
      take('('); const args = [parse(0, depth + 1)];
      if (tokens[position] === ',') { position++; args.push(parse(0, depth + 1)); }
      take(')');
      if (token !== 'round' && args.length !== 2) invalid(`${token} requires two arguments`);
      if (token === 'round' && args[1] && (args[1].kind !== 'literal' || !/^[0-2]$/.test(args[1].value))) {
        invalid('round precision must be the literal 0, 1 or 2');
      }
      left = counted({ kind: 'call', name: token, args });
    } else invalid(`unknown input or function ${token ?? '(end)'}`);
    while (position < tokens.length) {
      const op = tokens[position];
      const precedence = op === '+' || op === '-' ? 1 : op === '*' || op === '/' ? 2 : -1;
      if (precedence < minPrecedence) break;
      position++;
      left = counted({ kind: 'binary', op, left, right: parse(precedence + 1, depth + 1) });
    }
    return left;
  }
  const ast = parse();
  if (position !== tokens.length) invalid('unexpected trailing input');
  return { ast, references: [...references].sort() };
}

export function validateFormulaGraph(expressions: Map<string, string>, availableCodes: Set<string>): void {
  if (expressions.size > 512) invalid('company formula graph exceeds 512 components');
  const graph = new Map([...expressions].map(([code, expression]) => [code, compileFormula(expression).references]));
  const complete = new Set<string>(), visiting = new Set<string>();
  function visit(code: string, depth = 0) {
    if (!availableCodes.has(code)) invalid(`component ${code} is unavailable in this company`);
    if (complete.has(code)) return;
    if (visiting.has(code)) invalid('cyclic component dependency');
    if (depth > 32) invalid('component dependency chain is too deep');
    visiting.add(code);
    for (const dependency of graph.get(code) ?? []) visit(dependency, depth + 1);
    visiting.delete(code); complete.add(code);
  }
  for (const code of graph.keys()) visit(code);
}

export function evaluateFormula(formula: CompiledFormula, inputs: FormulaInputs,
  component: (code: string) => Prisma.Decimal): Prisma.Decimal {
  const values = new Map<FormulaVariable, Prisma.Decimal>();
  for (const name of FORMULA_VARIABLES) {
    if (typeof inputs[name] !== 'string' || !/^(?:0|[1-9]\d{0,12})(?:\.\d{1,6})?$/.test(inputs[name])) invalid(`invalid numeric input ${name}`);
    const value = new Decimal(inputs[name]);
    if (name !== 'BASE_SALARY' && value.greaterThan(10000)) invalid(`${name} exceeds 10000`);
    if ((name === 'WORK_DAYS' || name === 'PRESENT_DAYS') && !value.isInteger()) invalid(`${name} must be a whole number`);
    values.set(name, value);
  }
  function evaluate(node: Node): Prisma.Decimal {
    let result: Prisma.Decimal;
    if (node.kind === 'literal') result = new Decimal(node.value);
    else if (node.kind === 'variable') result = values.get(node.name)!;
    else if (node.kind === 'reference') result = new Decimal(component(node.code));
    else if (node.kind === 'negate') result = evaluate(node.value).negated();
    else if (node.kind === 'binary') {
      const left = evaluate(node.left), right = evaluate(node.right);
      if (node.op === '/' && right.isZero()) invalid('division by zero');
      result = node.op === '+' ? left.plus(right) : node.op === '-' ? left.minus(right)
        : node.op === '*' ? left.times(right) : left.dividedBy(right);
    } else {
      const first = evaluate(node.args[0]);
      result = node.name === 'round' ? first.toDecimalPlaces(node.args[1]?.kind === 'literal' ? Number(node.args[1].value) : 2)
        : node.name === 'min' ? Decimal.min(first, evaluate(node.args[1])) : Decimal.max(first, evaluate(node.args[1]));
    }
    if (!result.isFinite() || result.abs().greaterThan('100000000000000000000000000')) invalid('intermediate value exceeds calculation limits');
    return result;
  }
  return formulaMoney(evaluate(formula.ast));
}

export function formulaMoney(value: Prisma.Decimal | string | number): Prisma.Decimal {
  const amount = new Decimal(value);
  if (!amount.isFinite() || amount.isNegative() || amount.greaterThan('9999999999999.99')) invalid('result must be a nonnegative monetary amount within Decimal(15,2)');
  return amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

export interface FormulaVersionInput { id: string; componentId: string; expression: string; effectiveFrom: Date; version: number; engineVersion: number }
export function selectFormulaVersions(versions: FormulaVersionInput[], date: Date): Map<string, FormulaVersionInput> {
  const selected = new Map<string, FormulaVersionInput>();
  for (const version of versions) {
    if (version.effectiveFrom > date) continue;
    const previous = selected.get(version.componentId);
    if (!previous || previous.effectiveFrom < version.effectiveFrom) selected.set(version.componentId, version);
  }
  return selected;
}

export interface FormulaComponentInput {
  id: string; code: string; method: string; amount: Prisma.Decimal | string | number;
  ratePercent: Prisma.Decimal | string | number | null;
}
export function resolvePayrollComponents(components: FormulaComponentInput[], inputs: FormulaInputs,
  versions: Map<string, FormulaVersionInput>) {
  const byCode = new Map(components.map(component => [component.code, component]));
  if (byCode.size !== components.length) invalid('duplicate salary component allocation');
  const expressions = new Map(components.flatMap(component => {
    const version = versions.get(component.id); return version ? [[component.code, version.expression] as const] : [];
  }));
  validateFormulaGraph(expressions, new Set(byCode.keys()));
  const amounts = new Map<string, Prisma.Decimal>();
  const calculations: { componentId: string; versionId: string; expression: string; amount: Prisma.Decimal;
    inputs: FormulaInputs; dependencies: Record<string, string>; engineVersion: number }[] = [];
  function resolve(code: string): Prisma.Decimal {
    const existing = amounts.get(code); if (existing) return existing;
    const component = byCode.get(code); if (!component) invalid(`component ${code} is not allocated to this employee`);
    const version = versions.get(component.id);
    let amount: Prisma.Decimal;
    if (version) {
      if (version.engineVersion !== FORMULA_ENGINE_VERSION) invalid('unsupported engine version');
      const compiled = compileFormula(version.expression);
      amount = evaluateFormula(compiled, inputs, resolve);
      calculations.push({ componentId: component.id, versionId: version.id, expression: version.expression,
        amount, inputs: { ...inputs }, dependencies: Object.fromEntries(compiled.references.map(ref => [ref, resolve(ref).toFixed(2)])), engineVersion: FORMULA_ENGINE_VERSION });
    } else if (component.method === 'PERCENTAGE') {
      amount = formulaMoney(new Decimal(inputs.BASE_SALARY).times(component.ratePercent ?? 0).dividedBy(100));
    } else if (component.method === 'FIXED') amount = formulaMoney(component.amount);
    else invalid(`component ${code} has no effective published formula`);
    amounts.set(code, amount); return amount;
  }
  for (const component of components) resolve(component.code);
  return { amounts, calculations };
}
