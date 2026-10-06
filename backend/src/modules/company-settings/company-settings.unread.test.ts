import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Every key in DEFAULT_COMPANY_SETTINGS is a promise: offering it says the
 * system will act on its value. A key nothing reads is worse than a key that
 * does not exist, because whoever sets it concludes the system has a
 * capability it does not have — `currency_code` invited the belief that
 * payroll was multi-currency, and `fiscal_year_start_month` that a July
 * fiscal year would move anything.
 *
 * This is the seventh and eighth instance of one defect class in a week — a
 * field written and never read. The others were `isTaxable` on overtime,
 * `PayrollRunStatus.DISBURSED`, `isProrated`, `Department.costCenter`, the
 * webhook catalogue, and `autoAbsentEnabled`; the first three silently moved
 * money. Eight in a week is a pattern, not bad luck, so this fails the build
 * rather than waiting for the next audit to notice the ninth.
 *
 * HOW "READ" IS DETECTED, and why it is this and not something simpler: a key
 * is read when its literal appears somewhere other than the three lists that
 * merely DECLARE it (defaults, numeric ranges, boolean keys). That correctly
 * counts indirection — `const LATE_DEDUCTION_CAP = 'late_deduction_daily_cap_percent'`
 * is a fourth occurrence, outside those lists — which a naive "does the
 * literal appear outside this file" check gets wrong, because settings read
 * through a typed getter have their literal only in this file. I made exactly
 * that mistake twice while finding these two, and reported the wrong number
 * both times.
 */
const SRC = resolve(__dirname, '..', '..');
const SERVICE = join(__dirname, 'company-settings.service.ts');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith('.ts') && !entry.includes('.test.') ? [path] : [];
  });
}

const service = readFileSync(SERVICE, 'utf8');

/** The three regions that only declare a key, never consume it. */
function declarationRegions(): string {
  const slice = (start: string, end: string) => {
    const from = service.indexOf(start);
    return from < 0 ? '' : service.slice(from, service.indexOf(end, from));
  };
  const regions = slice('DEFAULT_COMPANY_SETTINGS', '};')
    + slice('NUMERIC_SETTINGS', '};')
    + slice('BOOLEAN_SETTINGS', ']);');
  // Stripped the same way as the corpus, or the two counts measure different
  // text and the subtraction is meaningless.
  return regions.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

describe('every advertised company setting is read by something', () => {
  const defaults = service.slice(
    service.indexOf('DEFAULT_COMPANY_SETTINGS'),
    service.indexOf('};', service.indexOf('DEFAULT_COMPANY_SETTINGS')),
  );
  const keys = [...defaults.matchAll(/^ {2}([a-z0-9_]+):/gm)].map(match => match[1]);
  const declarations = declarationRegions();
  // Comments are stripped before counting. A prose mention is not a consumer,
  // and the explanatory comment above DEFAULT_COMPANY_SETTINGS names both
  // retired keys — without this, that comment alone made the generic case
  // pass while `currency_code` sat unread in the list. Found by reintroducing
  // the key and watching the wrong assertion stay green.
  const stripComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const corpus = stripComments(
    sourceFiles(SRC).map(file => readFileSync(file, 'utf8')).join('\n'),
  );

  it('found the key list and the declaration regions', () => {
    // Without this, a refactor that moves the literals would make the suite
    // pass by having nothing to check.
    expect(keys.length).toBeGreaterThanOrEqual(10);
    expect(declarations.length).toBeGreaterThan(200);
  });

  it.each([['the retired keys stay retired', ['currency_code', 'fiscal_year_start_month']]])(
    '%s',
    (_label, retired) => {
      for (const key of retired as string[]) expect(keys).not.toContain(key);
    },
  );

  it('advertises every key it validates', () => {
    // The inverse of the assertion below, and the direction that was missing.
    // A key can be validated at the boundary and still be invisible to
    // `getAllSettings`, which is the only way a client discovers what is
    // configurable. Three money-or-mail switches sat in BOOLEAN_SETTINGS and
    // not in the defaults, so the only person who could set them was somebody
    // who already knew the key existed — and no UI could offer them at all.
    const validated = [
      ...[...service.matchAll(/BOOLEAN_SETTINGS = new Set\(\[([\s\S]*?)\]\)/g)]
        .flatMap(match => [...match[1].matchAll(/'([a-z0-9_]+)'/g)].map(key => key[1])),
      ...[...service.matchAll(/NUMERIC_SETTINGS[^=]*= \{([\s\S]*?)\n\};/g)]
        .flatMap(match => [...match[1].matchAll(/^ {2}([a-z0-9_]+):/gm)].map(key => key[1])),
      ...[...service.matchAll(/ENUM_SETTINGS[^=]*= \{([\s\S]*?)\n\};/g)]
        .flatMap(match => [...match[1].matchAll(/^ {2}([a-z0-9_]+):/gm)].map(key => key[1])),
    ];
    expect(validated.length).toBeGreaterThanOrEqual(15);
    expect(validated.filter(key => !keys.includes(key))).toEqual([]);
  });

  it('has a consumer for each key', () => {
    const unread = keys.filter((key) => {
      const occurrences = (corpus.match(new RegExp(`'${key}'|\\b${key}:`, 'g')) ?? []).length;
      const declared = (declarations.match(new RegExp(`'${key}'|\\b${key}:`, 'g')) ?? []).length;
      return occurrences - declared <= 0;
    });

    expect(unread).toEqual([]);
  });
});
