import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedPermissions(): Promise<void> {
  console.log('Seeding permissions...');

  const permissions = [
    // Auth & User Management
    { resource: 'auth', action: 'login', name: 'Login', module: 'auth', code: 'auth:login' },
    { resource: 'auth', action: 'logout', name: 'Logout', module: 'auth', code: 'auth:logout' },
    { resource: 'auth', action: 'impersonate', name: 'Impersonate User', module: 'auth', code: 'auth:impersonate' },
    { resource: 'user', action: 'create', name: 'Create User', module: 'user', code: 'user:create' },
    { resource: 'user', action: 'read', name: 'Read User', module: 'user', code: 'user:read' },
    { resource: 'user', action: 'update', name: 'Update User', module: 'user', code: 'user:update' },
    { resource: 'user', action: 'delete', name: 'Delete User', module: 'user', code: 'user:delete' },

    // RBAC
    { resource: 'rbac', action: 'create', name: 'Create Role', module: 'rbac', code: 'rbac:create' },
    { resource: 'rbac', action: 'read', name: 'Read Role', module: 'rbac', code: 'rbac:read' },
    { resource: 'rbac', action: 'update', name: 'Update Role', module: 'rbac', code: 'rbac:update' },
    { resource: 'rbac', action: 'delete', name: 'Delete Role', module: 'rbac', code: 'rbac:delete' },
    { resource: 'rbac', action: 'assign', name: 'Assign Permissions', module: 'rbac', code: 'rbac:assign' },

    // Organization
    { resource: 'organization', action: 'create', name: 'Create Organization', module: 'organization', code: 'org:create' },
    { resource: 'organization', action: 'read', name: 'Read Organization', module: 'organization', code: 'org:read' },
    { resource: 'organization', action: 'update', name: 'Update Organization', module: 'organization', code: 'org:update' },
    { resource: 'organization', action: 'delete', name: 'Delete Organization', module: 'organization', code: 'org:delete' },

    // Employee
    { resource: 'employee', action: 'create', name: 'Create Employee', module: 'employee', code: 'employee:create' },
    { resource: 'employee', action: 'read', name: 'Read Employee', module: 'employee', code: 'employee:read' },
    { resource: 'employee', action: 'update', name: 'Update Employee', module: 'employee', code: 'employee:update' },
    { resource: 'employee', action: 'delete', name: 'Delete Employee', module: 'employee', code: 'employee:delete' },
    { resource: 'employee', action: 'export', name: 'Export Employee', module: 'employee', code: 'employee:export' },

    // Attendance
    { resource: 'attendance', action: 'create', name: 'Create Attendance', module: 'attendance', code: 'att:create' },
    { resource: 'attendance', action: 'read', name: 'Read Attendance', module: 'attendance', code: 'att:read' },
    { resource: 'attendance', action: 'update', name: 'Update Attendance', module: 'attendance', code: 'att:update' },
    { resource: 'attendance', action: 'approve', name: 'Approve Attendance', module: 'attendance', code: 'att:approve' },
    { resource: 'attendance', action: 'export', name: 'Export Attendance', module: 'attendance', code: 'att:export' },

    // Leave
    { resource: 'leave', action: 'create', name: 'Create Leave', module: 'leave', code: 'leave:create' },
    { resource: 'leave', action: 'read', name: 'Read Leave', module: 'leave', code: 'leave:read' },
    { resource: 'leave', action: 'update', name: 'Update Leave', module: 'leave', code: 'leave:update' },
    { resource: 'leave', action: 'approve', name: 'Approve Leave', module: 'leave', code: 'leave:approve' },
    { resource: 'leave', action: 'export', name: 'Export Leave', module: 'leave', code: 'leave:export' },

    // Payroll
    { resource: 'payroll', action: 'create', name: 'Create Payroll', module: 'payroll', code: 'payroll:create' },
    { resource: 'payroll', action: 'read', name: 'Read Payroll', module: 'payroll', code: 'payroll:read' },
    { resource: 'payroll', action: 'update', name: 'Update Payroll', module: 'payroll', code: 'payroll:update' },
    { resource: 'payroll', action: 'approve', name: 'Approve Payroll', module: 'payroll', code: 'payroll:approve' },
    { resource: 'payroll', action: 'export', name: 'Export Payroll', module: 'payroll', code: 'payroll:export' },
    { resource: 'payroll', action: 'process', name: 'Process Payroll', module: 'payroll', code: 'payroll:process' },

    // Benefit
    { resource: 'benefit', action: 'create', name: 'Create Benefit Plan', module: 'benefit', code: 'benefit:create' },
    { resource: 'benefit', action: 'read', name: 'Read Benefit Plan', module: 'benefit', code: 'benefit:read' },
    { resource: 'benefit', action: 'update', name: 'Update Benefit Plan', module: 'benefit', code: 'benefit:update' },
    { resource: 'benefit', action: 'delete', name: 'Delete Benefit Plan', module: 'benefit', code: 'benefit:delete' },

    // Performance
    { resource: 'performance', action: 'create', name: 'Create Review', module: 'performance', code: 'performance:create' },
    { resource: 'performance', action: 'read', name: 'Read Review', module: 'performance', code: 'performance:read' },
    { resource: 'performance', action: 'update', name: 'Update Review', module: 'performance', code: 'performance:update' },
    { resource: 'performance', action: 'approve', name: 'Approve Review', module: 'performance', code: 'performance:approve' },

    // Training / LMS
    { resource: 'training', action: 'create', name: 'Create Course', module: 'training', code: 'training:create' },
    { resource: 'training', action: 'read', name: 'Read Course', module: 'training', code: 'training:read' },
    { resource: 'training', action: 'update', name: 'Update Course', module: 'training', code: 'training:update' },
    { resource: 'training', action: 'delete', name: 'Delete Course', module: 'training', code: 'training:delete' },

    // Recruitment
    { resource: 'recruitment', action: 'create', name: 'Create Requisition', module: 'recruitment', code: 'rec:create' },
    { resource: 'recruitment', action: 'read', name: 'Read Requisition', module: 'recruitment', code: 'rec:read' },
    { resource: 'recruitment', action: 'update', name: 'Update Requisition', module: 'recruitment', code: 'rec:update' },
    { resource: 'recruitment', action: 'approve', name: 'Approve Requisition', module: 'recruitment', code: 'rec:approve' },

    // Dashboard & Reports
    { resource: 'dashboard', action: 'read', name: 'View Dashboard', module: 'dashboard', code: 'dash:read' },
    { resource: 'dashboard', action: 'export', name: 'Export Reports', module: 'dashboard', code: 'dash:export' },
    { resource: 'report', action: 'create', name: 'Create Report', module: 'report', code: 'report:create' },
    { resource: 'report', action: 'read', name: 'Read Report', module: 'report', code: 'report:read' },
    { resource: 'report', action: 'export', name: 'Export Report', module: 'report', code: 'report:export' },

    // Travel & Expense
    { resource: 'travel-expense', action: 'create', name: 'Create Travel Expense Request', module: 'travel-expense', code: 'travel:create' },
    { resource: 'travel-expense', action: 'read', name: 'Read Travel Expense Data', module: 'travel-expense', code: 'travel:read' },
    { resource: 'travel-expense', action: 'update', name: 'Update Travel Expense Data', module: 'travel-expense', code: 'travel:update' },
    { resource: 'travel-expense', action: 'approve', name: 'Approve Travel Expense', module: 'travel-expense', code: 'travel:approve' },
    { resource: 'travel-expense', action: 'process', name: 'Process Reimbursement', module: 'travel-expense', code: 'travel:process' },

    // Workflow Engine
    { resource: 'workflow', action: 'create', name: 'Create Workflow', module: 'workflow', code: 'workflow:create' },
    { resource: 'workflow', action: 'read', name: 'Read Workflow', module: 'workflow', code: 'workflow:read' },
    { resource: 'workflow', action: 'update', name: 'Update Workflow', module: 'workflow', code: 'workflow:update' },
    { resource: 'workflow', action: 'delete', name: 'Delete Workflow', module: 'workflow', code: 'workflow:delete' },
    { resource: 'workflow', action: 'approve', name: 'Approve Workflow Step', module: 'workflow', code: 'workflow:approve' },

    // Settings
    { resource: 'settings', action: 'read', name: 'Read Settings', module: 'settings', code: 'settings:read' },
    { resource: 'settings', action: 'update', name: 'Update Settings', module: 'settings', code: 'settings:update' },
  ];

  for (const perm of permissions) {
    await prisma.permission.upsert({
      where: { code: perm.code },
      update: {},
      create: perm,
    });
  }

  console.log(`  ✓ ${permissions.length} permissions seeded`);
}
