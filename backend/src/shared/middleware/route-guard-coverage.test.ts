import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Every route that mutates data must be guarded, and this checks it by reading
 * the routers rather than by review.
 *
 * An audit of all 333 mutating routes found no unguarded one, but every bit of
 * that is convention: nothing stops the next `router.post` from shipping with
 * no guard, and nothing would fail. The same reasoning produced
 * tenant-scope-coverage.test.ts, and for the same reason — a gap here is not a
 * style problem, it is an authorisation problem.
 *
 * A route counts as guarded when any of these is true:
 *
 *   1. It carries a guard itself — `authorize`, `authorizeRole`,
 *      `authorizeOwnership`, or a module-local wrapper whose name begins with
 *      `authorize` (payroll-formula has `authorizeSimulation`, which picks
 *      `payroll:approve` or `payroll:update` from the caller's permissions).
 *   2. Its router applies one once with `router.use`, as payroll-payment does
 *      with `authorize({ resource: 'payroll', action: 'process' })`.
 *   3. It appears in SELF_SERVICE below, because the action is bounded to the
 *      caller and a permission check could only ever compare someone with
 *      themselves.
 *
 * The third case is the one that needs care, so each entry carries its reason
 * and the list is checked for staleness: an entry naming a route that no longer
 * exists fails, so a renamed route cannot keep an exemption it no longer
 * deserves.
 */

const MODULES = join(__dirname, '..', '..', 'modules');

/** Guards applied per route or via router.use. `authoriz` also covers wrappers. */
const GUARD = /\bauthoriz|\brequireSuperAdmin\b|\brequireCompanyPayrollAccess\b|\brequireGroupAccess\b|\bdeviceAuth\b|\bauthenticateDevice\b/;

/**
 * Routes that hold no permission guard because they act only on the caller's
 * own record. Each was read to confirm the actor comes from the session — via
 * `req.user`, the request context, or a controller helper such as
 * `getEmployeeId(req)` / `actor(req)` — and never from the path or body.
 */
const SELF_SERVICE: Record<string, string> = {
  // Anonymous by necessity: there is no session yet.
  'auth/auth.routes.ts POST /login': 'Authentication itself; no session exists to check.',
  'auth/auth.routes.ts POST /refresh': 'Presents a refresh token, which is the credential.',
  'auth/auth.routes.ts POST /forgot-password': 'Anonymous by design; rate limited.',
  'auth/auth.routes.ts POST /reset-password': 'Authorised by the emailed token, not by a role.',
  'auth/auth.routes.ts POST /logout': 'Revokes the presented token family.',

  // Own account.
  'auth/auth.routes.ts POST /change-password': 'Changes the calling user\'s own password.',
  'auth/auth.routes.ts POST /mfa/setup': 'Enrols the caller\'s own second factor.',
  'auth/auth.routes.ts POST /mfa/enable': 'Enables the caller\'s own second factor.',
  'auth/auth.routes.ts POST /mfa/disable': 'Disables the caller\'s own second factor.',
  'auth/auth.routes.ts DELETE /sessions/:id': 'Revokes one of the caller\'s own sessions.',

  // Own attendance.
  'attendance/attendance.routes.ts POST /me/check-in': 'Records the caller\'s own attendance.',
  'attendance/attendance.routes.ts PATCH /me/check-out': 'Closes the caller\'s own attendance.',
  'attendance/attendance-correction.routes.ts POST /': 'Files a correction for the caller; approval is separately authorised.',

  // Own requests: filing and withdrawing. Approving them is authorised.
  'employee-loan/employee-loan.routes.ts POST /': 'Applies for a loan as the caller.',
  'employee-loan/employee-loan.routes.ts PATCH /:id/cancel': 'Withdraws the caller\'s own pending application.',
  'leave/leave.routes.ts PATCH /:id/cancel': 'Withdraws the caller\'s own leave request and refunds their balance.',
  'permission-request/permission-request.routes.ts POST /': 'Files a permission request as the caller.',
  'permission-request/permission-request.routes.ts POST /attachments': 'Attaches evidence to the caller\'s own request.',
  'permission-request/permission-request.routes.ts PATCH /:id/cancel': 'Scoped by the caller\'s employee id, claimed conditionally.',
  'work-calendar/work-calendar.routes.ts POST /shift-swaps': 'Proposes a swap of the caller\'s own shift.',
  'work-calendar/work-calendar.routes.ts PATCH /shift-swaps/:requestId/cancel': 'Withdraws the caller\'s own proposal.',

  // Deciding a shift swap is an approver action, but the approver is verified
  // by the workflow engine rather than by a permission: applyAction refuses
  // anyone who is not the assigned approver, the assigned role, a super admin,
  // or an active delegate, and separately refuses the requester, the employee
  // the request is about, and anyone who already acted on an earlier level.
  'work-calendar/work-calendar.routes.ts PATCH /shift-swaps/:requestId/approve': 'Approver identity enforced by workflowEngine.applyAction.',
  'work-calendar/work-calendar.routes.ts PATCH /shift-swaps/:requestId/reject': 'Approver identity enforced by workflowEngine.applyAction.',

  // Delegating one's own authority. The repository refuses self-delegation, an
  // inactive delegate, and a delegate outside the caller's company; revoking
  // is scoped to the delegator.
  'workflow-engine/workflow-engine.routes.ts POST /delegations': 'The delegator is always the caller; the delegate is validated in-company.',
  'workflow-engine/workflow-engine.routes.ts PATCH /delegations/:id/revoke': 'Scoped to the caller as delegator.',

  // Own signature, own notifications, own reading, own feedback.
  'document-management/document-management.routes.ts POST /:id/sign': 'Signs as the caller; the signer row must be theirs.',
  'document-management/document-management.routes.ts POST /:id/decline': 'Declines as the caller; the signer row must be theirs.',
  'notification/notification.routes.ts POST /device-tokens': 'Registers a push token for the caller\'s device.',
  'notification/notification.routes.ts DELETE /device-tokens': 'Removes the caller\'s own push token.',
  'notification/notification.routes.ts PUT /read': 'Marks the caller\'s own notifications read.',
  'notification/notification.routes.ts PUT /read-all': 'Marks the caller\'s own notifications read.',
  'notification/notification.routes.ts DELETE /:id': 'Deletes one of the caller\'s own notifications.',
  'announcement/announcement.routes.ts PUT /:id/read': 'Records the caller\'s own read receipt.',
  'training/training.routes.ts POST /enrollments/:id/feedback': 'Submits feedback on the caller\'s own enrolment.',
};

interface Route {
  file: string;
  line: number;
  method: string;
  path: string;
  key: string;
  guarded: boolean;
}

function routeFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry.endsWith('.routes.ts')) out.push(full);
  }
  return out;
}

