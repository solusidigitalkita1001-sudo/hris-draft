jest.mock('@/shared/database/prisma', () => {
  const makeMockModel = () => ({
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({}),
    createMany: jest.fn().mockResolvedValue({ count: 0 }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    delete: jest.fn().mockResolvedValue({}),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    aggregate: jest.fn().mockResolvedValue({}),
    groupBy: jest.fn().mockResolvedValue([]),
  });

  const internalStore = new Map<string | symbol, any>();

  const prismaMock: any = new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (prop === '$use') return jest.fn();
        if (prop === '$on') return jest.fn();
        if (prop === '$connect') return jest.fn().mockResolvedValue(true);
        if (prop === '$disconnect') return jest.fn().mockResolvedValue(true);
        if (prop === '$transaction')
          return jest.fn().mockImplementation(async (cb: any) => cb(prismaMock));
        if (prop === '$queryRaw') return jest.fn().mockResolvedValue([]);
        if (prop === '$executeRaw') return jest.fn().mockResolvedValue(0);
        if (typeof prop === 'symbol') {
          if (prop === Symbol.iterator) return (undefined as any);
          if (prop === Symbol.toStringTag) return 'PrismaClient';
          return undefined as any;
        }
        if (prop === 'then' || prop === 'catch' || prop === 'finally') {
          return undefined as any;
        }
        if (!internalStore.has(prop)) {
          internalStore.set(prop, makeMockModel());
        }
        return internalStore.get(prop);
      },
      set: (_target, prop, value) => {
        internalStore.set(prop, value);
        return true;
      },
      has: (_target, prop) => {
        return internalStore.has(prop);
      },
    }
  );

  return {
    __esModule: true,
    default: prismaMock,
    prisma: prismaMock,
    prismaRead: prismaMock,
    testDatabaseConnection: jest.fn().mockResolvedValue(true),
    disconnectDatabase: jest.fn().mockResolvedValue(true),
  };
});

import { roleService, permissionService } from '@/modules/rbac/rbac.service';
import prisma from '@/shared/database/prisma';
import { ForbiddenError, ValidationError, NotFoundError } from '@/shared/exceptions/AppError';
import {
  runAs,
  userCompanyA,
  userSuperAdmin,
  COMPANY_A_ID,
  COMPANY_B_ID,
  USER_A_ID,
  USER_B_ID,
  USER_SUPERADMIN_ID,
  clearAllPrismaMocks,
} from '../helpers/setupTestApp';

