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
  DomainEvents.EMPLOYEE_CREATED,
  DomainEvents.EMPLOYEE_UPDATED,
  DomainEvents.EMPLOYEE_TERMINATED,
  DomainEvents.EMPLOYEE_RESIGNED,
  DomainEvents.PAYROLL_RUN_CREATED,
  DomainEvents.PAYROLL_RUN_APPROVED,
  DomainEvents.PAYROLL_RUN_DISBURSED,
  DomainEvents.BENEFIT_ENROLLMENT_CREATED,
  DomainEvents.ENROLLMENT_COMPLETED,
  DomainEvents.APPLICATION_SUBMITTED,
  DomainEvents.APPLICATION_STATUS_CHANGED,
  DomainEvents.INTERVIEW_SCHEDULED,
  DomainEvents.REVIEW_APPROVED,
  DomainEvents.BRANCH_CREATED,
  DomainEvents.DEPARTMENT_CREATED,
  DomainEvents.POSITION_CREATED,
];
