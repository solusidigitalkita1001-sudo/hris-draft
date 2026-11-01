import { PrismaClient } from '@prisma/client';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { resolveAdminPassword } from './admin-password';

const prisma = new PrismaClient();

export async function seedAdminUser(): Promise<void> {
  console.log('Seeding admin user...');

  const adminEmail = 'admin@hrms.com';
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingUser) {
    console.log('  ✓ Admin user already exists, skipping');
    console.log('  ⚠  existing admin kept; SEED_ADMIN_PASSWORD ignored');
    return;
  }

  const { password, wasGenerated } = resolveAdminPassword();
  const passwordHash = await passwordHandler.hash(password);

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: true,
    },
  });

  // Assign SUPER_ADMIN role
  const superAdminRole = await prisma.role.findUnique({
    where: { code: 'SUPER_ADMIN' },
  });

  if (superAdminRole) {
    await prisma.userRole.create({
      data: {
        userId: user.id,
        roleId: superAdminRole.id,
        scopeType: 'GLOBAL',
      },
    });
  }

  console.log(`  ✓ Admin user created: ${adminEmail}`);
  if (wasGenerated) {
    console.log('  ⚠  SEED_ADMIN_PASSWORD was not set — generated a random password.');
    console.log(`  ⚠  Admin password (shown ONCE, save it now): ${password}`);
    console.log('  ⚠  This password will not be printed again.');
  } else {
    console.log('  ✓ Admin password set from SEED_ADMIN_PASSWORD env var.');
  }
  // Fix-review M6: mustChangePassword is a flag the UI reads to show a
  // change-password notice after login — there is no server-side middleware
  // gate that blocks other requests until it changes, so this must not claim
  // the user is "forced" to change it.
  console.log('  ✓ mustChangePassword is set — the UI will show a change-password notice on next login.');
}
