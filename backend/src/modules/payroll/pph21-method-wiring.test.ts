import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The TER calculation is tested in `shared/payroll/ter.test.ts` against the
 * regulation's own worked examples, and the year-end rule in
 * `pph21-annual.test.ts`. What is tested here is the WIRING: that the run
 * reads the method setting, hands the flag to the calculator, and refuses the
 * one combination that would produce a number neither policy means.
 *
 * Asserted against the source because this all happens inside a Serializable
 * transaction that needs a database to stand up; the behavioural proof lives
 * in the MySQL-gated calculation suite, which is the convention this module
 * already follows for guards in `calculatePayroll`.
 */
const service = readFileSync(join(__dirname, 'payroll.service.ts'), 'utf8');
const employeePay = readFileSync(
  join(__dirname, '..', '..', 'shared', 'payroll', 'employee-pay.ts'), 'utf8',
);
/** Comments are stripped: prose naming a key is not a read of it. */
const code = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const serviceCode = code(service);
const employeePayCode = code(employeePay);

describe('the PPh 21 withholding method reaches the calculation', () => {
  it('reads the pph21_method setting', () => {
    expect(serviceCode).toContain("key: 'pph21_method'");
    expect(serviceCode).toMatch(/useTer\s*=\s*methodSetting\?\.value === 'TER'/);
  });

  it('passes the flag to calculateEmployeePay rather than computing twice', () => {
    // Anchored to the call site on purpose. A bare /^\s*useTer,$/ also matches
    // the argument to shouldReconcileAnnualTax, so removing the pass-through
    // left that assertion green — the setting would have been read, stored and
    // ignored, which is the defect class this codebase keeps producing.
    expect(serviceCode).toMatch(/prorationFactor: slice\.fraction,\s*\n\s*useTer,/);
    expect(employeePayCode).toMatch(/const monthlyTax = policy\.useTer/);
  });

  it('decides the year-end settlement through the shared rule, not an inline condition', () => {
    expect(serviceCode).toMatch(/shouldReconcileAnnualTax\(\{/);
    expect(serviceCode).toContain('optedIn: reconciliationSetting?.value === \'true\'');
    // An inline `isFinalPeriodOfYear && optedIn` would reintroduce the bug
    // where TER could run a whole year without ever settling.
    expect(serviceCode).not.toMatch(/reconcileAnnualTax\s*=\s*reconciliationSetting/);
  });

  it('refuses TER together with gross-up, in both the run and the calculator', () => {
    expect(serviceCode).toMatch(/if \(useTer && taxAllowanceComponent\)/);
    expect(employeePayCode).toMatch(/if \(policy\.useTer && grossUp\)/);
  });

  it('leaves the annualized method as the default', () => {
    const settings = code(readFileSync(
      join(__dirname, '..', 'company-settings', 'company-settings.service.ts'), 'utf8',
    ));
    expect(settings).toMatch(/pph21_method: 'ANNUALIZED'/);
    // Switching withholding method changes take-home pay for everyone, so it
    // must never become a side effect of deploying.
    expect(settings).not.toMatch(/pph21_method: 'TER'/);
  });
});