describe('Administration Access Control (A.7 cross verify — RBAC Role & Permission)', () => {
  beforeEach(() => {
    clearAllPrismaMocks();
  });

  afterEach(() => {
    clearAllPrismaMocks();
  });

  describe('Role cross-company scope', () => {
    it('create role company-scoped dengan companyId B oleh user company A tanpa SUPER → object dibuat', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue(null);
      (jest.spyOn(prisma.role, 'create') as any).mockImplementation((opts: any) =>
        Promise.resolve({
          id: 'role-new',
          ...opts.data,
          isSystem: false,
          code: opts.data.code ?? 'ROLE-TEST',
        })
      );

      const result = await runAs(userCompanyA(), () =>
        roleService.create({
          name: 'Custom Role B',
          companyId: COMPANY_B_ID,
          scope: 'COMPANY',
          description: 'test',
          priority: 10,
        })
      );
      expect(result).toBeDefined();
      expect(result.companyId).toBe(COMPANY_B_ID);
    });

    it('role create scope COMPANY tanpa companyId → ValidationError', async () => {
      await expect(
        runAs(userCompanyA(), () =>
          roleService.create({
            name: 'Tanpa Company',
            scope: 'COMPANY',
            description: 'x',
            priority: 5,
          })
        )
      ).rejects.toThrow(ValidationError);
    });

    it('role create scope GLOBAL tapi ada companyId → ValidationError', async () => {
      await expect(
        runAs(userSuperAdmin(), () =>
          roleService.create({
            name: 'Global salah',
            scope: 'GLOBAL',
            companyId: COMPANY_A_ID,
            description: 'x',
            priority: 5,
          })
        )
      ).rejects.toThrow(ValidationError);
    });

    it('update role ganti companyId dari A ke B → ValidationError (immutable)', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-A-1',
        companyId: COMPANY_A_ID,
        scope: 'COMPANY',
        isSystem: false,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.update('role-A-1', {
            companyId: COMPANY_B_ID,
          })
        )
      ).rejects.toThrow(ValidationError);
    });

    it('update role ganti scope dari COMPANY ke GROUP → ValidationError (immutable)', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-A-2',
        companyId: COMPANY_A_ID,
        scope: 'COMPANY',
        isSystem: false,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.update('role-A-2', {
            scope: 'GROUP',
          })
        )
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('assignPermissions (RoleMenuAccess-like cross-company)', () => {
    it('assignPermissions ke role company B oleh SUPER_ADMIN → allowed (bypass)', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-B-1',
        companyId: COMPANY_B_ID,
        scope: 'COMPANY',
        isSystem: false,
      } as any);
      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { id: 'perm-1' },
        { id: 'perm-2' },
      ] as any);
      jest.spyOn(prisma.rolePermission, 'deleteMany').mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.rolePermission, 'createMany').mockResolvedValue({ count: 2 } as any);
      jest.spyOn(prisma.rolePermission, 'findMany').mockResolvedValue([
        { roleId: 'role-B-1', permissionId: 'perm-1' },
        { roleId: 'role-B-1', permissionId: 'perm-2' },
      ] as any);

      const result = await runAs(userSuperAdmin(), () =>
        roleService.assignPermissions('role-B-1', { permissionIds: ['perm-1', 'perm-2'] })
      );
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
    });

    it('assignPermissions ke role SYSTEM → ValidationError (tidak bisa modify)', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-sys-1',
        companyId: COMPANY_A_ID,
        scope: 'COMPANY',
        isSystem: true,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.assignPermissions('role-sys-1', { permissionIds: ['perm-1'] })
        )
      ).rejects.toThrow(ValidationError);
    });

    it('assignPermissions dengan permission yang tidak ditemukan → NotFoundError', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-A-3',
        companyId: COMPANY_A_ID,
        scope: 'COMPANY',
        isSystem: false,
      } as any);
      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([{ id: 'perm-1' }] as any);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.assignPermissions('role-A-3', {
            permissionIds: ['perm-1', 'perm-UNKNOWN'],
          })
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('assignToUser (GLOBAL scope privilege escalation guard)', () => {
    it('assign GLOBAL-scope role oleh user TANPA GLOBAL role sendiri → ForbiddenError', async () => {
      jest.spyOn(prisma.userRole, 'findFirst').mockResolvedValue(null);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.assignToUser(
            USER_B_ID,
            {
              roleIds: ['role-global-1'],
              scopeType: 'GLOBAL',
            },
            USER_A_ID
          )
        )
      ).rejects.toThrow(ForbiddenError);
    });

    it('assign GLOBAL-scope role oleh user DENGAN GLOBAL role (SUPER_ADMIN) → sukses', async () => {
      jest.spyOn(prisma.userRole, 'findFirst').mockResolvedValue({ id: 'ur-global' } as any);
      jest.spyOn(prisma.role, 'findMany').mockResolvedValue([
        { id: 'role-global-1', scope: 'GLOBAL' },
      ] as any);
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: USER_B_ID,
        employee: null,
      } as any);
      jest.spyOn(prisma.userRole, 'deleteMany').mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.userRole, 'createMany').mockResolvedValue({ count: 1 } as any);

      const result = await runAs(userSuperAdmin(), () =>
        roleService.assignToUser(
          USER_B_ID,
          {
            roleIds: ['role-global-1'],
            scopeType: 'GLOBAL',
          },
          USER_SUPERADMIN_ID
        )
      );
      expect(result).toBeDefined();
    });

    it('assign GLOBAL-scoped role object dengan scopeType COMPANY → ValidationError', async () => {
      jest.spyOn(prisma.userRole, 'findFirst').mockResolvedValue({ id: 'ur-global' } as any);
      jest.spyOn(prisma.role, 'findMany').mockResolvedValue([
        { id: 'role-global-2', scope: 'GLOBAL' },
      ] as any);

      await expect(
        runAs(userSuperAdmin(), () =>
          roleService.assignToUser(
            USER_B_ID,
            {
              roleIds: ['role-global-2'],
              scopeType: 'COMPANY',
              companyId: COMPANY_A_ID,
            },
            USER_SUPERADMIN_ID
          )
        )
      ).rejects.toThrow(ValidationError);
    });

    it('assign role dengan salah satu id tidak ada → NotFoundError', async () => {
      jest.spyOn(prisma.userRole, 'findFirst').mockResolvedValue({ id: 'ur' } as any);
      jest.spyOn(prisma.role, 'findMany').mockResolvedValue([
        { id: 'role-ada', scope: 'COMPANY' },
      ] as any);

      await expect(
        runAs(userSuperAdmin(), () =>
          roleService.assignToUser(
            USER_B_ID,
            {
              roleIds: ['role-ada', 'role-TIDAK-ADA'],
              scopeType: 'COMPANY',
              companyId: COMPANY_A_ID,
            },
            USER_SUPERADMIN_ID
          )
        )
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe('System Role immutability', () => {
    it('delete SYSTEM role → ValidationError', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-sys-del',
        isSystem: true,
        companyId: COMPANY_A_ID,
      } as any);

      await expect(
        runAs(userSuperAdmin(), () => roleService.delete('role-sys-del'))
      ).rejects.toThrow(ValidationError);
    });

    it('update SYSTEM role → ValidationError', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-sys-upd',
        isSystem: true,
        scope: 'COMPANY',
        companyId: COMPANY_A_ID,
      } as any);

      await expect(
        runAs(userCompanyA(), () =>
          roleService.update('role-sys-upd', { name: 'Ganti nama sys' })
        )
      ).rejects.toThrow(ValidationError);
    });

    it('delete non-SYSTEM role oleh SUPER_ADMIN → berhasil (soft delete)', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-nonsys-del',
        isSystem: false,
        companyId: COMPANY_A_ID,
      } as any);
      jest.spyOn(prisma.role, 'update').mockResolvedValue({
        id: 'role-nonsys-del',
        deletedAt: new Date(),
      } as any);

      await expect(
        runAs(userSuperAdmin(), () => roleService.delete('role-nonsys-del'))
      ).resolves.not.toThrow();
    });
  });

  describe('SUPER_ADMIN cross company role management', () => {
    it('SUPER_ADMIN create role GROUP scope dengan groupId → allowed', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue(null);
      (jest.spyOn(prisma.role, 'create') as any).mockImplementation((opts: any) =>
        Promise.resolve({
          id: 'grp-role-' + Date.now(),
          ...opts.data,
          isSystem: false,
          code: opts.data.code ?? 'ROLE-GRP',
        })
      );

      const result = await runAs(userSuperAdmin(), () =>
        roleService.create({
          name: 'Group Admin Role',
          scope: 'GROUP',
          groupId: 'group-1-uuid',
          description: 'cross group',
          priority: 1,
        })
      );
      expect(result).toBeDefined();
      expect(result.scope).toBe('GROUP');
    });

    it('SUPER_ADMIN assignPermissions ke non-system role company B → sukses', async () => {
      jest.spyOn(prisma.role, 'findFirst').mockResolvedValue({
        id: 'role-B-sa',
        companyId: COMPANY_B_ID,
        scope: 'COMPANY',
        isSystem: false,
      } as any);
      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { id: 'p1' },
        { id: 'p2' },
        { id: 'p3' },
      ] as any);
      jest.spyOn(prisma.rolePermission, 'deleteMany').mockResolvedValue({ count: 0 } as any);
      jest.spyOn(prisma.rolePermission, 'createMany').mockResolvedValue({ count: 3 } as any);
      jest.spyOn(prisma.rolePermission, 'findMany').mockResolvedValue([
        { roleId: 'role-B-sa', permissionId: 'p1' },
        { roleId: 'role-B-sa', permissionId: 'p2' },
        { roleId: 'role-B-sa', permissionId: 'p3' },
      ] as any);

      const perms = await runAs(userSuperAdmin(), () =>
        roleService.assignPermissions('role-B-sa', { permissionIds: ['p1', 'p2', 'p3'] })
      );
      expect(perms.length).toBe(3);
    });
  });

  describe('PermissionService (read-only)', () => {
    it('findAll permissions → list (cached)', async () => {
      jest.spyOn(prisma.permission, 'findMany').mockResolvedValue([
        { id: 'p1', name: 'leave:read', module: 'leave' },
        { id: 'p2', name: 'loan:read', module: 'loan' },
      ] as any);

      const result = await runAs(userCompanyA(), () => permissionService.findAll());
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it('findAll by module leave → filter module', async () => {
      (jest.spyOn(prisma.permission, 'findMany') as any).mockImplementation((opts: any) => {
        const where = opts?.where;
        const all = [
          { id: 'p1', name: 'leave:read', module: 'leave' },
          { id: 'p2', name: 'loan:read', module: 'loan' },
        ];
        if (where?.module) {
          return Promise.resolve(all.filter((p) => p.module === where.module));
        }
        return Promise.resolve(all);
      });

      const result = await runAs(userCompanyA(), () => permissionService.findAll('leave'));
      expect(result.length).toBe(1);
      expect(result[0].module).toBe('leave');
    });
  });
});
