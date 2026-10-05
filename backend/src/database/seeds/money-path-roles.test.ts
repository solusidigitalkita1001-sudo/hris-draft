import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The three steps that move payroll money are deliberately separated in code:
 * `payroll.service.ts` refuses an approver who created the run, and
 * `payroll-payment-settlement.ts` refuses a disburser who approved it. That
 * separation is only reachable if the seeded roles actually hold the three
 * permissions between them.
 *
 * They did not. `payroll:process` and `payroll:disburse` were held by NO role
 * at all, so creating a run and releasing a payment were possible only as
 * SUPER_ADMIN, which bypasses every permission check (`Authorize.ts:35`). For
 * a product sold to other companies that means each tenant operating payroll
 * through the platform super-admin account, and the separation of duties
 * reduced to one account doing two of the three steps.
 *
 * Asserted against the seed source rather than a live database: what is being
 * checked is the intent the seed encodes, and it has to fail in CI before a
 * tenant discovers it.
 */
const SEEDS = join(__dirname, 'modules');
const rolePerms = readFileSync(join(SEEDS, '03-role-permissions.seed.ts'), 'utf8');
const roles = readFileSync(join(SEEDS, '02-roles.seed.ts'), 'utf8');
const testData = readFileSync(join(SEEDS, '05-test-data.seed.ts'), 'utf8');

/** The permission list literal for one role block. */
function blockFor(role: string): string {
  const start = rolePerms.indexOf(`roleMap.get('${role}')`);
  expect(start).toBeGreaterThan(-1);
  return rolePerms.slice(start, start + 2500);
}

describe('the payroll money path is reachable without the super-admin', () => {
  it.each([
    ['payroll:process', 'HR_MANAGER'],
    ['payroll:approve', 'COMPANY_ADMIN'],
    ['payroll:disburse', 'FINANCE'],
  ])('%s is held by %s', (permission, role) => {
    expect(blockFor(role)).toContain(`'${permission}'`);
  });

  it('keeps the three steps in three different roles', () => {
    // If one role held two of them, the code-level separation would be
    // satisfiable only by also having a second account — which is the state
    // this test exists to prevent returning to.
    const finance = blockFor('FINANCE');
    expect(finance).not.toContain("'payroll:process'");
    expect(finance).not.toContain("'payroll:approve'");
    expect(blockFor('HR_MANAGER')).not.toContain("'payroll:disburse'");
  });

  it('defines the FINANCE role at company scope', () => {
    expect(roles).toContain("code: 'FINANCE'");
    expect(roles.slice(roles.indexOf("code: 'FINANCE'") - 200, roles.indexOf("code: 'FINANCE'") + 300))
      .toContain("scope: 'COMPANY'");
  });

  it('seeds somebody holding FINANCE, so the path can actually be walked', () => {
    // A role nobody holds is a definition, not a capability.
    expect(testData).toMatch(/roleCode: 'FINANCE'/);
  });
});
