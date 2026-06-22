/**
 * Domain event definitions for the HRMS system
 * Central registry of all domain events
 */

export const DomainEvents = {
  // Auth events
  USER_LOGGED_IN: 'auth.user.logged_in',
  USER_LOGGED_OUT: 'auth.user.logged_out',
  USER_LOCKED: 'auth.user.locked',
  PASSWORD_CHANGED: 'auth.password.changed',
  PASSWORD_RESET_REQUESTED: 'auth.password.reset_requested',
  PASSWORD_RESETTED: 'auth.password.resetted',
  TOKEN_REFRESHED: 'auth.token.refreshed',
  MFA_ENABLED: 'auth.mfa.enabled',
  MFA_DISABLED: 'auth.mfa.disabled',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DEACTIVATED: 'user.deactivated',
  USER_ACTIVATED: 'user.activated',

  // Organization events
  GROUP_CREATED: 'organization.group.created',
  GROUP_UPDATED: 'organization.group.updated',
  GROUP_DELETED: 'organization.group.deleted',
  COMPANY_CREATED: 'organization.company.created',
  COMPANY_UPDATED: 'organization.company.updated',
  COMPANY_DELETED: 'organization.company.deleted',
  BRANCH_CREATED: 'organization.branch.created',
  BRANCH_UPDATED: 'organization.branch.updated',
  DIVISION_CREATED: 'organization.division.created',
  DEPARTMENT_CREATED: 'organization.department.created',
  POSITION_CREATED: 'organization.position.created',

  // Employee events
  EMPLOYEE_CREATED: 'employee.created',
  EMPLOYEE_UPDATED: 'employee.updated',
  EMPLOYEE_TERMINATED: 'employee.terminated',
  EMPLOYEE_RESIGNED: 'employee.resigned',

  // RBAC events
  ROLE_CREATED: 'rbac.role.created',
  ROLE_UPDATED: 'rbac.role.updated',
  ROLE_DELETED: 'rbac.role.deleted',
  PERMISSION_ASSIGNED: 'rbac.permission.assigned',
  ROLE_ASSIGNED: 'rbac.role.assigned',

  // Audit events
  SENSITIVE_DATA_ACCESSED: 'audit.sensitive_data_accessed',
  DATA_EXPORTED: 'audit.data_exported',
} as const;
