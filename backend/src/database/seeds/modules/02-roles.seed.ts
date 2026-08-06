import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedRoles(): Promise<void> {
  console.log('Seeding roles...');

  const roles = [
    {
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      description: 'Full system access - all companies, all groups',
      scope: 'GLOBAL' as const,
      isSystem: true,
      priority: 1,
    },
    {
      name: 'Group Admin',
      code: 'GROUP_ADMIN',
      description: 'Administrator for a company group (holding)',
      scope: 'GROUP' as const,
      isSystem: true,
      priority: 2,
    },
    {
      name: 'Company Admin',
      code: 'COMPANY_ADMIN',
      description: 'Administrator for a single company',
      scope: 'COMPANY' as const,
      isSystem: true,
      priority: 3,
    },
    {
      name: 'HR Manager',
      code: 'HR_MANAGER',
      description: 'HR department manager',
      scope: 'COMPANY' as const,
      isSystem: true,
      priority: 4,
    },
    {
      name: 'HR Staff',
      code: 'HR_STAFF',
      description: 'HR department staff member',
      scope: 'COMPANY' as const,
      isSystem: true,
      priority: 5,
    },
    {
      name: 'Manager',
      code: 'MANAGER',
      description: 'Department manager with approval authority',
      scope: 'COMPANY' as const,
      isSystem: true,
      priority: 6,
    },
    {
      name: 'Employee',
      code: 'EMPLOYEE',
      description: 'Regular employee - self service access',
      scope: 'COMPANY' as const,
      isSystem: true,
      priority: 7,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {
        name: role.name,
        description: role.description,
        scope: role.scope,
        isSystem: role.isSystem,
        priority: role.priority,
        status: 'ACTIVE',
        companyId: null,
        groupId: null,
        deletedAt: null,
      },
      create: role,
    });
  }

  console.log(`  ✓ ${roles.length} roles seeded`);
}
