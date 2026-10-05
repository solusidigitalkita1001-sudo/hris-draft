import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GAP-29 named five standard reports. Four were real; leave *balance* was
 * missing — the existing `/leave` report sums days taken over a range, which
 * answers a different question and cannot say who is sitting on unused
 * entitlement, the figure HR and the accrual liability both need.
 *
 * Asserted against the route table rather than by booting the app, because
 * what the gap is about is whether the endpoint exists and is guarded.
 */
const routes = readFileSync(join(__dirname, 'reports.routes.ts'), 'utf8');

describe('the five standard reports', () => {
  it.each([
    ['headcount', '/headcount'],
    ['turnover', '/turnover'],
    ['absenteeism', '/attendance'],
    ['payroll summary', '/payroll'],
    ['leave balance', '/leave-balance'],
  ])('exposes the %s report', (_name, path) => {
    expect(routes).toContain(`router.get('${path}'`);
  });

  it('guards every report route, including the summary', () => {
    const unguarded = routes
      .split('\n')
      .filter(line => line.startsWith("router.get('") && !line.includes('authorize('))
      .map(line => line.slice(0, 40));

    // `/summary` used to be the exception, returning company-wide figures to
    // anyone with company access.
    expect(unguarded).toEqual([]);
  });

  it('offers the payroll report a department dimension', () => {
    expect(routes).toContain("router.get('/payroll'");
    const dto = readFileSync(join(__dirname, 'reports.dto.ts'), 'utf8');
    expect(dto).toContain('byDepartment');
  });
});
