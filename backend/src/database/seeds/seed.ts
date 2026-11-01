import { PrismaClient } from '@prisma/client';
import { seedPermissions } from './modules/01-permissions.seed';
import { seedRoles } from './modules/02-roles.seed';
import { seedRolePermissions } from './modules/03-role-permissions.seed';
import { seedAdminUser } from './modules/04-admin-user.seed';
import { seedTestData } from './modules/05-test-data.seed';
import { seedWorkflowDefaults } from './modules/06-workflow-defaults.seed';
import { seedPayrollReferences } from './modules/07-payroll-reference-tables.seed';
import { runInSystemContext } from '@/shared/context/RequestContext';
import { assertTestDataSeedAllowed, ProductionTestDataSeedError } from './modules/test-data-guard';

const prisma = new PrismaClient();

async function seedAll(): Promise<void> {
  console.log('\n========================================');
  console.log('  HRMS Enterprise - Database Seed');
  console.log('========================================\n');

  // Run core seeds
  await seedPermissions();
  await seedRoles();
  await seedRolePermissions();
  await seedAdminUser();

  // Run test data (toggle with SKIP_TEST_DATA env var). S-M2: this demo data
  // (shared Employee123! password, admin@hrms.com login shown in the output)
  // must never land in a production database, so it is hard-refused there —
  // the refusal is caught so the rest of the seed (already-run admin/roles,
  // and the workflow/payroll seeds below) still completes.
  if (!process.env.SKIP_TEST_DATA) {
    try {
      assertTestDataSeedAllowed();
      await seedTestData();
    } catch (err) {
      if (err instanceof ProductionTestDataSeedError) {
        console.warn(`\n  ⚠ ${err.message}\n`);
      } else {
        throw err;
      }
    }
  }

  // Seed default workflow templates for all companies
  await seedWorkflowDefaults();

  // Seed payroll reference tables (TaxBracket, PtkpTable, BpjsReference defaults 2024)
  await seedPayrollReferences(prisma);

  console.log('\n========================================');
  console.log('  ✓ Database seeding completed!');
  console.log('========================================\n');
}

async function main(): Promise<void> {
  return runInSystemContext('database-seed', seedAll);
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
