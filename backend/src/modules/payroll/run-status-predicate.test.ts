import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * A payroll run that has been paid is DISBURSED, not APPROVED — settlement
 * moves it there (`payroll-payment-settlement.ts`), and that is the only
 * supported payment path. Any reader asking for "runs that really happened"
 * must therefore accept both, and four year-end readers accepted only
 * APPROVED.
 *
 * The consequence was money, not a missing row: by December every earlier run
 * had been paid, so the annual reconciliation saw no history, computed one
 * month's gross against a full year's PTKP, and emitted a component refunding
 * almost all of December's withholding. The 1721-A1 recap and the BPJS report
 * reported empty for the same reason.
 *
 * This guards the *shape* of that mistake rather than the four known sites.
 * Scope matters: it inspects only `status` inside a `payrollRun` filter.
 * Filtering a Resignation, LeaveRequest or PermissionRequest on APPROVED is
 * correct, and so is settlement's own precondition that the run be APPROVED
 * before it may be paid — widening that one would permit paying twice. A guard
 * that flagged those would be switched off by the next person to touch it,
 * which is worse than no guard at all.
 */
const SRC = resolve(__dirname, '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return entry.endsWith('.ts') && !entry.includes('.test.') ? [path] : [];
  });
}

/** `status` of the nearest enclosing `payrollRun: { … }` filter, if any. */
function payrollRunStatusFilters(contents: string): string[] {
  const found: string[] = [];
  const marker = /payrollRun:\s*\{/g;
  for (const match of contents.matchAll(marker)) {
    const window = contents.slice(match.index ?? 0, (match.index ?? 0) + 400);
    const status = window.match(/status:\s*([^,\n]+)/);
    if (status) found.push(status[1].trim());
  }
  return found;
}

describe('payroll run status predicates', () => {
  const files = sourceFiles(SRC).filter(path => /payroll|bpjs|tax|payslip/i.test(path));

  it('finds payrollRun filters to inspect at all', () => {
    // Without this, a broken scan would let the suite pass by having no work.
    const total = files.reduce(
      (sum, file) => sum + payrollRunStatusFilters(readFileSync(file, 'utf8')).length, 0);
    expect(total).toBeGreaterThanOrEqual(5);
  });

  it('never narrows a payrollRun filter to the bare string APPROVED', () => {
    const offenders: string[] = [];
    for (const file of files) {
      const contents = readFileSync(file, 'utf8');
      contents.split('\n').forEach((line, index) => {
        if (!/status:\s*'APPROVED'/.test(line) || line.includes('DISBURSED')) return;
        // Only complain when this line's status belongs to a payrollRun filter.
        const upto = contents.split('\n').slice(0, index + 1).join('\n');
        const lastRun = upto.lastIndexOf('payrollRun:');
        const lastOtherModel = Math.max(
          upto.lastIndexOf('resignations:'), upto.lastIndexOf('leaveRequest.'),
          upto.lastIndexOf('permissionRequest.'), upto.lastIndexOf('businessTrip.'),
          upto.lastIndexOf('payrollRun.updateMany'),
        );
        if (lastRun > lastOtherModel && upto.length - lastRun < 400) {
          offenders.push(`${file.slice(SRC.length + 1)}:${index + 1}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});
