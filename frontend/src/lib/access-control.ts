import type { AuthUser } from '@/services/auth.service';

export interface PermissionRequirement {
  resource: string;
  action: string;
}

export interface AccessRule {
  requireAuth?: boolean;
  requiredPermissions?: PermissionRequirement[];
  requiredRoles?: string[];
}

export const EMPLOYEE_SELF_SERVICE_ROLES = [
  'GROUP_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
  'HR_STAFF',
  'MANAGER',
  'EMPLOYEE',
];

export const OPERATIONAL_ROLES = [
  'GROUP_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
  'HR_STAFF',
  'MANAGER',
];

export const ADMIN_ROLES = [
  'GROUP_ADMIN',
  'COMPANY_ADMIN',
  'HR_MANAGER',
];

export function hasAnyRole(user: AuthUser | null | undefined, roles: string[]) {
  if (!user) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;
  return roles.some((role) => user.roles.includes(role));
}

export function hasAllPermissions(
  user: AuthUser | null | undefined,
  permissions: PermissionRequirement[]
) {
  if (!user) return false;
  if (user.roles.includes('SUPER_ADMIN')) return true;

  return permissions.every(({ resource, action }) => {
    const required = `${resource}:${action}`;
    return user.permissions.includes(required) || user.permissions.includes(`${resource}:*`);
  });
}

export function canAccess(user: AuthUser | null | undefined, rule?: AccessRule) {
  if (!rule) {
    return !!user;
  }

  if (rule.requireAuth && !user) {
    return false;
  }

  if (!user) {
    return false;
  }

  if (user.roles.includes('SUPER_ADMIN')) {
    return true;
  }

  if (rule.requiredRoles?.length && !hasAnyRole(user, rule.requiredRoles)) {
    return false;
  }

  if (rule.requiredPermissions?.length && !hasAllPermissions(user, rule.requiredPermissions)) {
    return false;
  }

  return true;
}
