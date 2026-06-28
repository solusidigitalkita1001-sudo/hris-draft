import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRolePermissions(): Promise<void> {
  console.log('Seeding role-permission assignments...');

  // Get all roles and permissions
  const roles = await prisma.role.findMany();
  const permissions = await prisma.permission.findMany();

  const roleMap = new Map(roles.map((r) => [r.code, r.id]));
  const permMap = new Map(permissions.map((p) => [p.code, p.id]));

  // SUPER_ADMIN - all permissions
  const superAdminId = roleMap.get('SUPER_ADMIN')!;
  const allPermIds = permissions.map((p) => p.id);
  await assignPermissionsToRole(superAdminId, allPermIds);

  // GROUP_ADMIN - almost all except super admin specific
  const groupAdminId = roleMap.get('GROUP_ADMIN')!;
  const groupAdminPerms = permissions
    .filter((p) => !['auth:impersonate'].includes(p.code))
    .map((p) => p.id);
  await assignPermissionsToRole(groupAdminId, groupAdminPerms);

  // COMPANY_ADMIN
  const companyAdminId = roleMap.get('COMPANY_ADMIN')!;
  const companyAdminPerms = permissions
    .filter((p) =>
      [
        'user:create', 'user:read', 'user:update',
        'employee:create', 'employee:read', 'employee:update', 'employee:delete', 'employee:export',
        'org:create', 'org:read', 'org:update',
        'att:read', 'att:approve', 'att:export',
        'leave:read', 'leave:approve', 'leave:export',
        'payroll:read', 'payroll:approve', 'payroll:export',
        'benefit:create', 'benefit:read', 'benefit:update', 'benefit:delete',
        'performance:create', 'performance:read', 'performance:update', 'performance:approve',
        'training:create', 'training:read', 'training:update', 'training:delete',
        'rbac:read',
        'dash:read', 'dash:export',
        'report:create', 'report:read', 'report:export',
        'travel:create', 'travel:read', 'travel:update', 'travel:approve', 'travel:process',
        'workflow:create', 'workflow:read', 'workflow:update', 'workflow:delete', 'workflow:approve',
        'settings:read', 'settings:update',
      ].includes(p.code)
    )
    .map((p) => p.id);
  await assignPermissionsToRole(companyAdminId, companyAdminPerms);

  // HR_MANAGER
  const hrManagerId = roleMap.get('HR_MANAGER')!;
  const hrManagerPerms = permissions
    .filter((p) =>
      [
        'employee:create', 'employee:read', 'employee:update', 'employee:export',
        'org:read',
        'att:read', 'att:approve', 'att:export',
        'leave:read', 'leave:approve', 'leave:export',
        'payroll:read', 'payroll:export',
        'benefit:read',
        'performance:create', 'performance:read', 'performance:update',
        'training:create', 'training:read', 'training:update',
        'rec:create', 'rec:read', 'rec:update', 'rec:approve',
        'dash:read',
        'report:create', 'report:read', 'report:export',
        'travel:create', 'travel:read', 'travel:update', 'travel:approve', 'travel:process',
        'workflow:create', 'workflow:read', 'workflow:update', 'workflow:approve',
      ].includes(p.code)
    )
    .map((p) => p.id);
  await assignPermissionsToRole(hrManagerId, hrManagerPerms);

  // HR_STAFF
  const hrStaffId = roleMap.get('HR_STAFF')!;
  const hrStaffPerms = permissions
    .filter((p) =>
      [
        'employee:create', 'employee:read', 'employee:update',
        'org:read',
        'att:read',
        'leave:read',
        'travel:create', 'travel:read',
        'workflow:read',
      ].includes(p.code)
    )
    .map((p) => p.id);
  await assignPermissionsToRole(hrStaffId, hrStaffPerms);

  // MANAGER
  const managerId = roleMap.get('MANAGER')!;
  const managerPerms = permissions
    .filter((p) =>
      [
        'employee:read',
        'org:read',
        'att:read', 'att:approve',
        'leave:read', 'leave:approve',
        'dash:read',
        'travel:create', 'travel:read', 'travel:approve', 'travel:process',
        'workflow:read', 'workflow:approve',
      ].includes(p.code)
    )
    .map((p) => p.id);
  await assignPermissionsToRole(managerId, managerPerms);

  // EMPLOYEE
  const employeeId = roleMap.get('EMPLOYEE')!;
  const employeePerms = permissions
    .filter((p) =>
      [
        'employee:read',
        'org:read',
        'att:read',
        'leave:read',
        'travel:create', 'travel:read',
        'workflow:read',
      ].includes(p.code)
    )
    .map((p) => p.id);
  await assignPermissionsToRole(employeeId, employeePerms);

  console.log('  ✓ Role-permission assignments completed');
}

async function assignPermissionsToRole(roleId: string, permissionIds: string[]) {
  await prisma.rolePermission.deleteMany({ where: { roleId } });

  if (permissionIds.length > 0) {
    await prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        roleId,
        permissionId,
      })),
    });
  }
}
