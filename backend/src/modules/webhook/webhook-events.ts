import { DomainEvents } from '@/shared/events/events';

/**
 * The published webhook catalogue — deliberately a curated subset of
 * DomainEvents, not all of it.
 *
 * Two reasons for curating. Authentication events (logins, token refreshes,
 * lockouts) describe how people get into the system; streaming those to an
 * external endpoint turns a webhook subscription into a security feed, and an
 * integrator almost never needs it. And a published name is a promise: once a
 * customer builds against `payroll.run.approved`, that name and its payload
 * shape cannot change casually, so the list should contain only events worth
 * committing to.
 *
 * Everything here is business fact — something happened to an employee, a
 * payroll run, a job application — and every entry carries `companyId` in its
 * data, which is what the fan-out uses to find the right tenant.
 */
export const WEBHOOK_EVENTS: string[] = [
  DomainEvents.PAYROLL_RUN_CREATED,
  DomainEvents.PAYROLL_RUN_APPROVED,
  DomainEvents.BENEFIT_ENROLLMENT_CREATED,
  DomainEvents.BRANCH_CREATED,
  DomainEvents.DEPARTMENT_CREATED,
  DomainEvents.POSITION_CREATED,
];

/**
 * Events an integrator will reasonably expect and which this catalogue does
 * NOT yet carry, with why each is more than a one-line addition. They are
 * listed here rather than in the catalogue because advertising a name that
 * never fires is worse than not advertising it: a subscriber builds against
 * it, receives silence, and has no way to tell that from "nothing happened".
 *
 * - employee.created / .updated / .terminated / .resigned — `employee.service`
 *   publishes nothing at all today; it has no event bus wired in. The hooks
 *   belong on create, update and the status transition, each needing a payload
 *   that carries `companyId` for the tenant fan-out.
 * - payroll.run.disbursed — settlement writes the status inside a transaction
 *   (`payroll-payment-settlement.ts`). Publishing from there would emit for a
 *   payment that then rolls back, so this one waits on the transactional
 *   outbox already on the backlog rather than being bolted on.
 * - application.submitted / .status_changed / interview.scheduled /
 *   review.approved / enrollment.completed — recruitment, performance and
 *   training have no publish points yet.
 *
 * `webhook-catalogue.test.ts` fails if an entry above is moved into the
 * catalogue without a publisher, so the two cannot drift apart again.
 */
export const WEBHOOK_EVENTS_PENDING_PUBLISHERS: string[] = [
  DomainEvents.EMPLOYEE_CREATED,
  DomainEvents.EMPLOYEE_UPDATED,
  DomainEvents.EMPLOYEE_TERMINATED,
  DomainEvents.EMPLOYEE_RESIGNED,
  DomainEvents.PAYROLL_RUN_DISBURSED,
  DomainEvents.ENROLLMENT_COMPLETED,
  DomainEvents.APPLICATION_SUBMITTED,
  DomainEvents.APPLICATION_STATUS_CHANGED,
  DomainEvents.INTERVIEW_SCHEDULED,
  DomainEvents.REVIEW_APPROVED,
];
