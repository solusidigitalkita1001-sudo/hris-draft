import { createPayrollRunSchema } from './payroll.dto';

/**
 * Fase 0 for GAP-41/42/14. Until now a period could hold exactly one payroll
 * run, because the rule knew nothing of run types — so paying THR meant
 * voiding the month's salary run, severance had nowhere to live, and a wrong
 * amount in a disbursed period could only be fixed by reopening the old run.
 *
 * The two guards that had to change are both in `createPayrollRun`:
 *   - one run per period  →  one run per period PER TYPE
 *   - the attendance-recap gate  →  REGULAR only
 *
 * Those live inside a Serializable transaction with a row lock, so they are
 * asserted here against the source and the DTO rather than by standing up a
 * database; the behavioural proof belongs in the MySQL-gated suite, which is
 * where the existing run-creation tests already are.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const service = readFileSync(join(__dirname, 'payroll.service.ts'), 'utf8');
const repository = readFileSync(join(__dirname, 'payroll.repository.ts'), 'utf8');

describe('payroll run type', () => {
  it('accepts the four run types and defaults to REGULAR by omission', () => {
    for (const runType of ['REGULAR', 'THR', 'SEVERANCE', 'CORRECTION']) {
      expect(createPayrollRunSchema.safeParse({
        periodId: '11111111-1111-1111-1111-111111111111',
        companyId: '22222222-2222-2222-2222-222222222222',
        name: 'Run', runType,
      }).success).toBe(true);
    }
    // Omitted rather than defaulted in the schema, so an existing client that
    // never sends it keeps behaving exactly as before.
    const parsed = createPayrollRunSchema.parse({
      periodId: '11111111-1111-1111-1111-111111111111',
      companyId: '22222222-2222-2222-2222-222222222222',
      name: 'Run',
    });
    expect(parsed.runType).toBeUndefined();
  });

  it('rejects a run type that is not one of the four', () => {
    expect(createPayrollRunSchema.safeParse({
      periodId: '11111111-1111-1111-1111-111111111111',
      companyId: '22222222-2222-2222-2222-222222222222',
      name: 'Run', runType: 'BONUS',
    }).success).toBe(false);
  });

  it('scopes the one-run-per-period guard by run type', () => {
    // The assertion that matters: without runType in this where-clause, a THR
    // run cannot coexist with the month's salary run.
    expect(service).toMatch(
      /payrollRun\.findFirst\(\{\s*\n\s*where: \{ companyId: data\.companyId, periodId: period\.id, runType,/,
    );
  });

  it('gates the attendance recap on REGULAR only', () => {
    expect(service).toMatch(/runType === 'REGULAR' && !period\.attendanceReviewedAt/);
    // And nothing else may still gate unconditionally.
    const unconditional = service.split('\n').filter(line =>
      line.includes('!period.attendanceReviewedAt') && !line.includes("runType === 'REGULAR'"));
    expect(unconditional).toEqual([]);
  });

  it('still lets a VOIDED run free its slot', () => {
    expect(service).toMatch(/status: \{ not: 'VOIDED' \}/);
  });

  it('persists the run type instead of dropping it on the floor', () => {
    expect(repository).toMatch(/runType: data\.runType \?\? 'REGULAR'/);
    expect(repository).toMatch(/runType: true/);
  });
});
