import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './modules/01-permissions.seed';
import { seedRoles } from './modules/02-roles.seed';
import { seedRolePermissions } from './modules/03-role-permissions.seed';
import { seedAdminUser } from './modules/04-admin-user.seed';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('\n========================================');
  console.log('  HRMS Enterprise - Database Seed');
  console.log('========================================\n');

  // Run seeds in order
  await seedPermissions();
  await seedRoles();
  await seedRolePermissions();
  await seedAdminUser();

  console.log('\n========================================');
  console.log('  ✓ Database seeding completed!');
  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
