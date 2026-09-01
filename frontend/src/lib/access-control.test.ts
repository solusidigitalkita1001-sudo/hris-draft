import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/services/auth.service';
import { canAccess, hasAllPermissions } from './access-control';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
  id: 'user-1',
  email: 'employee@example.com',
  roles: ['EMPLOYEE'],
  permissions: ['employee:read'],
  companyScope: ['company-1'],
  mustChangePassword: false,
  ...overrides,
});

describe('access control', () => {
  it('denies unauthenticated access', () => {
    expect(canAccess(null, { requireAuth: true })).toBe(false);
  });

  it('requires every declared permission', () => {
    expect(hasAllPermissions(user(), [{ resource: 'employee', action: 'read' }])).toBe(true);
    expect(hasAllPermissions(user(), [
      { resource: 'employee', action: 'read' },
      { resource: 'payroll', action: 'read' },
    ])).toBe(false);
  });

  it('supports wildcard permissions and the super-admin override', () => {
    expect(hasAllPermissions(user({ permissions: ['payroll:*'] }), [{ resource: 'payroll', action: 'disburse' }])).toBe(true);
    expect(canAccess(user({ roles: ['SUPER_ADMIN'], permissions: [] }), {
      requiredRoles: ['COMPANY_ADMIN'],
      requiredPermissions: [{ resource: 'payroll', action: 'disburse' }],
    })).toBe(true);
  });
});