/**
 * A route registration spans several lines, so lines are joined until the
 * parentheses balance. Reading only the first line would miss guards that sit
 * on their own line, which is how most of them are written.
 */
function parse(file: string, relative: string): Route[] {
  const source = readFileSync(file, 'utf8');
  const lines = source.split('\n');
  const routerGuard = lines.some((line) => line.includes('router.use(') && GUARD.test(line));
  const routes: Route[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!/router\.(post|put|patch|delete)\(/.test(lines[i] as string)) continue;
    let chunk = lines[i] as string;
    let depth = (chunk.match(/\(/g) ?? []).length - (chunk.match(/\)/g) ?? []).length;
    let j = i;
    while (depth > 0 && j + 1 < lines.length) {
      j += 1;
      const next = lines[j] as string;
      chunk += ` ${next.trim()}`;
      depth += (next.match(/\(/g) ?? []).length - (next.match(/\)/g) ?? []).length;
    }
    const matched = /router\.(\w+)\(\s*'([^']*)'/.exec(chunk);
    const method = (matched?.[1] ?? '?').toUpperCase();
    const path = matched?.[2] ?? '?';
    routes.push({
      file: relative,
      line: i + 1,
      method,
      path,
      key: `${relative} ${method} ${path}`,
      guarded: routerGuard || GUARD.test(chunk),
    });
    i = j;
  }
  return routes;
}

const files = routeFiles(MODULES);
const routes = files.flatMap((file) => parse(file, file.slice(MODULES.length + 1)));

describe('every mutating route is guarded', () => {
  /** A rename must not be able to turn this suite into a no-op. */
  it('parsed a plausible number of routers and routes', () => {
    expect(files.length).toBeGreaterThan(25);
    expect(routes.length).toBeGreaterThan(300);
    expect(routes.filter((route) => route.guarded).length).toBeGreaterThan(250);
  });

  it('leaves no mutating route without a guard or a stated reason', () => {
    const unexplained = routes
      .filter((route) => !route.guarded && !(route.key in SELF_SERVICE))
      .map((route) => `${route.file}:${route.line}  ${route.method} ${route.path}`);

    // A new route with no guard lands here. Either give it one, or add it to
    // SELF_SERVICE with the reason it needs none — after checking that its
    // handler takes the actor from the session rather than from the request.
    expect(unexplained).toEqual([]);
  });

  it('holds no stale exemption', () => {
    const live = new Set(routes.map((route) => route.key));
    const stale = Object.keys(SELF_SERVICE).filter((key) => !live.has(key));
    expect(stale).toEqual([]);
  });

  it('exempts nothing that is in fact guarded, so the list stays honest', () => {
    const redundant = routes
      .filter((route) => route.guarded && route.key in SELF_SERVICE)
      .map((route) => route.key);
    expect(redundant).toEqual([]);
  });

  it('gives every exemption a reason worth reading', () => {
    const thin = Object.entries(SELF_SERVICE)
      .filter(([, reason]) => reason.trim().length < 25)
      .map(([key]) => key);
    expect(thin).toEqual([]);
  });
});
