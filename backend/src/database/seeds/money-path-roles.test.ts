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

/**
 * Holding the permission is not the same as being able to reach the route that
 * needs it. FINANCE held `payroll:disburse` while every payment-batch route sat
 * behind a router-level `payroll:process` guard, so the role could not reach a
 * single one of them and disbursement remained a super-admin-only act.
 *
 * This asserts reachability rather than that one guard: for each payment route,
 * everything it demands must be a subset of what the role owning that step is
 * seeded with. A new route that forgets this fails here, and so does a widened
 * router-level guard.
 */
const paymentRoutes = readFileSync(
  join(__dirname, '..', '..', 'modules', 'payroll', 'payroll-payment.routes.ts'), 'utf8'
);

/** Payroll permissions a slice of source demands or grants, in order. */
function payrollPermissions(source: string): string[] {
  return [...source.matchAll(/authorize\(\{\s*resource: 'payroll', action: '(\w+)' \}\)/g)]
    .map((match) => `payroll:${match[1]}`);
}

function seededPayrollPermissions(role: string): string[] {
  const start = rolePerms.indexOf(`roleMap.get('${role}')`);
  expect(start).toBeGreaterThan(-1);
  // Bound at the next role so a long block cannot borrow its neighbour's grants.
  const next = rolePerms.indexOf('roleMap.get(', start + 1);
  const block = rolePerms.slice(start, next === -1 ? undefined : next);
  return [...block.matchAll(/'(payroll:\w+)'/g)].map((match) => match[1]);
}

const firstRoute = paymentRoutes.search(/^router\.(get|post|patch|put|delete)\(/m);
const routerLevel = payrollPermissions(paymentRoutes.slice(0, firstRoute));
const paymentRouteTable = [...paymentRoutes.slice(firstRoute).matchAll(
  /^router\.(get|post|patch|put|delete)\(\n {2}'([^']+)',([\s\S]*?)^\);$/gm
)].map((match) => ({
  route: `${match[1].toUpperCase()} ${match[2]}`,
  requires: [...routerLevel, ...payrollPermissions(match[3])],
}));

/** Which role is expected to perform each step of the payment path. */
const STEP_OWNER: Record<string, string> = {
  'POST /': 'HR_MANAGER',
  'GET /run/:runId': 'FINANCE',
  'GET /:id': 'FINANCE',
  'POST /:id/export': 'FINANCE',
  'PATCH /:id/transactions/:transactionId': 'FINANCE',
  'POST /:id/reconcile': 'FINANCE',
  'POST /:id/cancel': 'HR_MANAGER',
};

describe('every payment-batch route is reachable by the role that owns its step', () => {
  it('found the routes to check', () => {
    expect(firstRoute).toBeGreaterThan(-1);
    expect(paymentRouteTable.map((entry) => entry.route).sort()).toEqual(Object.keys(STEP_OWNER).sort());
  });

  it.each(Object.entries(STEP_OWNER))('%s is walkable by %s', (route, role) => {
    const entry = paymentRouteTable.find((candidate) => candidate.route === route);
    expect(entry).toBeDefined();
    expect(entry?.requires.length).toBeGreaterThan(0);
    expect(seededPayrollPermissions(role)).toEqual(expect.arrayContaining(entry?.requires ?? []));
  });

  it('still keeps releasing money out of the preparer\'s hands', () => {
    const recording = paymentRouteTable.filter((entry) => entry.requires.includes('payroll:disburse'));
    expect(recording.map((entry) => entry.route).sort())
      .toEqual(['PATCH /:id/transactions/:transactionId', 'POST /:id/reconcile']);
    const hrManager = seededPayrollPermissions('HR_MANAGER');
    expect(hrManager).not.toContain('payroll:disburse');
  });
});
