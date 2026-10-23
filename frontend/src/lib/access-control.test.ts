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

  it('hides employee-only pages from an account with no employee record', () => {
    // Super admin tanpa data karyawan bukan kurang wewenang — ia memang tidak
    // punya slip gaji. Dulu menu tetap tampil lalu halamannya menjawab 400.
    const rule = { requireAuth: true, requireEmployee: true, requiredRoles: ['EMPLOYEE'] };
    expect(canAccess(user({ roles: ['SUPER_ADMIN'], employeeId: undefined }), rule)).toBe(false);
    expect(canAccess(user({ employeeId: 'emp-1' }), rule)).toBe(true);
  });

  it('supports wildcard permissions and the super-admin override', () => {
    expect(hasAllPermissions(user({ permissions: ['payroll:*'] }), [{ resource: 'payroll', action: 'disburse' }])).toBe(true);
    expect(canAccess(user({ roles: ['SUPER_ADMIN'], permissions: [] }), {
      requiredRoles: ['COMPANY_ADMIN'],
      requiredPermissions: [{ resource: 'payroll', action: 'disburse' }],
    })).toBe(true);
  });
});
