import { PrismaClient } from '@prisma/client';
import { passwordHandler } from '@/shared/security/PasswordHandler';

const prisma = new PrismaClient();

export async function seedAdminUser(): Promise<void> {
  console.log('Seeding admin user...');

  const adminEmail = 'admin@hrms.com';
  const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });

  if (existingUser) {
    console.log('  ✓ Admin user already exists, skipping');
    return;
  }

  const passwordHash = await passwordHandler.hash('Admin123!');

  const user = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: false,
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
  console.log('  ✓ Default password: Admin123!');
  console.log('  ⚠  CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION!');
}
