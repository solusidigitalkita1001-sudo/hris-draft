import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A gate that releases money must recognise the role defined to release it.
 *
 * `EWA_FINANCE_ROLES` listed `FINANCE_STAFF` and `FINANCE_MANAGER` — neither of
 * which this product seeds anywhere — while omitting `FINANCE`, the role that
 * does exist and holds `payroll:disburse`. So the only role built for
 * disbursement could not mark an earned-wage payout paid, while the payroll
 * approver could: the separation of duties inverted for this one payment.
 *
 * Asserted against the source and the seed rather than a live database,
 * because what is being checked is that two files agree about role codes, and
 * it has to fail in CI rather than when a tenant tries to release an advance.
 */
const access = readFileSync(join(__dirname, 'ewa-access.ts'), 'utf8');
const roles = readFileSync(
  join(__dirname, '..', '..', 'database', 'seeds', 'modules', '02-roles.seed.ts'), 'utf8'
);

/** The role codes one exported list literal names. */
function listed(name: string): string[] {
  const start = access.indexOf(`${name} =`);
  expect(start).toBeGreaterThan(-1);
  const literal = access.slice(start, access.indexOf(']', start));
  return [...literal.matchAll(/'([A-Z_]+)'/g)].map((match) => match[1]);
}

describe('the EWA money-release gate', () => {
  it('recognises the seeded FINANCE role', () => {
    expect(listed('EWA_FINANCE_ROLES')).toContain('FINANCE');
  });

  it.each(['EWA_FINANCE_ROLES', 'EWA_HR_ROLES'])('%s names at least one role the seed creates', (name) => {
    // A gate may also list codes a tenant defines for itself, but if NONE of
    // its entries is a role this product ships, the gate is unreachable on a
    // fresh install and nobody can perform the step.
    const shipped = listed(name).filter((code) => roles.includes(`code: '${code}'`));
    expect(shipped.length).toBeGreaterThan(0);
  });
});
